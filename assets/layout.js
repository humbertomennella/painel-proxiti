(() => {
"use strict";
const el=id=>document.getElementById(id);
const panel=el("panel"),sidebar=el("app-sidebar"),main=el("panel-main");
const nav=[...sidebar.querySelectorAll("[data-side-view]")];
let current="overview",ready=false,restoring=false;
const key=()=> "proxiti-ui-"+(window.PROXITI_ACTIVE_SESSION?.user?.id||"guest");
const read=()=>{try{if(sessionStorage.getItem("proxiti-force-overview")==="1"){sessionStorage.removeItem("proxiti-force-overview");return "overview";}return sessionStorage.getItem(key()+"-view")||"overview"}catch{return "overview"}};
const save=view=>{try{sessionStorage.setItem(key()+"-view",view)}catch{}};
function setCollapsed(value){
 panel.classList.toggle("sidebar-collapsed",value);
 el("sidebar-toggle").setAttribute("aria-expanded",String(!value));
 el("sidebar-toggle").setAttribute("aria-label",value?"Expandir menu":"Recolher menu");
 try{localStorage.setItem("proxiti-sidebar-collapsed",value?"1":"0")}catch{}
}
function closeMobile(){
 panel.classList.remove("mobile-side-open");
 el("mobile-nav-toggle").setAttribute("aria-expanded","false");
}
function choose(view,scroll=false){
 const target=nav.find(n=>n.dataset.sideView===view&&!n.hidden);
 if(!target)return;
 current=view;
 for(const n of nav){n.classList.toggle("selected",n.dataset.sideView===view);
   n.setAttribute("aria-current",n.dataset.sideView===view?"page":"false");}
 const overview=view==="overview",profile=view==="profile";
 el("profile-section").hidden=!profile;
 document.querySelector(".section-heading").hidden=!overview;
 document.querySelector(".overview-banner").hidden=!overview;
 el("workspace").querySelector(".modules").hidden=!overview;
 document.querySelector(".development").hidden=!overview;
 el("operations").hidden=overview||profile;
 if(!overview&&!profile){
   const tab=el("ops-tabs").querySelector('[data-ops-view="'+view+'"]');
   if(tab&&!tab.hidden)tab.click();
 }
 save(view);
 if(scroll)window.scrollTo({top:0,behavior:"instant"});
 closeMobile();
}
function syncNav(){
 for(const n of nav){
  const view=n.dataset.sideView;
  const tab=el("ops-tabs").querySelector('[data-ops-view="'+view+'"]');
  n.hidden=view!=="overview"&&view!=="profile"&&(!tab||tab.hidden);
 }
 const stored=read();
 choose(nav.find(n=>n.dataset.sideView===stored&&!n.hidden)?stored:"overview");
}
function reset(){
 ready=false;panel.classList.remove("mobile-side-open");
 sidebar.hidden=true;document.body.classList.remove("workspace-mode");
}
function activate(){
 const session=window.PROXITI_ACTIVE_SESSION;if(!session?.user)return;
 sidebar.hidden=false;document.body.classList.add("workspace-mode");
 if(!ready){
  ready=true;
  let collapsed=false;try{collapsed=localStorage.getItem("proxiti-sidebar-collapsed")==="1"}catch{}
  setCollapsed(collapsed);
 }
 requestAnimationFrame(syncNav);
}
nav.forEach(button=>button.addEventListener("click",()=>choose(button.dataset.sideView,true)));
el("app-sidebar").querySelector(".sidebar-brand").addEventListener("click",e=>{if(ready){e.preventDefault();choose("overview",true);}});
window.PROXITI_OPEN_VIEW=view=>choose(view,true);
document.querySelectorAll("[data-summary-view]").forEach(card=>{
 const open=()=>choose(card.dataset.summaryView,true);
 card.addEventListener("click",open);
 card.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();open()}});
});
el("sidebar-toggle").addEventListener("click",()=>setCollapsed(!panel.classList.contains("sidebar-collapsed")));
el("mobile-nav-toggle").addEventListener("click",()=>{
 const open=!panel.classList.contains("mobile-side-open");
 panel.classList.toggle("mobile-side-open",open);
 el("mobile-nav-toggle").setAttribute("aria-expanded",String(open));
});
document.addEventListener("keydown",e=>{if(e.key==="Escape")closeMobile()});
document.addEventListener("proxiti-session-ready",activate);
document.addEventListener("proxiti-session-ended",reset);
document.addEventListener("proxiti-navigation-updated",()=>{if(ready)requestAnimationFrame(syncNav)});
if(window.PROXITI_ACTIVE_SESSION)activate();
const badge=el("ticket-badge"),sideBadge=el("side-ticket-badge");
const observer=new MutationObserver(()=>{sideBadge.textContent=badge.textContent.trim()});
observer.observe(badge,{characterData:true,subtree:true,childList:true});
})();