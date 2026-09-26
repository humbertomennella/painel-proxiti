import assert from "node:assert/strict";
import {createServer} from "node:http";
import {readFile,mkdir} from "node:fs/promises";
import {resolve,extname,sep} from "node:path";
import {fileURLToPath} from "node:url";
import {execFileSync} from "node:child_process";
import {Script} from "node:vm";
import {chromium} from "playwright";

const root=resolve(fileURLToPath(new URL("../",import.meta.url)));
const read=path=>readFile(resolve(root,path),"utf8");
const original=path=>execFileSync("git",["show","origin/main:"+path],{
 cwd:root,encoding:"utf8"});
const changed=execFileSync("git",["diff","--name-only","origin/main...HEAD"],{
 cwd:root,encoding:"utf8"}).trim().split("\n").filter(Boolean);
const allowed=new Set(["index.html","assets/reskin-visual.css","assets/reskin-visual.js",
 "assets/alerts.js","tests/reskin-visual.mjs",".github/workflows/browser-smoke.yml",
 "docs/reskin-fase0-protecao.md","docs/reskin-revisao.md"]);
for(const path of changed)
 assert(allowed.has(path),"Fora do escopo visual: "+path);
for(const path of changed)
 assert(!path.startsWith("supabase/")&&!path.endsWith(".env"),"Arquivo sensível alterado: "+path);
const html=await read("index.html"),base=original("index.html");
const oldIds=[...base.matchAll(/\bid="([^"]+)"/g)].map(x=>x[1]);
const newIds=[...html.matchAll(/\bid="([^"]+)"/g)].map(x=>x[1]);
assert.equal(new Set(newIds).size,newIds.length,"IDs HTML duplicados");
for(const id of oldIds)assert(newIds.includes(id),"Ação antiga removida: #"+id);
for(const attr of ["data-side-view","data-ops-view","data-summary-view",
 "data-overview-view","data-ticket-filter"]){
 const values=text=>[...text.matchAll(new RegExp("\\b"+attr+'="([^"]+)"',"g"))]
   .map(m=>m[1]).sort();
 assert.deepEqual(values(html),values(base),"Contratos de navegação alterados: "+attr);
}
for(const part of ['id="reskin-help"','id="reskin-nav-scrim"',
 'id="reskin-user-initials"','./assets/reskin-visual.css',
 './assets/reskin-visual.js'])assert(html.includes(part),"UI incompleta: "+part);
const css=await read("assets/reskin-visual.css"),visualJs=await read("assets/reskin-visual.js");
new Script(visualJs,{filename:"assets/reskin-visual.js"});
assert.equal((css.match(/{/g)||[]).length,(css.match(/}/g)||[]).length,
 "CSS com chaves desbalanceadas");
for(const key of ["--c-bg-sidebar:#0d1a2b","--c-bg-content:#f2f5f9",
 "--c-primary-grad:linear-gradient(135deg,#2563eb,#4f9dff)",
 "--c-success:#22c55e","--c-warning:#f59e0b","--c-danger:#ef4444",
 "--c-info:#3b82f6","--radius:14px","--radius-sm:10px",
 "--shadow-card:","--status-waiting_customer:","--font:"])
 assert(css.includes(key),"Token do reskin ausente: "+key);
const alertBase=original("assets/alerts.js"),alertNew=await read("assets/alerts.js");
const expected=alertBase
 .replace('button.textContent=enabled?"♫ Alertas ativados":"♪ Alertas desativados";',
          'button.textContent=enabled?"♫ Som ligado":"♪ Som desligado";')
 .replace('button.setAttribute("aria-label",enabled?"Desativar alertas":"Ativar alertas");',
          'button.setAttribute("aria-label",enabled?"Desativar som dos alertas":"Ativar som dos alertas");')
 .replace('button.title=enabled?"Desativar alertas":"Ativar alertas";',
          'button.title=enabled?"Desativar som dos alertas":"Ativar som dos alertas";');
