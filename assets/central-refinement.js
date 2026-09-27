/* Navegação complementar da Central; somente DOM e interfaces existentes. */
(() => {
"use strict";
const id=name=>document.getElementById(name);
const account=id("open-profile"),menu=id("central-account-menu"),sound=id("account-menu-sound");
const search=id("central-global-search"),input=id("central-global-search-input"),results=id("central-global-search-results");
let currentResults=[],selected=0,courseObserver=null;
const normalize=value=>String(value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("pt-BR").trim();
function closeAccount(restore=false){
 menu.hidden=true;account.setAttribute("aria-expanded","false");
 if(restore)account.focus();
}
function updateSound(){
 const on=window.PROXITI_ALERTS?.enabled!==false;
 sound.textContent=on?"Desativar som":"Ativar som";
 sound.setAttribute("aria-pressed",String(on));
}
account.addEventListener("click",()=>{
 const opening=menu.hidden;
 menu.hidden=!opening;account.setAttribute("aria-expanded",String(opening));updateSound();
 if(opening){hideSearch();id("account-menu-profile").focus();}
});
id("account-menu-profile").addEventListener("click",()=>{closeAccount();window.PROXITI_OPEN_VIEW?.("profile");});
id("account-menu-logout").addEventListener("click",()=>{closeAccount();id("logout")?.click();});
sound.addEventListener("click",()=>{
 const now=window.PROXITI_ALERTS?.enabled!==false;
 window.PROXITI_ALERTS?.setEnabled(!now);updateSound();sound.focus();
});
document.addEventListener("proxiti-sound-preference",updateSound);
document.addEventListener("proxiti-session-ready",()=>{closeAccount();hideSearch();updateSound();});
document.addEventListener("proxiti-session-ended",()=>{closeAccount();hideSearch();});
document.addEventListener("click",event=>{
 if(!menu.hidden&&!event.target.closest(".central-account-wrap"))closeAccount();
 if(!results.hidden&&!event.target.closest("#central-global-search"))hideSearch();
});
document.addEventListener("keydown",event=>{
 if(event.key==="Escape"){if(!menu.hidden){closeAccount(true);event.preventDefault();}if(!results.hidden){hideSearch();input.focus();event.preventDefault();}}
});
function hideSearch(){results.hidden=true;input.setAttribute("aria-expanded","false");currentResults=[];selected=0;}
function availableViews(){
 return [...document.querySelectorAll("#sidebar-nav [data-side-view]")].filter(node=>!node.hidden)
  .map(node=>({view:node.dataset.sideView,title:node.querySelector(".side-label")?.textContent?.trim()||node.getAttribute("aria-label")||"",kind:"Área"}))
  .filter(item=>item.view!=="content");
}
function indexedItems(query){
 const needle=normalize(query);
 if(!needle)return [];
 const pages=availableViews();
 const hits=pages.filter(item=>normalize(item.title).includes(needle));
 const library=pages.find(item=>item.view==="library"),academy=pages.find(item=>item.view==="training");
 if(library){
  const rows=[...document.querySelectorAll("#training-list .academy-entry")];
  for(const row of rows){
   const title=row.querySelector(".academy-entry-head strong")?.textContent?.trim()||"";
   const desc=row.querySelector("p")?.textContent?.trim()||"";
   if(title&&normalize(title+" "+desc+" "+row.dataset.category).includes(needle))
    hits.push({view:"library",title,kind:"Material técnico",query:title});
  }
 }
 if(academy){
  const curriculum=window.PROXITI_ACADEMY_CURRICULUM;
  for(const track of curriculum?.tracks||[])
   if(normalize(track.title+" "+track.subtitle).includes(needle))
    hits.push({view:"training",title:track.title,kind:"Trilha",track:track.id});
  for(const course of curriculum?.courses||[])
   if(normalize(course.title).includes(needle))
    hits.push({view:"training",title:course.title,kind:"Aula",course:course.id,track:course.track});
 }
 if(!hits.length&&library)hits.push({view:"library",title:"Pesquisar materiais por “"+query+"”",kind:"Biblioteca Técnica",query});
 return hits.slice(0,10);
}
function renderSearch(){
 const q=input.value.trim();currentResults=indexedItems(q);results.replaceChildren();selected=0;
 if(!q){hideSearch();return;}
 if(!currentResults.length){const p=document.createElement("p");p.textContent="Nenhum resultado nas áreas disponíveis para sua conta.";results.append(p);}
 for(const [index,item]of currentResults.entries()){
  const btn=document.createElement("button");btn.type="button";btn.setAttribute("role","option");
  btn.setAttribute("aria-selected",String(index===selected));
  const name=document.createElement("span"),tag=document.createElement("small");
  name.textContent=item.title;tag.textContent=item.kind;btn.append(name,tag);
  btn.addEventListener("mouseenter",()=>{selected=index;markSelection();});
  btn.addEventListener("click",()=>openResult(item));
  results.append(btn);
 }
 results.hidden=false;input.setAttribute("aria-expanded","true");
}
function markSelection(){
 [...results.querySelectorAll('[role="option"]')].forEach((node,i)=>node.setAttribute("aria-selected",String(i===selected)));
}
function openCourseEventually(item){
 if(courseObserver){courseObserver.disconnect();courseObserver=null;}
 const host=id("academy-track-list");
 if(!host)return;
 const attempt=()=>{
  const tiles=[...host.querySelectorAll(".uniproxiti-track-tile")];
  const tile=tiles.find(node=>normalize(node.querySelector(".academy-track-copy h5")?.textContent)===normalize((window.PROXITI_ACADEMY_CURRICULUM?.tracks||[]).find(t=>t.id===item.track)?.title));
  if(!tile)return false;
  tile.querySelector("details")?.setAttribute("open","");
  if(item.course){
   const course=[...tile.querySelectorAll(".academy-course-card")].find(node=>node.querySelector("strong")?.textContent===item.title);
   if(!course)return false;
   course.click();
  }else{tile.scrollIntoView({block:"start",behavior:"smooth"});}
  return true;
 };
 if(attempt())return;
 courseObserver=new MutationObserver(()=>{if(attempt()){courseObserver.disconnect();courseObserver=null;}});
 courseObserver.observe(host,{childList:true,subtree:true});
 setTimeout(()=>{if(courseObserver){courseObserver.disconnect();courseObserver=null;}},6000);
}
function openResult(item){
 hideSearch();input.value="";
 const nav=availableViews().some(x=>x.view===item.view);
 if(!nav)return;
 window.PROXITI_OPEN_VIEW?.(item.view);
 if(item.view==="library"&&item.query){
  requestAnimationFrame(()=>{
   const field=id("training-search");if(!field)return;
   field.value=item.query;field.dispatchEvent(new Event("input",{bubbles:true}));
   field.focus();
  });
 }else if(item.view==="training"&&(item.track||item.course)){
  openCourseEventually(item);
 }
}
input.addEventListener("input",renderSearch);
input.addEventListener("focus",()=>{if(input.value.trim())renderSearch();});
input.addEventListener("keydown",event=>{
 if(results.hidden||!currentResults.length)return;
 if(event.key==="ArrowDown"||event.key==="ArrowUp"){
  event.preventDefault();selected=(selected+(event.key==="ArrowDown"?1:-1)+currentResults.length)%currentResults.length;markSelection();
 }else if(event.key==="Escape"){event.preventDefault();hideSearch();}
});
search.addEventListener("submit",event=>{
 event.preventDefault();const list=currentResults.length?currentResults:indexedItems(input.value);
 if(list.length)openResult(list[selected]||list[0]);
});
updateSound();
})();