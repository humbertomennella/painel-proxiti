import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {execFileSync} from "node:child_process";
import {Script} from "node:vm";
import {fileURLToPath} from "node:url";
import {dirname,resolve} from "node:path";
const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const read=path=>readFileSync(resolve(root,path),"utf8");
const baseline=path=>execFileSync("git",["show","origin/main:"+path],{cwd:root,encoding:"utf8"});
const changed=execFileSync("git",["diff","--name-only","origin/main...HEAD"],{cwd:root,encoding:"utf8"})
  .split("\n").filter(Boolean);
const html=read("index.html"),oldHtml=baseline("index.html");
const ids=text=>[...text.matchAll(/\bid="([^"]+)"/g)].map(match=>match[1]);
const oldIds=ids(oldHtml),newIds=ids(html);
assert.equal(new Set(newIds).size,newIds.length,"IDs novos duplicados");
for(const id of oldIds)assert(newIds.includes(id),"ID existente removido: "+id);
for(const path of changed)assert(!path.startsWith("supabase/")&&
 !["assets/app.js","assets/config.js","assets/ticket-workflow.js","assets/ticket-extras.js",
   "assets/technical-tools.js","assets/profile.js","assets/agenda.js"].includes(path),
 "Mudança operacional proibida no reskin: "+path);
for(const id of ["uniproxiti-dashboard","uniproxiti-progress-ring","uniproxiti-approved",
 "uniproxiti-last-score","uniproxiti-average-score","uniproxiti-cert-status",
 "uniproxiti-continue","uniproxiti-resume-action","uniproxiti-resume-track",
 "uniproxiti-activity-list","uniproxiti-certificate-card","uniproxiti-certificate-pdf",
 "academy-track-list","academy-learning-refresh","academy-quiz-form","academy-exam-form",
 "academy-certificate-print","training-list","training-form"])
 assert(newIds.includes(id),"Controle de capacitação ausente: #"+id);
for(const id of ["academy-quiz-form","academy-exam-form","academy-certificate-print",
 "training-save","training-search","academy-learning-show-tracks"])
 assert(oldIds.includes(id)&&newIds.includes(id),"Contrato operacional removido: #"+id);
assert(html.includes('href="./assets/uniproxiti-dashboard.css?v=20260926-1"'));
assert(html.includes("Programa interno de capacitação PROXITI"));
assert(html.includes("Certificado UniProxiti"));
assert(!html.includes("Academia PROXITI"));
const js=read("assets/academy-learning.js"),oldJs=baseline("assets/academy-learning.js");
new Script(js,{filename:"assets/academy-learning.js"});
assert(js.includes('from("academy_course_progress")')&&
 js.includes('from("academy_certificates")')&&
 js.includes('from("academy_courses")')&&
 js.includes('from("academy_quiz_attempts")'),
 "O painel não consulta as tabelas com RLS existentes");
assert(js.includes('select("course_id,score,passed,created_at")'),
 "Histórico consulta respostas privadas ou não traz a nota real");
assert(!js.includes('from("academy_questions")'),
 "Cliente não pode consultar gabarito protegido");
for(const rpc of ["proxiti_academy_questions","proxiti_academy_submit_quiz",
 "proxiti_academy_submit_exam"]){
 assert(js.includes(rpc)&&oldJs.includes(rpc),"RPC existente removida: "+rpc);
}
assert(js.includes("certificate?\"Disponível\":\"Em andamento\""),
 "Status da certificação deve depender da emissão real");
assert(js.includes("certCard.hidden=!certificate"),
 "Certificado não pode aparecer sem registro do servidor");
assert(js.includes("recentAttempts===null")&&js.includes("catalogReady"),
 "Falha de dados não pode gerar percentuais ilustrativos");
assert(js.includes("O sistema registra tentativas")===false,
 "A ressalva de leitura deve ficar no HTML, não vir de uma nota inventada");
assert(!read("assets/operations.js").includes("Academia PROXITI"));
const css=read("assets/uniproxiti-dashboard.css");
assert.equal((css.match(/{/g)||[]).length,(css.match(/}/g)||[]).length,
 "CSS do dashboard com chaves desbalanceadas");
const luminance=hex=>{
 const rgb=hex.match(/[0-9a-f]{2}/gi).map(part=>Number.parseInt(part,16)/255);
 const linear=rgb.map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
 return .2126*linear[0]+.7152*linear[1]+.0722*linear[2];
};
const contrast=(a,b)=>{
 const [x,y]=[luminance(a),luminance(b)].sort((a,b)=>b-a);
 return (x+.05)/(y+.05);
};
for(const [fg,bg,name]of [
 ["#f2f8ff","#102d4e","chips do hero"],
 ["#5b6b82","#ffffff","estatísticas no tema claro"],
 ["#bdcbe0","#1a2639","estatísticas no tema escuro"]]){
 assert(contrast(fg,bg)>=4.5,"Texto abaixo do contraste AA: "+name);
}
assert(css.includes("background:#102d4e!important;color:#f2f8ff!important"),
 "Chips de Visão Geral continuam sem contraste corrigido");
assert(css.includes("prefers-reduced-motion")||read("assets/reskin-visual.css").includes("prefers-reduced-motion"),
 "Preferência de movimento reduzido foi perdida");
console.log("PASS: "+oldIds.length+" IDs preservados, dashboard sem dados falsos, tabelas existentes e contraste AA.");