assert.equal(alertNew,expected,"Comportamento do som foi alterado, e não apenas o texto");
function luminance(hex){
 const rgb=hex.match(/[\da-f]{2}/gi).map(v=>parseInt(v,16)/255);
 const [r,g,b]=rgb.map(n=>n<=.04045?n/12.92:Math.pow((n+.055)/1.055,2.4));
 return .2126*r+.7152*g+.0722*b;
}
function contrast(fore,back){
 const a=luminance(fore),b=luminance(back);
 return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
}
for(const [foreground,background,role]of [
 ["#c9d8eb","#0d1a2b","menu"],["#ffffff","#205ac2","ativo"],
 ["#5b6b82","#ffffff","texto secundário claro"],
 ["#bdcbe0","#1a2639","texto secundário escuro"],
 ["#a6ceff","#0d1a2b","foco no menu"]
])assert(contrast(foreground,background)>=4.5,
 "Contraste abaixo de AA: "+role+" "+contrast(foreground,background).toFixed(2));
console.log("PASS: diff permitido, "+oldIds.length+
 " IDs e contratos de navegação preservados, tokens e contraste AA.");

const mime={".html":"text/html; charset=utf-8",".css":"text/css; charset=utf-8",
 ".js":"application/javascript; charset=utf-8",".svg":"image/svg+xml",
 ".png":"image/png"};
