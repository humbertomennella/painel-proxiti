(() => {
"use strict";
const picker=document.getElementById("palette-select");
const allowed=new Set(["grafite","marinho","carbono","areia"]);
let currentUser=null;
const storageKey=id=>"proxiti-palette-v1-"+id;
function apply(name,save=false){
 const legacy={noturno:"marinho",petroleo:"carbono",ardosia:"areia"};
 const normalized=legacy[name]||name;
 const selected=allowed.has(normalized)?normalized:"grafite";
 document.body.dataset.palette=selected;
 picker.value=selected;
 if(save&&currentUser){try{localStorage.setItem(storageKey(currentUser),selected)}catch{}}
}
document.addEventListener("proxiti-session-ready",e=>{
 const id=e.detail?.user?.id;
 if(!id)return;
 if(id===currentUser)return;
 currentUser=id;
 let preferred="grafite";
 try{preferred=localStorage.getItem(storageKey(id))||preferred}catch{}
 apply(preferred);
});
document.addEventListener("proxiti-session-ended",()=>{
 currentUser=null;
 delete document.body.dataset.palette;
});
picker.addEventListener("change",()=>apply(picker.value,true));
if(window.PROXITI_ACTIVE_SESSION){
 currentUser=window.PROXITI_ACTIVE_SESSION.user.id;
 let preferred="grafite";try{preferred=localStorage.getItem(storageKey(currentUser))||preferred}catch{}
 apply(preferred);
}
})();