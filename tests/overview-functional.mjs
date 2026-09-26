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
async function openScenario({tickets=baseline,chat=true,failTickets=false,failMessages=false,viewer=true}={}){
 const page=await browser.newPage({viewport:{width:375,height:850},deviceScaleFactor:1});
 page.__errors=[];
 page.on("pageerror",error=>page.__errors.push(error.message));
 await page.route("https://cdn.jsdelivr.net/**",route=>route.abort());
 await page.goto(url,{waitUntil:"load",timeout:30000});
 await page.evaluate(({tickets,messages,chat,failTickets,failMessages,viewer})=>{
   document.body.classList.add("workspace-mode");
   document.getElementById("auth-screen").hidden=true;
   document.getElementById("panel").hidden=false;
   document.getElementById("workspace").hidden=false;
   document.getElementById("setup").hidden=true;
   const fixture=window.__fixture={
     tickets:structuredClone(tickets),
     messages:structuredClone(messages),
     failTickets,failMessages,
     read:[],staff_presence:[],calls:[]
   };
   const tables={
     support_tickets:"tickets",support_messages:"messages",
     ticket_read_receipts:"read",staff_presence:"staff_presence"
   };
   const client={
     from(table){
       const filters=[];
       const chain={
         select(){return chain;},
         eq(field,value){filters.push(["eq",field,value]);return chain;},
         gte(field,value){filters.push(["gte",field,value]);return chain;},
         in(field,values){filters.push(["in",field,values]);return chain;},
         order(){return chain;},
         limit(limit){chain.max=limit;return chain;},
         maybeSingle(){const result=chain.make();return Promise.resolve({...result,data:result.data?.[0]||null});},
         make(){
           fixture.calls.push(table);
           if(table==="support_tickets"&&fixture.failTickets)return {data:null,error:{message:"Falha de teste na fila"}};
           if(table==="support_messages"&&fixture.failMessages)return {data:null,error:{message:"Falha de teste nas mensagens"}};
           let rows=[...(fixture[tables[table]||table]||[])];
           for(const [kind,field,value]of filters){
             if(kind==="eq")rows=rows.filter(row=>row[field]===value);
             if(kind==="in")rows=rows.filter(row=>value.includes(row[field]));
             if(kind==="gte")rows=rows.filter(row=>row[field]>=value);
           }
           return {data:chain.max?rows.slice(0,chain.max):rows,error:null};
         },
         then(resolve,reject){return Promise.resolve(chain.make()).then(resolve,reject);}
       };
       return chain;
     },
     rpc(name,args){
       fixture.calls.push(name);
       if(name==="proxiti_mark_ticket_read"){
         const ticket=fixture.tickets.find(t=>t.id===args.p_ticket);
         if(ticket&&!fixture.read.some(x=>x.ticket_id===ticket.id))fixture.read.push({
           ticket_id:ticket.id,staff_id:"00000000-0000-4000-8000-000000000101",
           first_seen_at:new Date().toISOString(),last_read_customer_at:new Date().toISOString()
         });
       }
       return Promise.resolve({data:null,error:null});
     },
     channel(){return {on(){return this;},subscribe(callback){callback?.("SUBSCRIBED");return this;}};},
     removeChannel(){return Promise.resolve({});},
     auth:{mfa:{listFactors:async()=>({data:{totp:[]},error:null})}},
     storage:{from(){return {createSignedUrl:async()=>({data:null,error:{message:"no avatar fixture"}})}}}
   };
   const user={id:"00000000-0000-4000-8000-000000000101",email:"teste@example.invalid"};
   const profile={status:"active",role:"technician",display_name:"Técnico de teste",
     permissions:{tickets_view:viewer,chat,tickets_claim:viewer,training:!viewer,resources:false}};
   const session={client,user,profile};
   window.PROXITI_ACTIVE_SESSION=session;
   document.dispatchEvent(new CustomEvent("proxiti-session-ready",{detail:session}));
 },{tickets,messages: tickets===baseline?messages:[],chat,failTickets,failMessages,viewer});
 await page.waitForFunction(()=>["ready","partial","error","restricted"].includes(
   document.getElementById("overview-sync-state").dataset.phase),{timeout:12000});
 return page;
}
function test(name,fn){return fn().then(()=>console.log("PASS: "+name));}
try{
 await test("Pendência única por chamado, encerrados fora e estado confirmado",async()=>{
   const page=await openScenario();
   try{
     await page.waitForFunction(()=>document.querySelector("#overview-kpi-unread").textContent==="2");
     const data=await page.evaluate(()=>({
       unread:document.querySelector("#overview-kpi-unread").textContent,
       badge:document.querySelector("#notifications-count").textContent,
       notifications:document.querySelectorAll("#notifications-list .notification-item").length,
       recent:document.querySelectorAll("#overview-recent-list button").length,
       hiddenClosed:!document.querySelector("#overview-recent-list").textContent.includes("Histórico encerrado"),
       sync:document.querySelector("#overview-sync-state").dataset.phase
     }));
     assert.equal(data.unread,"2");assert.equal(data.badge,"2");
     assert.equal(data.notifications,2);assert.equal(data.recent,2);
     assert(data.hiddenClosed);assert.equal(data.sync,"ready");
     await page.click("#overview-reading-toggle");
     assert.equal(await page.getAttribute("#overview-reading-toggle","aria-pressed"),"true");
     await page.click("#overview-focus-toggle");
     assert.equal(await page.getAttribute("#overview-focus-toggle","aria-pressed"),"true");
     assert.equal(await page.isHidden("#overview-guide"),true);
     await page.click("#overview-focus-toggle");
     await page.click("#overview-guide-toggle");
     assert.equal(await page.getAttribute("#overview-guide-toggle","aria-expanded"),"true");
     await page.click("#overview-guide-toggle");
     await page.click("#overview-recent-list button:nth-child(2)");
     await page.waitForFunction(()=>window.PROXITI_ACTIVE_TICKET?.id?.endsWith("2"));
     await page.evaluate(()=>window.PROXITI_OPEN_VIEW("overview"));
     await page.waitForFunction(()=>!document.querySelector("#overview-resume").hidden);
     const over=await page.evaluate(()=>({
       resume:document.querySelector("#overview-resume-detail").textContent,
       scroll:document.documentElement.scrollWidth,viewport:window.innerWidth,
       stored:localStorage.getItem("proxiti-overview-reading-v1-00000000-0000-4000-8000-000000000101")
     }));
     assert(over.resume.includes("#102"));assert(over.scroll<=over.viewport+2);
     assert.equal(over.stored,"true");
   }finally{await page.close();}
 });
 await test("Falha da fila exibida e recuperada pelo botão",async()=>{
   const page=await openScenario({failTickets:true});
   try{
     assert.equal(await page.getAttribute("#overview-sync-state","data-phase"),"error");
     assert.equal(await page.isVisible("#overview-retry"),true);
     assert.equal((await page.textContent("#overview-kpi-unread")).trim(),"—");
     await page.evaluate(()=>{window.__fixture.failTickets=false;});
     await page.click("#overview-retry");
     await page.waitForFunction(()=>document.querySelector("#overview-sync-state").dataset.phase==="ready");
     assert.equal((await page.textContent("#overview-kpi-unread")).trim(),"2");
     assert.equal(await page.isHidden("#overview-retry"),true);
   }finally{await page.close();}
 });
 await test("Falha de mensagens não se transforma em falso zero",async()=>{
   const page=await openScenario({failMessages:true});
   try{
     await page.waitForFunction(()=>document.querySelector("#overview-sync-state").dataset.phase==="partial");
     assert.equal((await page.textContent("#overview-kpi-unread")).trim(),"—");
     assert.equal((await page.textContent("#overview-kpi-open")).trim(),"1");
     await page.evaluate(()=>{window.__fixture.failMessages=false;});
     await page.click("#overview-retry");
     await page.waitForFunction(()=>document.querySelector("#overview-sync-state").dataset.phase==="ready");
     assert.equal((await page.textContent("#overview-kpi-unread")).trim(),"2");
   }finally{await page.close();}
 });
 await test("Fila vazia diferencia zero confirmado de falha",async()=>{
   const page=await openScenario({tickets:[]});
   try{
     await page.waitForFunction(()=>document.querySelector("#overview-sync-state").dataset.phase==="ready");
     assert.equal((await page.textContent("#overview-kpi-unread")).trim(),"0");
     assert.equal((await page.textContent("#overview-kpi-open")).trim(),"0");
     assert.equal(await page.isHidden("#overview-resume"),true);
     assert((await page.textContent("#overview-banner-title")).includes("Tudo preparado"));
   }finally{await page.close();}
 });
 await test("Acesso restrito oculta indicadores e dados de chamado",async()=>{
   const page=await openScenario({viewer:false,chat:false});
   try{
     assert.equal(await page.getAttribute("#overview-sync-state","data-phase"),"restricted");
     assert.equal(await page.isHidden("#overview-metrics-section"),true);
     assert.equal(await page.isHidden("#overview-recent-section"),true);
     assert.equal(await page.isHidden("#overview-resume"),true);
     const text=await page.textContent("#overview-home");
     assert(!text.includes("Problema de inicialização"));
     assert(!text.includes("Histórico encerrado"));
   }finally{await page.close();}
 });
 await test("Sem acesso ao chat, novo chamado continua legível",async()=>{
   const page=await openScenario({chat:false});
   try{
     await page.waitForFunction(()=>document.querySelector("#overview-sync-state").dataset.phase==="ready");
     assert.equal((await page.textContent("#overview-kpi-unread")).trim(),"1");
     assert.equal((await page.textContent("#overview-metric-unread-label")).trim(),"Novos chamados não lidos");
   }finally{await page.close();}
 });
 await test("Layout autenticado simulado com atendimento ativo em cinco larguras e dois temas",async()=>{
   const page=await openScenario();
   try{
     await page.waitForFunction(()=>document.querySelector("#overview-sync-state").dataset.phase==="ready");
     await page.click("#overview-recent-list button:nth-child(2)");
     await page.waitForFunction(()=>window.PROXITI_ACTIVE_TICKET?.id?.endsWith("2"));
     await page.evaluate(()=>window.PROXITI_OPEN_VIEW("overview"));
     await page.waitForFunction(()=>!document.querySelector("#overview-resume").hidden);
     const artifactFolder=resolve(root,"artifacts");
     await mkdir(artifactFolder,{recursive:true});
     for(const width of [320,375,430,768,1366]){
       await page.setViewportSize({width,height:870});
       for(const theme of ["light","dark"]){
         await page.evaluate(value=>document.documentElement.dataset.theme=value,theme);
         const geometry=await page.evaluate(()=>{
           const root=document.documentElement;
           const card=document.getElementById("overview-resume").getBoundingClientRect();
           const button=document.getElementById("overview-resume-action").getBoundingClientRect();
           return {viewport:window.innerWidth,scroll:root.scrollWidth,
             card:{left:card.left,right:card.right,width:card.width},
             button:{left:button.left,right:button.right,width:button.width,height:button.height},
             sync:document.querySelector("#overview-sync-state").dataset.phase};
         });
         assert(geometry.scroll<=geometry.viewport+2,
           width+"px/"+theme+": rolagem horizontal com dados carregados ("+geometry.scroll+">"+geometry.viewport+")");
         assert(geometry.card.left>=-1&&geometry.card.right<=width+1,
           width+"px/"+theme+": cartão de retomada fora da tela");
         assert(geometry.button.left>=-1&&geometry.button.right<=width+1&&geometry.button.height>=44,
           width+"px/"+theme+": ação de retomada inacessível");
         assert.equal(geometry.sync,"ready");
         if([375,1366].includes(width))
           await page.screenshot({path:resolve(artifactFolder,"overview-autorizada-"+width+"-"+theme+".png"),fullPage:true});
       }
       console.log("PASS: conteúdo autorizado, retomada e temas sem overflow em "+width+"px");
     }
     assert.deepEqual(page.__errors,[],"O navegador registrou erros de JavaScript na Visão Geral");
   }finally{await page.close();}
 });
 console.log("PASS: 7 fluxos funcionais da Visão Geral, incluindo 10 verificações de layout com sessão simulada.");
}finally{
 await browser.close();
 await new Promise((done,fail)=>server.close(error=>error?fail(error):done()));
}
