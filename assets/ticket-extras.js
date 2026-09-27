(() => {
 "use strict";
 const el=id=>document.getElementById(id);
 let selected=null,revision=0;
 const drafts=new Map();let savedDevice=null;
 const draftForms=['ticket-device-form','ticket-appointment-form','ticket-report-form'];
 function rememberDrafts(){
   if(!selected)return;
   const values={};for(const id of draftForms)for(const field of el(id).querySelectorAll('input,select,textarea'))if(field.id)values[field.id]=field.value;
   drafts.set(selected.id,values);
 }
 function restoreDrafts(){
   const values=drafts.get(selected?.id);if(!values)return;
   for(const [id,value] of Object.entries(values))el(id).value=value;
 }
 for(const id of draftForms)el(id).addEventListener('input',()=>{rememberDrafts();el('ticket-report-reviewed').checked=false;});

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
     savedDevice=data;
     if(data){
       for(const [field,key] of [["category","category"],["brand","brand"],["model","model"],
         ["os","operating_system"],["ref","asset_reference"],["observations","observations"]])
         if(!drafts.has(ticketId))el("ticket-device-"+field).value=data[key]|| (field==="category"?"other":"");
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
         el("ticket-report-reviewed").checked=false;rememberDrafts();
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
   el("ticket-report-suggestions")?.replaceChildren();
   if(changed)savedDevice=null;
   el("ticket-device-form").hidden=!writable();
   el("ticket-appointment-form").hidden=!writable()||selected?.status==="resolved";
   el("ticket-report-save-box").hidden=!writable();
   feedback("");
   if(!selected||!canView()){
     drafts.clear();savedDevice=null;
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
     restoreDrafts();
     const id=selected.id;
     void loadDevice(id);void loadAppointments(id);void loadReports(id);
   }else{
     restoreDrafts();
     const id=selected.id;
     void loadDevice(id);void loadAppointments(id);void loadReports(id);
   }
 }
 el("ticket-device-form").addEventListener("submit",async event=>{
   event.preventDefault();if(!writable())return;
   const ticket=selected,button=event.currentTarget.querySelector('[type="submit"]');
   const rev=revision,client=db(),uid=session()?.user?.id;
   button.disabled=true;feedback("");
   try{
     await rpc("proxiti_save_ticket_device",{
       p_ticket:ticket.id,p_category:el("ticket-device-category").value,
       p_brand:el("ticket-device-brand").value.trim(),p_model:el("ticket-device-model").value.trim(),
       p_os:el("ticket-device-os").value.trim(),p_ref:el("ticket-device-ref").value.trim(),
       p_observations:el("ticket-device-observations").value.trim()
     });
     if(same(rev,ticket.id,client,uid)&&writable()){rememberDrafts();feedback("Identificação salva.");activity(ticket.id);await loadDevice(ticket.id);}
   }catch(error){if(same(rev,ticket.id,client,uid))feedback(error.message,true);}finally{button.disabled=false;}
 });
 el("ticket-appointment-form").addEventListener("submit",async event=>{
   event.preventDefault();if(!writable()||selected.status==="resolved")return;
   const ticket=selected,client=db(),uid=session()?.user?.id,rev=revision;
   const still=()=>same(rev,ticket.id,client,uid)&&writable();
   const button=event.currentTarget.querySelector('[type="submit"]');
   const local=el("ticket-appointment-start").value,when=new Date(local);
   const duration=Number(el("ticket-appointment-duration").value);
   if(!local||!Number.isFinite(when.getTime())||when.getTime()<Date.now()-900000||
      !Number.isInteger(duration)||duration<15||duration>480){
     feedback("Informe um horário válido e duração entre 15 e 480 minutos.",true);return;
   }
   button.disabled=true;feedback("");
   try{
     await query(client.rpc("proxiti_schedule_appointment",{
       p_ticket:ticket.id,p_title:el("ticket-appointment-title").value.trim(),
       p_starts_at:when.toISOString(),p_duration:duration,
       p_modality:el("ticket-appointment-mode").value,
       p_private_details:el("ticket-appointment-details").value.trim()
     }));
     if(!still())return;
     el("ticket-appointment-form").reset();rememberDrafts();
     feedback("Horário planejado. Combine com o cliente e registre a confirmação.");
     activity(ticket.id);await loadAppointments(ticket.id);
     document.dispatchEvent(new Event("proxiti-agenda-refresh"));
   }catch(error){
     if(still()){
       feedback("Não foi possível confirmar o agendamento. Verifique a Agenda antes de reenviar: "+
         error.message,true);
       await loadAppointments(ticket.id);
       document.dispatchEvent(new Event("proxiti-agenda-refresh"));
     }
   }finally{button.disabled=false;}
 });
 el("ticket-report-save").addEventListener("click",async event=>{
   if(!writable())return;
   const ticket=selected,button=event.currentTarget;
   const rev=revision,client=db(),uid=session()?.user?.id;
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
     if(same(rev,ticket.id,client,uid)&&writable()){
       el("ticket-report-reviewed").checked=false;
       feedback("Relatório versão "+version+" registrado como "+(final?"final":"rascunho")+".");
       activity(ticket.id);await loadReports(ticket.id);
     }
   }catch(error){if(same(rev,ticket.id,client,uid))feedback(error.message,true);}finally{button.disabled=false;}
 });
 document.addEventListener("proxiti-ticket-selected",event=>choose(event.detail?.ticket||null));
 document.addEventListener("proxiti-session-ended",()=>{
   selected=null;revision++;drafts.clear();savedDevice=null;choose(null);
 });
 document.addEventListener('proxiti-session-ready',()=>{drafts.clear();savedDevice=null;choose(null);});
 const assist=el('ticket-report-assist');assist.className='ticket-report-assist';
 const prepare=make('button','Preparar rascunho com registros salvos','secondary');prepare.type='button';
 const hint=make('p','Selecione e revise cada sugestão. Etapas concluídas não comprovam, por si só, um serviço. Nenhuma hipótese, nota privada ou conversa é importada.','ticket-workflow-help');
 const suggestions=el('ticket-report-suggestions');
 assist.append(prepare,hint);
 prepare.addEventListener('click',async()=>{
   if(!canView()||el('ticket-report-panel').hidden)return;
   const rev=revision,ticketId=selected.id,client=db(),uid=session().user.id;
   suggestions.replaceChildren();prepare.disabled=true;
   try{
     const rows=await query(client.from('ticket_tasks').select('title,position,state,note').eq('ticket_id',ticketId).order('position',{ascending:true}).limit(150));
     if(!same(rev,ticketId,client,uid))return;
     const items=[];
     if(savedDevice)items.push({label:'Equipamento registrado',text:[savedDevice.category,savedDevice.brand,savedDevice.model,savedDevice.operating_system].filter(Boolean).join(' · '),target:'ticket-report-diagnosis'});
     for(const row of rows||[])if(row.state==='done'||row.state==='skipped')items.push({label:'Etapa '+row.position+' · '+(row.state==='done'?'Concluída':'Não aplicável'),text:row.title+(row.note?' — Registro: '+row.note:' — Sem descrição de execução registrada; confirme antes de incluir.'),target:'ticket-report-service'});
     if(!items.length)suggestions.append(make('p','Nenhum equipamento ou etapa registrada disponível para sugerir.'));
     for(const item of items){
       const card=make('div','','report-suggestion'),label=make('label',item.label),editor=make('textarea');editor.value=item.text;editor.maxLength=1500;label.append(editor);
       const target=make('select');target.setAttribute('aria-label','Destino de '+item.label);
       for(const [value,title] of [['ticket-report-diagnosis','Diagnóstico realizado'],['ticket-report-service','Serviço ou encaminhamento'],['ticket-report-advice','Testes e orientações']]){const option=make('option',title);option.value=value;target.append(option);}target.value=item.target;
       const accept=make('button','Incluir texto revisado','secondary'),discard=make('button','Descartar','secondary');accept.type=discard.type='button';
       accept.addEventListener('click',()=>{
         if(!same(rev,ticketId,client,uid))return;
         const field=el(target.value),value=[field.value.trim(),editor.value.trim()].filter(Boolean).join('\n\n');
         if(value.length>field.maxLength){feedback('O texto excede o limite do campo. Reduza a sugestão.',true);return;}
         field.value=value;field.dispatchEvent(new Event('input',{bubbles:true}));card.remove();
       });discard.addEventListener('click',()=>card.remove());card.append(label,target,accept,discard);suggestions.append(card);
     }
   }catch(error){if(same(rev,ticketId,client,uid))feedback('Não foi possível preparar sugestões: '+error.message,true);}
   finally{prepare.disabled=false;}
 });
 if(window.PROXITI_ACTIVE_TICKET)choose(window.PROXITI_ACTIVE_TICKET);
})();
