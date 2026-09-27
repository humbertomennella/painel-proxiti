import assert from "node:assert/strict";
import {createServer} from "node:http";
import {readFile,mkdir} from "node:fs/promises";
import {resolve,extname,sep} from "node:path";
import {fileURLToPath} from "node:url";
import {chromium} from "playwright";

const root=resolve(fileURLToPath(new URL("../",import.meta.url)));
const mime={".html":"text/html; charset=utf-8",".js":"application/javascript; charset=utf-8",
 ".css":"text/css; charset=utf-8",".svg":"image/svg+xml"};
const server=createServer(async(req,res)=>{
 try{
   const path=new URL(req.url,"http://localhost").pathname;
   const file=resolve(root,"."+decodeURIComponent(path==="/"?"/index.html":path));
   if(!file.startsWith(root+sep)){res.writeHead(403);res.end();return;}
   const body=await readFile(file);
   res.writeHead(200,{"content-type":mime[extname(file)]||"application/octet-stream","cache-control":"no-store"});
   res.end(body);
 }catch{res.writeHead(404);res.end("Not found");}
});
await new Promise(done=>server.listen(0,"127.0.0.1",done));
const url="http://127.0.0.1:"+server.address().port+"/";
const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
const stamp=new Date().toISOString();
const baseline=[
 {id:"00000000-0000-4000-8000-000000000001",reference:101,customer_name:"Cliente de teste",
  customer_email:"teste@example.invalid",customer_phone:"",subject:"Problema de inicialização",
  description:"Sintoma de teste",status:"new",source:"central",assigned_to:null,created_at:stamp},
 {id:"00000000-0000-4000-8000-000000000002",reference:102,customer_name:"Cliente de teste",
  customer_email:"teste@example.invalid",customer_phone:"",subject:"Verificação de rede",
  description:"Sintoma de teste",status:"in_progress",source:"central",
  assigned_to:"00000000-0000-4000-8000-000000000101",created_at:stamp},
 {id:"00000000-0000-4000-8000-000000000003",reference:103,customer_name:"Cliente de teste",
  customer_email:"teste@example.invalid",customer_phone:"",subject:"Histórico encerrado",
  description:"Sintoma de teste",status:"closed",source:"central",assigned_to:null,created_at:stamp}
];
const messages=baseline.map((t,i)=>({
 id:"00000000-0000-4000-8000-00000000020"+(i+1),
 ticket_id:t.id,sender_kind:"customer",created_at:stamp,body:"Mensagem de teste"
}));
async function openScenario({tickets=baseline,chat=true,failTickets=false,failMessages=false,failReceipts=false,failRead=false,deferReply=false,attachAmbiguous=false,messagesFixture=null,viewer=true,training=false,startView="tickets"}={}){
 const page=await browser.newPage({viewport:{width:375,height:850},deviceScaleFactor:1});
 page.__errors=[];
 page.on("pageerror",error=>page.__errors.push(error.message));
 await page.route("https://cdn.jsdelivr.net/**",route=>route.abort());
 await page.goto(url,{waitUntil:"load",timeout:30000});
 await page.evaluate(({tickets,messages,chat,failTickets,failMessages,failReceipts,failRead,deferReply,attachAmbiguous,viewer,training,startView})=>{
   document.body.classList.add("workspace-mode");
   document.getElementById("auth-screen").hidden=true;
   document.getElementById("panel").hidden=false;
   document.getElementById("workspace").hidden=false;
   document.getElementById("setup").hidden=true;
   const fixture=window.__fixture={
     tickets:structuredClone(tickets),
     messages:structuredClone(messages),
     failTickets,failMessages,failReceipts,failRead,deferReply,attachAmbiguous,
     read:[],staff_presence:[],notes:[],tasks:[],reports:[],attachments:[],devices:[],appointments:[],audit:[],stored:new Map(),calls:[]
   };
   const tables={
     support_tickets:"tickets",support_messages:"messages",
     ticket_read_receipts:"read",staff_presence:"staff_presence",
     ticket_internal_notes:"notes",ticket_tasks:"tasks",ticket_reports:"reports",
     ticket_attachments:"attachments",ticket_devices:"devices",ticket_appointments:"appointments",ticket_audit:"audit"
   };
   const client={
     from(table){
       const filters=[];
       const chain={
         select(){return chain;},
         eq(field,value){filters.push(["eq",field,value]);return chain;},
         gte(field,value){filters.push(["gte",field,value]);return chain;},
         lt(field,value){filters.push(["lt",field,value]);return chain;},
         in(field,values){filters.push(["in",field,values]);return chain;},
         order(field,{ascending=true}={}){(chain.sorts??=[]).push({field,ascending});return chain;},
         limit(limit){chain.max=limit;return chain;},
         maybeSingle(){const result=chain.make();return Promise.resolve({...result,data:result.data?.[0]||null});},
         make(){
           fixture.calls.push(table);
           if(table==="support_tickets"&&fixture.failTickets)return {data:null,error:{message:"Falha de teste na fila"}};
           if(table==="support_messages"&&fixture.failMessages)return {data:null,error:{message:"Falha de teste nas mensagens"}};
           if(table==="ticket_read_receipts"&&fixture.failReceipts)return {data:null,error:{message:"Falha de teste na leitura"}};
           let rows=[...(fixture[tables[table]||table]||[])];
           for(const [kind,field,value]of filters){
             if(kind==="eq")rows=rows.filter(row=>row[field]===value);
             if(kind==="in")rows=rows.filter(row=>value.includes(row[field]));
             if(kind==="gte")rows=rows.filter(row=>row[field]>=value);
             if(kind==="lt")rows=rows.filter(row=>row[field]<value);
           }
           if(chain.sorts)rows.sort((a,b)=>{
             for(const sort of chain.sorts){
               const x=a[sort.field],y=b[sort.field];
               if(x!==y)return (x<y?-1:1)*(sort.ascending?1:-1);
             }
             return 0;
           });
           return {data:chain.max?rows.slice(0,chain.max):rows,error:null};
         },
         then(resolve,reject){return Promise.resolve(chain.make()).then(resolve,reject);}
       };
       return chain;
     },
     rpc(name,args){
       fixture.calls.push(name);
       const target=fixture.tickets.find(row=>row.id===args?.p_ticket);
       const ok=data=>Promise.resolve({data,error:null});
       const error=message=>Promise.resolve({data:null,error:{message}});
       if(name==="proxiti_mark_ticket_read"){
         if(fixture.failRead)return error("Leitura indisponível");
         if(target){
           const current=fixture.read.find(x=>x.ticket_id===target.id);
           const row={ticket_id:target.id,staff_id:"00000000-0000-4000-8000-000000000101",
             first_seen_at:new Date().toISOString(),last_read_customer_at:new Date().toISOString()};
           if(current)Object.assign(current,row);else fixture.read.push(row);
         }
         return ok(null);
       }
       if(name==="proxiti_claim_ticket"){
         if(!target||target.assigned_to||["closed","resolved"].includes(target.status))return ok(false);
         target.assigned_to="00000000-0000-4000-8000-000000000101";
         if(target.status==="new")target.status="triage";
         return ok(true);
       }
       if(name==="proxiti_change_ticket_status"){
         if(!target||target.status==="closed")return error("Chamado encerrado");
         target.status=args.p_status;return ok(null);
       }
       if(name==="proxiti_staff_reply"){
         const commit=()=>{
           fixture.messages.push({id:"staff-"+fixture.messages.length,ticket_id:target.id,
             sender_kind:"staff",created_at:new Date().toISOString(),body:args.p_body});
           return {data:"staff-confirmed",error:null};
         };
         if(fixture.deferReply){
           fixture.deferReply=false;
           return new Promise(resolve=>{fixture.completeReply=()=>resolve(commit());});
         }
         return Promise.resolve(commit());
       }
       if(name==='proxiti_add_ticket_note'){
         fixture.notes.unshift({id:'note-'+fixture.notes.length,ticket_id:target.id,body:args.p_body,created_at:new Date().toISOString()});return ok(null);
       }
       if(name==='proxiti_prepare_ticket_checklist'){
         fixture.tasks.push({id:'task-1',ticket_id:target.id,position:1,title:'Confirmar o problema e a autorização do cliente',state:'pending',note:''});return ok(1);
       }
       if(name==='proxiti_update_ticket_task'){
         const row=fixture.tasks.find(t=>t.id===args.p_task);Object.assign(row,{state:args.p_state,note:args.p_note});return ok(null);
       }
       if(name==='proxiti_save_ticket_device'){
         const row={ticket_id:target.id,category:args.p_category,brand:args.p_brand,model:args.p_model,operating_system:args.p_os,asset_reference:args.p_ref,observations:args.p_observations,updated_at:new Date().toISOString()};
         fixture.devices=fixture.devices.filter(d=>d.ticket_id!==target.id);fixture.devices.push(row);return ok(null);
       }
       if(name==='proxiti_save_ticket_report'){
         fixture.reports.push({id:'report-'+fixture.reports.length,ticket_id:target.id,version:fixture.reports.length+1,diagnosis:args.p_diagnosis,work_performed:args.p_work,recommendations:args.p_recommendations,finalized:args.p_finalized,created_at:new Date().toISOString()});return ok(fixture.reports.length);
       }
       if(name==='proxiti_schedule_appointment'){
         fixture.appointments.push({id:'appointment-1',ticket_id:target.id,title:args.p_title,starts_at:args.p_starts_at,duration_minutes:args.p_duration,modality:args.p_modality,status:'planned'});return ok(null);
       }
       if(name==="proxiti_attach_ticket_file"){
         fixture.attachments.push({id:"attach-"+fixture.attachments.length,ticket_id:target.id,
           storage_path:args.p_path,file_name:args.p_name,byte_size:args.p_size,
           created_at:new Date().toISOString()});
         return fixture.attachAmbiguous?error("Resposta de gravação interrompida"):ok("attachment-created");
       }
       return ok(null);
     },
     channel(){return {on(){return this;},subscribe(callback){callback?.("SUBSCRIBED");return this;}};},
     removeChannel(){return Promise.resolve({});},
     auth:{mfa:{listFactors:async()=>({data:{totp:[]},error:null})}},
     storage:{from(bucket){return {
       createSignedUrl:async()=>({data:null,error:{message:"no avatar fixture"}}),
       upload:async(path,file)=>{fixture.calls.push("storage.upload");
         fixture.stored.set(path,{file,bucket});return {data:{path},error:null};},
       remove:async(paths)=>{fixture.calls.push("storage.remove");
         paths.forEach(path=>fixture.stored.delete(path));return {data:paths,error:null};},
       download:async path=>fixture.stored.has(path)?
         {data:new Blob(["example"]),error:null}:{data:null,error:{message:"missing"}}
     };}}
   };
   const user={id:"00000000-0000-4000-8000-000000000101",email:"teste@example.invalid"};
   const profile={status:"active",role:"technician",display_name:"Técnico de teste",
     permissions:{tickets_view:viewer,chat,tickets_claim:viewer,training:training||!viewer,resources:false}};
   const session={client,user,profile};
   if(startView!=="tickets")sessionStorage.setItem("proxiti-work-v3-"+user.id+"-view",startView);
   window.PROXITI_ACTIVE_SESSION=session;
   document.dispatchEvent(new CustomEvent("proxiti-session-ready",{detail:session}));
 },{tickets,messages:messagesFixture??(tickets===baseline?messages:[]),chat,failTickets,failMessages,failReceipts,failRead,deferReply,attachAmbiguous,viewer,training,startView});
 await page.waitForFunction(()=>["ready","partial","error","restricted"].includes(
   document.getElementById("overview-sync-state").dataset.phase),{timeout:12000});
 return page;
}
function test(name,fn){return fn().then(()=>console.log("PASS: "+name));}
async function visit(page,ref){
 await page.evaluate(()=>window.PROXITI_OPEN_VIEW("tickets"));
 if(await page.isVisible("#ticket-queue-toggle")&&await page.locator("#ticket-list-pane").getAttribute("data-mobile-collapsed")==="true")
  await page.click("#ticket-queue-toggle");
 await page.locator(".ticket-inbox-card").filter({hasText:"#"+ref+" ·"}).click();
 await page.waitForFunction(ref=>document.getElementById("ticket-code").textContent.includes("#"+ref),ref);
 await page.locator(".ticket-context-details").evaluate(el=>el.open=true);
}
try{
 await test("Assumir atendimento em curso preserva situação",async()=>{
  const tickets=structuredClone(baseline);tickets[1].assigned_to=null;
  const page=await openScenario({tickets});
  try{
   await visit(page,102);await page.click("#claim-ticket");
   await page.waitForFunction(()=>window.__fixture.tickets[1].assigned_to?.endsWith("101")===true);
   await page.waitForFunction(()=>document.getElementById("claim-ticket").hidden===true);
   assert.equal(await page.inputValue("#ticket-status"),"in_progress");
   assert.equal(await page.evaluate(()=>window.__fixture.tickets[1].status),"in_progress");
  }finally{await page.close();}
 });
 await test("Falha ao confirmar leitura não marca novo chamado como lido",async()=>{
  const page=await openScenario({failRead:true});
  try{
   await visit(page,101);
   await page.waitForFunction(()=>document.getElementById("ticket-thread-status").dataset.phase==="read-error");
   assert.equal(await page.evaluate(()=>window.__fixture.read.length),0);
   assert.equal((await page.textContent("#ticket-badge")).trim(),"?");
   await page.evaluate(()=>window.__fixture.failRead=false);
   await page.click("#ticket-thread-retry");
   await page.waitForFunction(()=>window.__fixture.read.length===1);
   await page.click("#reload-tickets");
   await page.waitForFunction(()=>document.getElementById("ticket-sync-status").dataset.phase==="ready");
   assert.equal((await page.textContent("#ticket-filter-unread-count")).trim(),"1");
  }finally{await page.close();}
 });
 await test("Conversas longas mostram as 150 mensagens mais recentes",async()=>{
  const many=Array.from({length:151},(_,i)=>({
   id:"message-"+i,ticket_id:baseline[1].id,sender_kind:"customer",
   created_at:new Date(Date.now()-i*60000).toISOString(),
   body:i===0?"Novidade mais recente":i===150?"Mensagem mais antiga":"Mensagem "+i
  }));
  const page=await openScenario({messagesFixture:many});
  try{
   await visit(page,102);
   await page.waitForFunction(()=>document.getElementById("ticket-thread-status").dataset.phase==="partial");
   const text=await page.textContent("#staff-messages");
   assert(text.includes("Novidade mais recente"));
   assert(!text.includes("Mensagem mais antiga"));
   assert.equal(await page.locator("#staff-messages .ops-bubble").count(),150);
   await page.click("#ticket-thread-older");
   await page.waitForFunction(()=>document.querySelectorAll("#staff-messages .ops-bubble").length===151);
   assert((await page.textContent("#staff-messages")).includes("Mensagem mais antiga"));
   assert.equal(await page.isHidden("#ticket-thread-older"),true);
  }finally{await page.close();}
 });
 await test("Paginação inclui mensagens com horário idêntico sem duplicar ou omitir",async()=>{
  const now=new Date().toISOString();
  const many=Array.from({length:151},(_,i)=>({
   id:"shared-"+String(i).padStart(3,"0"),ticket_id:baseline[1].id,
   sender_kind:"customer",created_at:now,body:"Mensagem simultânea "+i
  }));
  const page=await openScenario({messagesFixture:many});
  try{
   await visit(page,102);
   await page.waitForFunction(()=>document.getElementById("ticket-thread-status").dataset.phase==="partial");
   assert.equal(await page.locator("#staff-messages .ops-bubble").count(),150);
   await page.click("#ticket-thread-older");
   await page.waitForFunction(()=>document.querySelectorAll("#staff-messages .ops-bubble").length===151);
   const values=await page.locator("#staff-messages .ops-bubble > div").allTextContents();
   assert.equal(new Set(values).size,151);
   assert(values.includes("Mensagem simultânea 0"));
   assert.equal(await page.isHidden("#ticket-thread-older"),true);
  }finally{await page.close();}
 });
 await test("Resposta atrasada de um chamado preserva rascunho de outro",async()=>{
  const page=await openScenario({deferReply:true});
  try{
   await visit(page,102);
   await page.fill("#staff-reply","Resposta do atendimento 102");
   await page.locator("#staff-reply-form button[type=submit]").click();
   await page.waitForFunction(()=>typeof window.__fixture.completeReply==="function");
   await visit(page,101);
   await page.click("#claim-ticket");
   await page.waitForFunction(()=>!document.getElementById("staff-reply-form").hidden);
   await page.fill("#staff-reply","Rascunho do atendimento 101");
   await page.evaluate(()=>window.__fixture.completeReply());
   await page.waitForFunction(()=>window.__fixture.messages.some(m=>m.body==="Resposta do atendimento 102"));
   assert.equal(await page.inputValue("#staff-reply"),"Rascunho do atendimento 101");
  }finally{await page.close();}
 });
 await test("Encerramento exige confirmação e torna o histórico somente leitura",async()=>{
  const page=await openScenario();const dialogs=[];
  page.on("dialog",async dialog=>{dialogs.push(dialog.message());await dialog.accept();});
  try{
   await visit(page,102);
   await page.selectOption("#ticket-status","closed");
   await page.click("#save-status");
   await page.waitForFunction(()=>document.getElementById("ticket-detail").dataset.status==="closed");
   assert(dialogs.some(x=>x.includes("relatório final")));
   for(const id of ["save-status","staff-reply-form","ticket-note-form","ticket-report-save-box"])
     assert.equal(await page.isHidden("#"+id),true,id+" deve estar oculto");
   assert.equal(await page.evaluate(()=>window.__fixture.tickets[1].status),"closed");
  }finally{await page.close();}
 });
 await test("Rascunho de nota é preservado entre chamados e eliminado no logout",async()=>{
  const page=await openScenario();
  try{
   await visit(page,102);await page.click('[data-ticket-jump="notes"]');await page.fill("#ticket-note-body","Nota privada ainda não salva.");
   await visit(page,101);await visit(page,102);
   assert.equal(await page.inputValue("#ticket-note-body"),"Nota privada ainda não salva.");
   await page.evaluate(()=>{window.PROXITI_ACTIVE_SESSION=null;
     document.dispatchEvent(new Event("proxiti-session-ended"));});
   assert.equal(await page.inputValue("#ticket-note-body"),"");
   assert.equal((await page.textContent("#ticket-notes-list")).trim(),"Selecione um chamado.");
  }finally{await page.close();}
 });
 await test("Retirada de acesso a um chamado limpa os dados da interface",async()=>{
  const page=await openScenario();
  try{
   await visit(page,102);
   assert((await page.textContent("#ticket-customer")).includes("teste@example.invalid"));
   await page.evaluate(()=>{window.__fixture.tickets=window.__fixture.tickets.filter(t=>t.reference!==102);});
   await page.click("#reload-tickets");
   await page.waitForFunction(()=>document.getElementById("ticket-detail").hidden);
   assert.equal((await page.textContent("#ticket-customer")).trim(),"");
   assert.equal((await page.textContent("#ticket-subject")).trim(),"");
   assert.equal((await page.textContent("#staff-messages")).trim(),"");
   assert.equal(await page.isHidden("#ticket-workflow"),true);
  }finally{await page.close();}
 });
 await test("Anexo com resposta ambígua não apaga arquivo já registrado",async()=>{
  const page=await openScenario({attachAmbiguous:true});
  try{
   await visit(page,102);
   await page.click('[data-ticket-jump="attachments"]');
   await page.locator("#ticket-file-input").setInputFiles({
    name:"evidencia.pdf",mimeType:"application/pdf",buffer:Buffer.from("%PDF-1.4 test")
   });
   await page.locator("#ticket-file-form button[type=submit]").click();
   await page.waitForFunction(()=>document.getElementById("ticket-files-list").textContent.includes("evidencia.pdf"));
   assert.equal(await page.evaluate(()=>window.__fixture.attachments.length),1);
   assert.equal(await page.evaluate(()=>window.__fixture.stored.size),1);
   assert.equal(await page.evaluate(()=>window.__fixture.calls.includes("storage.remove")),false);
  }finally{await page.close();}
 });
 await test("Diagnóstico orientado preserva a conversa e exige revisão antes de salvar ou responder",async()=>{
  const page=await openScenario();
  try{
   await visit(page,102);
   await page.waitForFunction(()=>document.getElementById("ticket-diagnostic-results").textContent.includes("Conectividade"));
   assert.equal(await page.isHidden("#ticket-conversation"),false);
   assert.equal(await page.isHidden("#ticket-go-chat"),false);
   await page.click("#ticket-go-chat");
   assert.equal(await page.getAttribute('[data-ticket-jump="chat"]',"aria-current"),"location");
   assert.equal(await page.getAttribute("#ticket-list-pane","data-mobile-collapsed"),"true");
   assert.equal(await page.isVisible("#ticket-queue-toggle"),true);
   await page.click('[data-ticket-jump="diagnostic"]');
   await page.click("#ticket-diagnostic-to-note");
   assert((await page.inputValue("#ticket-note-body")).includes("Triagem assistida local"));
   assert.equal(await page.evaluate(()=>window.__fixture.notes.length),0,"Nota não pode ser salva automaticamente");
   await page.click('[data-ticket-jump="diagnostic"]');
   await page.click("#ticket-diagnostic-to-reply");
   assert((await page.inputValue("#staff-reply")).includes("Para entender melhor"));
   assert.equal(await page.evaluate(()=>window.__fixture.messages.length),3,"Resposta não pode ser enviada automaticamente");
   await page.click('[data-ticket-jump="diagnostic"]');
   await page.fill("#ticket-diagnostic-symptoms","Disco SSD falhou e arquivos sumiram; preciso recuperar arquivos.");
   await page.waitForFunction(()=>document.getElementById("ticket-diagnostic-results").textContent.includes("Armazenamento"));
   assert((await page.textContent("#ticket-diagnostic-results")).includes("Não formate"));
   await page.fill("#ticket-diagnostic-symptoms","Windows com BitLocker ativado não inicia e BIOS travada com senha");
   await page.waitForFunction(()=>document.getElementById("ticket-diagnostic-results")?.textContent.includes("Recuperação do BitLocker"));
   const bitlockerCase=page.locator(".ticket-diagnostic-case").filter({hasText:"Recuperação do BitLocker"});
   if((await bitlockerCase.getAttribute("open"))===null)await bitlockerCase.locator("summary").click();
   await bitlockerCase.getByRole("button",{name:"Seguir esta hipótese"}).click();
   await page.waitForFunction(()=>document.querySelector(".ticket-solution-head")?.textContent.includes("BitLocker"));
   assert((await page.textContent("#ticket-diagnostic-results")).includes("Senha de BIOS/UEFI"));
   assert((await page.textContent(".ticket-solution")).includes("chave legítima"));
   await page.locator(".ticket-solution-choices").getByRole("button",{name:"Ainda não resolveu"}).click();
   assert((await page.textContent(".ticket-solution-feedback")).includes("Não resolvido")||
    (await page.textContent(".ticket-solution-feedback")).includes("Ainda não resolvido"));
   await page.getByRole("button",{name:"Próxima etapa"}).click();
   assert((await page.textContent(".ticket-solution-counter")).includes("Etapa 2 de 3"));
   assert.equal(await page.evaluate(()=>window.__fixture.notes.length),0,"Guia não pode salvar nota sozinho");
   await page.locator("#ticket-preflight summary").click();
   await page.locator('[data-ticket-preflight="scope"]').check();
   assert((await page.textContent("#ticket-preflight-progress")).includes("1 de 4"));
   await visit(page,101);
   assert(!(await page.inputValue("#ticket-diagnostic-symptoms")).includes("BitLocker ativado"));
   await visit(page,102);
   assert((await page.inputValue("#ticket-diagnostic-symptoms")).includes("BitLocker ativado"));
   await page.click('[data-ticket-jump="diagnostic"]');
   await page.click("#ticket-diagnostic-clear");
   assert.equal(await page.inputValue("#ticket-diagnostic-symptoms"),"");
   assert.equal(await page.isDisabled("#ticket-diagnostic-to-note"),true);
  }finally{await page.close();}
 });
 await test("Assistente respeita chat proibido e histórico encerrado",async()=>{
  const page=await openScenario({chat:false});
  try{
   await visit(page,102);
   assert.equal(await page.isHidden("#ticket-conversation"),true);
   assert.equal(await page.isHidden("#ticket-go-chat"),true);
   assert.equal(await page.isDisabled("#ticket-diagnostic-message"),true);
   assert.equal(await page.isDisabled("#ticket-diagnostic-to-reply"),true);
   await page.click('[data-ticket-jump="notes"]');
   assert.equal(await page.isHidden("#ticket-workflow"),false);
   await visit(page,103);
   assert.equal(await page.isDisabled("#ticket-diagnostic-to-note"),true);
   assert.equal(await page.isDisabled("#ticket-diagnostic-to-reply"),true);
  }finally{await page.close();}
 });
 await test("Chamado aberto mantém legibilidade nos dois temas e cinco larguras",async()=>{
  const page=await openScenario();
  try{
   await visit(page,102);
   const artifacts=resolve(root,"artifacts");await mkdir(artifacts,{recursive:true});
   for(const width of [320,375,430,768,1024,1366,1920]){
    await page.setViewportSize({width,height:875});
    for(const theme of ["light","dark"]){
     await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
     const value=await page.evaluate(()=>{
       const detail=document.getElementById("ticket-detail").getBoundingClientRect();
       const search=document.getElementById("ticket-search").getBoundingClientRect();
       const reply=document.getElementById("staff-reply").getBoundingClientRect();
       const chat=document.getElementById("ticket-conversation").getBoundingClientRect();
       const assistant=document.getElementById("ticket-diagnostic").getBoundingClientRect();
       return {width:window.innerWidth,scroll:document.documentElement.scrollWidth,
         detail:{left:detail.left,right:detail.right,width:detail.width},
         search:{left:search.left,right:search.right},
         reply:{left:reply.left,right:reply.right},
         chat:{left:chat.left,right:chat.right},assistant:{left:assistant.left,right:assistant.right}};
     });
     assert(value.scroll<=width+2,width+"px/"+theme+": rolagem horizontal na área de Chamados");
     for(const [name,rect]of Object.entries(value)){
      if(!rect||typeof rect!=="object"||!("right" in rect))continue;
      assert(rect.left>=-1&&rect.right<=width+1,width+"px/"+theme+": "+name+" sai da tela");
     }
     if([375,1366].includes(width))
      await page.screenshot({path:resolve(artifacts,"chamados-"+width+"-"+theme+".png"),fullPage:true});
    }
    console.log("PASS: Chamados "+width+"px, temas claro/escuro, sem overflow");
   }
   assert.deepEqual(page.__errors,[]);
  }finally{await page.close();}
 });

 await test('Abas reais, teclado, fila desktop, edição isolada, roteiro e relatório assistido',async()=>{
  const page=await openScenario();
  try{
   await page.setViewportSize({width:1366,height:900});await visit(page,102);
   for(const key of ['diagnostic','notes','tasks','device','appointments','attachments','report','history']){
    await page.click('[data-ticket-jump="'+key+'"]');
    assert.equal(await page.locator('[role=tabpanel]:visible').count(),1,key);
    assert.equal(await page.isVisible('#ticket-conversation'),true,'Conversa permanente');
   }
   await page.click('[data-ticket-jump="notes"]');await page.keyboard.press('ArrowRight');
   assert.equal(await page.getAttribute('#ticket-tab-tasks','aria-selected'),'true');
   await page.click('#ticket-queue-toggle');assert.equal(await page.isVisible('#ticket-list-pane'),false);
   await page.click('#ticket-queue-toggle');assert.equal(await page.isVisible('#ticket-list-pane'),true);
   await page.click('[data-ticket-jump="device"]');await page.fill('#ticket-device-brand','Fabricante teste');
   await page.fill('#ticket-device-ref','PATRIMONIO-NAO-INCLUIR');
   await page.click('[data-ticket-jump="report"]');await page.fill('#ticket-report-diagnosis','Diagnóstico em edição');
   await visit(page,101);await visit(page,102);await page.click('[data-ticket-jump="device"]');
   assert.equal(await page.inputValue('#ticket-device-brand'),'Fabricante teste');
   await page.locator('#ticket-device-form button[type=submit]').click();
   await page.waitForFunction(()=>window.__fixture.devices.length===1);
   await page.click('[data-ticket-jump="tasks"]');await page.click('#ticket-tasks-create');
   await page.waitForFunction(()=>document.querySelector('#ticket-tasks-list select'));
   await page.locator('#ticket-tasks-list select').selectOption('done');
   await page.locator('#ticket-tasks-list input').fill('Autorização confirmada pelo canal registrado.');
   assert((await page.textContent('#ticket-tasks-list')).includes('Alteração não salva'));
   await page.locator('#ticket-tasks-list button').click();
   await page.waitForFunction(()=>window.__fixture.tasks[0].state==='done');
   await page.click('[data-ticket-jump="report"]');
   assert.equal(await page.inputValue('#ticket-report-diagnosis'),'Diagnóstico em edição');
   await page.getByRole('button',{name:'Preparar rascunho com registros salvos'}).click();
   await page.waitForFunction(()=>document.querySelectorAll('.report-suggestion').length===2);
   const texts=await page.locator('.report-suggestion textarea').allTextContents();
   assert(!texts.join('').includes('PATRIMONIO-NAO-INCLUIR'));
   await page.locator('.report-suggestion').first().getByRole('button',{name:'Incluir texto revisado'}).click();
   await page.locator('.report-suggestion').first().getByRole('button',{name:'Incluir texto revisado'}).click();
   assert.equal(await page.evaluate(()=>window.__fixture.reports.length),0);
   await page.click('#ticket-report-save');await page.waitForFunction(()=>window.__fixture.reports.length===1);
   assert.equal(await page.evaluate(()=>window.__fixture.reports[0].finalized),false);
   await page.fill('#ticket-search','nao-corresponde');
   await page.waitForFunction(()=>!document.getElementById('ticket-outside-filter').hidden);
   assert.equal(await page.isVisible('#ticket-detail'),true);
   assert.deepEqual(page.__errors,[]);
  }finally{await page.close();}
 });
 console.log('PASS: suíte operacional de Chamados e matriz de sete larguras concluídas.');

}finally{
 await browser.close();
 await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));
}
