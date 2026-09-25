(() => {
"use strict";
let audio=null,enabled=false;
const el=document.getElementById("toggle-alerts");
function label(){if(!el)return;el.textContent=enabled?"♫ Alertas ligados":"♪ Ativar sons";el.setAttribute("aria-pressed",String(enabled));el.title=enabled?"Desativar notificações sonoras":"Ativar notificações sonoras de chamados e mensagens";}
async function toggle(){
 if(enabled){enabled=false;label();return;}
 try{
  const Context=window.AudioContext||window.webkitAudioContext;
  if(!Context)throw new Error("Este navegador não oferece áudio Web.");
  audio=audio||new Context();
  await audio.resume();
  enabled=audio.state==="running";
  label();
  if(enabled)play("message");
 }catch{enabled=false;label();}
}
function play(type){
 if(!enabled||!audio||audio.state!=="running")return;
 const now=audio.currentTime;
 const notes=type==="ticket"?[740,1030]:[920,720];
 for(let i=0;i<notes.length;i++){
  const osc=audio.createOscillator(),gain=audio.createGain();
  const start=now+i*.16;
  osc.type="sine";osc.frequency.setValueAtTime(notes[i],start);
  gain.gain.setValueAtTime(.0001,start);
  gain.gain.exponentialRampToValueAtTime(.055,start+.018);
  gain.gain.exponentialRampToValueAtTime(.0001,start+.135);
  osc.connect(gain);gain.connect(audio.destination);
  osc.start(start);osc.stop(start+.15);
 }
}
el?.addEventListener("click",()=>void toggle());
label();
window.PROXITI_ALERTS=Object.freeze({play,get enabled(){return enabled;}});
})();