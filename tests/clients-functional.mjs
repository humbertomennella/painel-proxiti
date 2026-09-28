import assert from "node:assert/strict";
import {createServer} from "node:http";
import {readFile} from "node:fs/promises";
import {resolve,extname,sep} from "node:path";
import {fileURLToPath} from "node:url";
import {chromium} from "playwright";
const root=resolve(fileURLToPath(new URL("../",import.meta.url)));
const mime={".html":"text/html; charset=utf-8",".js":"application/javascript; charset=utf-8",
 ".css":"text/css; charset=utf-8",".svg":"image/svg+xml",".jpg":"image/jpeg",".webp":"image/webp"};
const server=createServer(async(req,res)=>{
 try{
  const part=new URL(req.url,"http://localhost").pathname;
  const file=resolve(root,"."+decodeURIComponent(part==="/"?"/index.html":part));
  if(!file.startsWith(root+sep)){res.writeHead(403);res.end();return;}
  const body=await readFile(file);res.writeHead(200,{"content-type":mime[extname(file)]||"application/octet-stream","cache-control":"no-store"});res.end(body);
 }catch{res.writeHead(404);res.end("not found");}
});
await new Promise(done=>server.listen(0,"127.0.0.1",done));
const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
const base="http://127.0.0.1:"+server.address().port+"/";
const ids={admin:"00000000-0000-4000-8000-000000000001",ticket:"00000000-0000-4000-8000-000000000121"};
let page;const errors=[];
try{
 page=await browser.newPage({viewport:{width:390,height:844}});
 page.on("pageerror",e=>errors.push(e.message));page.on("dialog",d=>d.accept());
 await page.route("https://cdn.jsdelivr.net/**",route=>route.abort());
 await page.goto(base,{waitUntil:"load"});
 await page.evaluate(ids=>{
  document.body.classList.add("workspace-mode");document.getElementById("setup").hidden=true;
  document.getElementById("auth-screen").hidden=true;document.getElementById("panel").hidden=false;
  document.getElementById("workspace").hidden=false;document.getElementById("operations").hidden=false;
  document.getElementById("ops-clients").hidden=false;
  const now=new Date().toISOString();
  const fixture=window.__clientsFixture={clients:[],audit:[],tickets:[{id:ids.ticket,reference:91,
   customer_name:"Ana Teste",customer_email:"ana@example.test",customer_phone:"41999990000",
   subject:"Wi-Fi instável",status:"new",client_id:null,created_at:now}],counter:0};
  const ok=data=>Promise.resolve({data,error:null});
  const err=message=>Promise.resolve({data:null,error:{message}});
  const client={
   from(table){
    const source={client_profiles:"clients",support_tickets:"tickets",client_profile_audit:"audit"}[table];
    const chain={select(){return chain;},order(){return chain;},limit(){return chain;},
     then(resolve,reject){return Promise.resolve({data:structuredClone(fixture[source]||[]),error:null}).then(resolve,reject);}};
    return chain;
   },
   rpc(method,p){
    if(method==="proxiti_client_save"){
     let row=fixture.clients.find(x=>x.id===p.p_id);
     if(!row){row={id:"client-"+(++fixture.counter),created_at:now};fixture.clients.push(row);}
     Object.assign(row,{display_name:p.p_name,customer_type:p.p_type,organization:p.p_organization,
      email:p.p_email.toLowerCase(),phone:p.p_phone,preferred_channel:p.p_channel,city:p.p_city,
      internal_notes:p.p_notes,status:p.p_status,updated_at:new Date().toISOString()});
     fixture.audit.unshift({id:fixture.audit.length+1,client_id:row.id,action:p.p_id?"updated":"created",created_at:new Date().toISOString()});
     return ok(row.id);
    }
    if(method==="proxiti_client_link_ticket"){
     const t=fixture.tickets.find(x=>x.id===p.p_ticket);if(!t)return err("Chamado não encontrado");
     if(t.client_id&&t.client_id!==p.p_client)return err("Chamado já vinculado");
     t.client_id=p.p_client;fixture.audit.unshift({id:fixture.audit.length+1,client_id:p.p_client,action:"ticket_linked",created_at:new Date().toISOString()});return ok(null);
    }
    if(method==="proxiti_client_unlink_ticket"){
     const t=fixture.tickets.find(x=>x.id===p.p_ticket&&x.client_id===p.p_client);if(!t)return err("Vínculo não encontrado");
     t.client_id=null;fixture.audit.unshift({id:fixture.audit.length+1,client_id:p.p_client,action:"ticket_unlinked",created_at:new Date().toISOString()});return ok(null);
    }
    if(method==="proxiti_client_summary"){
     const linked=fixture.tickets.filter(x=>x.client_id===p.p_client);
     return ok({tickets:linked.length,open_tickets:linked.filter(x=>!["resolved","closed"].includes(x.status)).length,
      quotes:1,accepted_cents:15000,received_cents:10000});
    }
    return err("RPC inesperada "+method);
   }
  };
  window.PROXITI_ACTIVE_SESSION={client,user:{id:ids.admin},profile:{role:"administrator",status:"active",permissions:{tickets_view:true}}};
 },ids);
 await page.evaluate(async()=>{document.getElementById("ops-clients").hidden=false;document.querySelectorAll("#operations [data-admin-only]").forEach(n=>n.hidden=false);await window.PROXITI_CLIENTS_V16.load();document.getElementById("clients-v16-admin").hidden=false;document.getElementById("clients-list").hidden=true;});
 await page.waitForFunction(()=>document.getElementById("clients-status").textContent.includes("Cadastro atualizado"));
 assert.equal(await page.locator("#clients-v16-admin").isVisible(),true);
 assert.equal(await page.locator("#clients-list").isVisible(),false);
 await page.fill("#clients-v16-name","Ana Teste");await page.fill("#clients-v16-email","ana@example.test");
 await page.fill("#clients-v16-city","Curitiba");await page.click('#clients-v16-form button[type="submit"]');
 await page.waitForFunction(()=>window.__clientsFixture.clients.length===1);
 assert.equal(await page.locator("#clients-v16-list .clients-v16-record").count(),1);
 assert((await page.textContent("#clients-v16-list")).includes("Ana Teste"));
 await page.selectOption("#clients-v16-link-client","client-1");await page.selectOption("#clients-v16-link-ticket",ids.ticket);
 await page.click('#clients-v16-link-form button[type="submit"]');
 await page.waitForFunction(()=>window.__clientsFixture.tickets[0].client_id==="client-1");
 await page.waitForFunction(()=>!document.getElementById("clients-v16-detail").hidden);
 assert((await page.textContent("#clients-v16-summary")).includes("R$"));
 assert((await page.textContent("#clients-v16-tickets")).includes("#91"));
 const size=await page.evaluate(()=>({doc:document.documentElement.scrollWidth,screen:innerWidth}));
 assert(size.doc<=size.screen+4,"CRM não pode estourar largura no mobile");
 await page.evaluate(async()=>{
  window.PROXITI_ACTIVE_SESSION={client:window.PROXITI_ACTIVE_SESSION.client,user:{id:"tech"},profile:{role:"technician",status:"active",permissions:{tickets_view:true}}};
  await window.PROXITI_CLIENTS_V16.load();
 });
 await page.waitForTimeout(30);
 assert.equal(await page.locator("#clients-v16-admin").isVisible(),false);
 assert.deepEqual(errors,[]);
 console.log("PASS: CRM V16 salva, vincula, consolida e oculta administração de técnicos.");
}finally{if(page)await page.close();await browser.close();await new Promise(done=>server.close(done));}
