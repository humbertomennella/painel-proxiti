(() => {
"use strict";
const el=id=>document.getElementById(id),root=el("overview-home");
if(!root)return;
const statuses={new:"Aberto",triage:"Em triagem",in_progress:"Em atendimento",waiting_customer:"Aguardando cliente",resolved:"Resolvido",closed:"Encerrado"};
let userId=null,canTickets=false,hasData=false,lastSignature="",lastSuccess=0,resumeId=null,latest=null;
const node=(tag,className,text)=>{const n=document.createElement(tag);if(className)n.className=className;if(text!==undefined)n.textContent=String(text);return n;};
const fallback=text=>el("overview-recent-list").replaceChildren(node("p","overview-empty",text));
const focusKey=id=>"proxiti-overview-focus-v1-"+id;
const readingKey=id=>"proxiti-overview-reading-v1-"+id;
const clock=time=>new Date(time).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"});
function setGuide(open){
 const active=!!open&&!root.classList.contains("overview-focus-mode");
 const guide=el("overview-guide"),toggle=el("overview-guide-toggle");
 guide.hidden=!active;toggle.setAttribute("aria-expanded",String(active));
 toggle.title=active?"Ocultar orientações de uso":"Mostrar orientações rápidas";
 toggle.setAttribute("aria-label",active?"Ocultar orientações de uso":"Mostrar orientações rápidas");
}
function setReading(value,persist=false){
 const active=!!value;root.classList.toggle("overview-reading-mode",active);
 const toggle=el("overview-reading-toggle");
 toggle.setAttribute("aria-pressed",String(active));
 toggle.title=active?"Voltar ao tamanho de leitura padrão":"Ampliar o texto da visão geral";
 toggle.setAttribute("aria-label",toggle.title);
 el("overview-reading-label").textContent=active?"Padrão":"Leitura";
 if(persist&&userId)try{localStorage.setItem(readingKey(userId),String(active));}catch{}
}
function setFocus(value,persist=false){
 const active=!!value&&canTickets;
 if(active)setGuide(false);
 root.classList.toggle("overview-focus-mode",active);
 const toggle=el("overview-focus-toggle");toggle.setAttribute("aria-pressed",String(active));
 el("overview-focus-label").textContent=active?"Mostrar tudo":"Focar na fila";
 toggle.title=active?"Exibir também os recursos e orientações":"Mostrar apenas a fila, os indicadores e os próximos atendimentos";
 toggle.setAttribute("aria-label",toggle.title);
 if(persist&&userId)try{sessionStorage.setItem(focusKey(userId),String(active));}catch{}
}
function setSync(phase="loading",at=Date.now()){
 const status=el("overview-sync-state"),retry=el("overview-retry");
 if(!canTickets){
   if(status.textContent!=="Os atendimentos não estão habilitados para sua conta.")
     status.textContent="Os atendimentos não estão habilitados para sua conta.";
   status.dataset.phase="restricted";root.dataset.overviewSync="restricted";retry.hidden=true;return;
 }
 const valid=Number.isFinite(Number(at))&&Number(at)>0?Number(at):Date.now();
 status.dataset.phase=phase;root.dataset.overviewSync=phase;
 retry.hidden=phase!=="error"&&phase!=="partial";
 if(phase==="error"){
   status.textContent=hasData?"A atualização falhou. Os dados mostrados são da última consulta confirmada.":
     "Não foi possível carregar a fila. Use Atualizar agora para tentar novamente.";
   el("overview-updated").textContent=lastSuccess?"Última consulta confirmada às "+clock(lastSuccess):"Sem dados confirmados";
   if(!hasData){
     el("overview-hero-state").textContent="Fila temporariamente indisponível";
     el("overview-hero-detail").textContent="Nenhum indicador foi considerado zero sem confirmação.";
     fallback("Não foi possível consultar seus atendimentos. Tente atualizar.");
   }
 }else if(phase==="partial"){
   status.textContent=latest&&!latest.messagesAvailable?
     (latest.messagesAllowed?"Não foi possível conferir todas as mensagens ou leituras. O total de pendências pode estar incompleto.":
      "Resumo parcial. Verifique a conexão e atualize novamente."):
     "Atualização parcial. Algumas informações não puderam ser verificadas.";
   el("overview-updated").textContent="Consulta parcial às "+clock(valid);
 }else if(phase==="ready"){
   lastSuccess=valid;if(status.textContent!=="Dados conferidos.")status.textContent="Dados conferidos.";
   el("overview-updated").textContent="Atualizado às "+clock(valid);
 }else{
   status.textContent=hasData?"Conferindo atualizações. Os dados anteriores continuam visíveis.":
     "Consultando os chamados e as mensagens acessíveis…";
   if(!hasData)el("overview-updated").textContent="Sincronizando…";
 }
}
function clearSensitive(){
 hasData=false;latest=null;lastSignature="";lastSuccess=0;resumeId=null;
 el("overview-resume").hidden=true;el("overview-action-count").hidden=true;
 for(const id of ["overview-kpi-unread","overview-kpi-open","overview-kpi-progress","overview-kpi-waiting"])
   el(id).textContent="—";
 el("overview-updated").textContent="Sincronizando…";
 el("overview-data-note").textContent="Resumo de até 100 chamados acessíveis à sua conta.";
 fallback("Seus atendimentos aparecerão quando a fila estiver disponível.");
}
function syncAccess(allowed){
 const next=!!allowed.tickets,wasAllowed=canTickets;
 if(wasAllowed&&!next)clearSensitive();
 canTickets=next;
 el("overview-guide-tickets").hidden=!canTickets;
 el("overview-focus-toggle").hidden=!canTickets;
 if(!canTickets){
   setFocus(false);setGuide(false);el("overview-metrics-section").hidden=true;
   el("overview-recent-section").hidden=true;el("overview-resume").hidden=true;
   el("overview-guidance").textContent="Acesse as áreas autorizadas pelo menu ou pelos cartões abaixo.";
   el("overview-hero-state").textContent="Seus recursos estão à mão";
   el("overview-hero-detail").textContent="Use os cartões e o menu para navegar.";
   el("overview-open").textContent="Chamados: acesso restrito";
   el("overview-online").textContent="Equipe: acesso restrito";
 }else{
   el("overview-metrics-section").hidden=false;el("overview-recent-section").hidden=false;
 }
 if(!canTickets||!hasData)setSync(canTickets?"loading":"restricted");
}
function renderRecent(items){
 const area=el("overview-recent-list");area.replaceChildren();
 if(!items.length){
   fallback("Nenhum chamado em acompanhamento nesta lista. Os históricos continuam disponíveis na fila.");
   return;
 }
 for(const ticket of items){
   if(typeof ticket.id!=="string"||!ticket.id)continue;
   const btn=node("button","overview-recent-item");btn.type="button";
   btn.setAttribute("aria-label","Abrir chamado "+ticket.reference+": "+ticket.subject);
   const ref=node("span","overview-recent-ref","#"+ticket.reference+(ticket.unread?" · Não lido":""));
   const status=node("span","overview-recent-status",statuses[ticket.status]||"Em acompanhamento");
   status.dataset.status=ticket.status;
   const subject=node("strong","",ticket.subject||"Atendimento");
   const created=ticket.created_at?new Date(ticket.created_at):null;
   const date=created&&!Number.isNaN(created.getTime())?
     "Aberto em "+created.toLocaleDateString("pt-BR",{day:"2-digit",month:"short"})+
     " às "+created.toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"}):"";
   btn.append(ref,status,subject,node("small","",date));
   btn.addEventListener("click",()=>document.dispatchEvent(
     new CustomEvent("proxiti-overview-open-ticket",{detail:{id:ticket.id}})));
   area.append(btn);
 }
}
function render(data){
 if(!canTickets||!data||!Number.isFinite(data.open)||!Array.isArray(data.recent))return;
 hasData=true;latest=data;
 const content={unread:data.unread,open:data.open,progress:data.progress,waiting:data.waiting,
   active:data.active,recent:data.recent,resume:data.resume,messagesAllowed:data.messagesAllowed,
   messagesAvailable:data.messagesAvailable,sampleSize:data.sampleSize};
 const signature=JSON.stringify(content),time=Number(data.at)||Date.now();
 if(signature===lastSignature)return;
 lastSignature=signature;
 el("overview-kpi-unread").textContent=data.unread===null?"—":String(data.unread);
 el("overview-kpi-open").textContent=String(data.open);
 el("overview-kpi-progress").textContent=String(data.progress);
 el("overview-kpi-waiting").textContent=String(data.waiting);
 el("overview-action-count").hidden=data.unread===null||data.unread===0;
 el("overview-action-count").textContent=data.unread===null?"":String(data.unread);
 el("overview-metric-unread-label").textContent=data.messagesAllowed?"Pendências não lidas":"Novos chamados não lidos";
 el("overview-metric-unread-description").textContent=!data.messagesAvailable?
   "A verificação de leitura está temporariamente incompleta":
   data.messagesAllowed?"Chamados novos ou com resposta do cliente":"Novos chamados ainda não visualizados";
 el("overview-data-note").textContent="Resumo de "+data.sampleSize+
   (data.sampleSize===1?" chamado":" chamados")+" acessíveis, entre os "+data.sampleLimit+
   " mais recentes. Não representa um total histórico da operação.";
 const primary=el("overview-primary-action"),label=primary.querySelector("span:not(.overview-action-count)");
 if(data.unread===null){
   label.textContent="Consultar a fila";primary.dataset.overviewFilter="all";
   el("overview-banner-title").textContent="Seu trabalho, com o contexto preservado.";
   el("overview-guidance").textContent="A conferência das leituras está incompleta. A fila permanece disponível para consulta.";
   el("overview-hero-state").textContent="Conferência parcial da fila";
   el("overview-hero-detail").textContent="Use Atualizar agora para revisar os números.";
   el("overview-next-text").textContent="A lista pode conter novidades ainda não contabilizadas.";
 }else if(data.unread>0){
   label.textContent="Ver pendências";primary.dataset.overviewFilter="unread";
   el("overview-banner-title").textContent="Seus atendimentos, sem perder o contexto.";
   el("overview-guidance").textContent=data.unread===1?
     "Há um atendimento com novidade para revisar. Abra a pendência e continue de onde parou.":
     "Há "+data.unread+" atendimentos com novidades para revisar. Seu histórico e seus rascunhos continuam disponíveis.";
   el("overview-hero-state").textContent=data.unread===1?"1 atendimento pede revisão":data.unread+" atendimentos pedem revisão";
   el("overview-hero-detail").textContent="As novidades estão destacadas na fila, sem interromper o trabalho atual.";
   el("overview-next-text").textContent="Chamados com novidades aparecem primeiro. Escolha um atendimento para continuar.";
 }else if(data.active>0){
   label.textContent="Acompanhar chamados";primary.dataset.overviewFilter="all";
   el("overview-banner-title").textContent="Sua operação está organizada.";
   el("overview-guidance").textContent="Você tem "+data.active+" "+(data.active===1?"chamado ativo":"chamados ativos")+
     " nesta lista. Acompanhe cada etapa sem perder o atendimento.";
   el("overview-hero-state").textContent="Nenhuma pendência não lida";
   el("overview-hero-detail").textContent="Há atendimentos em curso. A fila continua sendo sincronizada.";
   el("overview-next-text").textContent="Escolha um chamado em andamento ou consulte seus outros recursos.";
 }else{
   label.textContent="Consultar a fila";primary.dataset.overviewFilter="all";
   el("overview-banner-title").textContent="Tudo preparado para o próximo atendimento.";
   el("overview-guidance").textContent="Não há chamados ativos entre os registros carregados. Seus recursos continuam disponíveis.";
   el("overview-hero-state").textContent="Sem pendências na fila carregada";
   el("overview-hero-detail").textContent="Novas solicitações aparecerão aqui quando chegarem.";
   el("overview-next-text").textContent="Sua fila não tem atendimentos ativos no momento.";
 }
 resumeId=data.resume?.id||null;el("overview-resume").hidden=!resumeId;
 if(resumeId)el("overview-resume-detail").textContent=
   "Chamado #"+data.resume.reference+" · "+data.resume.subject+" · "+(statuses[data.resume.status]||"Em acompanhamento");
 renderRecent(data.recent);
}
function reset(){
 userId=null;canTickets=false;clearSensitive();
 setFocus(false);setReading(false);setGuide(false);
 el("overview-guidance").textContent="Os atendimentos e recursos aparecem conforme suas permissões.";
 el("overview-hero-state").textContent="Preparando sua visão geral";
 el("overview-hero-detail").textContent="Atualizando as informações da Central Técnica.";
 el("overview-open").textContent="Chamados: carregando…";
 el("overview-online").textContent="Equipe: verificando…";
 setSync("restricted");
}
function start(session){
 if(!session?.user)return;
 if(userId!==session.user.id)clearSensitive();
 userId=session.user.id;
 const p=session.profile||{};
 syncAccess({tickets:p.status==="active"&&(p.role==="administrator"||p.permissions?.tickets_view===true)});
 let focused=false;try{focused=sessionStorage.getItem(focusKey(userId))==="true";}catch{}
 setFocus(focused);
 let enlarged=false;try{enlarged=localStorage.getItem(readingKey(userId))==="true";}catch{}
 setReading(enlarged);setGuide(false);
 const snapshot=window.PROXITI_OVERVIEW_SNAPSHOT;
 if(canTickets&&snapshot?.userId===userId){
   render(snapshot.detail);
   const state=window.PROXITI_OVERVIEW_STATUS;
   setSync(state?.userId===userId?state.phase:"ready",state?.at||Date.now());
 }
}
document.addEventListener("proxiti-session-ready",event=>start(event.detail));
document.addEventListener("proxiti-navigation-updated",event=>{
 if(!userId)return;syncAccess(event.detail?.allowed||{tickets:false});
});
document.addEventListener("proxiti-session-ended",reset);
document.addEventListener("proxiti-overview-updated",event=>render(event.detail));
document.addEventListener("proxiti-overview-status",event=>setSync(event.detail?.phase,event.detail?.at));
for(const control of root.querySelectorAll("[data-overview-view]")){
 control.addEventListener("click",()=>{
   if(control.hidden)return;
   const view=control.dataset.overviewView;
   if(view==="tickets"&&!canTickets)return;
   window.PROXITI_OPEN_VIEW?.(view);
   const filter=control.dataset.overviewFilter;
   if(view==="tickets"&&filter){
     const target=document.querySelector('#ops-tickets [data-ticket-filter="'+filter+'"]');
     target?.click();
   }
 });
}
el("overview-focus-toggle").addEventListener("click",()=>setFocus(!root.classList.contains("overview-focus-mode"),true));
el("overview-reading-toggle").addEventListener("click",()=>setReading(!root.classList.contains("overview-reading-mode"),true));
el("overview-guide-toggle").addEventListener("click",()=>setGuide(el("overview-guide").hidden));
el("overview-resume-action").addEventListener("click",()=>{
 if(canTickets&&resumeId)document.dispatchEvent(new CustomEvent("proxiti-overview-open-ticket",{detail:{id:resumeId}}));
});
el("overview-retry").addEventListener("click",()=>{
 if(!canTickets)return;
 setSync("loading");
 document.dispatchEvent(new Event("proxiti-overview-retry"));
});
if(window.PROXITI_ACTIVE_SESSION)start(window.PROXITI_ACTIVE_SESSION);
})();