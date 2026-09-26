(() => {
 "use strict";
 const el=id=>document.getElementById(id);
 let selected=null,revision=0;
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
   if(item.status==="planned")
     li.append(make("small","Planejado: a confirmação do cliente ainda não foi registrada."));
   if(item.status==="confirmed"&&item.confirmed_at)
     li.append(make("small","Confirmado em "+date(item.confirmed_at)+
       (item.confirmation_channel?" · "+({chat:"Chat",phone:"Telefone",whatsapp:"WhatsApp",
         email:"E-mail",in_person:"Presencial"}[item.confirmation_channel]||"Canal informado"):"")));
   if(item.private_details)li.append(make("p",item.private_details));
   if(writable()&&selected?.id===ticketId&&["planned","confirmed"].includes(item.status)){
     const actions=make("div","","ops-controls");
     const active=session(),client=db(),rev=revision,uid=active.user.id;
     const still=()=>same(rev,ticketId,client,uid)&&writable();
     async function commit(name,params,button,message){
       if(!still())return;
       for(const control of actions.querySelectorAll("button,select"))control.disabled=true;
       feedback("");
       try{
         await query(client.rpc(name,params));
         if(!still())return;
         feedback(message);activity(ticketId);
         await loadAppointments(ticketId);
         document.dispatchEvent(new Event("proxiti-agenda-refresh"));
       }catch(error){
         if(still()){
           feedback("Não foi possível confirmar a mudança: "+error.message+
             ". A lista será atualizada para evitar ações duplicadas.",true);
           await loadAppointments(ticketId);
         }
       }finally{
         for(const control of actions.querySelectorAll("button,select"))control.disabled=false;
       }
     }
     if(item.status==="planned"){
       const label=make("label","Canal da confirmação do cliente");
       const channel=make("select");
       channel.setAttribute("aria-label","Canal da confirmação do cliente para "+item.title);
       for(const [value,text]of [["","Selecione o canal"],["chat","Chat da Central"],
         ["phone","Telefone"],["whatsapp","WhatsApp"],["email","E-mail"],
         ["in_person","Presencial"]]){
         const option=make("option",text);option.value=value;channel.append(option);
       }
       const confirm=make("button","Registrar confirmação","secondary");confirm.type="button";
       confirm.addEventListener("click",()=>{
         if(!channel.value){feedback("Informe onde o cliente confirmou o horário.",true);return;}
         if(!window.confirm("O cliente confirmou este horário por "+
           channel.selectedOptions[0].textContent+"? O registro não envia mensagem automaticamente."))return;
         void commit("proxiti_confirm_appointment",
           {p_id:item.id,p_channel:channel.value},confirm,"Confirmação registrada.");
       });
       actions.append(label,channel,confirm);
     }else{
       const done=make("button","Concluir compromisso","secondary");done.type="button";
       done.addEventListener("click",()=>{
         if(!window.confirm("O compromisso foi realizado? O chamado permanecerá na situação atual."))return;
         void commit("proxiti_update_appointment",
           {p_id:item.id,p_status:"done"},done,"Compromisso concluído.");
       });
       actions.append(done);
     }
     const cancel=make("button","Cancelar compromisso","secondary");cancel.type="button";
     cancel.addEventListener("click",()=>{
       if(!window.confirm("Cancelar compromisso? A ação não notifica automaticamente o cliente."))return;
       void commit("proxiti_update_appointment",
         {p_id:item.id,p_status:"cancelled"},cancel,"Compromisso cancelado.");
     });
     const reschedule=make("button","Reagendar na Agenda","secondary");reschedule.type="button";
     reschedule.addEventListener("click",()=>window.PROXITI_OPEN_VIEW?.("agenda"));
     actions.append(cancel,reschedule);li.append(actions);
   }
   return li;
 }
 async function loadAppointments(ticketId){
   const rev=revision,client=db(),uid=session()?.user?.id;
   if(!canView()||!client)return;
   try{
     const rows=await query(client.from("ticket_appointments")
       .select("id,ticket_id,title,starts_at,duration_minutes,modality,status,private_details,confirmed_at,confirmation_channel")
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
 document.addEventListener("proxiti-ticket-selected",event=>choose(event.detail?.ticket||null));
 document.addEventListener("proxiti-session-ended",()=>{
   selected=null;revision++;choose(null);
 });
 if(window.PROXITI_ACTIVE_TICKET)choose(window.PROXITI_ACTIVE_TICKET);
})();
