import assert from "node:assert/strict";
import {readFileSync,existsSync} from "node:fs";
import {Script,runInNewContext} from "node:vm";
import {fileURLToPath} from "node:url";
import {dirname,resolve} from "node:path";
const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const read=path=>readFileSync(resolve(root,path),"utf8");
const html=read("index.html"),curriculumSource=read("assets/academy-curriculum.js");
const context={window:{}};
new Script(curriculumSource,{filename:"academy-curriculum.js"});
runInNewContext(curriculumSource,context);
const d=context.window.PROXITI_ACADEMY_CURRICULUM;
assert.equal(d.version,"2026-09-v1","Não alterar o ID dos registros existentes");
assert.equal(d.courses.length,16);assert.equal(d.tracks.length,8);
const classification=new Set(d.tracks.map(t=>t.classification));
assert(classification.has("Essencial")&&classification.has("Recomendada"),
 "É necessário haver trilhas essenciais e recomendadas, sem obrigar o currículo inteiro");
assert.equal(new Set(d.tracks.map(t=>t.image.split("?")[0])).size,8,
 "As oito capas precisam ser distintas");
assert.equal(new Set(d.courses.map(c=>c.image.split("?")[0])).size,16,
 "As dezesseis aulas precisam ter ilustrações próprias");
for(const track of d.tracks){
 assert(existsSync(resolve(root,track.image.split("?")[0])),"Capa ausente: "+track.id);
 const lessons=d.courses.filter(c=>c.track===track.id);
 assert.equal(lessons.length,2,"Duas aulas por trilha: "+track.id);
 assert.equal(lessons.reduce((sum,c)=>sum+c.minutes,0)+d.rules.trackExamMinutes,120,
   "Duração orientada diferente das duas horas: "+track.id);
}
for(const course of d.courses){
 assert(course.minutes===50&&course.studyGuide.readingMinutes===15&&
   course.studyGuide.activityMinutes===25&&course.studyGuide.questionnaireMinutes===10);
 assert(course.activity.minutes===25&&course.activity.steps.length>=5&&
   course.activity.setup.length>60&&course.activity.deliverable.length>45,
   "Atividade prática sem orientações suficientes: "+course.id);
 assert(course.objectives.length>=3&&course.sections.length>=3&&course.checklist.length>=4);
 assert(existsSync(resolve(root,course.image)),"Arte da aula ausente: "+course.id);
}
const js=read("assets/academy-learning.js"),visual=read("assets/reskin-visual.js"),
 css=read("assets/uniproxiti-course-upgrade.css"),sql=read("supabase/academy_track_certification_v14.sql");
new Script(js,{filename:"academy-learning.js"});
new Script(visual,{filename:"reskin-visual.js"});
assert(!visual.includes("const photographs={atendimento:"),
 "A substituição de fotos repetidas nas capas deve permanecer desativada");
assert(html.includes('id="academy-track-exam-panel"')&&
 html.includes('id="academy-track-exam-form"')&&html.includes('id="academy-track-exam-result"'),
 "Interface da prova por trilha ausente");
for(const rpc of ["proxiti_academy_track_questions","proxiti_academy_submit_track_exam"])
 assert(js.includes(rpc)&&sql.includes(rpc),"Integração ausente: "+rpc);
for(const table of ["academy_track_exam_questions","academy_track_exam_attempts","academy_track_certificates"])
 assert(sql.includes("create table if not exists public."+table),
   "Migração da tabela faltando: "+table);
assert(!/drop table|drop function|truncate table|delete from public\.academy_course_progress/i.test(sql),
 "Não excluir histórico anterior");
assert(sql.includes("grant select on public.academy_track_exam_attempts,public.academy_track_certificates to authenticated;")&&
 !/grant select on public\.academy_track_exam_questions/i.test(sql),
 "Gabaritos privados não devem ser acessíveis ao cliente");
assert(sql.includes("user_id=(select auth.uid())")&&
 sql.includes("revoke all on function public.proxiti_academy_submit_track_exam(text,jsonb) from public,anon"),
 "RLS/autorização para emissão não confirmadas");
assert(js.includes('from("academy_track_certificates")')&&
 js.includes("trackCatalogReady"),"Certificados devem depender de consulta ao servidor");
assert(!html.includes(">Obrigatória<")&&html.includes("Não é necessário concluir as outras trilhas"),
 "A comunicação não pode exigir o currículo completo para certificado individual");
assert(html.includes("uniproxiti-course-upgrade.css")&&
 css.includes(".uniproxiti-continue-card")&&css.includes(".academy-choice")&&
 css.includes("@media(max-width:767px)"),"Refinamento responsivo incompleto");
assert.equal((css.match(/{/g)||[]).length,(css.match(/}/g)||[]).length,"CSS desbalanceado");
console.log("PASS: UNIPROXITI V14, 8 trilhas, 16 aulas, 80 etapas de laboratório, prova privada e certificados independentes preservando V13.");
