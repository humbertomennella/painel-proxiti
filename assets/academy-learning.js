(() => {
"use strict";
const el=id=>document.getElementById(id),root=el("academy-learning-root");
const data=window.PROXITI_ACADEMY_CURRICULUM;
if(!root||!data||data.version!=="2026-09-v1")return;
const courses=new Map(data.courses.map(course=>[course.id,course]));
const tracks=new Map(data.tracks.map(track=>[track.id,track]));
const VERSION=data.version;
const session=()=>window.PROXITI_ACTIVE_SESSION;
const authorized=s=>!!s?.user&&!!s.client&&s.profile?.status==="active"&&
 (s.profile.role==="administrator"||s.profile.permissions?.training===true);
const valid=(generation,s)=>generation===revision&&authorized(session())&&
 session()?.user?.id===s.user.id&&session()?.client===s.client;
const make=(tag,text="",cls="")=>{
 const node=document.createElement(tag);
 if(text!==null)node.textContent=String(text);
 if(cls)node.className=cls;
 return node;
};
const request=async promise=>{
 const {data,error}=await promise;
 if(error)throw new Error(error.message||"Operação não confirmada.");
 return data;
};
const points=n=>Number.isFinite(Number(n))?Number(n).toFixed(2).replace(".",","):"—";
const formatDate=value=>new Date(value).toLocaleDateString("pt-BR",
 {day:"2-digit",month:"long",year:"numeric"});
const setStatus=(message,phase="ready")=>{
 const target=el("academy-learning-status");
 target.textContent=message;target.dataset.phase=phase;
};
let revision=0,progress=new Map(),certificate=null,loading=false,
 selected=null,quizQuestions=[],examQuestions=[],mode="tracks",quizBusy=false,examBusy=false;
function clear(){
 revision++;progress.clear();certificate=null;selected=null;loading=false;
 quizQuestions=[];examQuestions=[];quizBusy=false;examBusy=false;
 el("academy-track-list").replaceChildren();
 el("academy-learning-summary").replaceChildren(
   make("p","Entre na Central com uma conta autorizada para acompanhar sua capacitação."));
 el("academy-quiz-form").replaceChildren();el("academy-exam-form").replaceChildren();
 el("academy-quiz-result").replaceChildren();el("academy-exam-result").replaceChildren();
 el("academy-certificate-detail").replaceChildren();
 el("academy-certificate-print").hidden=true;
 el("academy-learning-open-exam").disabled=true;
 mode="tracks";show("tracks");
 setStatus("Capacitação disponível apenas para profissionais autorizados.","restricted");
}
function passedCount(){
 return data.courses.filter(course=>progress.get(course.id)?.completed_at).length;
}
function averagePassed(){
 const scores=data.courses.map(course=>progress.get(course.id))
   .filter(item=>item?.completed_at).map(item=>Number(item.best_score));
 return scores.length?scores.reduce((sum,n)=>sum+n,0)/scores.length:null;
}
function show(next){
 mode=next;
 el("academy-track-list").hidden=next!=="tracks";
 el("academy-lesson-panel").hidden=next!=="lesson";
 el("academy-exam-panel").hidden=next!=="exam";
 el("academy-certificate-panel").hidden=next!=="certificate";
 const btn=el("academy-learning-open-exam");
 btn.disabled=passedCount()!==data.courses.length||!authorized(session());
 btn.textContent=passedCount()===data.courses.length?
   "Iniciar / refazer prova final":"Prova final · concluir 16 cursos";
}
function summary(){
 if(!authorized(session()))return;
 const done=passedCount(),avg=averagePassed(),area=el("academy-learning-summary");
 area.replaceChildren();
 const panel=make("div",null,"academy-progress-panel");
 const item=(name,value,description)=>{
   const card=make("div",null,"academy-progress-metric");
   card.append(make("small",name),make("strong",value),make("span",description));
   panel.append(card);
 };
 item("Aulas aprovadas",done+" / "+data.courses.length,"75 pontos por questionário");
 item("Média dos questionários",avg===null?"—":points(avg)+" / 100",
   "Melhor nota de cada aula concluída");
 item("Certificado",certificate?"Emitido":"Pendente",
   certificate?"Emissão em "+formatDate(certificate.issued_at):
     "Exige prova final e média ponderada");
 area.append(panel);
 const bar=make("div",null,"academy-progress-track");
 bar.setAttribute("role","progressbar");bar.setAttribute("aria-valuenow",String(done));
 bar.setAttribute("aria-valuemin","0");bar.setAttribute("aria-valuemax",String(data.courses.length));
 bar.setAttribute("aria-label","Aulas aprovadas");
 const fill=make("span");fill.style.width=(done*100/data.courses.length)+"%";
 bar.append(fill);area.append(bar);
 show(mode);
}
function cardForCourse(course){
 const current=progress.get(course.id),passed=!!current?.completed_at;
 const box=make("button",null,"academy-course-card");box.type="button";
 const heading=make("strong",course.title),badge=make("span",
   passed?"Aprovado · "+points(current.best_score):
     current?.attempts?"Em revisão · "+points(current.best_score):"Não iniciado",
   "academy-course-badge");
 badge.dataset.passed=String(passed);
 box.append(heading,badge,make("small",course.minutes+" min estimados · "+
   "4 perguntas · 100 pontos"));
 box.setAttribute("aria-label",course.title+"; "+
   (passed?"aprovado com "+points(current.best_score)+" pontos":"ainda não aprovado"));
 box.addEventListener("click",()=>void openCourse(course.id));
 return box;
}
function renderTracks(){
 if(!authorized(session()))return;
 const host=el("academy-track-list");host.replaceChildren();
 for(const [index,track] of data.tracks.entries()){
   const group=make("details",null,"academy-track-card");
   if(index===0)group.open=true;
   const title=make("summary",null,"academy-track-summary");
   const illustration=make("img");
   illustration.src=track.image;
   illustration.alt="Infográfico original da trilha "+track.title;
   illustration.width=960;illustration.height=440;illustration.loading="lazy";
   const copy=make("div",null,"academy-track-copy");
   const lessonList=data.courses.filter(course=>course.track===track.id);
   const done=lessonList.filter(course=>progress.get(course.id)?.completed_at).length;
   copy.append(make("small","TRILHA "+String(index+1).padStart(2,"0")+" · "+
     done+"/"+lessonList.length+" aulas aprovadas"),
     make("h5",track.title),make("p",track.subtitle));
   title.append(illustration,copy);
   const body=make("div",null,"academy-track-courses");
   for(const course of lessonList)body.append(cardForCourse(course));
   group.append(title,body);host.append(group);
 }
}
function renderReferences(references,host){
 const safe=references.filter(value=>{
   try{const url=new URL(value);return url.protocol==="https:";}catch{return false;}
 });
 if(!safe.length)return;
 const aside=make("aside",null,"academy-lesson-references");
 aside.append(make("h6","Referências para aprofundar"));
 const list=make("ul");
 for(const raw of safe){
   const url=new URL(raw),li=make("li"),link=make("a",url.hostname+" ↗");
   link.href=url.href;link.target="_blank";link.rel="noopener noreferrer";
   li.append(link);list.append(li);
 }
 aside.append(list);host.append(aside);
}
function renderLesson(course){
 const host=el("academy-lesson-content");host.replaceChildren();
 const track=tracks.get(course.track);
 const top=make("div",null,"academy-lesson-intro");
 const image=make("img");image.src=track.image;image.alt="Diagrama original: "+
   track.title+". "+track.subtitle;image.width=960;image.height=440;
 top.append(image,make("p","TRILHA · "+track.title+" · "+course.minutes+" min estimados","kicker"),
   make("h5",course.title),make("p",track.subtitle));
 host.append(top);
 const objectives=make("section",null,"academy-lesson-block");
 objectives.append(make("h6","Ao final desta aula, você será capaz de"));
 const list=make("ul");for(const goal of course.objectives)list.append(make("li",goal));
 objectives.append(list);host.append(objectives);
 for(const [title,...paras] of course.sections){
   const section=make("section",null,"academy-lesson-block");
   section.append(make("h6",title));
   for(const para of paras)section.append(make("p",para));
   host.append(section);
 }
 const practice=make("aside",null,"academy-case");
 practice.append(make("span","ESTUDO DE CASO","academy-case-label"),
   make("h6",course.practice.title),make("p",course.practice.context),
   make("strong","Conduta de referência"),make("p",course.practice.response));
 host.append(practice);
 const checklist=make("section",null,"academy-lesson-block");
 checklist.append(make("h6","Checklist para aplicar no atendimento"));
 const items=make("ul");
 for(const step of course.checklist)items.append(make("li",step));
 checklist.append(items);host.append(checklist);
 renderReferences(course.references,host);
 host.append(make("p","Conteúdo de orientação interna: executar intervenções apenas "+
   "no escopo autorizado e de acordo com a qualificação técnica.","academy-lesson-footnote"));
}
function drawQuestions(target,questions,prefix){
 target.replaceChildren();
 for(const [index,question] of questions.entries()){
   const field=make("fieldset",null,"academy-question");
   field.dataset.code=question.code;
   const legend=make("legend",String(index+1)+". "+question.prompt);
   field.append(legend);
   if(question.critical)
     field.append(make("span","Questão crítica: exige acerto para certificação",
       "academy-critical"));
   for(const [optionIndex,option] of question.options.entries()){
     const label=make("label",null,"academy-choice");
     const input=make("input");
     input.type="radio";input.name=prefix+"-"+question.code;
     input.value=String(optionIndex);input.required=true;
     label.append(input,make("span",option));field.append(label);
   }
   target.append(field);
 }
 const button=make("button",prefix==="quiz"?"Corrigir questionário":"Enviar prova final","primary");
 button.type="submit";button.className+=" academy-assessment-submit";
 target.append(button);
}
function answersFor(form,questions,prefix){
 const values={};
 for(const q of questions){
   const checked=form.querySelector('input[name="'+prefix+"-"+q.code+'"]:checked');
   if(!checked)return null;
   values[q.code]=Number(checked.value);
 }
 return values;
}
function resultLine(text,kind=""){
 return make("p",text,"academy-result-line"+(kind?" "+kind:""));
}
function quizResult(result,questions){
 const host=el("academy-quiz-result");host.replaceChildren();
 const total=Number(result.total),score=Number(result.score);
 if(total!==4||!Number.isFinite(score))throw new Error("Resposta de avaliação inválida");
 const header=make("div",null,"academy-grade-header");
 header.append(make("strong",points(score)+" / 100"),
   make("span",result.passed?"Aula aprovada":"Aula ainda não aprovada","ops-badge"));
 host.append(header,make("p",result.correct+" de "+total+" acertos. "+
   (result.passed?"Você concluiu esta aula.":"Revise as explicações e tente novamente.")));
 const table=new Map((result.review||[]).map(item=>[item.code,item]));
 for(const [index,q] of questions.entries()){
   const item=table.get(q.code);if(!item)continue;
   const box=make("div",null,"academy-grade-review");
   box.append(make("strong",(index+1)+". "+(item.correct?"Correta":"Revisar")),
     make("p",item.explanation));
   if(!item.correct&&Number.isInteger(item.correct_index)&&
      q.options[item.correct_index]!==undefined)
     box.append(make("small","Alternativa indicada: "+q.options[item.correct_index]));
   host.append(box);
 }
 const retry=make("button","Refazer questionário","secondary");retry.type="button";
 retry.addEventListener("click",()=>{
   el("academy-quiz-form").reset();
   el("academy-quiz-form").hidden=false;
   host.replaceChildren();el("academy-quiz-status").textContent="Responda às quatro questões e envie para correção.";
 });
 host.append(retry);
}
async function openCourse(id){
 const s=session(),course=courses.get(id);
 if(!authorized(s)||!course)return;
 const g=revision;selected=id;quizQuestions=[];
 show("lesson");renderLesson(course);
 el("academy-quiz-form").replaceChildren();el("academy-quiz-result").replaceChildren();
 el("academy-quiz-status").textContent="Carregando as quatro questões desta aula…";
 el("academy-lesson-panel").scrollIntoView({behavior:"smooth",block:"start"});
 try{
   const questions=await request(s.client.rpc("proxiti_academy_questions",{p_course:id}));
   if(!valid(g,s)||selected!==id||mode!=="lesson")return;
   if(!Array.isArray(questions)||questions.length!==4)
     throw new Error("O banco ainda não disponibilizou as quatro questões deste curso.");
   quizQuestions=questions;
   drawQuestions(el("academy-quiz-form"),questions,"quiz");
   el("academy-quiz-status").textContent="Cada resposta correta vale 25 pontos. "+
     "Para aprovar, acerte ao menos 3 de 4 questões.";
 }catch(error){
   if(valid(g,s)&&selected===id&&mode==="lesson")
     el("academy-quiz-status").textContent="Questionário indisponível: "+error.message+
       " Volte às trilhas e tente novamente.";
 }
}
async function submitQuiz(event){
 event.preventDefault();
 const s=session(),g=revision,id=selected,form=event.currentTarget;
 if(!valid(g,s)||!id||quizBusy||quizQuestions.length!==4)return;
 const answers=answersFor(form,quizQuestions,"quiz");
 if(!answers){form.reportValidity();return;}
 quizBusy=true;const button=form.querySelector('[type="submit"]');
 button.disabled=true;el("academy-quiz-status").textContent="Confirmando respostas no servidor…";
 try{
   const result=await request(s.client.rpc("proxiti_academy_submit_quiz",
     {p_course:id,p_answers:answers}));
   if(!valid(g,s)||selected!==id||mode!=="lesson")return;
   quizResult(result,quizQuestions);
   form.hidden=true;
   el("academy-quiz-status").textContent="Correção registrada na sua conta.";
   await loadProgress(false);
 }catch(error){
   if(valid(g,s)&&selected===id&&mode==="lesson")
     el("academy-quiz-status").textContent=
       "Não foi possível confirmar a nota. Consulte o progresso antes de reenviar: "+
       error.message;
 }finally{quizBusy=false;button.disabled=false;}
}
async function openExam(){
 const s=session(),g=revision;
 if(!authorized(s)||passedCount()!==data.courses.length){
   setStatus("Conclua todos os 16 questionários antes da prova final.","error");return;
 }
 const holder=String(s.profile?.display_name||"").trim();
 if(holder.length<3){
   setStatus("Defina seu nome completo no Perfil antes da prova, para emissão correta do certificado.","error");
   return;
 }
 show("exam");examQuestions=[];
 el("academy-exam-form").replaceChildren();el("academy-exam-result").replaceChildren();
 el("academy-exam-status").textContent="Carregando a avaliação final autorizada…";
 el("academy-exam-panel").scrollIntoView({behavior:"smooth",block:"start"});
 try{
   const questions=await request(s.client.rpc("proxiti_academy_questions",{p_course:null}));
   if(!valid(g,s)||mode!=="exam")return;
   if(!Array.isArray(questions)||questions.length!==24)
     throw new Error("A prova final ainda não está disponível no banco.");
   examQuestions=questions;
   drawQuestions(el("academy-exam-form"),questions,"exam");
   el("academy-exam-status").textContent="24 questões · 100 pontos. "+
     "É necessário acertar as quatro questões críticas e cumprir as notas mínimas.";
 }catch(error){
   if(valid(g,s)&&mode==="exam")
     el("academy-exam-status").textContent="Prova indisponível: "+error.message;
 }
}
function examResult(result){
 const host=el("academy-exam-result");host.replaceChildren();
 const grade=Number(result.overall_score);
 if(!Number.isFinite(grade))throw new Error("Resultado final inválido");
 const grid=make("div",null,"academy-exam-metrics");
 for(const [label,value] of [
   ["Questionários (60%)",points(result.quiz_average)],
   ["Prova final (40%)",points(result.score)],
   ["Nota final",points(grade)] ]){
   const item=make("div",null,"academy-progress-metric");
   item.append(make("small",label),make("strong",value+" / 100"));
   grid.append(item);
 }
 host.append(grid,resultLine(result.passed?"Aprovado para o certificado interno.":
   "Ainda não aprovado. Estude os temas abaixo e refaça a prova.",
   result.passed?"academy-success":"academy-warning"));
 if(!result.critical_correct)
   host.append(resultLine("Uma ou mais questões críticas de segurança ou privacidade "+
     "não foram acertadas. Todas são obrigatórias para o certificado.","academy-warning"));
 const byTrack=result.by_track||{};
 for(const track of data.tracks){
   const values=byTrack[track.id];
   if(!values)continue;
   host.append(resultLine(track.title+": "+values.correct+"/"+values.total+" acertos."));
 }
 if(result.passed&&result.certificate){
   const open=make("button","Ver certificado emitido","primary");open.type="button";
   open.addEventListener("click",()=>{show("certificate");renderCertificate();});
   host.append(open);
 }else{
   const retry=make("button","Refazer prova","secondary");retry.type="button";
   retry.addEventListener("click",()=>void openExam());
   host.append(retry);
 }
}
async function submitExam(event){
 event.preventDefault();
 const s=session(),g=revision,form=event.currentTarget;
 if(!valid(g,s)||mode!=="exam"||examBusy||examQuestions.length!==24)return;
 const answers=answersFor(form,examQuestions,"exam");
 if(!answers){form.reportValidity();return;}
 if(!window.confirm("Enviar suas 24 respostas para correção e registro da nota?"))return;
 examBusy=true;const button=form.querySelector('[type="submit"]');button.disabled=true;
 el("academy-exam-status").textContent="Corrigindo prova no Supabase…";
 try{
   const result=await request(s.client.rpc("proxiti_academy_submit_exam",{p_answers:answers}));
   if(!valid(g,s)||mode!=="exam")return;
   examResult(result);form.hidden=true;
   el("academy-exam-status").textContent="Avaliação registrada na sua conta.";
   await loadProgress(false);
 }catch(error){
   if(valid(g,s)&&mode==="exam")
     el("academy-exam-status").textContent=
       "A nota não foi confirmada. Revise o histórico antes de enviar novamente: "+
       error.message;
 }finally{examBusy=false;button.disabled=false;}
}
function renderCertificate(){
 const target=el("academy-certificate-detail");target.replaceChildren();
 el("academy-certificate-print").hidden=!certificate;
 if(!certificate){
   target.append(make("p","O certificado é emitido pelo Supabase somente após "+
     "conclusão das 16 aulas, aprovação na prova final, nota final mínima e "+
     "acerto das questões críticas. Seu progresso não é substituído por uma impressão local."));
   return;
 }
 const item=make("div",null,"academy-certificate-card");
 item.append(make("small","PROXITI · ACADEMIA INTERNA","academy-certificate-kicker"),
   make("h6","Certificado de Conclusão Interna"),
   make("p","Certificamos que "+certificate.holder_name+
     " concluiu a capacitação interna Fundamentos Operacionais PROXITI."),
   make("p","16 aulas · Oito áreas · Avaliação final"),
   make("strong","Nota final: "+points(certificate.overall_score)+" / 100"),
   make("small","Questionários: "+points(certificate.quiz_average)+
     " · Prova final: "+points(certificate.exam_score)),
   make("small","Emissão: "+formatDate(certificate.issued_at)),
   make("small","Código: "+certificate.verification_code),
   make("p","Documento interno/institucional. Não substitui diploma, "+
     "habilitação profissional ou certificação externa."));
 target.append(item);
}
function printCertificate(){
 const s=session();if(!authorized(s)||!certificate)return;
 const popup=window.open("","_blank");
 if(!popup){setStatus("Permita a janela de impressão do navegador.","error");return;}
 popup.opener=null;const doc=popup.document;
 doc.title="Certificado de Conclusão Interna · PROXITI";
 const style=make("style",
   "body{font:16px/1.6 Arial,sans-serif;color:#172537;background:#fff;margin:0;padding:35px}"+
   ".paper{border:6px double #315a7c;padding:50px 45px;max-width:850px;min-height:480px;margin:auto;text-align:center}"+
   ".brand{font-size:17px;letter-spacing:4px;font-weight:800;color:#34658d}"+
   "h1{font-size:31px;line-height:1.3;margin:27px 0}p{margin:16px 0}"+
   ".name{font-size:27px;font-weight:800}.score{font-size:23px;font-weight:800}"+
   ".meta{font-size:13px;color:#4b6275}.note{font-size:12px;margin-top:34px}"+
   "button{display:block;margin:24px auto;padding:12px 18px}"+
   "@media print{button{display:none}body{padding:0}.paper{border:6px double #315a7c;min-height:640px}}");
 doc.head.append(style);
 const paper=make("main",null,"paper");
 paper.append(make("div","PROXITI","brand"),
   make("h1","Certificado de Conclusão Interna"),
   make("p","A Academia PROXITI certifica que"),
   make("div",certificate.holder_name,"name"),
   make("p","concluiu a capacitação interna Fundamentos Operacionais PROXITI, "+
     "com 16 aulas nas oito áreas de atendimento, computadores, redes, "+
     "segurança preventiva, backup, infraestrutura, privacidade e operação."),
   make("p","Nota final: "+points(certificate.overall_score)+" / 100","score"),
   make("p","Questionários: "+points(certificate.quiz_average)+
     " · Prova final: "+points(certificate.exam_score),"meta"),
   make("p","Emitido em "+formatDate(certificate.issued_at)+
     " · Código "+certificate.verification_code,"meta"),
   make("p","Documento interno e institucional. Não equivale a diploma, "+
     "credenciamento regulado nem certificação profissional externa.","note"));
 doc.body.append(paper);
 const button=make("button","Imprimir / Salvar como PDF");button.type="button";
 button.addEventListener("click",()=>popup.print());doc.body.append(button);
 popup.focus();
}
async function loadProgress(silent=true){
 const s=session();if(!authorized(s)){clear();return;}
 const g=revision;
 loading=true;if(!silent)setStatus("Sincronizando suas notas e certificados…","loading");
 try{
   const [rows,cert]=await Promise.all([
     request(s.client.from("academy_course_progress")
       .select("course_id,best_score,last_score,attempts,completed_at")
       .eq("curriculum_version",VERSION).limit(100)),
     request(s.client.from("academy_certificates")
       .select("id,verification_code,holder_name,curriculum_version,course_count,quiz_average,exam_score,overall_score,issued_at")
       .eq("curriculum_version",VERSION).maybeSingle())
   ]);
   if(!valid(g,s))return;
   progress=new Map(rows.filter(row=>courses.has(row.course_id))
     .map(row=>[row.course_id,row]));
   certificate=cert||null;
   summary();renderTracks();
   if(mode==="certificate")renderCertificate();
   if(!silent)setStatus("Progresso atualizado na sua conta.");
 }catch(error){
   if(valid(g,s))setStatus("Não foi possível sincronizar o progresso: "+
     error.message+". Tente atualizar a Academia.","error");
 }finally{if(valid(g,s))loading=false;}
}
el("academy-learning-refresh").addEventListener("click",()=>{
 if(authorized(session()))void loadProgress(false);
});
el("academy-learning-show-tracks").addEventListener("click",()=>{
 if(!authorized(session()))return;
 show("tracks");el("academy-track-list").scrollIntoView({behavior:"smooth",block:"start"});
});
el("academy-learning-show-certificate").addEventListener("click",()=>{
 if(!authorized(session()))return;
 show("certificate");renderCertificate();
 el("academy-certificate-panel").scrollIntoView({behavior:"smooth",block:"start"});
});
el("academy-learning-open-exam").addEventListener("click",()=>void openExam());
el("academy-lesson-back").addEventListener("click",()=>{selected=null;show("tracks");});
el("academy-exam-back").addEventListener("click",()=>show("tracks"));
el("academy-certificate-back").addEventListener("click",()=>show("tracks"));
el("academy-quiz-form").addEventListener("submit",event=>void submitQuiz(event));
el("academy-exam-form").addEventListener("submit",event=>void submitExam(event));
el("academy-certificate-print").addEventListener("click",printCertificate);
document.addEventListener("proxiti-session-ended",clear);
document.addEventListener("proxiti-session-ready",event=>{
 revision++;
 if(!authorized(event.detail)){clear();return;}
 progress.clear();certificate=null;selected=null;
 quizQuestions=[];examQuestions=[];
 show("tracks");void loadProgress(false);
});
if(authorized(session()))void loadProgress(false);
else clear();
})();
