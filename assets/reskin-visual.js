/* PROXITI visual reskin · Fase 2. Exclusivamente apresentação e navegação já disponível.
   Não acessa Supabase, não altera auth, permissões, dados, uploads ou publicação. */
(() => {
 "use strict";
 const byId=id=>document.getElementById(id);
 const panel=byId("panel"),sidebar=byId("app-sidebar"),scrim=byId("reskin-nav-scrim");
 const name=byId("person-name"),welcome=byId("welcome"),avatar=byId("avatar-top"),online=byId("overview-online");
 const initials=byId("reskin-user-initials"),toggle=byId("sidebar-toggle");
 let desktopManuallyCollapsed=false;
 const desktop=()=>window.matchMedia("(min-width:1200px)").matches;
 const mobile=()=>window.matchMedia("(max-width:767px)").matches;
 function greeting(){
   if(!document.body.classList.contains("workspace-mode")||
      !window.PROXITI_ACTIVE_SESSION?.user)return;
   const raw=(name?.textContent||"").trim();
   const first=raw.split(/[.\s_-]+/).filter(Boolean)[0]||"Profissional";
   const firstName=first.charAt(0).toLocaleUpperCase("pt-BR")+first.slice(1);
   const hour=new Date().getHours();
   const word=hour<6?"Boa madrugada":hour<12?"Bom dia":hour<18?"Boa tarde":"Boa noite";
   const next=word+", "+firstName;
   if(welcome.textContent!==next)welcome.textContent=next;
 }
 function avatarFallback(){
   if(!avatar||!initials)return;
   const src=avatar.getAttribute("src")||"";
   const empty=!src||src.includes("assets/favicon.svg")||avatar.dataset.visualError===src;
   const parts=(name?.textContent||"Profissional").trim().split(/\s+/).filter(Boolean);
   const letters=(parts[0]?.[0]||"P")+(parts.length>1?parts[parts.length-1][0]:"");
   initials.textContent=letters.toLocaleUpperCase("pt-BR");
   initials.hidden=!empty;
   avatar.hidden=empty;
 }
 function onlineCopy(){
   if(!online||!document.body.classList.contains("workspace-mode"))return;
   const value=online.textContent.trim();
   const match=/^([0-9]+) (?:profissional|profissionais) online$/.exec(value);
   if(!match)return;
   const n=Number(match[1]);
   online.textContent=n+(n===1?" conta online agora":" contas online agora");
 }
  function navVisual(){
   if(!panel||!scrim)return;
   const opened=mobile()&&panel.classList.contains("mobile-side-open")&&
     document.body.classList.contains("workspace-mode");
   scrim.hidden=!opened;
   byId("mobile-nav-toggle")?.setAttribute("aria-expanded",String(opened));
   if(!mobile())scrim.hidden=true;
 }
 function syncSidebar(){
   if(!panel||!document.body.classList.contains("workspace-mode"))return;
   if(desktop()&&!desktopManuallyCollapsed){
     panel.classList.remove("sidebar-collapsed");
     toggle?.setAttribute("aria-expanded","true");
     toggle?.setAttribute("aria-label","Recolher menu");
   }else if(!desktop()&&!mobile()){
     panel.classList.add("sidebar-collapsed");
     toggle?.setAttribute("aria-expanded","false");
     toggle?.setAttribute("aria-label","Expandir menu");
   }
   navVisual();
 }
 byId("reskin-help")?.addEventListener("click",()=>{
   window.PROXITI_OPEN_VIEW?.("overview");
   requestAnimationFrame(()=>{
     const guide=byId("overview-guide-toggle");
     if(guide?.getAttribute("aria-expanded")!=="true")guide?.click();
     byId("overview-guide")?.scrollIntoView({behavior:"smooth",block:"start"});
   });
 });
 scrim?.addEventListener("click",()=>{
   if(panel.classList.contains("mobile-side-open"))byId("mobile-nav-toggle")?.click();
 });
 toggle?.addEventListener("click",()=>{
   if(desktop())desktopManuallyCollapsed=panel.classList.contains("sidebar-collapsed");
 });
 sidebar?.addEventListener("pointerleave",()=>{
   if(desktop()&&!desktopManuallyCollapsed)syncSidebar();
 });
 window.addEventListener("resize",syncSidebar);
 window.addEventListener("focus",greeting);
 avatar?.addEventListener("error",()=>{
   avatar.dataset.visualError=avatar.getAttribute("src")||"";avatarFallback();
 });
 new MutationObserver(avatarFallback).observe(avatar,{attributes:true,attributeFilter:["src"]});
 new MutationObserver(()=>{greeting();avatarFallback();}).observe(name,{childList:true,subtree:true,characterData:true});
 new MutationObserver(greeting).observe(welcome,{childList:true,subtree:true,characterData:true});
 if(online)new MutationObserver(onlineCopy).observe(online,{childList:true,subtree:true,characterData:true});
 new MutationObserver(navVisual).observe(panel,{attributes:true,attributeFilter:["class","hidden"]});
 document.addEventListener("proxiti-session-ready",()=>{
   desktopManuallyCollapsed=false;
   greeting();avatarFallback();onlineCopy();requestAnimationFrame(syncSidebar);
 });
 document.addEventListener("proxiti-session-ended",()=>{
   scrim.hidden=true;desktopManuallyCollapsed=false;
 });
 avatarFallback();navVisual();
 if(window.PROXITI_ACTIVE_SESSION?.user){greeting();requestAnimationFrame(syncSidebar);}
})();
