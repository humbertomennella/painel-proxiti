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
         in(field,values){filters.push(["in",field,values]);return chain;},
         order(field,{ascending=true}={}){chain.sort={field,ascending};return chain;},
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
           }
           if(chain.sort)rows.sort((a,b)=>{
             const x=a[chain.sort.field],y=b[chain.sort.field];
             return (x===y?0:x<y?-1:1)*(chain.sort.ascending?1:-1);
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
 await page.locator(".ticket-inbox-card").filter({hasText:"#"+ref+" ·"}).click();
 await page.waitForFunction(ref=>document.getElementById("ticket-code").textContent.includes("#"+ref),ref);
}
try{
 await test("Assumir atendimento em curso preserva situação",async()=>{
  const tickets=structuredClone(baseline);tickets[1].assigned_to=null;
  const page=await openScenario({tickets});
  try{
   await visit(page,102);await page.click("#claim-ticket");
   await page.waitForFunction(()=>document.getElementById("ticket-assignee").value.endsWith("101"));
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
   await visit(page,102);await page.fill("#ticket-note-body","Nota privada ainda não salva.");
   await visit(page,101);await visit(page,102);
   assert.equal(await page.inputValue("#ticket-note-body"),"Nota privada ainda não salva.");
   await page.evaluate(()=>{window.PROXITI_ACTIVE_SESSION=null;
     document.dispatchEvent(new Event("proxiti-session-ended"));});
   assert.equal(await page.inputValue("#ticket-note-body"),"");
   assert.equal((await page.textContent("#ticket-notes-list")).trim(),"Selecione um chamado.");
  }finally{await page.close();}
 });
 await test("Anexo com resposta ambígua não apaga arquivo já registrado",async()=>{
  const page=await openScenario({attachAmbiguous:true});
  try{
   await visit(page,102);
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
 console.log("PASS: 7 cenários de Chamados em Chromium sem escrever dados de produção.");
}finally{
 await browser.close();
 await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));
}
