/* PROXITI · Alertas sonoros de chamados e mensagens
   Ativos por padrão; preferência por conta, controlada no menu do perfil.
   Autoplay pode depender da primeira interação com o navegador. */
(() => {
"use strict";
let audio=null,enabled=true,userId=null;
const key=id=>"proxiti-alerts-v2-"+id;
function state(){
 document.dispatchEvent(new CustomEvent("proxiti-alerts-changed",{detail:{enabled}}));
}
async function unlock(){
 if(!enabled||!userId)return false;
 try{
  const Context=window.AudioContext||window.webkitAudioContext;
  if(!Context)return false;
  audio=audio||new Context();
  if(audio.state!=="running")await audio.resume();
  return audio.state==="running";
 }catch{return false;}
}
function tone(frequencies,volume=.042){
 if(!enabled||!userId||!audio||audio.state!=="running")return false;
 const now=audio.currentTime;
 frequencies.forEach((frequency,index)=>{
  const oscillator=audio.createOscillator(),gain=audio.createGain(),at=now+index*.14;
  oscillator.type="sine";oscillator.frequency.setValueAtTime(frequency,at);
  gain.gain.setValueAtTime(.0001,at);
  gain.gain.exponentialRampToValueAtTime(volume,at+.016);
  gain.gain.exponentialRampToValueAtTime(.0001,at+.12);
  oscillator.connect(gain);gain.connect(audio.destination);
  oscillator.start(at);oscillator.stop(at+.13);
 });
 return true;
}
function play(type){
 if(!enabled||!userId)return false;
 const notes=type==="ticket"?[740,1030]:[930,720];
 if(tone(notes,.043))return true;
 const owner=userId;
 void unlock().then(ready=>{if(ready&&enabled&&userId===owner)tone(notes,.043)});
 return false;
}
function setEnabled(value){
 enabled=!!value;
 if(userId)try{localStorage.setItem(key(userId),enabled?"on":"off")}catch{}
 if(!enabled&&audio?.state==="running")void audio.suspend().catch(()=>{});
 if(enabled)void unlock();
 state();return enabled;
}
function activate(event){
 const id=event?.detail?.user?.id||window.PROXITI_ACTIVE_SESSION?.user?.id;
 if(!id)return;
 if(id===userId)return;
 userId=id;enabled=true;
 try{enabled=localStorage.getItem(key(id))!=="off"}catch{}
 state();
}
document.addEventListener("pointerdown",()=>{if(enabled&&userId&&audio?.state!=="running")void unlock()},{capture:true});
document.addEventListener("keydown",()=>{if(enabled&&userId&&audio?.state!=="running")void unlock()},{capture:true});
document.addEventListener("proxiti-session-ready",activate);
document.addEventListener("proxiti-session-ended",()=>{
 userId=null;enabled=true;
 if(audio?.state==="running")void audio.suspend().catch(()=>{});
 state();
});
window.PROXITI_ALERTS=Object.freeze({play,setEnabled,get enabled(){return enabled}});
if(window.PROXITI_ACTIVE_SESSION?.user)activate({detail:window.PROXITI_ACTIVE_SESSION});
})();