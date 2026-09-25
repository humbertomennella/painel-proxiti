import assert from "node:assert/strict";
import {createServer} from "node:http";
import {readFile, mkdir} from "node:fs/promises";
import {resolve, extname, sep} from "node:path";
import {fileURLToPath} from "node:url";
import {chromium} from "playwright";

const root=resolve(fileURLToPath(new URL("../",import.meta.url)));
const mime={".html":"text/html; charset=utf-8",".js":"application/javascript; charset=utf-8",
 ".css":"text/css; charset=utf-8",".svg":"image/svg+xml",".png":"image/png",".ico":"image/x-icon"};
const server=createServer(async(req,res)=>{
 try{
   const pathname=new URL(req.url,"http://localhost").pathname;
   const file=resolve(root,"."+decodeURIComponent(pathname==="/"?"/index.html":pathname));
   if(!file.startsWith(root+sep)){res.writeHead(403);res.end();return;}
   const body=await readFile(file);
   res.writeHead(200,{"content-type":mime[extname(file)]||"application/octet-stream",
     "cache-control":"no-store"});res.end(body);
 }catch{res.writeHead(404);res.end("Not found");}
});
await new Promise(ok=>server.listen(0,"127.0.0.1",ok));
const url="http://127.0.0.1:"+server.address().port+"/";
const artifacts=resolve(root,"artifacts");
await mkdir(artifacts,{recursive:true});
const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
let checks=0;
try{
 for(const width of [320,375,430,768,1366]){
   const page=await browser.newPage({viewport:{width,height:800},deviceScaleFactor:1});
   await page.route("https://cdn.jsdelivr.net/**",r=>r.abort());
   await page.goto(url,{waitUntil:"load",timeout:30000});
   await page.evaluate(()=>{
     document.documentElement.dataset.theme="light";
     document.body.classList.add("workspace-mode");
     document.getElementById("auth-screen").hidden=true;
     document.getElementById("panel").hidden=false;
     document.getElementById("workspace").hidden=false;
     document.getElementById("overview-home").hidden=false;
     document.getElementById("app-sidebar").hidden=true;
   });
   await page.evaluate(()=>document.fonts.ready);
   const v=await page.evaluate(()=>{
     const ids=["overview-focus-toggle","overview-reading-toggle","overview-guide-toggle"];
     const rect=id=>{
       const el=document.getElementById(id),r=el.getBoundingClientRect();
       return {width:r.width,height:r.height,left:r.left,right:r.right,top:r.top,bottom:r.bottom};
     };
     const buttons=Object.fromEntries(ids.map(id=>[id,rect(id)]));
     const icon=document.querySelector("#overview-guide-toggle svg").getBoundingClientRect();
     return {scrollWidth:document.documentElement.scrollWidth,viewport:window.innerWidth,
       buttons,icon:{width:icon.width,height:icon.height},
       title:rect("overview-heading"),banner:rect("overview-banner-title"),
       offenders:[...document.querySelectorAll("body *")].map(el=>({
         element:el.tagName.toLowerCase()+(el.id?"#"+el.id:"")+
           (typeof el.className==="string"?"."+el.className.trim().split(/\\s+/).join("."):""),
         right:Math.round(el.getBoundingClientRect().right),
         width:Math.round(el.getBoundingClientRect().width)
       })).filter(x=>x.right>window.innerWidth+2&&x.width>1).slice(0,16)};
   });
   assert(v.scrollWidth<=v.viewport+2,
     width+"px: rolagem horizontal ("+v.scrollWidth+">"+v.viewport+"). Excedentes: "+JSON.stringify(v.offenders));
   for(const [id,r]of Object.entries(v.buttons)){
     assert(r.width>=44&&r.height>=44,width+"px: alvo muito pequeno "+id);
     assert(r.left>=-1&&r.right<=width+1,width+"px: botão fora da tela "+id);
   }
   assert(v.icon.width<=24&&v.icon.height<=24,
     width+"px: ícone de ajuda desproporcional ("+v.icon.width+"x"+v.icon.height+")");
   if(width<=760){
     assert(v.buttons["overview-focus-toggle"].bottom<=v.buttons["overview-reading-toggle"].top+2,
       width+"px: controles móveis sem fluxo vertical");
     assert(Math.abs(v.buttons["overview-reading-toggle"].top-v.buttons["overview-guide-toggle"].top)<=2,
       width+"px: Leitura e Ajuda não estão alinhados");
   }
   if(width===375||width===1366){
     await page.screenshot({path:resolve(artifacts,"central-"+width+"-light.png"),fullPage:false});
     await page.evaluate(()=>document.documentElement.dataset.theme="dark");
     await page.screenshot({path:resolve(artifacts,"central-"+width+"-dark.png"),fullPage:false});
   }
   checks++;
   console.log("PASS: viewport "+width+"px, sem overflow, controles alcançáveis e ajuda "+v.icon.width+"px");
   await page.close();
 }
 console.log("PASS: "+checks+" larguras verificadas nos dois temas (capturas de 375 e 1366px).");
}finally{
 await browser.close();
 await new Promise((resolve,reject)=>server.close(err=>err?reject(err):resolve()));
}
