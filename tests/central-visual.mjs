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

// Shared scenario structure mirrors the existing integration harness. All data is test-only.
const shots=resolve(root,"artifacts","central-completo");await mkdir(shots,{recursive:true});
const surfaces=["overview","tickets","staff","content","agenda","training","tools","profile"];
try{
 const page=await openScenario({admin:true,progressFixture:[{course_id:"at-01",best_score:100,last_score:100,attempts:1,completed_at:stamp,updated_at:stamp}],quizAttemptsFixture:[{course_id:"at-01",score:100,passed:true,created_at:stamp}]});
 await page.evaluate(()=>document.getElementById("person-name").textContent="Conta de teste");
 for(const width of [1920,1366,768,375,320]){
  await page.setViewportSize({width,height:1000});
  await page.evaluate(()=>window.dispatchEvent(new Event("resize")));
  for(const theme of ["light","dark"]){
   await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);
   for(const view of surfaces){
    await page.evaluate(v=>window.PROXITI_OPEN_VIEW(v),view);
    await page.waitForTimeout(100);
    const size=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,side:document.getElementById("app-sidebar").getBoundingClientRect().width}));
    assert(size.scroll<=width+1,`${view} ${width} ${theme} overflow ${JSON.stringify(size)}`);
    if(width>=1200)assert.equal(size.side,240);
    else if(width>=768)assert.equal(size.side,72);
    if([1920,1366,375].includes(width))await page.screenshot({path:resolve(shots,`${view}-${width}-${theme}.png`),fullPage:true});
   }
   console.log(`PASS: eight areas at ${width}px, ${theme}, no overflow`);
  }
 }
 await page.setViewportSize({width:375,height:850});
 await page.click("#mobile-nav-toggle");
 await page.waitForFunction(()=>document.activeElement.closest("#app-sidebar"));
 await page.keyboard.press("Escape");
 await page.waitForFunction(()=>document.activeElement.id==="mobile-nav-toggle"&&!document.getElementById("panel-main").inert);
 await page.click("#mobile-nav-toggle");
 await page.locator("#reskin-nav-scrim").click({position:{x:355,y:500}});
 assert.equal(await page.getAttribute("#mobile-nav-toggle","aria-expanded"),"false");
 console.log("PASS: mobile drawer focus, Escape and backdrop");
 await page.evaluate(()=>window.PROXITI_OPEN_VIEW("training"));
 await page.locator(".academy-track-summary").first().click();
 assert(await page.locator(".academy-course-card").first().isVisible());
 await page.locator(".academy-course-card").first().click();
 await page.waitForFunction(()=>document.querySelectorAll("#academy-quiz-form fieldset").length===4);
 assert.deepEqual(page.__errors,[],"JavaScript errors");
 await page.close();
 const login=await browser.newPage();await login.route("https://cdn.jsdelivr.net/**",r=>r.abort());await login.goto(url);
 for(const width of [1920,1366,768,375,320])for(const theme of ["light","dark"]){
  await login.setViewportSize({width,height:1000});await login.evaluate(t=>document.documentElement.dataset.theme=t,theme);
  assert(await login.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`login overflow ${width}`);
  if([1366,375].includes(width))await login.screenshot({path:resolve(shots,`login-${width}-${theme}.png`),fullPage:true});
 }
 await login.close();
 console.log("PASS: login all widths/themes, native course disclosure and questionnaire, zero pageerror");
}finally{await browser.close();await new Promise(done=>server.close(done));}
