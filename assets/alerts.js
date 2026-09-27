/* Alertas habilitados por padrão. Navegadores podem exigir interação para liberar áudio. */
(() => {
"use strict";
let audio=null;
async function unlock(){
 try{
  const Context=window.AudioContext||window.webkitAudioContext;
  if(!Context)return false;
  audio=audio||new Context();
  if(audio.state!=="running")await audio.resume();
  return audio.state==="running";
 }catch{return false;}
}
function tone(frequencies,volume=.042){
 if(!audio||audio.state!=="running")return false;
 const now=audio.currentTime;
 frequencies.forEach((frequency,index)=>{
  const oscillator=audio.createOscillator(),gain=audio.createGain(),at=now+index*.14;
  oscillator.type="sine";oscillator.frequency.setValueAtTime(frequency,at);
  gain.gain.setValueAtTime(.0001,at);
  gain.gain.exponentialRampToValueAtTime(volume,at+.016);
  gain.gain.exponentialRampToValueAtTime(.0001,at+.12);
  oscillator.connect(gain);gain.connect(audio.destination);oscillator.start(at);oscillator.stop(at+.13);
 });
 return true;
}
function play(type){
 const notes=type==="ticket"?[740,1030]:[930,720];
 if(tone(notes,.043))return;
 void unlock().then(ready=>{if(ready)tone(notes,.043);});
}
document.addEventListener("pointerdown",()=>{if(audio?.state!=="running")void unlock();},{capture:true});
document.addEventListener("keydown",()=>{if(audio?.state!=="running")void unlock();},{capture:true});
window.PROXITI_ALERTS=Object.freeze({play,get enabled(){return true;}});
})();
