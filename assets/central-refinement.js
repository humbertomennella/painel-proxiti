/* PROXITI · Navegação global e menu da conta. Não realiza consultas novas ao banco. */
(() => {
"use strict";
const el=id=>document.getElementById(id);
const input=el("central-global-query"),form=el("central-global-search"),
  resultBox=el("central-global-results"),status=el("central-global-status"),
  clear=el("central-global-clear"),account=el("central-account-menu"),
  trigger=el("open-profile"),anchor=trigger?.closest(".account-menu-anchor"),
  soundButton=el("account-menu-sound"),soundLabel=el("account-sound-label");
if(!input||!form||!resultBox||!account||!trigger)return;
const normalized=value=>String(value||"").normalize("NFD")
 .replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("pt-BR")
 .replace(/[^a-z0-9]+/g," ").trim();
const parts=value=>normalized(value).split(" ").filter(Boolean);
const session=()=>window.PROXITI_ACTIVE_SESSION;
const nav=view=>document.querySelector('#sidebar-nav [data-side-view="'+view+'"]');
const allowed=view=>!!session()?.user&&document.body.classList.contains("workspace-mode")&&
 !!nav(view)&&!nav(view).hidden;
const sections=[
 {view:"overview",name:"Início",icon:"⌂",terms:"início inicio visão geral visao geral dashboard painel página principal home operação"},
 {view:"tickets",name:"Chamados",icon:"☷",terms:"chamado ticket atendimento mensagem conversa cliente suporte triagem fila chat"},
 {view:"agenda",name:"Agenda",icon:"▦",terms:"agenda visita calendário compromisso agendamento retorno data"},
 {view:"training",name:"UNIPROXITI",icon:"◇",terms:"uni proxiti estudo curso aula capacitação trilha avaliação quiz prova certificado"},
 {view:"library",name:"Biblioteca Técnica",icon:"▤",terms:"biblioteca técnica documento procedimento artigo material manual pdf tutorial orientação"},
 {view:"equipment",name:"Equipamentos",icon:"▣",terms:"equipamento inventário computador notebook hardware ferramenta atribuída"},
 {view:"clients",name:"Clientes",icon:"♧",terms:"clientes contatos pessoa empresa telefone email cadastro"},
 {view:"reports",name:"Relatórios",icon:"▥",terms:"relatório indicador gráfico estatística desempenho chamados resolvidos"},
 {view:"users",name:"Usuários",icon:"♙",terms:"usuário usuários conta contas acesso permissão profissionais"},
 {view:"settings",name:"Configurações",icon:"⚙",terms:"configurações preferência aparência tema notificação segurança"},
 {view:"staff",name:"Técnicos",icon:"♙",terms:"técnicos convites equipe mfa permissão"},
 {view:"tools",name:"Ferramentas",icon:"⚒",terms:"ferramentas diagnóstico rede cidr hash sha ipv4"},
 {view:"profile",name:"Meu Perfil",icon:"◉",terms:"perfil foto nome senha autenticação mfa conta meu perfil"}
];
let results=[],selected=0,searchVersion=0;
function closeSearch(){
 resultBox.hidden=true;input.setAttribute("aria-expanded","false");
 selected=0;
}
function put(candidate){
 if(results.some(item=>item.view===candidate.view&&item.title===candidate.title&&item.term===candidate.term))return;
 results.push(candidate);
}
function buildResults(query){
 results=[];selected=0;const q=normalized(query),tokens=parts(query);
 if(!q)return;
 for(const section of sections){
  if(!allowed(section.view))continue;
  const title=normalized(section.name),terms=normalized(section.terms);
  const score=title===q?115:title.startsWith(q)?97:
    terms.split(" ").some(t=>t.startsWith(q))?73:
    terms.includes(q)?67:tokens.length>1&&tokens.every(t=>terms.includes(t))?62:0;
  if(score)put({...section,title:section.name,description:"Abrir seção",score});
 }
 if(allowed("training")){
  for(const course of window.PROXITI_ACADEMY_CURRICULUM?.courses||[]){
   const name=normalized(course.title);
   if(name.includes(q)||tokens.length>1&&tokens.every(t=>name.includes(t)))
    put({view:"training",title:course.title,description:"Aula da UNIPROXITI",icon:"◇",
      courseId:course.id,score:name===q?112:91});
  }
  for(const track of window.PROXITI_ACADEMY_CURRICULUM?.tracks||[]){
   const name=normalized(track.title);
   if(name.includes(q)||tokens.length>1&&tokens.every(t=>name.includes(t)))
    put({view:"training",title:track.title,description:"Trilha da UNIPROXITI",icon:"◇",score:87});
  }
 }
 if(allowed("library")){
  for(const card of el("training-list")?.querySelectorAll(".academy-entry")||[]){
   const title=card.querySelector(".academy-entry-head strong")?.textContent?.trim()||"";
   const desc=card.querySelector("p")?.textContent?.trim()||"";
   if(normalized(title).includes(q)||tokens.length>1&&tokens.every(t=>normalized(title+" "+desc).includes(t)))
    put({view:"library",title,description:"Material da Biblioteca Técnica",icon:"▤",term:title,score:92});
  }
 }
 if(allowed("tickets")){
  for(const card of el("ticket-list")?.querySelectorAll(".ticket-card,.ticket-list-item,[data-ticket-id]")||[]){
   const title=(card.querySelector("strong,h3")?.textContent||card.textContent||"").trim().slice(0,145);
   if(title&&normalized(title).includes(q))
    put({view:"tickets",title,description:"Chamado acessível",icon:"☷",term:query,score:84});
  }
 }
 if(allowed("equipment")){
  for(const card of el("tools-list")?.querySelectorAll(".ops-list-item")||[]){
   const title=(card.querySelector("strong,h3")?.textContent||"").trim();
   if(title&&normalized(title).includes(q))
    put({view:"equipment",title,description:"Equipamento atribuído",icon:"▣",term:query,score:85});
  }
 }
 results.sort((a,b)=>b.score-a.score||a.title.localeCompare(b.title,"pt-BR"));
 if(!results.length){
  if(allowed("tickets"))put({view:"tickets",title:"Pesquisar chamados por “"+query+"”",description:"Pesquisar na fila autorizada",icon:"☷",term:query,score:1});
  if(allowed("library"))put({view:"library",title:"Pesquisar a Biblioteca por “"+query+"”",description:"Buscar materiais autorizados",icon:"▤",term:query,score:0});
 }
 results=results.slice(0,8);
}
function render(){
 resultBox.replaceChildren();
 for(const [index,item]of results.entries()){
  const button=document.createElement("button");button.type="button";
  button.className="central-global-item";button.setAttribute("role","option");
  button.setAttribute("aria-selected",String(index===selected));
  const badge=document.createElement("span");badge.className="central-global-kind";
  badge.setAttribute("aria-hidden","true");badge.textContent=item.icon||"↗";
  const label=document.createElement("strong");label.textContent=item.title;
  const subtitle=document.createElement("small");subtitle.textContent=item.description;
  button.append(badge,label,subtitle);
  button.addEventListener("click",()=>navigate(item));
  resultBox.append(button);
 }
 if(!results.length){
  const empty=document.createElement("p");empty.className="central-global-empty";
  empty.textContent="Nenhum resultado nas áreas autorizadas.";resultBox.append(empty);
 }
 resultBox.hidden=false;input.setAttribute("aria-expanded","true");
 status.textContent=results.length+" resultados nas áreas autorizadas.";
}
function applyFilter(id,query){
 const field=el(id);if(!field)return;
 field.value=query;field.dispatchEvent(new Event("input",{bubbles:true}));
}
function openCourseWhenReady(id,revision){
 if(!id)return;
 const host=el("academy-track-list");
 if(!host)return;
 const tryOpen=()=>{
  if(revision!==searchVersion||!allowed("training"))return true;
  const course=(window.PROXITI_ACADEMY_CURRICULUM?.courses||[]).find(c=>c.id===id);
  if(!course)return true;
  const card=[...host.querySelectorAll(".academy-course-card")].find(
   b=>normalized(b.querySelector("strong")?.textContent)===normalized(course.title));
  if(!card)return false;
  card.closest("details")?.setAttribute("open","");
  card.click();return true;
 };
 if(tryOpen())return;
 const observer=new MutationObserver(()=>{if(tryOpen())observer.disconnect()});
 observer.observe(host,{childList:true,subtree:true});
 setTimeout(()=>observer.disconnect(),6500);
}
function navigate(item){
 if(!item||!allowed(item.view)){closeSearch();return;}
 searchVersion++;const revision=searchVersion;
 closeSearch();input.value="";clear.hidden=true;
 window.PROXITI_OPEN_VIEW?.(item.view);
 if(item.view==="tickets"&&item.term)applyFilter("ticket-search",item.term);
 if(item.view==="library"&&item.term)applyFilter("training-search",item.term);
 if(item.view==="equipment"&&item.term)applyFilter("tools-search",item.term);
 if(item.courseId)openCourseWhenReady(item.courseId,revision);
 status.textContent="Seção aberta: "+item.title;
}
function updateSearch(){
 clear.hidden=!input.value;
 if(!input.value.trim()||!session()?.user){closeSearch();return;}
 buildResults(input.value.trim());render();
}
form.addEventListener("submit",event=>{
 event.preventDefault();
 if(!input.value.trim()){closeSearch();return;}
 if(!results.length)buildResults(input.value.trim());
 navigate(results[selected]||results[0]);
});
input.addEventListener("input",updateSearch);
input.addEventListener("focus",()=>{if(input.value.trim())updateSearch()});
input.addEventListener("keydown",event=>{
 if(event.key==="Escape"){event.stopPropagation();closeSearch();return;}
 if(!results.length||resultBox.hidden)return;
 if(event.key==="ArrowDown"||event.key==="ArrowUp"){
  event.preventDefault();selected=(selected+(event.key==="ArrowDown"?1:results.length-1))%results.length;render();
 }
});
clear.addEventListener("click",()=>{input.value="";clear.hidden=true;closeSearch();input.focus()});
function soundCopy(){
 const on=window.PROXITI_ALERTS?.enabled!==false;
 soundLabel.textContent=on?"Desativar som":"Ativar som";
 soundButton.setAttribute("aria-pressed",String(on));
 soundButton.title=on?"Desativar avisos sonoros de chamados e mensagens":"Ativar avisos sonoros de chamados e mensagens";
}
function closeAccount(focus=false){
 account.hidden=true;trigger.setAttribute("aria-expanded","false");
 if(focus)trigger.focus({preventScroll:true});
}
function toggleAccount(){
 if(!session()?.user)return;
 closeSearch();
 const open=account.hidden;account.hidden=!open;trigger.setAttribute("aria-expanded",String(open));
 if(open){soundCopy();el("account-menu-profile").focus({preventScroll:true})}
}
el("account-menu-profile").addEventListener("click",()=>{
 closeAccount();window.PROXITI_OPEN_VIEW?.("profile");
});
soundButton.addEventListener("click",()=>{
 const sound=window.PROXITI_ALERTS;
 if(!sound?.setEnabled)return;
 sound.setEnabled(!sound.enabled);soundCopy();
});
el("account-menu-logout").addEventListener("click",()=>{
 closeAccount();el("logout")?.click();
});
document.addEventListener("pointerdown",event=>{
 if(!form.contains(event.target))closeSearch();
 if(!anchor?.contains(event.target))closeAccount();
});
document.addEventListener("keydown",event=>{
 if(event.key!=="Escape")return;
 if(!account.hidden){event.preventDefault();closeAccount(true);}
 closeSearch();
});
document.addEventListener("proxiti-session-ended",()=>{
 closeAccount();closeSearch();searchVersion++;input.value="";clear.hidden=true;
});
document.addEventListener("proxiti-alerts-changed",soundCopy);
window.PROXITI_ACCOUNT_MENU=Object.freeze({toggle:toggleAccount,close:closeAccount});
soundCopy();
})();
