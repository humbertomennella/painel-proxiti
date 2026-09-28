import assert from "node:assert/strict";
import {createServer} from "node:http";
import {readFile} from "node:fs/promises";
import {resolve,extname,sep} from "node:path";
import {fileURLToPath} from "node:url";
import {chromium} from "playwright";
const root=resolve(fileURLToPath(new URL("../",import.meta.url)));
const mime={".html":"text/html; charset=utf-8",".js":"application/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".svg":"image/svg+xml",".jpg":"image/jpeg",".webp":"image/webp"};
const server=createServer(async(req,res)=>{try{const part=new URL(req.url,"http://localhost").pathname,file=resolve(root,"."+decodeURIComponent(part==="/"?"/index.html":part));if(!file.startsWith(root+sep)){res.writeHead(403);res.end();return;}res.writeHead(200,{"content-type":mime[extname(file)]||"application/octet-stream","cache-control":"no-store"});res.end(await readFile(file));}catch{res.writeHead(404);res.end("not found")}});
await new Promise(done=>server.listen(0,"127.0.0.1",done));
const browser=await chromium.launch({headless:true,args:["--no-sandbox"]}),base="http://127.0.0.1:"+server.address().port+"/";
let page;const errors=[];try{
 page=await browser.newPage({viewport:{width:390,height:844}});page.on("pageerror",e=>errors.push(e.message));
 await page.route("https://cdn.jsdelivr.net/**",r=>r.abort());await page.goto(base,{waitUntil:"load"});
 await page.evaluate(()=>{
  document.body.classList.add("workspace-mode");for(const id of ["setup","auth-screen"])document.getElementById(id).hidden=true;
  for(const id of ["panel","workspace","operations"])document.getElementById(id).hidden=false;
  const fixture=window.__partnerFixture={profile:null,reviews:0};
  const ok=data=>Promise.resolve({data,error:null});
  const client={
   from(){
    const chain={select(){return chain},eq(){return chain},maybeSingle(){return ok(fixture.profile)}};
    return chain;
   },
   rpc(method,p){
    if(method==="proxiti_partner_save_self"){fixture.profile={user_id:"tech",headline:p.p_headline,bio:p.p_bio,experience_level:p.p_experience,specialties:p.p_specialties,regions:p.p_regions,accepts_remote:p.p_remote,accepts_on_site:p.p_on_site,availability:p.p_availability,availability_note:p.p_availability_note,max_concurrent:p.p_capacity,approved_for_assignment:false};return ok(null);}
    if(method==="proxiti_partner_admin_list")return ok([{user_id:"tech",display_name:"Técnico Teste",status:"active",headline:fixture.profile?.headline||"",experience_level:fixture.profile?.experience_level||"beginner",specialties:fixture.profile?.specialties||[],regions:fixture.profile?.regions||[],accepts_remote:fixture.profile?.accepts_remote??true,accepts_on_site:fixture.profile?.accepts_on_site??false,availability:fixture.profile?.availability||"unavailable",availability_note:"",max_concurrent:1,approved_for_assignment:fixture.reviews>0,reviewed_at:null,admin_note:"",open_tickets:0}]);
    if(method==="proxiti_partner_admin_review"){fixture.reviews++;return ok(null)}
    return Promise.resolve({data:null,error:{message:"RPC inesperada "+method}});
   }
  };
  window.__partnerClient=client;
  window.PROXITI_ACTIVE_SESSION={client,user:{id:"tech"},profile:{role:"technician",status:"active"}};
 });
 await page.evaluate(async()=>window.PROXITI_PARTNERS_V17.loadOwn());
 await page.waitForFunction(()=>!document.getElementById("partner-v17-self").hidden);
 await page.fill("#partner-v17-headline","Suporte remoto e redes");
 await page.check('.partner-v17-specialties input[value="support"]');
 await page.selectOption("#partner-v17-availability","available");
 await page.click('#partner-v17-self button[type="submit"]');
 await page.waitForFunction(()=>window.__partnerFixture.profile?.availability==="available");
 assert((await page.textContent("#partner-v17-self-review")).includes("habilitação administrativa"));
 await page.evaluate(async()=>{
   window.PROXITI_ACTIVE_SESSION={client:window.__partnerClient,user:{id:"admin"},profile:{role:"administrator",status:"active"}};
   document.querySelectorAll("#operations [data-admin-only]").forEach(n=>n.hidden=false);
   document.getElementById("partner-v17-admin").hidden=false;
   await window.PROXITI_PARTNERS_V17.loadAdmin();
 });
 await page.waitForFunction(()=>document.querySelectorAll("#partner-v17-admin-list .partner-v17-card").length===1);
 assert((await page.textContent("#partner-v17-admin-list")).includes("Suporte remoto e redes"));
 const size=await page.evaluate(()=>({d:document.documentElement.scrollWidth,w:innerWidth}));assert(size.d<=size.w+4);
 assert.deepEqual(errors,[]);
 console.log("PASS: parceiro atualiza disponibilidade e administração consulta perfil sem aceite automático.");
}finally{if(page)await page.close();await browser.close();await new Promise(done=>server.close(done));}
