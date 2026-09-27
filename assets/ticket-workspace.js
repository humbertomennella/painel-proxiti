/* Workspace: presentation never overrides permission-owned hidden attributes. */
(() => {
'use strict';
const $=id=>document.getElementById(id), root=$('ops-tickets');
const nav=$('ticket-desk-shortcuts'), column=root.querySelector('.ticket-service-column');
const tabs=document.createElement('div');tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','Ferramentas técnicas');
const panels={diagnostic:$('ticket-diagnostic'),notes:$('ticket-note-heading').closest('section'),tasks:$('ticket-tasks-heading').closest('section'),device:$('ticket-device-heading').closest('section'),appointments:$('ticket-appointments-heading').closest('section'),attachments:$('ticket-files-heading').closest('section'),report:$('ticket-report-panel'),history:root.querySelector('.ticket-audit-panel')};
for(const [key,panel] of Object.entries(panels)){
 const button=nav.querySelector(`[data-ticket-jump="${key}"]`);
 panel.id ||= 'ticket-tool-'+key; panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby','ticket-tab-'+key);panel.tabIndex=0;
 button.id='ticket-tab-'+key;button.setAttribute('role','tab');button.setAttribute('aria-controls',panel.id);tabs.append(button);
}
nav.append(tabs);
const notice=document.createElement('p');notice.id='ticket-outside-filter';notice.hidden=true;notice.setAttribute('role','status');notice.textContent='Este atendimento está aberto fora do filtro atual.';nav.before(notice);
let active='diagnostic';
function queue(closed){
 closed=!!window.PROXITI_ACTIVE_TICKET&&!!closed;
 root.querySelector('.ticket-workspace').dataset.queueCollapsed=String(closed);
 $('ticket-list-pane').dataset.mobileCollapsed=String(closed);
 const toggle=$('ticket-queue-toggle');toggle.hidden=false;toggle.textContent=closed?'Abrir fila':'Recolher fila';toggle.setAttribute('aria-expanded',String(!closed));
}
// Keep the reopen control outside the pane being collapsed.
root.querySelector('.ticket-toolbar').append($('ticket-queue-toggle'));
$('ticket-queue-toggle').addEventListener('click',()=>queue(root.querySelector('.ticket-workspace').dataset.queueCollapsed!=='true'));
function open(key,focus=false){
 if(key==='queue'){queue(false);$('ticket-list').scrollIntoView({block:'nearest'});return;}
 if(key==='chat'){
  root.dataset.mobilePane='chat';nav.querySelector('[data-ticket-jump="chat"]').setAttribute('aria-current','location');
  $('ticket-conversation').scrollIntoView({block:'nearest'});return;
 }
 if(!panels[key])return;
 active=key;root.dataset.mobilePane='tool';
 nav.querySelector('[data-ticket-jump="chat"]').removeAttribute('aria-current');
 for(const [name,panel] of Object.entries(panels)){
  const on=name===key;panel.dataset.toolActive=String(on);
  const button=$('ticket-tab-'+name);button.setAttribute('aria-selected',String(on));button.tabIndex=on?0:-1;button.classList.toggle('active',on);
  if(on&&panel.tagName==='DETAILS')panel.open=true;
 }
 column.dataset.tool=key;column.scrollTop=0;
 if(focus)$('ticket-tab-'+key).focus({preventScroll:true});
}
tabs.addEventListener('keydown',event=>{
 const keys=Object.keys(panels),i=keys.indexOf(event.target.dataset.ticketJump);
 if(i<0)return;
 let next;if(event.key==='ArrowRight')next=(i+1)%keys.length;else if(event.key==='ArrowLeft')next=(i+keys.length-1)%keys.length;else if(event.key==='Home')next=0;else if(event.key==='End')next=keys.length-1;else return;
 event.preventDefault();open(keys[next],true);
});
document.addEventListener('proxiti-ticket-filtered',e=>notice.hidden=!e.detail.outside);
document.addEventListener('proxiti-ticket-selected',e=>{
 if(!e.detail?.ticket)notice.hidden=true;
 open(active);if(window.matchMedia('(max-width:767px)').matches)root.dataset.mobilePane=$('ticket-conversation').hidden?'tool':'chat';
});
document.addEventListener('proxiti-session-ended',()=>{notice.hidden=true;open('diagnostic');queue(false);});
window.PROXITI_TICKET_WORKSPACE={open,queue};open('diagnostic');queue(false);
})();
