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
async function openScenario({materials=[],admin=false,failTraining=false,deferTraining=false,ambiguousSave=false,conflictSave=false,startView="training"}={}){
 const page=await browser.newPage({viewport:{width:375,height:850},deviceScaleFactor:1});
 page.__errors=[];
 page.on("pageerror",error=>page.__errors.push(error.message));
 await page.route("https://cdn.jsdelivr.net/**",route=>route.abort());
 await page.goto(url,{waitUntil:"load",timeout:30000});
 await page.evaluate(({materials,admin,failTraining,deferTraining,ambiguousSave,conflictSave,startView})=>{
   document.body.classList.add("workspace-mode");
   document.getElementById("auth-screen").hidden=true;
   document.getElementById("panel").hidden=false;
   document.getElementById("workspace").hidden=false;
   document.getElementById("setup").hidden=true;
   const fixture=window.__fixture={
     tickets:[],
     messages:[],
     failTickets:false,failMessages:false,failReceipts:false,failRead:false,deferReply:false,
     attachAmbiguous:false,failAppointments:false,deferAppointments:false,
     failTraining,deferTraining,ambiguousSave,conflictSave,
     read:[],staff_presence:[],notes:[],tasks:[],reports:[],attachments:[],devices:[],
     appointments:[],appointmentReschedules:[],audit:[],stored:new Map(),calls:[],
     training:structuredClone(materials),versions:[]
   };
   const tables={
     support_tickets:"tickets",support_messages:"messages",
     ticket_read_receipts:"read",staff_presence:"staff_presence",
     ticket_internal_notes:"notes",ticket_tasks:"tasks",ticket_reports:"reports",
     ticket_attachments:"attachments",ticket_devices:"devices",ticket_appointments:"appointments",ticket_audit:"audit",
     ticket_appointment_reschedules:"appointmentReschedules",
     training_materials:"training",training_material_versions:"versions",profiles:"staff"
   };
   const client={
     supabaseUrl:"https://example.supabase.co",
     from(table){
       const filters=[],sorts=[];let skip=0,max=null,search="",op="",payload=null;
       const chain={
         select(){return chain;},
         eq(field,value){filters.push(["eq",field,value]);return chain;},
         in(field,values){filters.push(["in",field,values]);return chain;},
         gte(field,value){filters.push(["gte",field,value]);return chain;},
         lt(field,value){filters.push(["lt",field,value]);return chain;},
         order(field,{ascending=true}={}){sorts.push({field,ascending});return chain;},
         range(from,to){skip=from;max=to-from+1;return chain;},
         limit(value){max=value;return chain;},
         textSearch(field,value){search=String(value).toLowerCase();return chain;},
         insert(value){op="insert";payload=value;return chain;},
         update(value){op="update";payload=value;return chain;},
         maybeSingle(){
           return chain.then(result=>({...result,data:result.data?.[0]||null}));
         },
         make(){
           fixture.calls.push(table+(op?"."+op:""));
           if(table==="training_materials"&&fixture.failTraining&&!op)
             return {data:null,error:{message:"Falha de teste na biblioteca"}};
           let rows=[...(fixture[tables[table]||table]||[])];
           if(table==="training_materials"&&!(profile.role==="administrator"&&profile.status==="active"))
             rows=rows.filter(row=>row.published);
           if(table==="training_material_versions"&&!(profile.role==="administrator"&&profile.status==="active"))
             rows=[];
           if(search&&table==="training_materials")
             rows=rows.filter(row=>(row.title+" "+row.description+" "+row.body)
               .toLowerCase().includes(search));
           for(const [kind,field,value]of filters){
             if(kind==="eq")rows=rows.filter(row=>row[field]===value);
             if(kind==="in")rows=rows.filter(row=>value.includes(row[field]));
             if(kind==="gte")rows=rows.filter(row=>row[field]>=value);
             if(kind==="lt")rows=rows.filter(row=>row[field]<value);
           }
           if(op==="update"){
             if(profile.role!=="administrator")return {data:null,error:{message:"Sem permissão"}};
             if(fixture.conflictSave){
               fixture.conflictSave=false;return {data:[],error:null};
             }
             rows=rows.map(row=>{
               const old=structuredClone(row);
               Object.assign(row,payload,{updated_at:new Date(Date.now()+fixture.versions.length+1000).toISOString()});
               fixture.versions.push({id:fixture.versions.length+1,material_id:row.id,
                 previous_snapshot:old,changed_by:"00000000-0000-4000-8000-000000000101",
                 recorded_at:new Date().toISOString()});
               return row;
             });
           }
           if(op==="insert"){
             if(profile.role!=="administrator")return {data:null,error:{message:"Sem permissão"}};
             const row={id:crypto.randomUUID(),created_at:new Date().toISOString(),
               updated_at:new Date().toISOString(),content_key:null,...payload};
             fixture.training.push(row);rows=[row];
             if(fixture.ambiguousSave){
               fixture.ambiguousSave=false;
               return {data:null,error:{message:"Resposta da gravação interrompida"}};
             }
           }
           if(sorts.length)rows.sort((a,b)=>{
             for(const sort of sorts){
               const x=a[sort.field],y=b[sort.field];
               if(x!==y)return (x<y?-1:1)*(sort.ascending?1:-1);
             }
             return 0;
           });
           return {data:max===null?rows:rows.slice(skip,skip+max),error:null};
         },
         then(resolve,reject){
           if(table==="training_materials"&&!op&&fixture.deferTraining){
             return new Promise(done=>{fixture.releaseTraining=()=>{
               fixture.deferTraining=false;done(chain.make());
             };}).then(resolve,reject);
           }
           return Promise.resolve(chain.make()).then(resolve,reject);
         }
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
         if(["resolved","closed"].includes(args.p_status)&&fixture.appointments.some(row=>
           row.ticket_id===target.id&&["planned","confirmed"].includes(row.status)))
           return error("Finalize ou cancele os compromissos pendentes");
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
       if(name==="proxiti_confirm_appointment"){
         const appointment=fixture.appointments.find(x=>x.id===args.p_id);
         if(!appointment||appointment.status!=="planned")return error("Compromisso já alterado");
         appointment.status="confirmed";appointment.confirmation_channel=args.p_channel;
         appointment.confirmed_at=new Date().toISOString();fixture.audit.push("confirmed");
         return ok(null);
       }
       if(name==="proxiti_update_appointment"){
         const appointment=fixture.appointments.find(x=>x.id===args.p_id);
         if(!appointment||["done","cancelled"].includes(appointment.status)||
           !["done","cancelled"].includes(args.p_status)||
           (args.p_status==="done"&&appointment.status!=="confirmed"))
           return error("Transição inválida");
         appointment.status=args.p_status;fixture.audit.push(args.p_status);return ok(null);
       }
       if(name==="proxiti_reschedule_appointment"){
         const appointment=fixture.appointments.find(x=>x.id===args.p_id);
         if(!appointment||!["planned","confirmed"].includes(appointment.status))
           return error("Compromisso finalizado");
         fixture.appointmentReschedules.push({
           id:fixture.appointmentReschedules.length+1,appointment_id:appointment.id,
           previous_start:appointment.starts_at,new_start:args.p_starts_at,
           previous_duration:appointment.duration_minutes,new_duration:args.p_duration,
           previous_modality:appointment.modality,new_modality:args.p_modality,
           reason:args.p_reason,created_at:new Date().toISOString()
         });
         appointment.starts_at=args.p_starts_at;appointment.duration_minutes=args.p_duration;
         appointment.modality=args.p_modality;appointment.status="planned";
         appointment.confirmation_channel=null;appointment.confirmed_at=null;
         fixture.audit.push("rescheduled");return ok(null);
       }
       return ok(null);
     },
     channel(){return {on(){return this;},subscribe(callback){callback?.("SUBSCRIBED");return this;}};},
     removeChannel(){return Promise.resolve({});},
     auth:{mfa:{listFactors:async()=>({data:{totp:[]},error:null})}},
     storage:{from(bucket){return {
       createSignedUrl:async path=>{fixture.calls.push("storage.sign");
         return {data:{signedUrl:"https://example.supabase.co/storage/v1/object/sign/"+bucket+"/"+path},error:null};},
       upload:async(path,file)=>{fixture.calls.push("storage.upload");
         fixture.stored.set(path,{file,bucket});return {data:{path},error:null};},
       remove:async(paths)=>{fixture.calls.push("storage.remove");
         paths.forEach(path=>fixture.stored.delete(path));return {data:paths,error:null};},
       download:async path=>fixture.stored.has(path)?
         {data:new Blob(["example"]),error:null}:{data:null,error:{message:"missing"}}
     };}}
   };
   const user={id:"00000000-0000-4000-8000-000000000101",email:"teste@example.invalid"};
   const profile={status:"active",role:admin?"administrator":"technician",display_name:"Técnico de teste",
     permissions:{tickets_view:false,chat:false,tickets_claim:false,training:true,resources:false}};
   const session={client,user,profile};
   if(startView!=="tickets")sessionStorage.setItem("proxiti-work-v3-"+user.id+"-view",startView);
   window.PROXITI_ACTIVE_SESSION=session;
   document.dispatchEvent(new CustomEvent("proxiti-session-ready",{detail:session}));
 },{materials,admin,failTraining,deferTraining,ambiguousSave,conflictSave,startView});
 await page.waitForFunction(()=>["ready","partial","error","restricted"].includes(
   document.getElementById("overview-sync-state").dataset.phase),{timeout:12000});
 return page;
}
function test(name,fn){return fn().then(()=>console.log("PASS: "+name));}
const makeMaterial=(n,options={})=>({
 id:"00000000-0000-4000-8000-"+String(n).padStart(12,"0"),
 content_key:"sop.test."+n,
 title:"Procedimento técnico "+n,
 description:"Procedimento de teste para diagnóstico autorizado.",
 kind:"article",category:n%2?"Segurança":"Atendimento",
 body:"# Procedimento técnico "+n+"\n## Contexto\n- Confirmar autorização antes da intervenção. "+
   "Registrar diagnóstico sem coletar credenciais. Testar e documentar o resultado com cuidado.",
 reference_url:null,storage_path:null,published:true,reviewed_at:"2026-09-25",
 created_at:new Date(Date.now()+n*1000).toISOString(),
 updated_at:new Date(Date.now()+n*1000).toISOString(),...options
});
async function academy(page){
 await page.evaluate(()=>window.PROXITI_OPEN_VIEW("training"));
 await page.waitForFunction(()=>document.getElementById("training-sync-state").dataset.phase==="ready");
}
try{
 await test("Biblioteca preserva rascunhos privados e pesquisa o corpo inteiro",async()=>{
   const material=makeMaterial(1,{body:makeMaterial(1).body+"\n## Backup\n- Verificar backup autorizado."});
   const draft=makeMaterial(2,{title:"Manual sigiloso de teste",published:false});
   const page=await openScenario({materials:[material,draft]});
   try{
     await academy(page);
     assert.equal(await page.locator("#training-list .academy-entry").count(),1);
     assert(!(await page.textContent("#training-list")).includes("Manual sigiloso"));
     await page.fill("#training-search","backup");
     await page.waitForFunction(()=>document.querySelectorAll("#training-list .academy-entry").length===1);
     assert((await page.textContent("#training-list")).includes("Procedimento técnico 1"));
     await page.selectOption("#training-category-filter","Atendimento");
     await page.waitForFunction(()=>document.querySelectorAll("#training-list .academy-entry").length===0);
     assert.equal(await page.locator("#training-form").isVisible(),false);
   }finally{await page.close();}
 });
 await test("Editor exige revisão antes de publicar conteúdo novo",async()=>{
   const page=await openScenario({admin:true});
   try{
     await academy(page);
     await page.fill("#training-title","Procedimento novo para triagem");
     await page.fill("#training-body",makeMaterial(1).body);
     await page.check("#training-published");
     await page.click("#training-save");
     assert((await page.textContent("#training-editor-feedback")).includes("Confirme a revisão"));
     assert.equal(await page.evaluate(()=>window.__fixture.training.length),0);
     await page.check("#training-reviewed");
     await page.click("#training-save");
     await page.waitForFunction(()=>window.__fixture.training.length===1);
     await page.waitForFunction(()=>document.querySelectorAll("#training-list .academy-entry").length===1);
     assert.equal(await page.evaluate(()=>window.__fixture.training[0].published),true);
     assert.equal(await page.evaluate(()=>window.__fixture.training[0].reviewed_at!==null),true);
   }finally{await page.close();}
 });
 await test("Edição preserva versão anterior e restaura artigo somente como rascunho",async()=>{
   const page=await openScenario({admin:true,materials:[makeMaterial(1)]});
   try{
     await academy(page);
     await page.getByRole("button",{name:"Editar"}).click();
     await page.fill("#training-body",makeMaterial(1).body+"\n## Novo controle\n- Conferir data da revisão.");
     await page.click("#training-save");
     assert((await page.textContent("#training-editor-feedback")).includes("Confirme a revisão"));
     await page.check("#training-reviewed");
     await page.click("#training-save");
     await page.waitForFunction(()=>window.__fixture.versions.length===1);
     await page.waitForFunction(()=>document.querySelector("#training-list .academy-entry .academy-versions"));
     await page.locator(".academy-versions summary").first().click();
     await page.waitForFunction(()=>document.querySelector(".academy-version")?.textContent.includes("Procedimento técnico"));
     await page.getByRole("button",{name:"Carregar esta versão no editor como rascunho"}).click();
     assert.equal(await page.isChecked("#training-published"),false);
     assert.equal(await page.isChecked("#training-reviewed"),false);
     assert(!(await page.inputValue("#training-body")).includes("Novo controle"));
     await page.click("#training-save");
     await page.waitForFunction(()=>window.__fixture.versions.length===2);
     assert.equal(await page.evaluate(()=>window.__fixture.training[0].published),false);
   }finally{await page.close();}
 });
 await test("Edição concorrente não sobrescreve outro administrador",async()=>{
   const page=await openScenario({admin:true,materials:[makeMaterial(1)],conflictSave:true});
   try{
     await academy(page);
     await page.getByRole("button",{name:"Editar"}).click();
     await page.fill("#training-title","Novo título após edição concorrente");
     await page.click("#training-save");
     await page.waitForFunction(()=>document.getElementById("training-editor-feedback").textContent.includes("Outra edição"));
     assert.equal(await page.inputValue("#training-title"),"Novo título após edição concorrente");
     assert.equal(await page.evaluate(()=>window.__fixture.versions.length),0);
   }finally{await page.close();}
 });
 await test("Arquivar preserva material e retira o rascunho do perfil técnico",async()=>{
   const page=await openScenario({admin:true,materials:[makeMaterial(1)]});
   page.on("dialog",dialog=>dialog.accept());
   try{
     await academy(page);
     await page.getByRole("button",{name:"Arquivar"}).click();
     await page.waitForFunction(()=>window.__fixture.training[0].published===false);
     assert.equal(await page.evaluate(()=>window.__fixture.training.length),1);
     assert.equal(await page.evaluate(()=>window.__fixture.versions.length),1);
     await page.evaluate(()=>{
       const active=window.PROXITI_ACTIVE_SESSION;
       active.profile.role="technician";active.profile.permissions.training=true;
       document.dispatchEvent(new CustomEvent("proxiti-session-ready",{detail:active}));
     });
     await page.waitForFunction(()=>document.getElementById("training-sync-state").dataset.phase==="ready");
     assert.equal(await page.locator("#training-list .academy-entry").count(),0);
     assert(!(await page.textContent("#training-list")).includes("Procedimento técnico 1"));
   }finally{await page.close();}
 });
 await test("Pesquisa e histórico paginam sem cortar a biblioteca em 40 itens",async()=>{
   const materials=Array.from({length:42},(_,i)=>makeMaterial(i+1));
   const page=await openScenario({materials});
   try{
     await academy(page);
     assert.equal(await page.locator("#training-list .academy-entry").count(),40);
     assert.equal(await page.isVisible("#training-load-more"),true);
     await page.click("#training-load-more");
     await page.waitForFunction(()=>document.querySelectorAll("#training-list .academy-entry").length===42);
     const ids=await page.locator("#training-list .academy-entry").evaluateAll(nodes=>
       nodes.map(n=>n.dataset.materialId));
     assert.equal(new Set(ids).size,42);
     assert.equal(await page.isHidden("#training-load-more"),true);
   }finally{await page.close();}
 });
 await test("Falha de consulta não se confunde com biblioteca vazia",async()=>{
   const page=await openScenario({materials:[makeMaterial(1)],failTraining:true});
   try{
     await page.evaluate(()=>window.PROXITI_OPEN_VIEW("training"));
     await page.waitForFunction(()=>document.getElementById("training-sync-state").dataset.phase==="error");
     assert((await page.textContent("#training-sync-state")).includes("Não foi possível consultar"));
     await page.evaluate(()=>window.__fixture.failTraining=false);
     await page.click("#reload-training");
     await page.waitForFunction(()=>document.getElementById("training-sync-state").dataset.phase==="ready");
     assert.equal(await page.locator("#training-list .academy-entry").count(),1);
   }finally{await page.close();}
 });
 await test("Revogação durante uma consulta impede vazamento após resposta atrasada",async()=>{
   const page=await openScenario({materials:[makeMaterial(1)],deferTraining:true});
   try{
     await page.evaluate(()=>window.PROXITI_OPEN_VIEW("training"));
     await page.waitForFunction(()=>typeof window.__fixture.releaseTraining==="function");
     await page.evaluate(()=>{
       const active=window.PROXITI_ACTIVE_SESSION;
       active.profile.permissions.training=false;
       document.dispatchEvent(new CustomEvent("proxiti-session-ready",{detail:active}));
       window.__fixture.releaseTraining();
     });
     await page.waitForFunction(()=>document.getElementById("training-sync-state").dataset.phase==="restricted");
     assert.equal(await page.locator("#training-list .academy-entry").count(),0);
     assert(!(await page.textContent("#training-list")).includes("Procedimento técnico 1"));
   }finally{await page.close();}
 });
 await test("Arquivo com confirmação ambígua preserva o objeto já registrado",async()=>{
   const page=await openScenario({admin:true,ambiguousSave:true});
   try{
     await academy(page);
     await page.selectOption("#training-kind","file");
     await page.fill("#training-title","Manual de atendimento privado");
     await page.locator("#training-file").setInputFiles({
       name:"manual.pdf",mimeType:"application/pdf",buffer:Buffer.from("%PDF-1.4 exemplo")
     });
     await page.check("#training-reviewed");await page.check("#training-published");
     await page.click("#training-save");
     await page.waitForFunction(()=>window.__fixture.training.length===1);
     await page.waitForFunction(()=>document.querySelector("#training-list .academy-entry")!==null);
     assert.equal(await page.evaluate(()=>window.__fixture.stored.size),1);
     assert.equal(await page.evaluate(()=>window.__fixture.calls.includes("storage.remove")),false);
   }finally{await page.close();}
 });
 await test("Indicação de consulta é local por versão e não cria certificado",async()=>{
   const page=await openScenario({materials:[makeMaterial(1)]});
   try{
     await academy(page);
     const button=page.getByRole("button",{name:"Marcar como consultado neste navegador"});
     await button.click();
     assert.equal(await page.getAttribute(".academy-mark-read","aria-pressed"),"true");
     assert((await page.textContent("#training-list")).includes("Consultado neste navegador"));
     assert.equal(await page.evaluate(()=>window.__fixture.calls.some(x=>x.includes("certificate"))),false);
   }finally{await page.close();}
 });
 await test("Academia preenchida é legível nos dois temas e cinco larguras",async()=>{
   const page=await openScenario({materials:[makeMaterial(1)],admin:true});
   try{
     await academy(page);
     await page.locator(".academy-article summary").click();
     const folder=resolve(root,"artifacts");await mkdir(folder,{recursive:true});
     for(const width of [320,375,430,768,1366]){
       await page.setViewportSize({width,height:870});
       for(const theme of ["light","dark"]){
         await page.evaluate(v=>document.documentElement.dataset.theme=v,theme);
         const geometry=await page.evaluate(()=>{
           const card=document.querySelector(".academy-entry").getBoundingClientRect();
           const form=document.getElementById("training-form").getBoundingClientRect();
           const search=document.getElementById("training-search").getBoundingClientRect();
           return {scroll:document.documentElement.scrollWidth,width:window.innerWidth,
             card:{left:card.left,right:card.right},
             form:{left:form.left,right:form.right},
             search:{left:search.left,right:search.right},
             offenders:[...document.querySelectorAll("#ops-training *")].map(node=>{
               const rect=node.getBoundingClientRect();
               return {element:node.tagName.toLowerCase()+(node.id?"#"+node.id:""),
                 left:Math.round(rect.left),right:Math.round(rect.right),width:Math.round(rect.width)};
             }).filter(x=>x.right>window.innerWidth+2&&x.width>1).slice(0,18)};
         });
         assert(geometry.scroll<=width+2,width+"/"+theme+": rolagem horizontal "+geometry.scroll+"px, excedentes: "+JSON.stringify(geometry.offenders));
         for(const key of ["card","form","search"])assert(geometry[key].left>=-1&&
           geometry[key].right<=width+1,width+"/"+theme+": "+key+" fora da tela");
         if([375,1366].includes(width))await page.screenshot({
           path:resolve(folder,"academia-"+width+"-"+theme+".png"),fullPage:true
         });
       }
       console.log("PASS: Academia "+width+"px nos temas claro e escuro");
     }
     assert.deepEqual(page.__errors,[]);
   }finally{await page.close();}
 });
 console.log("PASS: 11 cenários de Academia em Chromium, sem alterar materiais reais.");
}finally{
 await browser.close();
 await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));
}
