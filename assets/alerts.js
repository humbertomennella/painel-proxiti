(() => {
"use strict";
const button=document.getElementById("toggle-alerts"),key="proxiti-alerts-enabled-v2";
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
 try{
  const Context=window.AudioContext||window.webkitAudioContext;
  if(!Context)return;
  audio=audio||new Context();
  if(audio.state!=="running")await audio.resume();
 }catch{/* O navegador pode exigir interação antes de reproduzir som. */}
}
function tone(frequencies,volume=.042){
 if(!audio||audio.state!=="running")return;
 const now=audio.currentTime;
 frequencies.forEach((frequency,index)=>{
  const osc=audio.createOscillator(),gain=audio.createGain(),at=now+index*.14;
  osc.type="sine";osc.frequency.setValueAtTime(frequency,at);
  gain.gain.setValueAtTime(.0001,at);
  gain.gain.exponentialRampToValueAtTime(volume,at+.016);
  gain.gain.exponentialRampToValueAtTime(.0001,at+.12);
  osc.connect(gain);gain.connect(audio.destination);osc.start(at);osc.stop(at+.13);
 });
}
function play(type){if(enabled)tone(type==="ticket"?[740,1030]:[930,720],.043)}
button?.addEventListener("click",async()=>{
 await unlock();
 if(enabled){tone([650,480],.037);enabled=false;}
 else{enabled=true;tone([550,810],.037);}
 try{localStorage.setItem(key,String(enabled))}catch{}
 label();
});
document.addEventListener("pointerdown",()=>{if(enabled&&audio?.state!=="running")void unlock()},{capture:true});
document.addEventListener("keydown",()=>{if(enabled&&audio?.state!=="running")void unlock()},{capture:true});
label();
window.PROXITI_ALERTS=Object.freeze({play,get enabled(){return enabled;}});
})();