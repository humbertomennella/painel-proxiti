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
 for(const card of document.querySelectorAll("[data-summary-view]")){
   const item=nav.find(n=>n.dataset.sideView===card.dataset.summaryView);
   card.hidden=!item||item.hidden;
 }
 choose(nav.find(n=>n.dataset.sideView===stored&&!n.hidden)?stored:"overview");
}
function reset(){
 ready=false;clearTimeout(hoverTimer);hideTooltip();panel.classList.remove("mobile-side-open");
 sidebar.hidden=true;document.body.classList.remove("workspace-mode");
}
function activate(){
 const session=window.PROXITI_ACTIVE_SESSION;if(!session?.user)return;
 sidebar.hidden=false;document.body.classList.add("workspace-mode");
 if(!ready){
  ready=true;
  setCollapsed(true);
 }
 requestAnimationFrame(syncNav);
}
nav.forEach(button=>button.addEventListener("click",()=>choose(button.dataset.sideView,true)));

const tooltip=document.createElement("div");
tooltip.className="sidebar-tooltip";tooltip.hidden=true;tooltip.setAttribute("aria-hidden","true");
document.body.append(tooltip);
let hoverTimer=null;
const desktopHover=()=>window.matchMedia("(min-width:931px) and (hover:hover) and (pointer:fine)").matches;
function hideTooltip(){tooltip.hidden=true}
function showTooltip(node){
 if(!desktopHover()||!panel.classList.contains("sidebar-collapsed"))return;
 const value=node.getAttribute("aria-label")||node.getAttribute("title")||"";
 if(!value)return;
 const rect=node.getBoundingClientRect();
 tooltip.textContent=value;tooltip.style.left=Math.min(rect.right+13,window.innerWidth-215)+"px";
 tooltip.style.top=Math.max(8,Math.min(rect.top+4,window.innerHeight-50))+"px";tooltip.hidden=false;
}
sidebar.addEventListener("pointerenter",()=>{
 if(!ready||!desktopHover())return;
 clearTimeout(hoverTimer);
 hoverTimer=setTimeout(()=>{hideTooltip();setCollapsed(false)},220);
});
sidebar.addEventListener("pointerleave",()=>{
 clearTimeout(hoverTimer);hideTooltip();
 if(ready&&desktopHover())setCollapsed(true);
});
for(const node of [...nav,sidebar.querySelector(".sidebar-brand"),sidebar.querySelector(".side-home")]){
 node.addEventListener("pointerenter",()=>showTooltip(node));
 node.addEventListener("pointerleave",hideTooltip);
}
sidebar.addEventListener("focusin",()=>{
 if(ready&&window.innerWidth>930){clearTimeout(hoverTimer);hideTooltip();setCollapsed(false);}
});
sidebar.addEventListener("focusout",event=>{
 if(ready&&window.innerWidth>930&&!sidebar.contains(event.relatedTarget)&&!sidebar.matches(":hover"))
   setCollapsed(true);
});
window.addEventListener("resize",()=>{hideTooltip();if(ready&&window.innerWidth>930)setCollapsed(true)});

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