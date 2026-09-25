(() => {
"use strict";
const el=id=>document.getElementById(id);
const root=el("overview-home");
if(!root)return;
const statusNames={new:"Aberto",triage:"Em triagem",in_progress:"Em atendimento",waiting_customer:"Aguardando cliente",resolved:"Resolvido",closed:"Encerrado"};
let userId=null,canTickets=false,lastSignature="",lastUpdated=0;
const node=(tag,className,text)=>{const n=document.createElement(tag);if(className)n.className=className;if(text!==undefined)n.textContent=String(text);return n};
const fallback=text=>{const p=node("p","overview-empty",text);el("overview-recent-list").replaceChildren(p)};
const focusKey=id=>"proxiti-overview-focus-v1-"+id;
const readingKey=id=>"proxiti-overview-reading-v1-"+id;
function setGuide(open){
 const active=!!open&&!root.classList.contains("overview-focus-mode");
 const guide=el("overview-guide"),toggle=el("overview-guide-toggle");
 guide.hidden=!active;
 toggle.setAttribute("aria-expanded",String(active));
 toggle.title=active?"Ocultar orientações de uso":"Mostrar orientações rápidas";
}
function setReading(value,persist=false){
 const active=!!value;
 root.classList.toggle("overview-reading-mode",active);
 const toggle=el("overview-reading-toggle");
 toggle.setAttribute("aria-pressed",String(active));
 toggle.title=active?"Voltar ao tamanho de leitura padrão":"Ampliar o texto da visão geral";
 el("overview-reading-label").textContent=active?"Leitura padrão":"Ampliar leitura";
 if(persist&&userId){try{localStorage.setItem(readingKey(userId),String(active))}catch{}}
}
function setFocus(value,persist=false){
 const active=!!value;
 if(active)setGuide(false);
 root.classList.toggle("overview-focus-mode",active);
 const toggle=el("overview-focus-toggle");toggle.setAttribute("aria-pressed",String(active));
 el("overview-focus-label").textContent=active?"Mostrar tudo":"Focar na fila";
 toggle.title=active?"Exibir também os recursos e orientações":"Mostrar apenas a fila, os indicadores e os próximos atendimentos";
 if(persist&&userId){try{sessionStorage.setItem(focusKey(userId),String(active))}catch{}}
}
function syncAccess(allowed){
 canTickets=!!allowed.tickets;
 el("overview-guide-tickets").hidden=!canTickets;
 el("overview-focus-toggle").hidden=!canTickets;
 if(!canTickets)setFocus(false);
 el("overview-metrics-section").hidden=!canTickets;
 el("overview-recent-section").hidden=!canTickets;
 if(!canTickets){
  el("overview-guidance").textContent="Aqui ficam as áreas que a PROXITI autorizou para sua conta. Acesse os materiais, ferramentas ou seu perfil pelos cartões abaixo.";
  el("overview-hero-state").textContent="Seus recursos estão à mão";
  el("overview-hero-detail").textContent="Use os cartões e o menu lateral para navegar.";
  el("overview-open").textContent="Chamados: acesso restrito";
 }
}
function renderRecent(items){
 const area=el("overview-recent-list");area.replaceChildren();
 if(!items.length){
  fallback("Nenhum chamado ativo nesta lista. Você pode consultar os materiais e o histórico enquanto aguarda novas solicitações.");
  return;
 }
 for(const ticket of items){
  if(typeof ticket.id!=="string"||!ticket.id)continue;
  const btn=node("button","overview-recent-item");
  btn.type="button";btn.setAttribute("aria-label","Abrir chamado "+ticket.reference+": "+ticket.subject);
  const ref=node("span","overview-recent-ref","#"+ticket.reference+(ticket.unread?" · Não lido":""));
  const status=node("span","overview-recent-status",statusNames[ticket.status]||"Em acompanhamento");
  status.dataset.status=ticket.status;
  const subject=node("strong","",ticket.subject||"Atendimento");
  const created=ticket.created_at?new Date(ticket.created_at):null;
  const date=created&&!Number.isNaN(created.getTime())?
    "Aberto em "+created.toLocaleDateString("pt-BR",{day:"2-digit",month:"short"})+
    " às "+created.toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"}):"";
  btn.append(ref,status,subject,node("small","",date));
  btn.addEventListener("click",()=>document.dispatchEvent(new CustomEvent("proxiti-overview-open-ticket",{detail:{id:ticket.id}})));
  area.append(btn);
 }
}
function render(data){
 if(!canTickets||!data||typeof data.unread!=="number")return;
 const content={unread:data.unread,open:data.open,progress:data.progress,waiting:data.waiting,active:data.active,recent:data.recent};
 const signature=JSON.stringify(content);
 const time=Number(data.at)||Date.now();
 if(time-lastUpdated>30000||signature!==lastSignature){
  el("overview-updated").textContent="Atualizado às "+new Date(time).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"});
  lastUpdated=time;
 }
 if(signature===lastSignature)return;
 lastSignature=signature;
 el("overview-kpi-unread").textContent=String(data.unread);
 el("overview-kpi-open").textContent=String(data.open);
 el("overview-kpi-progress").textContent=String(data.progress);
 el("overview-kpi-waiting").textContent=String(data.waiting);
 el("overview-action-count").hidden=data.unread===0;
 el("overview-action-count").textContent=String(data.unread);
 const primary=el("overview-primary-action");
 const label=primary.querySelector("span:not(.overview-action-count)");
 if(data.unread>0){
  label.textContent="Ver pendências";
  el("overview-banner-title").textContent="Seus atendimentos, sem perder o contexto.";
  el("overview-guidance").textContent=data.unread===1?
    "Há um atendimento com novidade para revisar. Abra a pendência e continue de onde parou.":
    "Há "+data.unread+" atendimentos com novidades para revisar. A Central mantém o histórico e seus rascunhos disponíveis.";
  el("overview-hero-state").textContent=data.unread===1?"1 atendimento pede revisão":data.unread+" atendimentos pedem revisão";
  el("overview-hero-detail").textContent="As pendências estão destacadas na fila, sem interromper o trabalho atual.";
  el("overview-next-text").textContent="Chamados com novidades aparecem primeiro. Escolha um atendimento para continuar.";
 }else if(data.active>0){
  label.textContent="Acompanhar chamados";
  el("overview-banner-title").textContent="Sua operação está organizada.";
  el("overview-guidance").textContent="Você tem "+data.active+" "+(data.active===1?"chamado ativo":"chamados ativos")+" nesta lista. Acompanhe cada etapa e alterne entre recursos sem perder o atendimento.";
  el("overview-hero-state").textContent="Nenhuma pendência não lida";
  el("overview-hero-detail").textContent="Há atendimentos em curso. A fila continua sendo sincronizada.";
  el("overview-next-text").textContent="Escolha um chamado em andamento ou consulte seus outros recursos.";
 }else{
  label.textContent="Consultar a fila";
  el("overview-banner-title").textContent="Tudo preparado para o próximo atendimento.";
  el("overview-guidance").textContent="Não há chamados ativos entre os últimos atendimentos carregados. Seus materiais, ferramentas e perfil continuam disponíveis.";
  el("overview-hero-state").textContent="Sem pendências na fila carregada";
  el("overview-hero-detail").textContent="Novas solicitações aparecerão aqui quando chegarem.";
  el("overview-next-text").textContent="Sua fila não tem atendimentos ativos no momento.";
 }
 primary.dataset.overviewFilter=data.unread>0?"unread":"all";
 renderRecent(Array.isArray(data.recent)?data.recent:[]);
}
function reset(){
 userId=null;canTickets=false;lastSignature="";lastUpdated=0;
 setFocus(false);
 setReading(false);
 setGuide(false);
 for(const id of ["overview-kpi-unread","overview-kpi-open","overview-kpi-progress","overview-kpi-waiting"])el(id).textContent="—";
 el("overview-updated").textContent="Sincronizando…";el("overview-action-count").hidden=true;
 el("overview-guidance").textContent="Os atendimentos e recursos aparecem de acordo com suas permissões.";
 el("overview-hero-state").textContent="Preparando sua visão geral";
 el("overview-hero-detail").textContent="Atualizando as informações da Central Técnica.";
 fallback("Seus atendimentos aparecerão aqui quando a fila estiver disponível.");
}
document.addEventListener("proxiti-session-ready",event=>{
 const session=event.detail;
 if(!session?.user)return;
 if(userId!==session.user.id){lastSignature="";lastUpdated=0;}
 userId=session.user.id;
 let focused=false;
 try{focused=sessionStorage.getItem(focusKey(userId))==="true"}catch{}
 setFocus(focused);
 let enlarged=false;
 try{enlarged=localStorage.getItem(readingKey(userId))==="true"}catch{}
 setReading(enlarged);
 setGuide(false);
 const p=session.profile||{};
 syncAccess({tickets:p.status==="active"&&(p.role==="administrator"||p.permissions?.tickets_view===true)});
});
document.addEventListener("proxiti-navigation-updated",event=>{
 if(!userId)return;
 syncAccess(event.detail?.allowed||{tickets:false});
});
document.addEventListener("proxiti-session-ended",reset);
document.addEventListener("proxiti-overview-updated",event=>render(event.detail));
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
if(window.PROXITI_ACTIVE_SESSION){
 const session=window.PROXITI_ACTIVE_SESSION;userId=session.user.id;
 const p=session.profile||{};
 syncAccess({tickets:p.status==="active"&&(p.role==="administrator"||p.permissions?.tickets_view===true)});
 let saved=false;try{saved=sessionStorage.getItem(focusKey(userId))==="true"}catch{}
 setFocus(saved);
 let enlarged=false;try{enlarged=localStorage.getItem(readingKey(userId))==="true"}catch{}
 setReading(enlarged);
 setGuide(false);
}
})();