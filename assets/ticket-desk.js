/* PROXITI · Mesa de atendimento. Usa somente eventos e permissões existentes. */
(() => {
"use strict";
const $=name=>document.getElementById(name);
const engine=window.PROXITI_DIAGNOSTICS;
if(!engine)throw new Error("Base local de diagnóstico indisponível.");
const symptoms=$("ticket-diagnostic-symptoms"),results=$("ticket-diagnostic-results"),
 status=$("ticket-diagnostic-status"),platform=$("ticket-diagnostic-platform"),
 impact=$("ticket-diagnostic-impact"),noteButton=$("ticket-diagnostic-to-note"),
 replyButton=$("ticket-diagnostic-to-reply"),stepsButton=$("ticket-diagnostic-to-steps"),
 checklist=$("ticket-preflight"),progress=$("ticket-preflight-progress");
const memory=new Map();const checks=new Map();
let selected=null,answer=null,account=null,debounce=null,guided=null;
const guideMemory=new Map();
const make=(tag,txt,className)=>{
 const node=document.createElement(tag);if(txt!==undefined&&txt!==null)node.textContent=txt;
 if(className)node.className=className;return node;
};
const redact=text=>String(text||"").replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g,"[e-mail omitido]")
 .replace(/\b(?:\d[ .-]?){10,13}\b/g,"[identificador omitido]")
 .replace(/\b(?:\+?\d[\d ()-]{9,}\d)\b/g,"[telefone omitido]")
 .slice(0,2200);
function setStatus(text,error=false){
 status.textContent=text;status.dataset.state=error?"error":"ready";
}
function canNote(){return !!selected&&!$("ticket-workflow").hidden&&!$("ticket-note-form").hidden&&!$("ticket-note-body").disabled;}
function canReply(){return !!selected&&!$("ticket-conversation").hidden&&!$("staff-reply-form").hidden&&!$("staff-reply").disabled;}
function canRoteiro(){return !!selected&&!$("ticket-workflow").hidden&&!$("ticket-tasks-start").hidden&&!$("ticket-task-template").disabled;}
function updateActions(){
 noteButton.disabled=!answer||!canNote();
 replyButton.disabled=!answer||!canReply();
 stepsButton.disabled=!answer||!canRoteiro();
 $("ticket-diagnostic-message").disabled=!selected||$("ticket-conversation").hidden||
  !$("staff-messages").querySelector(".ops-bubble:not(.own)");
 $("ticket-diagnostic-import").disabled=!selected;
 $("ticket-diagnostic-run").disabled=!selected;
 $("ticket-go-chat").hidden=!selected||$("ticket-conversation").hidden;
}
function guideFingerprint(){return [symptoms.value,platform.value,impact.value].join("|");}
function saveGuide(){if(selected&&guided)guideMemory.set(selected.id,{...guided,outcomes:[...guided.outcomes]});}
function makeGuideButton(label,callback,disabled=false,primary=false){
 const button=make("button",label,primary?"primary":"secondary");
 button.type="button";button.disabled=disabled;button.addEventListener("click",callback);return button;
}
function renderGuide(panel,item){
 panel.replaceChildren();
 if(!item?.solution){panel.hidden=true;return;}
 panel.hidden=false;
 const plan=item.solution;
 const intro=make("div","","ticket-solution-head");
 intro.append(make("span","SOLUÇÃO PROPOSTA · EXIGE CONFIRMAÇÃO","ticket-solution-kicker"),make("h5",plan.title));
 panel.append(intro,make("p",plan.condition,"ticket-solution-condition"));
 if(plan.stop)panel.append(make("p",plan.stop,"ticket-solution-stop"));
 const position=Math.min(guided?.step||0,plan.steps.length-1),stage=plan.steps[position];
 const card=make("div","","ticket-solution-current");
 card.append(make("span","Etapa "+(position+1)+" de "+plan.steps.length,"ticket-solution-counter"),make("h6",stage.title),make("p",stage.action));
 const expected=make("p","Resultado esperado: "+stage.expected,"ticket-solution-expected");card.append(expected);
 const outcome=guided?.outcomes[position]||null;
 if(outcome==="resolved"){
  card.append(make("p","Resultado informado como positivo. Confirme o critério final antes de encerrar o chamado: "+plan.verification,"ticket-solution-feedback"));
 }else if(outcome==="failed"){
  card.append(make("p","Ainda não resolvido: "+stage.ifFailed,"ticket-solution-feedback"));
 }
 const actions=make("div","","ticket-solution-choices");
 actions.setAttribute("role","group");actions.setAttribute("aria-label","Resultado da verificação atual");
 for(const [value,label] of [["resolved","Funcionou"],["failed","Ainda não resolveu"]]){
  const button=makeGuideButton(label,()=>{
   if(!guided||!selected)return;
   guided.outcomes[position]=value;saveGuide();renderGuide(panel,item);
  },false,value==="resolved");
  button.setAttribute("aria-pressed",String(outcome===value));
  actions.append(button);
 }
 card.append(actions);panel.append(card);
 const nav=make("div","","ticket-solution-nav");
 if(position>0)nav.append(makeGuideButton("Anterior",()=>{
  guided.step=position-1;saveGuide();renderGuide(panel,item);
 }));
 if(position<plan.steps.length-1&&outcome!=="resolved")nav.append(makeGuideButton("Próxima etapa",()=>{
  guided.step=position+1;saveGuide();renderGuide(panel,item);
 },outcome!=="failed",true));
 nav.append(makeGuideButton("Recomeçar guia",()=>{
  guided.step=0;guided.outcomes=[];saveGuide();renderGuide(panel,item);
 }));
 panel.append(nav);
 if(position===plan.steps.length-1&&outcome==="failed")
  panel.append(make("p","As etapas propostas não resolveram. Registre o resultado e encaminhe ao suporte responsável. Não marque o chamado como resolvido automaticamente.","ticket-solution-escalate"));
 panel.append(make("p","O guia só registra a sua navegação nesta sessão. Não executa comandos, não altera chamados e não comprova autorização do cliente.","ticket-diagnostic-disclaimer"));
}
function activateGuide(item,panel){
 if(!selected||!item?.solution)return;
 guided={ticketId:selected.id,caseId:item.id,fingerprint:guideFingerprint(),step:0,outcomes:[]};
 saveGuide();renderGuide(panel,item);
 panel.scrollIntoView({block:"nearest",behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches?"instant":"smooth"});
}
function renderAnalysis(out){
 answer=out?.empty?null:out;
 results.replaceChildren();
 if(!out||out.empty){
  setStatus(out?.warning||"Descreva o sintoma ou importe a descrição deste chamado.");updateActions();return;
 }
 setStatus("Triagem local concluída · "+out.cases.length+" "+(out.cases.length===1?"área sugerida.":"áreas sugeridas.")+" Revise antes de agir.");
 const triage=make("div","","ticket-diagnostic-priority");
 triage.append(make("strong","Impacto informado"),make("span",out.priority));
 const alert=make("p",out.warning,"ticket-diagnostic-warning");
 results.append(triage,alert);
 const guidePanel=make("section","","ticket-solution");guidePanel.id="ticket-solution-guide";
 guidePanel.setAttribute("aria-label","Guia assistido de solução");
 results.append(guidePanel);
 const previous=selected?guideMemory.get(selected.id):null;
 const chosen=out.cases.find(item=>item.id===previous?.caseId&&item.solution)||out.cases[0];
 if(previous&&previous.fingerprint===guideFingerprint()&&previous.ticketId===selected?.id&&chosen?.id===previous.caseId)
  guided={...previous,outcomes:[...previous.outcomes]};
 else guided={ticketId:selected?.id,caseId:chosen?.id,fingerprint:guideFingerprint(),step:0,outcomes:[]};
 saveGuide();renderGuide(guidePanel,chosen);
 const questionGroup=make("section","","ticket-diagnostic-questions");
 questionGroup.append(make("h5","Perguntas para confirmar com o cliente"));
 const questions=make("ol");for(const q of out.questions)questions.append(make("li",q));
 questionGroup.append(questions);results.append(questionGroup);
 for(const [index,item] of out.cases.entries()){
  const group=make("details","","ticket-diagnostic-case");group.open=index===0;
  const heading=make("summary");heading.append(make("span",item.title),make("small",index===0?"Primeira hipótese":"Hipótese adicional"));
  group.append(heading);
  if(item.solution){
   const choose=makeGuideButton("Seguir esta hipótese",()=>activateGuide(item,guidePanel));
   choose.className+=" ticket-diagnostic-choose";group.append(choose);
  }
  if(item.matched.length)group.append(make("p","Termos associados: "+item.matched.join(", "),"ticket-diagnostic-signals"));
  if(item.alert)group.append(make("p",item.alert,"ticket-diagnostic-warning"));
  const steps=make("ol","","ticket-diagnostic-steps");
  for(const step of item.steps){
   const row=make("li","","ticket-diagnostic-step");
   row.append(make("span",step.level,"ticket-diagnostic-level"),
     make("strong",step.title),make("p",step.detail));
   if(step.warning)row.append(make("p",step.warning,"ticket-diagnostic-step-warning"));
   steps.append(row);
  }
  group.append(steps);
  if(item.sources.length){
   const refs=make("div","","ticket-diagnostic-sources");refs.append(make("strong","Referências para conferência"));
   for(const source of item.sources){
    const a=make("a",source.label);
    a.href=source.url;a.target="_blank";a.rel="noopener noreferrer";refs.append(a);
   }
   group.append(refs);
  }
  results.append(group);
 }
 updateActions();
}
function analyzeNow(){
 if(!selected){renderAnalysis(null);return;}
 const output=engine.analyze(symptoms.value,{platform:platform.value,impact:impact.value});
 renderAnalysis(output);
 if(selected?.id)memory.set(selected.id,{text:symptoms.value,platform:platform.value,impact:impact.value});
}
function schedule(){
 if(debounce)clearTimeout(debounce);
 if(!selected)return;
 debounce=setTimeout(()=>{debounce=null;analyzeNow();},350);
}
function setQueue(collapsed){
 const pane=$("ticket-list-pane"),toggle=$("ticket-queue-toggle");
 const small=window.matchMedia("(max-width: 767px)").matches;
 const closed=!!selected&&small&&!!collapsed;
 pane.dataset.mobileCollapsed=String(closed);
 toggle.hidden=!small||!selected;
 toggle.textContent=closed?"Abrir fila":"Recolher fila";
 toggle.setAttribute("aria-expanded",String(!closed));
}
$("ticket-queue-toggle").addEventListener("click",()=>{
 const pane=$("ticket-list-pane");
 setQueue(pane.dataset.mobileCollapsed!=="true");
 if(pane.dataset.mobileCollapsed!=="true")pane.scrollIntoView({block:"start",behavior:"smooth"});
});
window.addEventListener("resize",()=>setQueue($("ticket-list-pane").dataset.mobileCollapsed==="true"));
const listObserver=new MutationObserver(()=>{
 const list=$("ticket-list"),empty=list.querySelector(".ticket-list-empty");
 if(!empty||!empty.textContent.includes("corresponde aos filtros")||list.querySelector(".ticket-list-clear"))return;
 const reset=make("button","Mostrar todos os chamados","secondary ticket-list-clear");
 reset.type="button";reset.addEventListener("click",()=>{
  const field=$("ticket-search");field.value="";field.dispatchEvent(new Event("input",{bubbles:true}));
  document.querySelector('[data-ticket-filter="all"]')?.click();
  setQueue(false);
 });
 list.append(reset);
});
listObserver.observe($("ticket-list"),{childList:true});
function jump(key){
 const targets={
  queue:$("ticket-list-pane")||document.querySelector(".ticket-list-pane"),
  chat:$("ticket-conversation"),diagnostic:$("ticket-diagnostic"),
  notes:$("ticket-note-heading"),tasks:$("ticket-tasks-heading"),
  device:$("ticket-device-heading"),appointments:$("ticket-appointments-heading"),
  attachments:$("ticket-files-heading"),report:$("ticket-report-panel"),
  history:document.querySelector("#ticket-detail .ticket-audit-panel")
 };
 const target=targets[key];if(!target||target.hidden)return;
 if(key==="report")target.open=true;
 if(key==="history")target.open=true;
 const reduced=window.matchMedia("(prefers-reduced-motion: reduce)").matches;
 target.scrollIntoView({behavior:reduced?"instant":"smooth",block:"start"});
 for(const btn of document.querySelectorAll("[data-ticket-jump]")){
  const active=btn.dataset.ticketJump===key;
  btn.classList.toggle("active",active);btn.setAttribute("aria-current",active?"location":"false");
 }
}
document.querySelectorAll("[data-ticket-jump]").forEach(button=>{
 button.addEventListener("click",()=>jump(button.dataset.ticketJump));
});
$("ticket-go-chat").addEventListener("click",()=>jump("chat"));
$("ticket-diagnostic-run").addEventListener("click",analyzeNow);
symptoms.addEventListener("input",schedule);
for(const el of [platform,impact])el.addEventListener("change",analyzeNow);
$("ticket-diagnostic-import").addEventListener("click",()=>{
 if(!selected)return;
 symptoms.value=redact([selected.subject,selected.description].filter(Boolean).join("\n"));
 analyzeNow();symptoms.focus();
});
$("ticket-diagnostic-message").addEventListener("click",()=>{
 if(!selected||$("ticket-conversation").hidden)return;
 const rows=[...$("staff-messages").querySelectorAll(".ops-bubble:not(.own)")];
 const latest=rows.at(-1)?.querySelector(":scope > div")?.textContent||"";
 if(!latest){setStatus("Ainda não há mensagem do cliente disponível para importar.",true);return;}
 symptoms.value=redact(latest);analyzeNow();symptoms.focus();
});
$("ticket-diagnostic-clear").addEventListener("click",()=>{
 symptoms.value="";answer=null;if(selected)memory.set(selected.id,{text:"",platform:platform.value,impact:impact.value});
 renderAnalysis(null);symptoms.focus();
});
noteButton.addEventListener("click",()=>{
 if(!answer||!canNote()){updateActions();setStatus("Sua conta não pode editar notas neste chamado.",true);return;}
 const editor=$("ticket-note-body"),append=answer.summary;
 editor.value=[editor.value.trim(),append].filter(Boolean).join("\n\n").slice(0,3000);
 editor.dispatchEvent(new Event("input",{bubbles:true}));
 setStatus("Resumo inserido na nota em edição. Revise e clique em Salvar nota interna para registrar.");
 jump("notes");editor.focus();
});
replyButton.addEventListener("click",()=>{
 if(!answer||!canReply()){updateActions();setStatus("Sua conta não pode responder neste chamado.",true);return;}
 const editor=$("staff-reply"),draft=engine.replyDraft(answer);
 if(!draft)return;
 editor.value=[editor.value.trim(),draft].filter(Boolean).join("\n\n").slice(0,2000);
 editor.dispatchEvent(new Event("input",{bubbles:true}));
 setStatus("Perguntas inseridas no rascunho do chat. Revise antes de enviar.");
 jump("chat");editor.focus();
});
const templates={wifi:"network",performance:"computer",boot:"computer",storage:"computer",power:"computer",heat:"computer",
 security:"security",backup:"backup",accounts:"security",printing:"general",audio:"general",general:"general"};
stepsButton.addEventListener("click",()=>{
 if(!answer||!canRoteiro()){updateActions();setStatus("Roteiro indisponível para esta conta ou chamado.",true);return;}
 const kind=templates[guided?.caseId||answer.cases[0]?.id]||"general";
 $("ticket-task-template").value=kind;jump("tasks");
 setStatus("Modelo de roteiro selecionado. Clique em Criar roteiro para este chamado para confirmar.");
 $("ticket-task-template").focus();
});
function updatePreflight(){
 const boxes=[...checklist.querySelectorAll("input[type=checkbox]")];
 const complete=boxes.filter(el=>el.checked).length;
 progress.textContent=complete+" de "+boxes.length;
 if(selected)checks.set(selected.id,boxes.map(el=>el.checked));
}
checklist.addEventListener("change",updatePreflight);
function choose(ticket){
 if(debounce){clearTimeout(debounce);debounce=null;}
 if(selected?.id)memory.set(selected.id,{text:symptoms.value,platform:platform.value,impact:impact.value});
 selected=ticket||null;answer=null;results.replaceChildren();
 const saved=selected?memory.get(selected.id):null;
 symptoms.value=saved?saved.text:redact([selected?.subject,selected?.description].filter(Boolean).join("\n"));
 platform.value=saved?.platform||"unspecified";impact.value=saved?.impact||"unspecified";
 const previous=selected?checks.get(selected.id):null;
 [...checklist.querySelectorAll("input[type=checkbox]")].forEach((el,i)=>el.checked=!!previous?.[i]);
 updatePreflight();checklist.open=false;
 if(selected&&symptoms.value.trim().length>=4)analyzeNow();
 else renderAnalysis(null);
 updateActions();
 const nav=$("ticket-desk-shortcuts");nav.hidden=!selected;
 if(selected)document.querySelector('[data-ticket-jump="chat"]')?.classList.add("active");
 setQueue(!!selected);
}
document.addEventListener("proxiti-ticket-selected",event=>choose(event.detail?.ticket||null));
document.addEventListener("proxiti-session-ready",event=>{
 const uid=event.detail?.user?.id||null;
 if(uid!==account){memory.clear();checks.clear();guideMemory.clear();guided=null;account=uid;choose(null);}
});
document.addEventListener("proxiti-session-ended",()=>{
 memory.clear();checks.clear();guideMemory.clear();guided=null;account=null;selected=null;answer=null;choose(null);
});
const observer=new MutationObserver(()=>updateActions());
observer.observe($("staff-messages"),{childList:true,subtree:true});
observer.observe($("ticket-workflow"),{attributes:true,subtree:true,attributeFilter:["hidden","disabled"]});
observer.observe($("ticket-conversation"),{attributes:true,subtree:true,attributeFilter:["hidden"]});
if(window.PROXITI_ACTIVE_TICKET)choose(window.PROXITI_ACTIVE_TICKET);
else updateActions();
})();