const server=createServer(async(req,res)=>{
 try{
  const pathname=new URL(req.url,"http://localhost").pathname;
  const full=resolve(root,"."+decodeURIComponent(pathname==="/"?"/index.html":pathname));
  if(!full.startsWith(root+sep)){res.writeHead(403);res.end();return;}
  const bytes=await readFile(full);
  res.writeHead(200,{"content-type":mime[extname(full)]||"application/octet-stream",
   "cache-control":"no-store"});res.end(bytes);
 }catch{res.writeHead(404);res.end("Not found");}
});
await new Promise(done=>server.listen(0,"127.0.0.1",done));
const url="http://127.0.0.1:"+server.address().port+"/";
const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
const artifacts=resolve(root,"artifacts");await mkdir(artifacts,{recursive:true});
const surfaces=[
 ["overview","overview-home"],["tickets","ops-tickets"],["staff","ops-staff"],
 ["content","ops-content"],["agenda","ops-agenda"],["training","ops-training"],
 ["tools","ops-tools"],["profile","profile-section"]
];
try{
 const page=await browser.newPage({viewport:{width:1366,height:850}});
 const errors=[];page.on("pageerror",error=>errors.push(error.message));
 await page.route("https://cdn.jsdelivr.net/**",route=>route.abort());
 await page.goto(url,{waitUntil:"load",timeout:30000});
 await page.evaluate(()=>{
  document.body.classList.add("workspace-mode");
  document.getElementById("auth-screen").hidden=true;
  document.getElementById("panel").hidden=false;
  document.getElementById("app-sidebar").hidden=false;
  document.getElementById("workspace").hidden=false;
  document.getElementById("blocked").hidden=true;
  document.getElementById("overview-home").hidden=false;
  window.PROXITI_ACTIVE_SESSION={user:{id:"visual-fixture"},profile:{status:"active",role:"administrator"},
   client:{},};
  document.getElementById("person-name").textContent="Pessoa de Teste";
  window.dispatchEvent(new Event("resize"));
 });
 for(const width of [320,375,430,767,768,930,1199,1200,1366,1920]){
  await page.setViewportSize({width,height:870});
  await page.evaluate(()=>window.dispatchEvent(new Event("resize")));
  await page.waitForTimeout(280); // Aguarda a transição de 220 ms do grid lateral.
  for(const theme of ["light","dark"]){
   await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);
   const data=await page.evaluate(()=>({
    viewport:innerWidth,scroll:document.documentElement.scrollWidth,
    sidebar:document.getElementById("app-sidebar").getBoundingClientRect().width,
    pos:getComputedStyle(document.getElementById("app-sidebar")).position,
    open:document.getElementById("panel").classList.contains("sidebar-collapsed")
   }));
   assert(data.scroll<=width+2,
    "Shell "+width+"/"+theme+" overflow "+JSON.stringify(data));
   if(width>=1200)assert(data.sidebar>=230&&!data.open,
    "Sidebar desktop não expandida "+JSON.stringify(data));
   else if(width>=768)assert(Math.abs(data.sidebar-72)<2,
    "Sidebar tablet não tem 72px "+JSON.stringify(data));
   if([375,1366].includes(width)){
    await page.screenshot({path:resolve(artifacts,"reskin-shell-"+width+"-"+theme+".png"),
     fullPage:false});
   }
  }
  console.log("PASS: shell "+width+"px nos dois temas");
 }
 await page.setViewportSize({width:375,height:850});
 await page.evaluate(()=>window.dispatchEvent(new Event("resize")));
 await page.click("#mobile-nav-toggle");
 await page.waitForFunction(()=>document.getElementById("reskin-nav-scrim").hidden===false);
 assert.equal(await page.isVisible("#app-sidebar"),true);
 await page.click("#reskin-nav-scrim",{position:{x:355,y:400}});
 await page.waitForFunction(()=>document.getElementById("reskin-nav-scrim").hidden===true);
 console.log("PASS: drawer móvel e scrim acessíveis.");
 for(const width of [320,768,1366]){
  await page.setViewportSize({width,height:900});
  await page.evaluate(()=>window.dispatchEvent(new Event("resize")));
  for(const theme of ["light","dark"]){
   await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);
   for(const [view,id]of surfaces){
    await page.evaluate(id=>{
     document.getElementById("overview-home").hidden=id!=="overview-home";
     document.getElementById("operations").hidden=!id.startsWith("ops-");
     document.getElementById("profile-section").hidden=id!=="profile-section";
     for(const node of document.querySelectorAll(".ops-view"))
      node.hidden=node.id!==id;
    },id);
    const data=await page.evaluate(id=>{
     const target=document.getElementById(id).getBoundingClientRect();
     return {width:window.innerWidth,scroll:document.documentElement.scrollWidth,
      left:Math.round(target.left),right:Math.round(target.right),size:Math.round(target.width)};
    },id);
    assert(data.scroll<=width+2,
     view+" "+width+"/"+theme+" rolagem horizontal "+JSON.stringify(data));
    assert(data.left>=-2&&data.right<=width+2,
     view+" "+width+"/"+theme+" painel fora da tela "+JSON.stringify(data));
    if(view==="training"&&[320,1366].includes(width))
     await page.screenshot({path:resolve(artifacts,"reskin-academia-"+width+"-"+theme+".png"),
      fullPage:true});
   }
  }
  console.log("PASS: oito superfícies internas "+width+"px em ambos os temas");
 }
 await page.setViewportSize({width:1366,height:870});
 await page.evaluate(()=>{
  document.getElementById("operations").hidden=false;
  document.getElementById("overview-home").hidden=true;
  document.getElementById("profile-section").hidden=true;
  for(const node of document.querySelectorAll(".ops-view"))
   node.hidden=node.id!=="ops-tools";
 });
 const network=[];page.on("request",request=>network.push(request.url()));
 await page.fill("#subnet-ip","10.0.0.0");
 await page.fill("#subnet-cidr","31");
 await page.click("#subnet-form button[type=submit]");
 const output=await page.textContent("#subnet-result");
 assert(output&&output.includes("10.0.0."),"Calculadora CIDR /31 deixou de responder");
 assert.equal(network.length,0,"Calculadora local fez requisições: "+network.join(", "));
 console.log("PASS: CIDR /31 continua local, sem requisições.");
 await page.evaluate(()=>{
  document.body.classList.remove("workspace-mode");
  document.getElementById("panel").hidden=true;
  document.getElementById("auth-screen").hidden=false;
 });
 for(const width of [320,375,768,1366]){
  await page.setViewportSize({width,height:850});
  for(const theme of ["light","dark"]){
   await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);
   const dimension=await page.evaluate(()=>document.documentElement.scrollWidth);
   assert(dimension<=width+2,"Login "+width+"/"+theme+" overflow "+dimension);
   if(width===375)await page.screenshot({path:resolve(artifacts,
    "reskin-login-"+width+"-"+theme+".png"),fullPage:true});
  }
 }
 assert.deepEqual(errors,[],"Erros JavaScript no reskin");
 console.log("PASS: login visual e menus, oito áreas, ferramentas locais e zero pageerror.");
 await page.close();
}finally{
 await browser.close();
 await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));
}
