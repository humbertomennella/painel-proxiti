(() => {
  "use strict";
  // Modelo puro da Visão Geral: os mesmos critérios alimentam cards, fila e avisos.
  const openStatuses=new Set(["new","triage","in_progress","waiting_customer"]);
  const newlyArrived=new Set(["new","triage"]);
  const attention=(ticket,seen,unread,canReadMessages,messagesReady)=>
    ticket.status!=="closed"&&(
      (newlyArrived.has(ticket.status)&&!seen(ticket.id))||
      (canReadMessages&&messagesReady&&unread(ticket.id)>0)
    );
  function summarize(tickets,options={}){
    const list=Array.isArray(tickets)?tickets:[];
    const seen=options.seen||(()=>false),unread=options.unread||(()=>0);
    const canReadMessages=!!options.canReadMessages,messagesReady=!!options.messagesReady;
    const complete=!canReadMessages||messagesReady;
    const needs=t=>attention(t,seen,unread,canReadMessages,messagesReady);
    const priority=t=>needs(t)?0:newlyArrived.has(t.status)?1:t.status==="in_progress"?2:3;
    const recent=list.filter(t=>openStatuses.has(t.status)||(t.status==="resolved"&&needs(t)))
      .sort((a,b)=>priority(a)-priority(b)||
        (Date.parse(b.created_at)||0)-(Date.parse(a.created_at)||0))
      .slice(0,4).map(t=>({
        id:t.id,reference:t.reference,subject:t.subject,status:t.status,created_at:t.created_at,unread:needs(t)
      }));
    const resumed=list.find(t=>t.id===options.activeId&&openStatuses.has(t.status));
    const resume=resumed?{
      id:resumed.id,reference:resumed.reference,subject:resumed.subject,status:resumed.status
    }:null;
    return {
      unread:complete?list.filter(needs).length:null,
      open:list.filter(t=>newlyArrived.has(t.status)).length,
      progress:list.filter(t=>t.status==="in_progress").length,
      waiting:list.filter(t=>t.status==="waiting_customer").length,
      active:list.filter(t=>openStatuses.has(t.status)).length,
      messagesAllowed:canReadMessages,messagesAvailable:complete,
      recent,resume,
      at:Number(options.at)||Date.now(),sampleSize:list.length,sampleLimit:Number(options.sampleLimit)||100
    };
  }
  window.PROXITI_OVERVIEW_MODEL=Object.freeze({attention,summarize});
})();
