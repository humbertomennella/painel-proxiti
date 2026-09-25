(() => {
"use strict";
const root=document.documentElement,key="proxiti-theme-v3";
const buttons=[document.getElementById("theme-toggle-public"),document.getElementById("theme-toggle-panel")].filter(Boolean);
let current="light";
try{const saved=localStorage.getItem(key);if(saved==="dark"||saved==="light")current=saved}catch{}
function apply(value,persist=false){
 current=value==="dark"?"dark":"light";
 root.dataset.theme=current;
 const meta=document.querySelector('meta[name="theme-color"]');
 if(meta)meta.content=current==="dark"?"#0b1220":"#f6f7f9";
 for(const button of buttons){
  button.setAttribute("aria-label",current==="dark"?"Ativar tema claro":"Ativar tema escuro");
  button.setAttribute("aria-pressed",String(current==="dark"));
  button.title=current==="dark"?"Ativar tema claro":"Ativar tema escuro";
  const label=button.querySelector(".theme-switch-label");
  if(label)label.textContent=current==="dark"?"Tema escuro":"Tema claro";
 }
 if(persist){try{localStorage.setItem(key,current)}catch{}}
}
buttons.forEach(button=>button.addEventListener("click",()=>apply(current==="dark"?"light":"dark",true)));
window.addEventListener("storage",event=>{
 if(event.key===key&&(event.newValue==="dark"||event.newValue==="light"))apply(event.newValue);
});
apply(current);
})();