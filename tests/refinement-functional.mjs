import assert from "node:assert/strict";
import {createServer} from "node:http";
import {readFile,mkdir} from "node:fs/promises";
import {resolve,extname,sep} from "node:path";
import {fileURLToPath} from "node:url";
import {chromium} from "playwright";

const root=resolve(fileURLToPath(new URL("../",import.meta.url)));
const mime={".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",
 ".css":"text/css; charset=utf-8",".svg":"image/svg+xml",".webp":"image/webp"};
const server=createServer(async(req,res)=>{
 try{
  const pathname=new URL(req.url,"http://localhost").pathname;
  const file=resolve(root,"."+decodeURIComponent(pathname==="/"?"/index.html":pathname));
  if(!file.startsWith(root+sep)){res.writeHead(403);res.end();return;}
  const body=await readFile(file);
  res.writeHead(200,{"content-type":mime[extname(file)]||"application/octet-stream","cache-control":"no-store"});
  res.end(body);
 }catch{res.writeHead(404);res.end("Not found");}
});
await new Promise(done=>server.listen(0,"127.0.0.1",done));
const base="http://127.0.0.1:"+server.address().port+"/";
const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
const artifacts=resolve(root,"artifacts");await mkdir(artifacts,{recursive:true});
const views=["tickets","staff","agenda","tools","library","equipment","clients","reports","users","settings"];
const errors=[];
try{
 for(const width of [320,375,768,1366,1920]){
  const page=await browser.newPage({viewport:{width,height:900}});
  page.on("pageerror",error=>errors.push(width+": "+error.message));
  await page.route("https://cdn.jsdelivr.net/**",route=>route.abort());
  await page.goto(base,{waitUntil:"load",timeout:30000});
  await page.evaluate(()=>{
   document.body.classList.add("workspace-mode");
   for(const name of ["auth-screen","blocked","setup"])document.getElementById(name).hidden=true;
   for(const name of ["panel","workspace","app-sidebar"])document.getElementById(name).hidden=false;
   document.getElementById("overview-home").hidden=false;
  });
  const search=page.locator("#central-global-search-input");
  assert(await search.isVisible(),"Busca global ausente em "+width+"px");
  await search.fill("biblioteca");
  await page.waitForFunction(()=>!document.getElementById("central-global-search-results").hidden);
  assert((await page.locator("#central-global-search-results").innerText()).includes("Biblioteca Técnica"),
   "Busca global não encontra a Biblioteca");
  await search.press("Escape");
  assert(await page.isHidden("#central-global-search-results"),"Busca não fecha com Escape");
  await page.click("#open-profile");
  assert(await page.isVisible("#central-account-menu"),"Menu de conta não abre");
  await page.click("#account-menu-sound");
  assert.equal(await page.textContent("#account-menu-sound"),"Ativar som","Som não desativa");
  assert.equal(await page.evaluate(()=>window.PROXITI_ALERTS.enabled),false);
  await page.click("#account-menu-sound");
  assert.equal(await page.textContent("#account-menu-sound"),"Desativar som","Som não reativa");
  assert.equal(await page.evaluate(()=>window.PROXITI_ALERTS.enabled),true);
  await page.click("#account-menu-profile");
  assert.equal(await page.isHidden("#profile-section"),false,"Meu Perfil não abriu pelo menu");
  await page.evaluate(()=>{
   document.getElementById("profile-section").hidden=true;
   document.getElementById("operations").hidden=true;
   document.getElementById("overview-home").hidden=false;
  });
  const home=await page.locator("#overview-home .overview-banner").boundingBox();
  const main=await page.locator("#panel-main").boundingBox();
  assert(home&&main&&Math.abs(home.x-main.x)<=2&&home.height>=240,
   "Hero Início não acompanha largura/altura UniProxiti: "+width);
  for(const view of [...views,"training","profile"]){
   await page.evaluate(name=>{
    document.getElementById("overview-home").hidden=true;
    document.getElementById("profile-section").hidden=name!=="profile";
    document.getElementById("operations").hidden=name==="profile";
    for(const panel of document.querySelectorAll(".ops-view"))panel.hidden=panel.id!=="ops-"+name;
    if(name==="training")document.getElementById("uniproxiti-dashboard").hidden=false;
   },view);
   const selector=view==="training"?"#ops-training .academy-learning-hero":
    view==="profile"?"#profile-section>.central-page-hero":"#ops-"+view+">.central-page-hero";
   const geometry=await page.locator(selector).boundingBox();
   assert(geometry&&Math.abs(geometry.x-main.x)<=2&&geometry.height>=240,
    width+"px / "+view+": banner sem encaixe full-bleed: "+JSON.stringify(geometry));
   assert(geometry.x+geometry.width<=width+2,width+"px / "+view+": banner excede viewport");
   if(view!=="training"){
    const image=page.locator(selector+" img");
    const photo=await image.evaluate(async img=>{
      img.loading="eager";
      const response=await fetch(img.src);
      if(!response.ok)return {ok:false,url:img.src,status:response.status};
      try{await img.decode();}catch{
       const preloaded=new Image();preloaded.src=img.src;
       try{await preloaded.decode();}catch{return {ok:false,url:img.src,status:response.status};}
      }
      return {ok:img.naturalWidth>0,url:img.src,status:response.status};
    });
    assert(photo.ok,view+": fotografia não carregou: "+JSON.stringify(photo));
   }
   if(view==="library")assert.equal(await page.locator("#training-list").count(),1);
   if(view==="training")assert.equal(await page.locator(".uniproxiti-stat-icon").count(),3);
   if([375,1366].includes(width)&&["training","library","profile"].includes(view))
    await page.screenshot({path:resolve(artifacts,"refino-"+view+"-"+width+".png"),fullPage:false});
  }
  if(width>=931){
   const sizes=await page.evaluate(async()=>{
    const side=document.getElementById("app-sidebar"),panel=document.getElementById("panel"),main=document.getElementById("panel-main");
    panel.classList.add("sidebar-collapsed");const compact=side.getBoundingClientRect().width,left=main.getBoundingClientRect().left;
    panel.classList.remove("sidebar-collapsed");await new Promise(resolve=>setTimeout(resolve,340));
    const expanded=side.getBoundingClientRect().width;
    return {compact,expanded,left,transition:getComputedStyle(side).transitionProperty};
   });
   assert(sizes.compact<=73&&sizes.expanded>=239&&sizes.left===72&&sizes.transition.includes("width"),
    "Sidebar não expande como sobreposição sem deslocar conteúdo: "+JSON.stringify(sizes));
  }
  const span=await page.evaluate(()=>document.documentElement.scrollWidth);
  assert(span<=width+2,width+"px: overflow horizontal "+span);
  console.log("PASS: refinamento em "+width+"px: busca, menu, alertas, banners e encaixe.");
  await page.close();
 }
 assert.deepEqual(errors,[],"Erros de execução no navegador");
 console.log("PASS: 12 banners e menu/busca/áudio em cinco larguras, fotos carregadas.");
}finally{
 await browser.close();
 await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));
}
