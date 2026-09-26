(() => {
 "use strict";
 const el=id=>document.getElementById(id);
 let selected=null,revision=0,agendaRevision=0;
 const session=()=>window.PROXITI_ACTIVE_SESSION;
 const db=()=>session()?.client;
 const admin=()=>session()?.profile?.role==="administrator"&&session()?.profile?.status==="active";
 const canView=()=>!!selected&&!!session()?.user&&session()?.profile?.status==="active"&&
   (admin()||(session()?.profile?.permissions?.tickets_view===true&&
     (selected.assigned_to===session().user.id||selected.assigned_to===null)));
 const writable=()=>canView()&&selected.status!=="closed"&&
   (admin()||selected.assigned_to===session().user.id);
 const same=(rev,ticketId,client,uid)=>rev===revision&&selected?.id===ticketId&&
   db()===client&&session()?.user?.id===uid&&canView();
 const date=value=>new Date(value).toLocaleString("pt-BR",{dateStyle:"short",timeStyle:"short"});
 const make=(tag,content="",cls="")=>{
   const node=document.createElement(tag);node.textContent=String(content);
   if(cls)node.className=cls;return node;
 };
 const empty=(id,text)=>{const node=el(id);node.replaceChildren(make(node.tagName==="UL"||node.tagName==="OL"?"li":"p",text,"ticket-workflow-empty"));};
 async function query(request){
   const {data,error}=await request;
   if(error)throw new Error(error.message||"Serviço temporariamente indisponível.");
   return data;
 }
 const rpc=(name,args)=>query(db().rpc(name,args));
 const feedback=(msg,error=false)=>{
   const p=el("ticket-extras-feedback");
   if(!p)return;
   p.hidden=!msg;p.textContent=msg;p.className="ticket-workflow-feedback"+(error?" error":"");
 };
 const activity=id=>document.dispatchEvent(new CustomEvent("proxiti-ticket-activity",{detail:{id}}));
 async function loadDevice(ticketId){
   const rev=revision,client=db(),uid=session()?.user?.id;
   if(!canView()||!client)return;
   try{
     const data=await query(client.from("ticket_devices")
       .select("category,brand,model,operating_system,asset_reference,observations,updated_at")
       .eq("ticket_id",ticketId).maybeSingle());
     if(!same(rev,ticketId,client,uid))return;
     if(data){
       for(const [field,key] of [["category","category"],["brand","brand"],["model","model"],
         ["os","operating_system"],["ref","asset_reference"],["observations","observations"]])
         el("ticket-device-"+field).value=data[key]|| (field==="category"?"other":"");
       el("ticket-device-summary").textContent="Última atualização: "+date(data.updated_at)+
         " · "+[data.brand,data.model].filter(Boolean).join(" ")+" · "+data.category;
     }else el("ticket-device-summary").textContent="Nenhum equipamento identificado neste chamado.";
   }catch(error){if(same(rev,ticketId,client,uid))feedback("Equipamento: "+error.message,true);}
 }
 const statuses={planned:"Planejado",confirmed:"Confirmado",done:"Concluído",cancelled:"Cancelado"};
 const modalities={remote:"Remoto",on_site:"Presencial",phone:"Ligação"};
 function itemDetail(item,ticketId){
   const li=make("li","","ticket-workflow-entry");
   const head=make("div","","ticket-workflow-card-head");
   head.append(make("strong",item.title),make("span",statuses[item.status]||item.status,"ops-badge"));
   li.append(head,make("small",date(item.starts_at)+" · "+item.duration_minutes+" min · "+
     (modalities[item.modality]||item.modality)));
   if(item.private_details)li.append(make("p",item.private_details));
   if(writable()&&selected?.id===ticketId&&!["done","cancelled"].includes(item.status)){
     const actions=make("div","","ops-controls");
     const transitions=item.status==="planned"?[["confirmed","Confirmar após combinar"],["cancelled","Cancelar"]]:
       [["done","Concluir compromisso"],["cancelled","Cancelar"]];
     for(const [status,label]of transitions){
       const button=make("button",label,"secondary");button.type="button";
       button.addEventListener("click",async()=>{
         if(selected?.id!==ticketId||!writable())return;
         if(status==="confirmed"&&!window.confirm("O cliente confirmou o horário por um canal de atendimento?"))return;
         if(status==="cancelled"&&!window.confirm("Cancelar este compromisso?"))return;
         button.disabled=true;feedback("");
         try{
           await rpc("proxiti_update_appointment",{p_id:item.id,p_status:status});
           feedback("Agenda atualizada.");activity(ticketId);
           await Promise.all([loadAppointments(ticketId),loadAgenda()]);
         }catch(error){feedback(error.message,true);}finally{button.disabled=false;}
       });
       actions.append(button);
     }
     li.append(actions);
   }
   return li;
 }
 async function loadAppointments(ticketId){
   const rev=revision,client=db(),uid=session()?.user?.id;
   if(!canView()||!client)return;
   try{
     const rows=await query(client.from("ticket_appointments")
       .select("id,ticket_id,title,starts_at,duration_minutes,modality,status,private_details")
       .eq("ticket_id",ticketId).order("starts_at",{ascending:false}).limit(100));
     if(!same(rev,ticketId,client,uid))return;
     const list=el("ticket-appointments-list");list.replaceChildren();
     if(!rows.length){empty("ticket-appointments-list","Nenhum compromisso registrado.");return;}
     for(const row of rows)list.append(itemDetail(row,ticketId));
   }catch(error){if(same(rev,ticketId,client,uid))feedback("Agenda: "+error.message,true);}
 }
 async function loadReports(ticketId){
   const rev=revision,client=db(),uid=session()?.user?.id;
   if(!canView()||!client)return;
   try{
     const rows=await query(client.from("ticket_reports")
       .select("id,ticket_id,version,author_id,diagnosis,work_performed,recommendations,finalized,created_at")
       .eq("ticket_id",ticketId).order("version",{ascending:false}).limit(40));
     if(!same(rev,ticketId,client,uid))return;
     const list=el("ticket-report-history");list.replaceChildren();
     if(!rows.length){empty("ticket-report-history","Nenhuma versão salva.");return;}
     for(const row of rows){
       const item=make("li","","ticket-workflow-entry");
       const heading=make("div","","ticket-workflow-card-head");
       heading.append(make("strong","Versão "+row.version),
         make("span",row.finalized?"Final · revisada":"Rascunho","ops-badge"));
       item.append(heading,make("small",date(row.created_at)));
       const button=make("button","Carregar para revisão / impressão","secondary");
       button.type="button";
       button.addEventListener("click",()=>{
         if(selected?.id!==ticketId)return;
         el("ticket-report-diagnosis").value=row.diagnosis;
         el("ticket-report-service").value=row.work_performed;
         el("ticket-report-advice").value=row.recommendations;
         el("ticket-report-reviewed").checked=false;
         el("ticket-report-panel").open=true;
         el("ticket-report-diagnosis").focus({preventScroll:true});
         el("ticket-report-panel").scrollIntoView({behavior:"smooth",block:"start"});
         feedback("Versão "+row.version+" carregada. Uma alteração será salva como uma nova versão.");
       });
       item.append(button);list.append(item);
     }
   }catch(error){if(same(rev,ticketId,client,uid))feedback("Relatórios: "+error.message,true);}
 }
 function choose(ticket){
   const changed=selected?.id!==ticket?.id;revision++;selected=ticket||null;
   el("ticket-device-form").hidden=!writable();
   el("ticket-appointment-form").hidden=!writable()||selected?.status==="resolved";
   el("ticket-report-save-box").hidden=!writable();
   feedback("");
   if(!selected||!canView()){
     el("ticket-device-form").reset();el("ticket-appointment-form").reset();
     empty("ticket-appointments-list","Selecione um chamado.");
     empty("ticket-report-history","Selecione um chamado.");
     el("ticket-device-summary").textContent="Nenhum equipamento identificado.";
     return;
   }
   if(changed){
     el("ticket-device-form").reset();el("ticket-appointment-form").reset();
     el("ticket-report-reviewed").checked=false;
     empty("ticket-appointments-list","Carregando compromissos…");
     empty("ticket-report-history","Carregando versões…");
     el("ticket-device-summary").textContent="Carregando equipamento…";
     const id=selected.id;
     void loadDevice(id);void loadAppointments(id);void loadReports(id);
   }else{
     const id=selected.id;
     void loadDevice(id);void loadAppointments(id);void loadReports(id);
   }
 }
 el("ticket-device-form").addEventListener("submit",async event=>{
   event.preventDefault();if(!writable())return;
   const ticket=selected,button=event.currentTarget.querySelector('[type="submit"]');
   button.disabled=true;feedback("");
   try{
     await rpc("proxiti_save_ticket_device",{
       p_ticket:ticket.id,p_category:el("ticket-device-category").value,
       p_brand:el("ticket-device-brand").value.trim(),p_model:el("ticket-device-model").value.trim(),
       p_os:el("ticket-device-os").value.trim(),p_ref:el("ticket-device-ref").value.trim(),
       p_observations:el("ticket-device-observations").value.trim()
     });
     if(selected?.id===ticket.id){feedback("Identificação salva.");activity(ticket.id);await loadDevice(ticket.id);}
   }catch(error){feedback(error.message,true);}finally{button.disabled=false;}
 });
 el("ticket-appointment-form").addEventListener("submit",async event=>{
   event.preventDefault();if(!writable()||selected.status==="resolved")return;
   const ticket=selected,button=event.currentTarget.querySelector('[type="submit"]');
   const local=el("ticket-appointment-start").value,when=new Date(local);
   if(!local||!Number.isFinite(when.getTime())){feedback("Informe uma data e horário válidos.",true);return;}
   button.disabled=true;feedback("");
   try{
     await rpc("proxiti_schedule_appointment",{
       p_ticket:ticket.id,p_title:el("ticket-appointment-title").value.trim(),
       p_starts_at:when.toISOString(),p_duration:Number(el("ticket-appointment-duration").value),
       p_modality:el("ticket-appointment-mode").value,
       p_private_details:el("ticket-appointment-details").value.trim()
     });
     if(selected?.id===ticket.id){
       el("ticket-appointment-form").reset();feedback("Horário planejado. Confirme com o cliente.");
       activity(ticket.id);await Promise.all([loadAppointments(ticket.id),loadAgenda()]);
     }
   }catch(error){feedback(error.message,true);}finally{button.disabled=false;}
 });
 el("ticket-report-save").addEventListener("click",async event=>{
   if(!writable())return;
   const ticket=selected,button=event.currentTarget;
   const diagnosis=el("ticket-report-diagnosis").value.trim();
   const work=el("ticket-report-service").value.trim();
   const advice=el("ticket-report-advice").value.trim();
   if(diagnosis.length<5||work.length<5){feedback("Preencha diagnóstico e serviço antes de registrar.",true);return;}
   const final=el("ticket-report-reviewed").checked;
   if(final&&!window.confirm("Confirma que revisou esta versão? Ela será preservada no histórico como final, sem envio automático."))return;
   button.disabled=true;feedback("");
   try{
     const version=await rpc("proxiti_save_ticket_report",{
       p_ticket:ticket.id,p_diagnosis:diagnosis,p_work:work,
       p_recommendations:advice,p_finalized:final
     });
     if(selected?.id===ticket.id){
       el("ticket-report-reviewed").checked=false;
       feedback("Relatório versão "+version+" registrado como "+(final?"final":"rascunho")+".");
       activity(ticket.id);await loadReports(ticket.id);
     }
   }catch(error){feedback(error.message,true);}finally{button.disabled=false;}
 });
 async function loadAgenda(){
   const rev=++agendaRevision,active=session();
   if(!active?.client||!(admin()||active.profile?.permissions?.tickets_view===true))return;
   const list=el("agenda-list");
   if(!list)return;
   try{
     const rows=await query(active.client.from("ticket_appointments")
       .select("id,ticket_id,title,starts_at,duration_minutes,modality,status")
       .order("starts_at",{ascending:true}).limit(250));
     const ids=[...new Set(rows.map(x=>x.ticket_id))];
     const tickets=ids.length?await query(active.client.from("support_tickets")
       .select("id,reference,subject").in("id",ids)):[];
     if(rev!==agendaRevision||session()?.user?.id!==active.user.id)return;
     const byId=new Map(tickets.map(x=>[x.id,x]));
     const display=rows.filter(x=>el("agenda-filter").value==="all"||
       (x.status!=="cancelled"&&x.status!=="done"&&new Date(x.starts_at).getTime()>=Date.now()-86400000));
     list.replaceChildren();el("agenda-count").textContent=display.length+" de "+rows.length+" compromissos acessíveis";
     if(!display.length){list.append(make("p","Nenhum compromisso nessa visualização.","ticket-workflow-empty"));return;}
     for(const row of display){
       const card=make("article","","agenda-entry");
       const link=byId.get(row.ticket_id);
       card.append(make("strong",row.title),
         make("p",date(row.starts_at)+" · "+(modalities[row.modality]||row.modality)+
           " · "+row.duration_minutes+" min · "+(statuses[row.status]||row.status)),
         make("small",link?"Chamado #"+link.reference+" · "+link.subject:"Chamado autorizado","academy-meta"));
       if(link){
         const open=make("button","Abrir chamado","secondary");open.type="button";
         open.addEventListener("click",()=>{
           window.PROXITI_OPEN_VIEW?.("tickets");
           document.dispatchEvent(new CustomEvent("proxiti-overview-open-ticket",{detail:{id:row.ticket_id}}));
         });card.append(open);
       }
       list.append(card);
     }
   }catch(error){
     if(rev!==agendaRevision)return;
     list.replaceChildren(make("p","Falha ao consultar agenda: "+error.message,"ticket-workflow-feedback error"));
   }
 }
 el("reload-agenda").addEventListener("click",()=>void loadAgenda());
 el("agenda-filter").addEventListener("change",()=>void loadAgenda());
 document.addEventListener("proxiti-agenda-refresh",()=>void loadAgenda());
 document.addEventListener("proxiti-ticket-selected",event=>choose(event.detail?.ticket||null));
 document.addEventListener("proxiti-session-ended",()=>{
   selected=null;revision++;agendaRevision++;choose(null);
   el("agenda-list").replaceChildren(make("p","Entre na Central para consultar a agenda.","ops-muted"));
   el("agenda-count").textContent="";
 });
 if(window.PROXITI_ACTIVE_TICKET)choose(window.PROXITI_ACTIVE_TICKET);
})();
