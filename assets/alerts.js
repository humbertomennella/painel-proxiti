(() => {
"use strict";
const button=document.getElementById("toggle-alerts");
const key="proxiti-alerts-enabled-v2";
let audio=null,enabled=true;
try{enabled=localStorage.getItem(key)!=="false"}catch{}
function label(){
 if(!button)return;
 button.textContent=enabled?"♫ Alertas ativados":"♪ Alertas desativados";
 button.setAttribute("aria-pressed",String(enabled));
 button.setAttribute("aria-label",enabled?"Desativar alertas":"Ativar alertas");
 button.title=enabled?"Desativar alertas":"Ativar alertas";
}
async function unlock(){
 if(!enabled)return;
 try{
  const Context=window.AudioContext||window.webkitAudioContext;
  if(!Context)return;
  audio=audio||new Context();
  if(audio.state!=="running")await audio.resume();
 }catch{/* O navegador pode exigir uma interação antes de liberar áudio. */}
}
function play(type){
 if(!enabled||!audio||audio.state!=="running")return;
 const start=audio.currentTime,notes=type==="ticket"?[740,1030]:[930,720];
 notes.forEach((frequency,index)=>{
  const osc=audio.createOscillator(),gain=audio.createGain(),at=start+index*.16;
  osc.type="sine";osc.frequency.setValueAtTime(frequency,at);
  gain.gain.setValueAtTime(.0001,at);
  gain.gain.exponentialRampToValueAtTime(.055,at+.017);
  gain.gain.exponentialRampToValueAtTime(.0001,at+.134);
  osc.connect(gain);gain.connect(audio.destination);osc.start(at);osc.stop(at+.15);
 });
}
button?.addEventListener("click",()=>{
 enabled=!enabled;
 try{localStorage.setItem(key,String(enabled))}catch{}
 if(enabled)void unlock();
 label();
});
document.addEventListener("pointerdown",()=>{if(enabled&&audio?.state!=="running")void unlock()},{capture:true});
document.addEventListener("keydown",()=>{if(enabled&&audio?.state!=="running")void unlock()},{capture:true});
label();
window.PROXITI_ALERTS=Object.freeze({play,get enabled(){return enabled;}});
})();