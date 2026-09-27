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
async function openScenario({materials=[],admin=false,failTraining=false,deferTraining=false,ambiguousSave=false,conflictSave=false,startView="training",progressFixture=[],failGrade=false,quizAttemptsFixture=[],requiredOverrides={}}={}){
 const page=await browser.newPage({viewport:{width:375,height:850},deviceScaleFactor:1});
 page.__errors=[];
 page.on("pageerror",error=>page.__errors.push(error.message));
 await page.route("https://cdn.jsdelivr.net/**",route=>route.abort());
 await page.goto(url,{waitUntil:"load",timeout:30000});
 await page.evaluate(({materials,admin,failTraining,deferTraining,ambiguousSave,conflictSave,startView,progressFixture,failGrade,quizAttemptsFixture,requiredOverrides})=>{
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
     training:structuredClone(materials),versions:[],progress:structuredClone(progressFixture),certificates:[],failGrade,
     quizAttempts:structuredClone(quizAttemptsFixture),academyCourses:window.PROXITI_ACADEMY_CURRICULUM.courses.map(course=>({
       code:course.id,track_id:course.track,curriculum_version:"2026-09-v1",active:true,
       required:Object.prototype.hasOwnProperty.call(requiredOverrides,course.id)?requiredOverrides[course.id]:true
     }))
   };
   const tables={
     support_tickets:"tickets",support_messages:"messages",
     ticket_read_receipts:"read",staff_presence:"staff_presence",
     ticket_internal_notes:"notes",ticket_tasks:"tasks",ticket_reports:"reports",
     ticket_attachments:"attachments",ticket_devices:"devices",ticket_appointments:"appointments",ticket_audit:"audit",
     ticket_appointment_reschedules:"appointmentReschedules",
     training_materials:"training",training_material_versions:"versions",profiles:"staff",
     academy_course_progress:"progress",academy_certificates:"certificates",
     academy_courses:"academyCourses",academy_quiz_attempts:"quizAttempts"
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
       if(name==="proxiti_academy_questions"){
         if(args.p_course){
           const course=window.PROXITI_ACADEMY_CURRICULUM.courses.find(x=>x.id===args.p_course);
           return ok(Array.from({length:4},(_,i)=>({code:course.id+"-q"+(i+1),
             prompt:"Qual procedimento respeita a aula "+course.title+"?",track_id:course.track,
             options:["Procedimento autorizado","Alteração sem autorização","Ignorar evidências","Expor dados"],
             critical:false})));
         }
         const tracks=window.PROXITI_ACADEMY_CURRICULUM.tracks;
         return ok(Array.from({length:24},(_,i)=>({code:"final-"+String(i+1).padStart(2,"0"),
           track_id:tracks[Math.floor(i/3)].id,prompt:"Qual decisão se aplica à questão "+(i+1)+"?",
           options:["Conduta correta","Conduta indevida","Ignorar contexto","Divulgar dados"],
           critical:[10,11,19,20].includes(i+1)})));
       }
       if(name==="proxiti_academy_submit_quiz"){
         if(fixture.failGrade)return error("Correção temporariamente indisponível");
         const values=Object.values(args.p_answers),correct=values.filter(x=>x===0).length;
         const score=correct*25,passed=score>=75;
         const old=fixture.progress.find(x=>x.course_id===args.p_course);
         if(old){old.best_score=Math.max(old.best_score,score);old.last_score=score;
           old.attempts++;old.updated_at=new Date().toISOString();
           if(passed&&!old.completed_at)old.completed_at=new Date().toISOString();}
         else fixture.progress.push({course_id:args.p_course,curriculum_version:"2026-09-v1",
           best_score:score,last_score:score,attempts:1,updated_at:new Date().toISOString(),
           completed_at:passed?new Date().toISOString():null});
         fixture.quizAttempts.push({course_id:args.p_course,score,passed,
           curriculum_version:"2026-09-v1",created_at:new Date().toISOString()});
         return ok({score,passed,correct,total:4,review:Object.keys(args.p_answers).map(code=>({
           code,correct:args.p_answers[code]===0,correct_index:0,
           explanation:"O procedimento correto respeita autorização e evidências."
         }))});
       }
       if(name==="proxiti_academy_submit_exam"){
         const values=Object.values(args.p_answers),correct=values.filter(x=>x===0).length;
         const score=Math.round(correct*10000/24)/100;
         const avg=fixture.progress.reduce((n,x)=>n+Number(x.best_score),0)/16;
         const overall=Math.round((avg*.6+score*.4)*100)/100;
         const critical=[10,11,19,20].every(n=>args.p_answers["final-"+
           String(n).padStart(2,"0")]===0);
         const passed=score>=75&&overall>=80&&critical;
         if(passed&&!fixture.certificates.length)fixture.certificates.push({
           id:crypto.randomUUID(),verification_code:"PXI-ACA-TESTE-VALIDO",
           holder_name:profile.display_name,curriculum_version:"2026-09-v1",course_count:16,
           quiz_average:avg,exam_score:score,overall_score:overall,issued_at:new Date().toISOString()
         });
         const by_track={};
         for(const t of window.PROXITI_ACADEMY_CURRICULUM.tracks)by_track[t.id]={correct:3,total:3};
         return ok({score,quiz_average:avg,overall_score:overall,correct,total:24,
           critical_correct:critical,passed,by_track,certificate:passed?fixture.certificates[0]:null});
       }
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
 },{materials,admin,failTraining,deferTraining,ambiguousSave,conflictSave,startView,progressFixture,failGrade,quizAttemptsFixture,requiredOverrides});
 await page.waitForFunction(()=>["ready","partial","error","restricted"].includes(
   document.getElementById("overview-sync-state").dataset.phase),{timeout:12000});
 await page.evaluate(()=>window.PROXITI_OPEN_VIEW("training"));
 await page.waitForFunction(()=>!document.getElementById("ops-training").hidden);
 return page;
}

