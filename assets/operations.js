(() => {
  "use strict";
  const el = id => document.getElementById(id);
  const state = { db:null, user:null, profile:null, tickets:[], staff:[], active:null,
    channel:null, poll:null, heartbeat:null, currentView:"tickets", loading:false };
  const statusNames = {new:"Novo",triage:"Em triagem",in_progress:"Em atendimento",
    waiting_customer:"Aguardando cliente",resolved:"Resolvido",closed:"Encerrado"};
  const permNames = {tickets_view:"Consultar chamados",tickets_claim:"Assumir chamados",
    chat:"Chat com clientes",training:"Academia PROXITI",resources:"Ferramentas"};
  const isAdmin = () => state.profile?.role === "administrator" && state.profile?.status === "active";
  const can = name => isAdmin() || (state.profile?.status === "active" && state.profile?.permissions?.[name] === true);
  const elem = (tag,text="",className="") => {
    const result = document.createElement(tag);
    if (text !== "") result.textContent=String(text);
    if (className) result.className=className;
    return result;
  };
  const button = (text,fn,cls="") => {
    const result=elem("button",text,cls);
    result.type="button";
    result.addEventListener("click",async()=>{
      if (result.disabled)return;
      result.disabled=true;
      try {await fn();}catch(e){notice(e.message||"Não foi possível concluir a operação.",true);}
      finally {result.disabled=false;}
    });
    return result;
  };
  function notice(message,fail=false){
    const area=el("ops-message");area.hidden=!message;area.textContent=message;
    area.className="message"+(fail?" error":message?" success":"");
  }
  async function query(q){const result=await q;if(result.error)throw new Error(result.error.message);return result.data;}
  async function rpc(name,params){return query(state.db.rpc(name,params));}
  const shortDate = s=>s?new Date(s).toLocaleString("pt-BR",{dateStyle:"short",timeStyle:"short"}):"";
  const staffName = id=>state.staff.find(x=>x.id===id)?.display_name || (id?"Técnico designado":"Fila geral");
  function showView(view){
    state.currentView=view;
    for(const tab of el("ops-tabs").querySelectorAll("[data-ops-view]"))
      tab.classList.toggle("active",tab.dataset.opsView===view);
    for(const v of ["tickets","staff","content","training","tools"])el("ops-"+v).hidden=v!==view;
    notice("");
    if(view==="tickets")void loadTickets();
    if(view==="staff"&&isAdmin())void loadStaff();
    if(view==="content"&&isAdmin())void loadContent();
    if(view==="training"&&can("training"))void loadTraining();
    if(view==="tools"&&can("resources"))void loadTools();
  }
  function updateNav(){
    for(const node of document.querySelectorAll("#operations [data-admin-only]"))
      node.hidden=!isAdmin();
    const allowed = {tickets:can("tickets_view"),staff:isAdmin(),content:isAdmin(),
      training:can("training"),tools:can("resources")};
    for(const tab of el("ops-tabs").querySelectorAll("[data-ops-view]"))
      tab.hidden=!allowed[tab.dataset.opsView];
    const first=Object.keys(allowed).find(key=>allowed[key]);
    el("operations").hidden=!first;
    if(first)showView(allowed[state.currentView]?state.currentView:first);
  }
  async function loadStaff(){
    if(!isAdmin())return;
    try {
      state.staff=await query(state.db.from("profiles").select("id,display_name,role,status,permissions").order("created_at",{ascending:false}));
      const list=el("staff-list");list.replaceChildren();
      const technicians=state.staff.filter(p=>p.role==="technician");
      if(!technicians.length)list.append(elem("p","Nenhum técnico cadastrado. Convide um profissional pelo e-mail acima.","ops-muted"));
      for(const p of technicians){
        const item=elem("article","","ops-list-item");
        item.append(elem("strong",p.display_name),elem("p","Status: "+p.status+" · Permissões individuais"));
        const name=elem("input");name.type="text";name.value=p.display_name;name.maxLength=120;name.setAttribute("aria-label","Nome do técnico");
        const select=elem("select");
        for(const s of ["pending","active","suspended"]){
          const o=elem("option",{pending:"Pendente",active:"Ativo",suspended:"Suspenso"}[s]);o.value=s;
          o.selected=s===p.status;select.append(o);
        }
        const controls=elem("div","","ops-controls"),checks=elem("div");
        const flags={};
        for(const [key,label] of Object.entries(permNames)){
          const wrapper=elem("label","","ops-check"),box=elem("input");box.type="checkbox";
          box.checked=p.permissions?.[key]===true;flags[key]=box;
          wrapper.append(box,document.createTextNode(" "+label));checks.append(wrapper);
        }
        const save=button("Salvar permissões",async()=>{
          const permissions=Object.fromEntries(Object.entries(flags).map(([key,value])=>[key,value.checked]));
          await rpc("proxiti_admin_update_technician",{p_id:p.id,p_name:name.value.trim(),
            p_status:select.value,p_permissions:permissions});
          notice("Acesso do técnico atualizado.");await loadStaff();
        });
        const label=elem("label","Nome profissional");label.append(name);
        const statusLabel=elem("label"," Situação");statusLabel.append(select);
        controls.append(label,statusLabel,save);
        item.append(checks,controls);list.append(item);
      }
      el("ticket-assignee").replaceChildren();
      const none=elem("option","Fila geral");none.value="";el("ticket-assignee").append(none);
      for(const p of state.staff.filter(p=>p.status==="active")){
        const option=elem("option",p.display_name);option.value=p.id;el("ticket-assignee").append(option);
      }
      el("tool-assignee").replaceChildren();
      const available=elem("option","Disponível / não atribuído");available.value="";
      el("tool-assignee").append(available);
      for(const p of state.staff.filter(p=>p.role==="technician"&&p.status==="active")){
        const option=elem("option",p.display_name);option.value=p.id;el("tool-assignee").append(option);
      }
    }catch(e){notice("Erro ao consultar técnicos: "+e.message,true);}
  }
  async function loadTickets(){
    if(!can("tickets_view")||state.loading)return;
    state.loading=true;
    try {
      state.tickets=await query(state.db.from("support_tickets")
        .select("id,reference,customer_name,customer_email,customer_phone,subject,description,status,source,assigned_to,created_at")
        .order("created_at",{ascending:false}).limit(100));
      const waiting=state.tickets.filter(t=>t.status==="new"||t.status==="triage").length;
      el("ticket-badge").textContent=waiting?String(waiting):"";
      const body=el("tickets-body");body.replaceChildren();
      if(!state.tickets.length){
        const tr=elem("tr"),cell=elem("td","Nenhum chamado disponível.");cell.colSpan=6;tr.append(cell);body.append(tr);
      }
      for(const t of state.tickets){
        const tr=elem("tr");
        for(const value of ["#"+t.reference,t.customer_name,t.subject,statusNames[t.status]||t.status,staffName(t.assigned_to)]){
          tr.append(elem("td",value));
        }
        const td=elem("td");td.append(button("Abrir",()=>openTicket(t.id)));tr.append(td);body.append(tr);
      }
      if(state.active){
        const found=state.tickets.find(t=>t.id===state.active.id);
        if(found){state.active=found;updateTicketHeading();}
        else {state.active=null;el("ticket-detail").hidden=true;}
      }
    }catch(e){notice("Falha ao carregar chamados: "+e.message,true);}
    finally{state.loading=false;}
  }
  function updateTicketHeading(){
    const t=state.active;if(!t)return;
    el("ticket-detail").hidden=false;
    el("ticket-code").textContent="CHAMADO #"+t.reference+" · "+shortDate(t.created_at);
    el("ticket-subject").textContent=t.subject;
    el("ticket-customer").textContent=t.customer_name+" · "+t.customer_email+(t.customer_phone?" · "+t.customer_phone:"");
    el("ticket-description").textContent=t.description;
    el("ticket-status").value=t.status;
    el("ticket-assignee").value=t.assigned_to||"";
    const assigned=t.assigned_to===state.user.id,manage=isAdmin()||assigned;
    el("claim-ticket").hidden=!!t.assigned_to||!can("tickets_claim");
    el("ticket-status").disabled=!manage;
    el("save-status").hidden=!manage;
    el("staff-reply-form").hidden=!(manage&&can("chat"))||t.status==="closed";
  }
  async function loadMessages(){
    const t=state.active;
    if(!t||!can("chat"))return;
    try{
      const list=await query(state.db.from("support_messages")
        .select("id,sender_kind,body,created_at").eq("ticket_id",t.id)
        .order("created_at",{ascending:true}).limit(150));
      if(state.active?.id!==t.id)return;
      const box=el("staff-messages"),last=box.scrollHeight-box.scrollTop-box.clientHeight;
      box.replaceChildren();
      if(!list.length)box.append(elem("p","Ainda não há mensagens.","ops-muted"));
      for(const m of list){
        const bubble=elem("div","", "ops-bubble"+(m.sender_kind==="staff"?" own":""));
        bubble.append(elem("small",(m.sender_kind==="staff"?"Equipe PROXITI":"Cliente")+" · "+shortDate(m.created_at)),elem("div",m.body));
        box.append(bubble);
      }
      if(last<130)box.scrollTop=box.scrollHeight;
    }catch(e){notice("Falha ao consultar conversa: "+e.message,true);}
  }
  async function openTicket(id){
    const t=state.tickets.find(t=>t.id===id);if(!t)return;
    state.active=t;updateTicketHeading();
    if(can("chat"))await loadMessages();
    el("ticket-detail").scrollIntoView({behavior:"smooth",block:"start"});
  }
  async function loadContent(){
    if(!isAdmin())return;
    try{
      const data=await query(state.db.from("site_content").select("content_key,label,value,is_published").order("content_key"));
      const list=el("content-list");list.replaceChildren();
      if(!data.length)list.append(elem("p","Nenhuma personalização cadastrada."));
      for(const item of data){
        const entry=elem("article","","ops-list-item");
        entry.append(elem("strong",item.label+" · "+item.content_key),
          elem("p",item.value),elem("span",item.is_published?"Publicado":"Rascunho","ops-badge"));
        entry.append(button("Editar",()=>{
          el("content-key").value=item.content_key;el("content-label").value=item.label;
          el("content-value").value=item.value;el("content-published").checked=item.is_published;
          el("content-form").scrollIntoView({behavior:"smooth",block:"start"});
        }));
        list.append(entry);
      }
    }catch(e){notice("Falha ao carregar conteúdos: "+e.message,true);}
  }
  async function loadTraining(){
    if(!can("training"))return;
    try{
      const data=await query(state.db.from("training_materials")
        .select("id,title,description,storage_path,published,created_at")
        .order("created_at",{ascending:false}).limit(100));
      const list=el("training-list");list.replaceChildren();
      if(!data.length)list.append(elem("p","Ainda não há materiais disponíveis.","ops-muted"));
      for(const item of data){
        const entry=elem("article","","ops-list-item");
        entry.append(elem("strong",item.title),elem("p",item.description||"Sem descrição"),
          elem("span",item.published?"Disponível":"Rascunho","ops-badge"));
        const controls=elem("div","","ops-controls");
        if(item.storage_path){
          controls.append(button("Abrir arquivo privado",async()=>{
            const {data:link,error}=await state.db.storage.from("proxiti-training")
              .createSignedUrl(item.storage_path,90);
            if(error||!link?.signedUrl)throw new Error("Não foi possível autorizar o arquivo.");
            window.open(link.signedUrl,"_blank","noopener,noreferrer");
          }));
        }
        if(isAdmin())controls.append(button("Excluir material",async()=>{
          if(!window.confirm("Excluir este material e seu arquivo privado?"))return;
          if(item.storage_path)await query(state.db.storage.from("proxiti-training").remove([item.storage_path]));
          await query(state.db.from("training_materials").delete().eq("id",item.id));
          notice("Material excluído.");await loadTraining();
        }));
        entry.append(controls);list.append(entry);
      }
    }catch(e){notice("Falha ao carregar academia: "+e.message,true);}
  }
  async function loadTools(){
    if(!can("resources"))return;
    try{
      const data=await query(state.db.from("tool_inventory")
        .select("id,name,serial_label,notes,assigned_to,created_at")
        .order("created_at",{ascending:false}).limit(150));
      const list=el("tools-list");list.replaceChildren();
      if(!data.length)list.append(elem("p","Ainda não há ferramentas atribuídas.","ops-muted"));
      for(const item of data){
        const entry=elem("article","","ops-list-item");
        entry.append(elem("strong",item.name),
          elem("p","Patrimônio: "+(item.serial_label||"Não informado")+
            " · Responsável: "+staffName(item.assigned_to)+(item.notes?" · "+item.notes:"")));
        if(isAdmin()){
          entry.append(button("Editar",()=>{
            el("tool-name").value=item.name;el("tool-serial").value=item.serial_label||"";
            el("tool-notes").value=item.notes||"";
            el("tool-assignee").value=item.assigned_to||"";
            el("tool-form").dataset.edit=item.id;
            el("tool-form").querySelector("button[type=submit]").textContent="Salvar alterações";
            el("tool-form").scrollIntoView({behavior:"smooth",block:"start"});
          }));
          entry.append(document.createTextNode(" "));
          entry.append(button("Excluir",async()=>{
            if(!window.confirm("Excluir permanentemente este registro de ferramenta?"))return;
            await query(state.db.from("tool_inventory").delete().eq("id",item.id));
            notice("Ferramenta excluída.");await loadTools();
          }));
        }
        list.append(entry);
      }
    }catch(e){notice("Falha ao carregar ferramentas: "+e.message,true);}
  }
  function stop(){
    if(state.poll)clearInterval(state.poll);
    if(state.heartbeat)clearInterval(state.heartbeat);
    if(state.channel&&state.db)void state.db.removeChannel(state.channel);
    Object.assign(state,{db:null,user:null,profile:null,tickets:[],staff:[],active:null,channel:null,poll:null,heartbeat:null,loading:false});
    el("operations").hidden=true;el("ticket-detail").hidden=true;notice("");
  }
  async function start(e){
    const {client,user,profile}=e.detail;
    stop();state.db=client;state.user=user;state.profile=profile;
    if(isAdmin())await loadStaff();
    updateNav();
    if(!el("operations").hidden){
      if(can("chat")){
        const heartbeat=async()=>{if(!state.db||document.hidden)return;try{await rpc("proxiti_heartbeat",{});}catch{}};
        void heartbeat();state.heartbeat=setInterval(heartbeat,25000);
      }
      state.poll=setInterval(()=>{
        if(document.hidden||!state.db)return;
        if(can("tickets_view"))void loadTickets();
        if(state.active&&can("chat"))void loadMessages();
      },6000);
      if(can("tickets_view")){
        state.channel=state.db.channel("proxiti-workspace-"+user.id)
          .on("postgres_changes",{event:"*",schema:"public",table:"support_tickets"},()=>void loadTickets())
          .on("postgres_changes",{event:"INSERT",schema:"public",table:"support_messages"},payload=>{
            if(state.active?.id===payload.new?.ticket_id)void loadMessages();
          }).subscribe(status=>{
            el("ops-live").textContent=status==="SUBSCRIBED"?"Atualizações em tempo real":"Atualização automática ativa";
          });
      }else el("ops-live").textContent="Atualização automática ativa";
    }
  }
  document.addEventListener("proxiti-session-ready",e=>{void start(e);});
  document.addEventListener("proxiti-session-ended",stop);
  for(const tab of el("ops-tabs").querySelectorAll("[data-ops-view]"))
    tab.addEventListener("click",()=>showView(tab.dataset.opsView));
  el("reload-tickets").addEventListener("click",()=>void loadTickets());
  el("reload-staff").addEventListener("click",()=>void loadStaff());
  el("reload-content").addEventListener("click",()=>void loadContent());
  el("reload-training").addEventListener("click",()=>void loadTraining());
  el("reload-tools").addEventListener("click",()=>void loadTools());
  el("close-detail").addEventListener("click",()=>{state.active=null;el("ticket-detail").hidden=true;});
  el("claim-ticket").addEventListener("click",async()=>{
    if(!state.active)return;
    try{
      const ok=await rpc("proxiti_claim_ticket",{p_ticket:state.active.id});
      if(!ok)throw new Error("O chamado já foi assumido por outro profissional.");
      notice("Chamado assumido.");await loadTickets();await loadMessages();
    }catch(e){notice(e.message,true);}
  });
  el("save-status").addEventListener("click",async()=>{
    if(!state.active)return;
    try{
      await rpc("proxiti_change_ticket_status",{p_ticket:state.active.id,p_status:el("ticket-status").value});
      notice("Situação atualizada.");await loadTickets();
    }catch(e){notice(e.message,true);}
  });
  el("save-assignee").addEventListener("click",async()=>{
    if(!state.active||!isAdmin())return;
    try{
      await rpc("proxiti_admin_assign_ticket",{p_ticket:state.active.id,
        p_staff:el("ticket-assignee").value||null});
      notice("Responsável atualizado.");await loadTickets();
    }catch(e){notice(e.message,true);}
  });
  el("staff-reply-form").addEventListener("submit",async e=>{
    e.preventDefault();
    if(!state.active||!can("chat"))return;
    const field=el("staff-reply");const body=field.value.trim();
    if(!body)return;
    const send=e.currentTarget.querySelector("button[type=submit]");
    send.disabled=true;
    try{
      await rpc("proxiti_staff_reply",{p_ticket:state.active.id,p_body:body});
      field.value="";await loadMessages();notice("Mensagem enviada.");
    }catch(error){notice(error.message,true);}
    finally{send.disabled=false;}
  });
  el("invite-form").addEventListener("submit",async e=>{
    e.preventDefault();if(!isAdmin())return;
    const send=e.currentTarget.querySelector("button[type=submit]");send.disabled=true;
    try{
      const {data:{session}}=await state.db.auth.getSession();
      if(!session?.access_token)throw new Error("Sessão expirada. Entre novamente.");
      const config=window.PROXITI_PUBLIC_CONFIG;
      const resp=await fetch(config.url+"/functions/v1/proxiti-support",{
        method:"POST",headers:{"content-type":"application/json",
          apikey:config.publishableKey,Authorization:"Bearer "+session.access_token},
        body:JSON.stringify({action:"invite",email:el("invite-email").value.trim()})
      });
      const result=await resp.json();
      if(!resp.ok||!result.ok)throw new Error(result.error||"Não foi possível enviar o convite.");
      el("invite-email").value="";notice("Convite enviado. O técnico ficará pendente até a liberação.");
      await loadStaff();
    }catch(error){notice(error.message,true);}
    finally{send.disabled=false;}
  });
  el("content-form").addEventListener("submit",async e=>{
    e.preventDefault();if(!isAdmin())return;
    const key=el("content-key").value.trim(),label=el("content-label").value.trim(),
      value=el("content-value").value.trim();
    if(!/^[a-z0-9][a-z0-9._-]{2,100}$/.test(key)||label.length<2||!value){
      notice("Revise o identificador, nome e conteúdo.",true);return;
    }
    try{
      await query(state.db.from("site_content").upsert({content_key:key,label,value,
        is_published:el("content-published").checked,updated_at:new Date().toISOString()},
      {onConflict:"content_key"}));
      notice("Conteúdo salvo. A atualização aparece no site após atualizar a página.");
      await loadContent();
    }catch(error){notice(error.message,true);}
  });
  el("content-delete").addEventListener("click",async()=>{
    if(!isAdmin()||!el("content-key").value.trim())return;
    if(!window.confirm("Excluir a personalização? O site voltará ao texto original desse bloco."))return;
    try{
      await query(state.db.from("site_content").delete().eq("content_key",el("content-key").value.trim()));
      el("content-form").reset();notice("Personalização excluída.");await loadContent();
    }catch(error){notice(error.message,true);}
  });
  el("training-form").addEventListener("submit",async e=>{
    e.preventDefault();if(!isAdmin())return;
    const send=e.currentTarget.querySelector("button[type=submit]");send.disabled=true;
    let path=null;
    try{
      const file=el("training-file").files[0];
      if(file){
        const types={"application/pdf":".pdf","image/png":".png","image/jpeg":".jpg","image/webp":".webp"};
        if(!types[file.type]||file.size>10485760)throw new Error("Arquivo não aceito. Use PDF ou imagem de até 10 MB.");
        path=crypto.randomUUID()+types[file.type];
        await query(state.db.storage.from("proxiti-training").upload(path,file,
          {cacheControl:"3600",upsert:false,contentType:file.type}));
      }
      await query(state.db.from("training_materials").insert({
        title:el("training-title").value.trim(),description:el("training-description").value.trim(),
        storage_path:path,published:el("training-published").checked
      }));
      e.currentTarget.reset();notice("Material cadastrado.");await loadTraining();
    }catch(error){
      if(path)void state.db.storage.from("proxiti-training").remove([path]);
      notice(error.message,true);
    }finally{send.disabled=false;}
  });
  el("tool-form").addEventListener("submit",async e=>{
    e.preventDefault();if(!isAdmin())return;
    const form=e.currentTarget,save=form.querySelector("button[type=submit]");save.disabled=true;
    const data={name:el("tool-name").value.trim(),serial_label:el("tool-serial").value.trim()||null,
      assigned_to:el("tool-assignee").value||null,notes:el("tool-notes").value.trim()};
    try{
      if(form.dataset.edit)await query(state.db.from("tool_inventory").update(data).eq("id",form.dataset.edit));
      else await query(state.db.from("tool_inventory").insert(data));
      delete form.dataset.edit;form.reset();save.textContent="Cadastrar ferramenta";
      notice("Ferramenta salva.");await loadTools();
    }catch(error){notice(error.message,true);}
    finally{save.disabled=false;}
  });
})();
