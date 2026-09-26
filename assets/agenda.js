(() => {
 "use strict";
 const el=id=>document.getElementById(id);
 const root=el("ops-agenda");
 if(!root)return;
 const PAGE_SIZE=60,MAX_DURATION_MS=480*60000;
 const states={planned:"Planejado",confirmed:"Confirmado",done:"Concluído",cancelled:"Cancelado"};
 const modes={remote:"Remoto",on_site:"Presencial",phone:"Ligação"};
 const channels={chat:"Chat da Central",phone:"Telefone",whatsapp:"WhatsApp",
   email:"E-mail",in_person:"Presencial"};
 const session=()=>window.PROXITI_ACTIVE_SESSION;
 const allowed=value=>!!value?.client&&!!value?.user&&value.profile?.status==="active"&&
   (value.profile.role==="administrator"||value.profile.permissions?.tickets_view===true);
 const admin=value=>value.profile?.role==="administrator"&&value.profile?.status==="active";
 const canAct=(value,ticket)=>allowed(value)&&ticket&&
   !["closed","resolved"].includes(ticket.status)&&
   (admin(value)||ticket.assigned_to===value.user.id);
 const make=(tag,text="",className="")=>{
   const node=document.createElement(tag);if(text!==null)node.textContent=String(text);
   if(className)node.className=className;return node;
 };
 const query=async req=>{
   const {data,error}=await req;if(error)throw new Error(error.message||"Consulta indisponível.");
   return data;
 };
 const stamp=value=>new Date(value).toLocaleString("pt-BR",{dateStyle:"short",timeStyle:"short"});
 const localDate=value=>{
   const date=new Date(value),pad=n=>String(n).padStart(2,"0");
   return [date.getFullYear(),pad(date.getMonth()+1),pad(date.getDate())].join("-")+
     "T"+pad(date.getHours())+":"+pad(date.getMinutes());
 };
 let generation=0,loaded=0,entries=[],tickets=new Map(),hasMore=false,
   fetching=false,currentFilter="",lastSync=0;
 const current=(gen,active)=>gen===generation&&allowed(session())&&
   session()?.client===active.client&&session()?.user?.id===active.user.id;
 function feedback(message="",error=false){
   const node=el("agenda-feedback");node.textContent=message;node.hidden=!message;
   node.className="ticket-workflow-feedback"+(error?" error":"");
 }
 function sync(phase){
   const node=el("agenda-sync-state");node.dataset.phase=phase;
   el("reload-agenda").disabled=phase==="loading"||phase==="restricted";
   el("agenda-load-more").disabled=phase==="loading"||phase==="restricted";
   if(phase==="loading")node.textContent=lastSync?
     "Atualizando agenda. Os registros anteriores permanecem visíveis até a confirmação.":
     "Consultando compromissos autorizados…";
   else if(phase==="ready")
     node.textContent="Agenda consultada às "+new Date(lastSync).toLocaleTimeString("pt-BR",
       {hour:"2-digit",minute:"2-digit"})+
       (hasMore?". Há mais compromissos disponíveis na próxima página.":".");
   else if(phase==="error")node.textContent=lastSync?
     "Falha na consulta. Os compromissos exibidos podem estar desatualizados. Atualize novamente.":
     "Não foi possível consultar a agenda. Use Atualizar para tentar novamente.";
   else node.textContent="A Agenda não está autorizada para esta conta.";
 }
 function clear(){
   generation++;loaded=0;entries=[];tickets.clear();hasMore=false;fetching=false;
   currentFilter="";lastSync=0;
   el("agenda-list").replaceChildren(make("p","Entre na Central para consultar sua agenda.","ops-muted"));
   el("agenda-count").textContent="";el("agenda-load-more").hidden=true;
   feedback("");sync("restricted");
 }
 const validRow=row=>!!tickets.get(row.ticket_id);
 function statusOf(row,ticket){
   const label=states[row.status]||"Situação desconhecida";
   const badge=make("span",label,"ops-badge");
   if(row.status==="confirmed"&&row.confirmation_channel)
     badge.title="Confirmado após contato por "+(channels[row.confirmation_channel]||row.confirmation_channel);
   if(ticket?.status==="closed")badge.title="Chamado encerrado · somente leitura";
   return badge;
 }
 async function act(row,ticket,action,params,button,message){
   const active=session(),gen=generation;
   if(!current(gen,active)||!canAct(active,ticket)||fetching)return;
   const card=button.closest(".agenda-entry"),status=card?.querySelector(".agenda-entry-feedback");
   for(const control of card?.querySelectorAll("button,select,input,textarea")||[])control.disabled=true;
   if(status){status.hidden=false;status.textContent="Registrando atualização autorizada…";}
   try{
     await query(active.client.rpc(action,params));
     if(!current(gen,active))return;
     feedback(message);document.dispatchEvent(new CustomEvent("proxiti-ticket-activity",
       {detail:{id:row.ticket_id}}));
     await loadAgenda();
   }catch(error){
     if(!current(gen,active))return;
     const warning="Não foi possível confirmar a alteração. Atualize a agenda antes de repetir: "+
       error.message;
     feedback(warning,true);
     if(status){status.hidden=false;status.textContent=warning;}
     for(const control of card?.querySelectorAll("button,select,input,textarea")||[])
       control.disabled=false;
   }
 }
 function controlsFor(row,ticket){
   const holder=make("div",null,"agenda-actions"),active=session();
   if(!canAct(active,ticket)||!["planned","confirmed"].includes(row.status))return holder;
   const messages=make("p","","agenda-entry-feedback");
   messages.hidden=true;messages.setAttribute("role","status");
   if(row.status==="planned"){
     const confirm=make("div",null,"agenda-confirm");
     const label=make("label","Canal da confirmação do cliente");
     const channel=make("select");channel.setAttribute("aria-label","Canal da confirmação do cliente");
     const empty=make("option","Selecione o canal");empty.value="";channel.append(empty);
     for(const [key,text]of Object.entries(channels)){
       const option=make("option",text);option.value=key;channel.append(option);
     }
     const button=make("button","Registrar confirmação","secondary");button.type="button";
     button.addEventListener("click",()=>{
       if(!channel.value){feedback("Selecione o canal em que o cliente confirmou o horário.",true);return;}
       if(!window.confirm("O cliente confirmou este horário por "+channels[channel.value]+
         "? A confirmação será registrada no histórico e não enviará mensagem automaticamente."))return;
       void act(row,ticket,"proxiti_confirm_appointment",
         {p_id:row.id,p_channel:channel.value},button,"Confirmação do cliente registrada.");
     });
     confirm.append(label,channel,button);holder.append(confirm);
   }else{
     const button=make("button","Concluir compromisso","secondary");button.type="button";
     button.addEventListener("click",()=>{
       if(!window.confirm("O compromisso foi realizado? Isso não encerra automaticamente o chamado."))return;
       void act(row,ticket,"proxiti_update_appointment",
         {p_id:row.id,p_status:"done"},button,"Compromisso concluído.");
     });
     holder.append(button);
   }
   const cancel=make("button","Cancelar compromisso","secondary");cancel.type="button";
   cancel.addEventListener("click",()=>{
     if(!window.confirm("Cancelar este compromisso? A ação ficará registrada e não avisará o cliente automaticamente."))return;
     void act(row,ticket,"proxiti_update_appointment",
       {p_id:row.id,p_status:"cancelled"},cancel,"Compromisso cancelado.");
   });
   holder.append(cancel);
   const disclosure=make("details",null,"agenda-reschedule");
   disclosure.append(make("summary","Reagendar horário"));
   const form=make("form",null,"ticket-workflow-form");
   const timeLabel=make("label","Novo dia e horário no fuso do dispositivo");
   const time=make("input");time.type="datetime-local";time.value=localDate(row.starts_at);time.required=true;
   const durationLabel=make("label","Duração prevista em minutos");
   const duration=make("input");duration.type="number";duration.min="15";duration.max="480";
   duration.step="15";duration.value=String(row.duration_minutes);duration.required=true;
   const modeLabel=make("label","Modalidade");
   const mode=make("select");for(const [key,text]of Object.entries(modes)){
     const option=make("option",text);option.value=key;mode.append(option);
   }mode.value=row.modality;
   const reasonLabel=make("label","Motivo do reagendamento");
   const reason=make("textarea");reason.minLength=5;reason.maxLength=400;reason.rows=2;
   reason.placeholder="Registre o motivo, sem senhas ou dados desnecessários.";reason.required=true;
   const submit=make("button","Salvar novo horário","secondary");submit.type="submit";
   form.append(timeLabel,time,durationLabel,duration,modeLabel,mode,
     reasonLabel,reason,submit);
   form.addEventListener("submit",event=>{
     event.preventDefault();
     const when=new Date(time.value),minutes=Number(duration.value);
     if(!Number.isFinite(when.getTime())||!Number.isInteger(minutes)||
       minutes<15||minutes>480||reason.value.trim().length<5){
       feedback("Revise a data, duração e o motivo do reagendamento.",true);return;
     }
     if(!window.confirm("Registrar novo horário como PLANEJADO? "+
       "A confirmação anterior será invalidada e será necessário combinar novamente com o cliente."))return;
     void act(row,ticket,"proxiti_reschedule_appointment",{
       p_id:row.id,p_starts_at:when.toISOString(),p_duration:minutes,
       p_modality:mode.value,p_reason:reason.value.trim()
     },submit,"Horário atualizado como planejado. Confirme novamente com o cliente.");
   });
   disclosure.append(form);holder.append(disclosure,messages);
   return holder;
 }
 function cardFor(row){
   const ticket=tickets.get(row.ticket_id);if(!ticket)return null;
   const card=make("article",null,"agenda-entry");
   card.dataset.appointmentId=row.id;
   const heading=make("div",null,"ticket-workflow-card-head agenda-card-heading");
   heading.append(make("strong",row.title),statusOf(row,ticket));
   card.append(heading,make("p",stamp(row.starts_at)+" · "+
     row.duration_minutes+" min · "+(modes[row.modality]||row.modality)));
   if(row.status==="confirmed"&&row.confirmed_at)
     card.append(make("small","Confirmação registrada em "+stamp(row.confirmed_at)+
       (row.confirmation_channel?" · "+(channels[row.confirmation_channel]||"Canal informado"):"")));
   else if(row.status==="planned")
     card.append(make("small","Horário planejado · confirmação do cliente pendente."));
   card.append(make("small","Chamado #"+ticket.reference+" · "+ticket.subject,"academy-meta"));
   const open=make("button","Abrir chamado","secondary");open.type="button";
   open.addEventListener("click",()=>{
     if(!allowed(session()))return;
     window.PROXITI_OPEN_VIEW?.("tickets");
     document.dispatchEvent(new CustomEvent("proxiti-overview-open-ticket",
       {detail:{id:row.ticket_id}}));
   });
   card.append(open,controlsFor(row,ticket));
   return card;
 }
 function render(){
   const active=session();
   if(!allowed(active)){clear();return;}
   const now=Date.now(),visible=entries.filter(row=>validRow(row)&&
     (currentFilter==="all"||(
       ["planned","confirmed"].includes(row.status)&&
       Date.parse(row.starts_at)+Number(row.duration_minutes)*60000>=now)));
   const list=el("agenda-list");list.replaceChildren();
   if(!visible.length)list.append(make("p",fetching?"Consultando compromissos…":
     hasMore?"Nenhum compromisso nesta página. Carregue mais para continuar.":
     "Nenhum compromisso nesta visualização.","ops-muted"));
   for(const row of visible){const card=cardFor(row);if(card)list.append(card);}
   el("agenda-count").textContent=visible.length+" exibido"+(visible.length===1?"":"s")+
     (hasMore?" · há mais páginas":"")+
     (currentFilter==="upcoming"?" · planejados e confirmados":" · histórico acessível");
   el("agenda-load-more").hidden=!hasMore;
   el("agenda-load-more").disabled=fetching;
 }
 async function loadAgenda(more=false){
   const active=session();
   if(!allowed(active)){clear();return;}
   if(fetching&&more)return;
   if(more&&!hasMore)return;
   const filter=el("agenda-filter").value,changing=filter!==currentFilter;
   if(!more){
     generation++;if(changing){loaded=0;entries=[];tickets.clear();hasMore=false;lastSync=0;}
     currentFilter=filter;
   }
   const gen=generation,offset=more?loaded:0;
   fetching=true;feedback("");sync("loading");
   if(changing)render();
   try{
     let request=active.client.from("ticket_appointments")
       .select("id,ticket_id,title,starts_at,duration_minutes,modality,status,confirmed_at,confirmation_channel")
       .order("starts_at",{ascending:filter==="upcoming"})
       .order("id",{ascending:filter==="upcoming"});
     if(filter==="upcoming"){
       request=request.in("status",["planned","confirmed"])
         .gte("starts_at",new Date(Date.now()-MAX_DURATION_MS).toISOString());
     }
     const rows=await query(request.range(offset,offset+PAGE_SIZE));
     if(!current(gen,active))return;
     const batch=rows.slice(0,PAGE_SIZE),ids=[...new Set(batch.map(x=>x.ticket_id))];
     const linked=ids.length?await query(active.client.from("support_tickets")
       .select("id,reference,subject,assigned_to,status").in("id",ids)):[];
     if(!current(gen,active))return;
     if(!more){entries=[];tickets.clear();loaded=0;}
     for(const item of linked)tickets.set(item.id,item);
     const seen=new Set(entries.map(item=>item.id));
     for(const row of batch)if(tickets.has(row.ticket_id)&&!seen.has(row.id)){
       entries.push(row);seen.add(row.id);
     }
     loaded=offset+batch.length;hasMore=rows.length>PAGE_SIZE;
     lastSync=Date.now();render();sync("ready");
   }catch(error){
     if(!current(gen,active))return;
     feedback("Falha ao consultar agenda: "+error.message,true);
     sync("error");render();
   }finally{if(current(gen,active)){fetching=false;render();}}
 }
 el("reload-agenda").addEventListener("click",()=>void loadAgenda());
 el("agenda-filter").addEventListener("change",()=>void loadAgenda());
 el("agenda-load-more").addEventListener("click",()=>void loadAgenda(true));
 document.addEventListener("proxiti-agenda-refresh",()=>void loadAgenda());
 document.addEventListener("proxiti-session-ended",clear);
 document.addEventListener("proxiti-session-ready",event=>{
   if(!allowed(event.detail))clear();
   else if(!root.hidden)void loadAgenda();
 });
 if(allowed(session())&&!root.hidden)void loadAgenda();
})();