function test(name,fn){return fn().then(()=>console.log("PASS: "+name));}
const ids=["at-01","at-02","pc-01","pc-02","re-01","re-02","se-01","se-02",
 "bk-01","bk-02","in-01","in-02","pr-01","pr-02","op-01","op-02"];
const complete=()=>ids.map(course_id=>({course_id,curriculum_version:"2026-09-v1",
 best_score:85,last_score:85,attempts:1,completed_at:new Date().toISOString(),
 updated_at:new Date().toISOString()}));
async function first(page){
 await page.locator(".academy-track-card").first().evaluate(node=>node.open=true);
 await page.locator(".academy-course-card").first().click();
 await page.waitForFunction(()=>document.querySelectorAll("#academy-quiz-form fieldset").length===4);
}
async function select(page,selector,total,wrong=[]){
 for(let i=0;i<total;i++)await page.locator(selector+" fieldset").nth(i)
   .locator('input[value="'+(wrong.includes(i+1)?1:0)+'"]').check();
}
try{
 await test("Oito trilhas, dezesseis aulas e imagens originais",async()=>{
   const page=await openScenario();
   try{
     await page.waitForFunction(()=>document.querySelectorAll(".academy-track-card").length===8);
     assert.equal(await page.locator(".academy-course-card").count(),16);
     assert.equal(await page.locator(".academy-track-summary img").count(),8);
     assert.equal(await page.isDisabled("#academy-learning-open-exam"),true);
     assert.deepEqual(page.__errors,[]);
   }finally{await page.close();}
 });
 await test("Dashboard não inventa dados para uma conta sem histórico",async()=>{
   const page=await openScenario();
   try{
     await page.waitForFunction(()=>!document.getElementById("uniproxiti-dashboard").hidden);
     assert.equal(await page.textContent("#uniproxiti-approved"),"0 de 16");
     assert.equal(await page.textContent("#uniproxiti-progress-percent"),"0%");
     assert.equal(await page.textContent("#uniproxiti-last-score"),"—");
     assert.equal(await page.textContent("#uniproxiti-cert-status"),"Em andamento");
     assert.equal(await page.locator("#uniproxiti-certificate-card").isVisible(),false);
     assert.equal(await page.locator(".uniproxiti-track-category").first().textContent(),"Obrigatória");
     assert((await page.textContent("#uniproxiti-activity-list")).includes("Nenhuma atividade registrada"));
     await page.click("#uniproxiti-continue");
     await page.waitForFunction(()=>document.querySelectorAll("#academy-quiz-form fieldset").length===4);
     assert.deepEqual(page.__errors,[]);
   }finally{await page.close();}
 });
 await test("Dashboard deriva nota, feed, progresso e classificação de dados do servidor",async()=>{
   const older="2026-09-20T12:00:00.000Z",newer="2026-09-22T15:00:00.000Z";
   const page=await openScenario({
     progressFixture:[
       {course_id:"at-01",curriculum_version:"2026-09-v1",best_score:75,
        last_score:75,attempts:1,completed_at:older,updated_at:older},
       {course_id:"pc-01",curriculum_version:"2026-09-v1",best_score:50,
        last_score:50,attempts:1,completed_at:null,updated_at:newer}],
     quizAttemptsFixture:[
       {course_id:"at-01",curriculum_version:"2026-09-v1",score:75,passed:true,created_at:older},
       {course_id:"pc-01",curriculum_version:"2026-09-v1",score:50,passed:false,created_at:newer}],
     requiredOverrides:{"pc-01":false,"pc-02":false}
   });
   try{
     await page.waitForFunction(()=>document.getElementById("uniproxiti-approved").textContent==="1 de 16");
     assert.equal(await page.textContent("#uniproxiti-progress-percent"),"6%");
     assert((await page.textContent("#uniproxiti-last-score")).includes("50,00"));
     assert((await page.textContent("#uniproxiti-average-score")).includes("75,00"));
     assert((await page.textContent("#uniproxiti-resume-title")).includes("Diagnóstico de lentidão"));
     assert((await page.textContent("#uniproxiti-resume-progress")).includes("trilha: 0 de 2 aulas (0%)"));
     assert((await page.textContent("#uniproxiti-activity-list")).includes("Quiz realizado"));
     assert((await page.textContent("#uniproxiti-activity-list")).includes("Aula concluída"));
     assert.equal(await page.locator(".uniproxiti-track-category").nth(1).textContent(),"Recomendada");
     const requests=await page.evaluate(()=>window.__fixture.calls.filter(name=>
       ["academy_courses","academy_course_progress","academy_certificates","academy_quiz_attempts"].includes(name)));
     assert(requests.includes("academy_quiz_attempts")&&requests.includes("academy_courses"));
     await mkdir(resolve(root,"artifacts"),{recursive:true});
     for(const width of [320,375,1366]){
       await page.setViewportSize({width,height:850});
       for(const theme of ["light","dark"]){
         await page.evaluate(value=>document.documentElement.dataset.theme=value,theme);
         const audit=await page.evaluate(()=>{
           const rgb=value=>String(value).match(/[0-9.]+/g).slice(0,3).map(Number);
           const lum=value=>{
             const [r,g,b]=rgb(value).map(v=>{
               const x=v/255;return x<=.04045?x/12.92:((x+.055)/1.055)**2.4;
             });
             return .2126*r+.7152*g+.0722*b;
           };
           const ratio=(a,b)=>{const x=lum(a),y=lum(b);
             return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
           const stat=document.querySelector(".uniproxiti-stat");
           const muted=stat.querySelector("small");
           const chip=document.querySelector("#overview-home .overview-quick span");
           return {
             scroll:document.documentElement.scrollWidth,
             statContrast:ratio(getComputedStyle(muted).color,getComputedStyle(stat).backgroundColor),
             chipContrast:ratio(getComputedStyle(chip).color,getComputedStyle(chip).backgroundColor)
           };
         });
         assert(audit.scroll<=width+2,"Dashboard com rolagem horizontal: "+width+"/"+theme+" "+JSON.stringify(audit));
         assert(audit.statContrast>=4.5&&audit.chipContrast>=4.5,
           "Contraste AA insuficiente: "+width+"/"+theme+" "+JSON.stringify(audit));
         if([375,1366].includes(width))
           await page.screenshot({path:resolve(root,"artifacts","uniproxiti-dashboard-"+width+"-"+theme+".png"),fullPage:true});
       }
     }
     await page.click("#uniproxiti-resume-action");
     await page.waitForFunction(()=>document.getElementById("academy-lesson-content").textContent
       .includes("Computadores e notebooks"));
     assert.deepEqual(page.__errors,[]);
   }finally{await page.close();}
 });
  await test("Quatro questões são corrigidas e aprovação 75 fica salva",async()=>{
   const page=await openScenario();
   try{
     await first(page);await select(page,"#academy-quiz-form",4,[4]);
     await page.locator("#academy-quiz-form button[type=submit]").click();
     await page.waitForFunction(()=>window.__fixture.progress.length===1);
     assert.equal(await page.evaluate(()=>window.__fixture.progress[0].best_score),75);
     assert((await page.textContent("#academy-quiz-result")).includes("75,00 / 100"));
     assert((await page.textContent("#academy-learning-summary")).includes("1 / 16"));
     assert.deepEqual(page.__errors,[]);
   }finally{await page.close();}
 });
 await test("Falha no servidor não simula nota nem certificado",async()=>{
   const page=await openScenario({failGrade:true});
   try{
     await first(page);await select(page,"#academy-quiz-form",4);
     await page.locator("#academy-quiz-form button[type=submit]").click();
     await page.waitForFunction(()=>document.getElementById("academy-quiz-status").textContent.toLowerCase()
       .includes("não foi possível confirmar"));
     assert.equal(await page.evaluate(()=>window.__fixture.progress.length),0);
     assert.equal(await page.evaluate(()=>window.__fixture.certificates.length),0);
     await page.evaluate(()=>window.__fixture.failGrade=false);
     await page.locator("#academy-quiz-form button[type=submit]").click();
     await page.waitForFunction(()=>window.__fixture.progress.length===1);
   }finally{await page.close();}
 });
 await test("Prova bloqueada até completar todos os cursos",async()=>{
   const page=await openScenario();
   try{
     assert.equal(await page.isDisabled("#academy-learning-open-exam"),true);
     await page.click("#academy-learning-show-certificate");
     assert.equal(await page.isHidden("#academy-certificate-print"),true);
   }finally{await page.close();}
 });
 await test("Prova emite certificado interno apenas após aprovação",async()=>{
   const page=await openScenario({progressFixture:complete()});
   page.on("dialog",dialog=>dialog.accept());
   try{
     await page.waitForFunction(()=>!document.getElementById("academy-learning-open-exam").disabled);
     await page.click("#academy-learning-open-exam");
     await page.waitForFunction(()=>document.querySelectorAll("#academy-exam-form fieldset").length===24);
     assert.equal(await page.locator("#academy-exam-form .academy-critical").count(),4);
     await select(page,"#academy-exam-form",24);
     await page.locator("#academy-exam-form button[type=submit]").click();
     await page.waitForFunction(()=>window.__fixture.certificates.length===1);
     assert((await page.textContent("#academy-exam-result")).includes("91,00"));
     await page.click("#academy-learning-show-tracks");
     assert.equal(await page.locator("#uniproxiti-certificate-card").isVisible(),true);
     assert.equal(await page.textContent("#uniproxiti-cert-status"),"Disponível");
     await page.click("#academy-learning-show-certificate");
     const [popup]=await Promise.all([page.waitForEvent("popup"),
       page.click("#academy-certificate-print")]);
     await popup.waitForSelector(".paper");
     assert((await popup.textContent(".paper")).includes("PXI-ACA-TESTE-VALIDO"));
     assert((await popup.textContent(".paper")).includes("Documento interno e institucional"));
     await popup.close();assert.deepEqual(page.__errors,[]);
   }finally{await page.close();}
 });
 await test("Nota alta com erro crítico não emite certificado",async()=>{
   const page=await openScenario({progressFixture:complete()});
   page.on("dialog",dialog=>dialog.accept());
   try{
     await page.click("#academy-learning-open-exam");
     await page.waitForFunction(()=>document.querySelectorAll("#academy-exam-form fieldset").length===24);
     await select(page,"#academy-exam-form",24,[10]);
     await page.locator("#academy-exam-form button[type=submit]").click();
     await page.waitForFunction(()=>document.getElementById("academy-exam-result").textContent
       .includes("questões críticas"));
     assert.equal(await page.evaluate(()=>window.__fixture.certificates.length),0);
   }finally{await page.close();}
 });
 await test("Aula carregada não transborda em cinco larguras e dois temas",async()=>{
   const page=await openScenario();
   try{
     await first(page);
     const dir=resolve(root,"artifacts");await mkdir(dir,{recursive:true});
     for(const width of [320,375,430,768,1366]){
       await page.setViewportSize({width,height:875});
       for(const theme of ["light","dark"]){
         await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);
         const g=await page.evaluate(()=>({width:window.innerWidth,
           scroll:document.documentElement.scrollWidth}));
         assert(g.scroll<=width+2,width+"/"+theme+" overflow "+JSON.stringify(g));
         if([375,1366].includes(width))
           await page.screenshot({path:resolve(dir,"academia-curso-"+width+"-"+theme+".png"),fullPage:true});
       }
     }
     assert.deepEqual(page.__errors,[]);
   }finally{await page.close();}
 });
 console.log("PASS: nove fluxos de capacitação, dashboard real, prova e certificado com contas simuladas.");
}finally{
 await browser.close();
 await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));
}
