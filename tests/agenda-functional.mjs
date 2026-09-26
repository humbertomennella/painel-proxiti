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
async function openScenario({tickets=baseline,appointmentsFixture=[],failAppointments=false,deferAppointments=false,viewer=true,startView="agenda"}={}){
 const page=await browser.newPage({viewport:{width:375,height:850},deviceScaleFactor:1});
 page.__errors=[];
 page.on("pageerror",error=>page.__errors.push(error.message));
 await page.route("https://cdn.jsdelivr.net/**",route=>route.abort());
 await page.goto(url,{waitUntil:"load",timeout:30000});
 await page.evaluate(({tickets,appointmentsFixture,failAppointments,deferAppointments,viewer,startView})=>{
   document.body.classList.add("workspace-mode");
   document.getElementById("auth-screen").hidden=true;
   document.getElementById("panel").hidden=false;
   document.getElementById("workspace").hidden=false;
   document.getElementById("setup").hidden=true;
   const fixture=window.__fixture={
     tickets:structuredClone(tickets),
     messages:structuredClone(messages),
     failTickets:false,failMessages:false,failReceipts:false,failRead:false,deferReply:false,
     attachAmbiguous:false,failAppointments,deferAppointments,
     read:[],staff_presence:[],notes:[],tasks:[],reports:[],attachments:[],devices:[],
     appointments:structuredClone(appointmentsFixture),audit:[],stored:new Map(),calls:[]
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
         range(from,to){chain.skip=from;chain.max=to-from+1;return chain;},
         maybeSingle(){const result=chain.make();return Promise.resolve({...result,data:result.data?.[0]||null});},
         make(){
           fixture.calls.push(table);
           if(table==="support_tickets"&&fixture.failTickets)return {data:null,error:{message:"Falha de teste na fila"}};
           if(table==="support_messages"&&fixture.failMessages)return {data:null,error:{message:"Falha de teste nas mensagens"}};
           if(table==="ticket_read_receipts"&&fixture.failReceipts)return {data:null,error:{message:"Falha de teste na leitura"}};
           if(table==="ticket_appointments"&&fixture.failAppointments)return {data:null,error:{message:"Falha de teste na agenda"}};
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
           return {data:chain.max?rows.slice(chain.skip||0,(chain.skip||0)+chain.max):rows,error:null};
         },
         then(resolve,reject){
           if(table==="ticket_appointments"&&fixture.deferAppointments){
             return new Promise(done=>{fixture.releaseAgenda=()=>{
               fixture.deferAppointments=false;done(chain.make());
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
     permissions:{tickets_view:viewer,chat:true,tickets_claim:viewer,training:!viewer,resources:false}};
   const session={client,user,profile};
   if(startView!=="tickets")sessionStorage.setItem("proxiti-work-v3-"+user.id+"-view",startView);
   window.PROXITI_ACTIVE_SESSION=session;
   document.dispatchEvent(new CustomEvent("proxiti-session-ready",{detail:session}));
 },{tickets,appointmentsFixture,failAppointments,deferAppointments,viewer,startView});
 await page.waitForFunction(()=>["ready","partial","error","restricted"].includes(
   document.getElementById("overview-sync-state").dataset.phase),{timeout:12000});
 return page;
}
function test(name,fn){return fn().then(()=>console.log("PASS: "+name));}
const id="00000000-0000-4000-8000-000000000002";
const future=(hours=24)=>new Date(Date.now()+hours*3600000).toISOString();
const appointment=(i,override={})=>({
 id:"00000000-0000-4000-8000-"+String(i).padStart(12,"0"),ticket_id:id,
 title:"Retorno de diagnóstico "+i,starts_at:future(i+1),duration_minutes:60,
 modality:"remote",status:"planned",confirmed_at:null,confirmation_channel:null,...override
});
async function agenda(page){
 await page.evaluate(()=>window.PROXITI_OPEN_VIEW("agenda"));
 await page.waitForFunction(()=>document.getElementById("agenda-sync-state").dataset.phase==="ready");
}
try{
 await test("Agenda vazia confirmada mostra zero sem criar registros",async()=>{
  const page=await openScenario();
  try{
   await agenda(page);
   assert((await page.textContent("#agenda-count")).includes("0 exibidos"));
   assert.equal(await page.isHidden("#agenda-load-more"),true);
   assert.equal(await page.evaluate(()=>window.__fixture.appointments.length),0);
  }finally{await page.close();}
 });
 await test("Próximos mostra apenas compromissos vigentes e não os cancelados",async()=>{
  const rows=[appointment(1),appointment(2,{status:"cancelled"}),appointment(3,{starts_at:future(-48)}),
   appointment(4,{status:"confirmed",confirmed_at:future(-1),confirmation_channel:"chat"})];
  const page=await openScenario({appointmentsFixture:rows});
  try{
   await agenda(page);
   assert.equal(await page.locator("#agenda-list .agenda-entry").count(),2);
   assert((await page.textContent("#agenda-list")).includes("Retorno de diagnóstico 1"));
   assert(!(await page.textContent("#agenda-list")).includes("Retorno de diagnóstico 2"));
   await page.selectOption("#agenda-filter","all");
   await page.waitForFunction(()=>document.querySelectorAll("#agenda-list .agenda-entry").length===4);
   assert.equal(await page.locator("#agenda-list .agenda-entry").count(),4);
  }finally{await page.close();}
 });
 await test("Falha de consulta é distinguida de agenda vazia e permite recuperação",async()=>{
  const page=await openScenario({appointmentsFixture:[appointment(1)],failAppointments:true});
  try{
   await page.waitForFunction(()=>document.getElementById("agenda-sync-state").dataset.phase==="error");
   assert(!(await page.textContent("#agenda-sync-state")).includes("consultada às"));
   await page.evaluate(()=>window.__fixture.failAppointments=false);
   await page.click("#reload-agenda");
   await page.waitForFunction(()=>document.getElementById("agenda-sync-state").dataset.phase==="ready");
   assert.equal(await page.locator("#agenda-list .agenda-entry").count(),1);
  }finally{await page.close();}
 });
 await test("Confirmar exige canal real e não comunica automaticamente o cliente",async()=>{
  const page=await openScenario({appointmentsFixture:[appointment(1)]});
  page.on("dialog",dialog=>dialog.accept());
  try{
   await agenda(page);
   const card=page.locator("#agenda-list .agenda-entry").first();
   await card.getByRole("button",{name:"Registrar confirmação"}).click();
   assert((await page.textContent("#agenda-feedback")).includes("Selecione o canal"));
   assert.equal(await page.evaluate(()=>window.__fixture.appointments[0].status),"planned");
   await card.locator(".agenda-confirm select").selectOption("phone");
   await card.getByRole("button",{name:"Registrar confirmação"}).click();
   await page.waitForFunction(()=>window.__fixture.appointments[0].status==="confirmed");
   await page.waitForFunction(()=>document.getElementById("agenda-list").textContent.includes("Confirmação registrada"));
   assert.equal(await page.evaluate(()=>window.__fixture.appointments[0].confirmation_channel),"phone");
   assert.equal(await page.evaluate(()=>window.__fixture.calls.includes("proxiti_staff_reply")),false);
  }finally{await page.close();}
 });
 await test("Concluir exige confirmação anterior, preserva estado terminal",async()=>{
  const page=await openScenario({appointmentsFixture:[appointment(1,{status:"confirmed",confirmed_at:future(-1),
    confirmation_channel:"chat"})]});
  page.on("dialog",dialog=>dialog.accept());
  try{
   await agenda(page);
   await page.getByRole("button",{name:"Concluir compromisso"}).click();
   await page.waitForFunction(()=>window.__fixture.appointments[0].status==="done");
   assert.equal(await page.getByRole("button",{name:"Concluir compromisso"}).count(),0);
   assert((await page.textContent("#agenda-list")).includes("Concluído"));
  }finally{await page.close();}
 });
 await test("Reagendamento invalida confirmação anterior e mantém histórico",async()=>{
  const page=await openScenario({appointmentsFixture:[appointment(1,{status:"confirmed",confirmed_at:future(-1),
    confirmation_channel:"email"})]});
  page.on("dialog",dialog=>dialog.accept());
  try{
   await agenda(page);
   await page.locator(".agenda-reschedule summary").click();
   const form=page.locator(".agenda-reschedule form");
   const local=await page.evaluate(()=>{
     const d=new Date(Date.now()+3*86400000),pad=n=>String(n).padStart(2,"0");
     return d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate())+
       "T"+pad(d.getHours())+":"+pad(d.getMinutes());
   });
   await form.locator('input[type="datetime-local"]').fill(local);
   await form.locator("textarea").fill("Cliente solicitou novo horário.");
   await form.getByRole("button",{name:"Salvar novo horário"}).click();
   await page.waitForFunction(()=>window.__fixture.appointments[0].status==="planned");
   assert.equal(await page.evaluate(()=>window.__fixture.appointments[0].confirmation_channel),null);
   assert.equal(await page.evaluate(()=>window.__fixture.audit.includes("rescheduled")),true);
   await page.waitForFunction(()=>document.getElementById("agenda-list").textContent.includes("confirmação do cliente pendente"));
  }finally{await page.close();}
 });
 await test("Histórico pagina 61 itens sem inventar total global",async()=>{
  const rows=Array.from({length:61},(_,i)=>appointment(i+1,{starts_at:future(48)}));
  const page=await openScenario({appointmentsFixture:rows});
  try{
   await agenda(page);
   await page.selectOption("#agenda-filter","all");
   await page.waitForFunction(()=>document.querySelectorAll("#agenda-list .agenda-entry").length===60);
   assert.equal(await page.isVisible("#agenda-load-more"),true);
   await page.click("#agenda-load-more");
   await page.waitForFunction(()=>document.querySelectorAll("#agenda-list .agenda-entry").length===61);
   const values=await page.locator("#agenda-list .agenda-entry").evaluateAll(nodes=>
     nodes.map(node=>node.dataset.appointmentId));
   assert.equal(new Set(values).size,61);
   assert.equal(await page.isHidden("#agenda-load-more"),true);
  }finally{await page.close();}
 });
 await test("Permissão revogada durante consulta não exibe compromissos antigos",async()=>{
  const page=await openScenario({appointmentsFixture:[appointment(1)],deferAppointments:true});
  try{
   await page.waitForFunction(()=>typeof window.__fixture.releaseAgenda==="function");
   await page.evaluate(()=>{
     const active=window.PROXITI_ACTIVE_SESSION;
     active.profile.permissions.tickets_view=false;
     document.dispatchEvent(new CustomEvent("proxiti-session-ready",{detail:active}));
     window.__fixture.releaseAgenda();
   });
   await page.waitForFunction(()=>document.getElementById("agenda-sync-state").dataset.phase==="restricted");
   assert.equal(await page.locator("#agenda-list .agenda-entry").count(),0);
   assert(!(await page.textContent("#agenda-list")).includes("Retorno de diagnóstico 1"));
  }finally{await page.close();}
 });
 await test("Compromissos sem vínculo autorizado não são exibidos",async()=>{
  const orphan=appointment(1,{ticket_id:"00000000-0000-4000-8000-000000000999"});
  const page=await openScenario({appointmentsFixture:[orphan]});
  try{
   await agenda(page);
   assert.equal(await page.locator("#agenda-list .agenda-entry").count(),0);
   assert(!(await page.textContent("#agenda-list")).includes(orphan.title));
  }finally{await page.close();}
 });
 await test("Agenda preenchida cabe em cinco larguras e nos dois temas",async()=>{
  const page=await openScenario({appointmentsFixture:[appointment(1)]});
  try{
   await agenda(page);
   const dir=resolve(root,"artifacts");await mkdir(dir,{recursive:true});
   for(const width of [320,375,430,768,1366]){
    await page.setViewportSize({width,height:870});
    for(const theme of ["light","dark"]){
     await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
     const geometry=await page.evaluate(()=>{
       const card=document.querySelector(".agenda-entry").getBoundingClientRect();
       const select=document.querySelector(".agenda-confirm select").getBoundingClientRect();
       return {scroll:document.documentElement.scrollWidth,width:window.innerWidth,
         card:{left:card.left,right:card.right},
         select:{left:select.left,right:select.right}};
     });
     assert(geometry.scroll<=width+2,width+"/"+theme+": rolagem horizontal");
     for(const key of ["card","select"])
       assert(geometry[key].left>=-1&&geometry[key].right<=width+1,
         width+"/"+theme+": "+key+" fora da tela");
     if([375,1366].includes(width))await page.screenshot({
       path:resolve(dir,"agenda-"+width+"-"+theme+".png"),fullPage:true
     });
    }
    console.log("PASS: Agenda "+width+"px nos dois temas");
   }
   assert.deepEqual(page.__errors,[]);
  }finally{await page.close();}
 });
 console.log("PASS: 10 cenários de Agenda em Chromium com dados exclusivamente simulados.");
}finally{
 await browser.close();
 await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));
}
