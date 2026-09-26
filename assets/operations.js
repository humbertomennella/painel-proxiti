(() => {
  "use strict";
  const el = id => document.getElementById(id);
  const state = { db:null, user:null, profile:null, tickets:[], staff:[], active:null,
    channel:null, poll:null, heartbeat:null, currentView:"tickets", loading:false,accessGeneration:0,ticketsReady:false,ticketError:false,ticketLastUpdated:0,threadRevision:0,threadRows:new Map(),threadExpanded:false,threadHasMore:false,threadOlderBusy:false,ticketIds:null,messageIds:null,restoreTicketId:null,restoreScroll:null,messageCheckBusy:false,messageCheckPromise:null,messageReady:false,messagesCapped:false,readIssue:false,ticketFilter:"all",ticketSearch:"",messageRows:[],renderedTable:"",renderedThread:"",seenFallback:new Set(),readFallback:new Map(),readReceipts:new Map(),receiptsReady:false,readFetch:null,readSaving:new Set(),toastTimer:null };
  const statusNames = {new:"Aberto",triage:"Em triagem",in_progress:"Em atendimento",
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
  function ticketSync(phase){
    const output=el("ticket-sync-status"),retry=el("reload-tickets");
    output.dataset.phase=phase;
    retry.disabled=phase==="loading"||phase==="restricted";
    if(phase==="ready"){
      output.textContent="Fila consultada às "+new Date(state.ticketLastUpdated).toLocaleTimeString("pt-BR",
        {hour:"2-digit",minute:"2-digit"})+" · "+state.tickets.length+
        (state.tickets.length===1?" chamado acessível":" chamados acessíveis")+
        (state.tickets.length===100?" (limite da consulta: 100).":".");
    }else if(phase==="loading")
      output.textContent=state.ticketsReady?
        "Atualizando a fila. Os registros anteriores continuam visíveis.":"Consultando a fila autorizada…";
    else if(phase==="error")
      output.textContent=state.ticketsReady?
        "Falha na atualização. Os registros visíveis são da última consulta; tente Atualizar.":
        "Não foi possível carregar a fila. Use Atualizar para tentar novamente.";
    else output.textContent="A consulta à fila não está autorizada para esta conta.";
  }
  function threadSync(phase,count=0){
    const output=el("ticket-thread-status"),retry=el("ticket-thread-retry");
    output.dataset.phase=phase;
    retry.disabled=phase==="loading"||phase==="restricted";
    if(phase==="ready")output.textContent=count?"Conversa atualizada.":"Ainda não há mensagens neste chamado.";
    else if(phase==="partial")output.textContent="Exibindo as "+count+" mensagens mais recentes. Use Carregar mensagens anteriores para consultar o restante.";
    else if(phase==="loading")output.textContent="Consultando as mensagens autorizadas…";
    else if(phase==="error")output.textContent="Não foi possível atualizar a conversa. Tente novamente.";
    else if(phase==="read-error")output.textContent="Conversa carregada, mas não foi possível confirmar a leitura. Tente Atualizar conversa.";
    else if(phase==="history-error")output.textContent="Não foi possível carregar mensagens anteriores. Tente novamente.";
    else output.textContent="Abra um chamado com acesso à conversa para visualizar mensagens.";
  }
  function notice(message,fail=false){
    const area=el("ops-message");area.hidden=!message;area.textContent=message;
    area.className="message"+(fail?" error":message?" success":"");
  }
  async function query(q){const result=await q;if(result.error)throw new Error(result.error.message);return result.data;}
  async function rpc(name,params){return query(state.db.rpc(name,params));}
  const shortDate = s=>s?new Date(s).toLocaleString("pt-BR",{dateStyle:"short",timeStyle:"short"}):"";
  const staffName = id=>state.staff.find(x=>x.id===id)?.display_name || (id?"Técnico designado":"Fila geral");
  const prefKey=key=>"proxiti-work-v3-"+(state.user?.id||"guest")+"-"+key;
  const remember=(key,value)=>{try{sessionStorage.setItem(prefKey(key),String(value));}catch{}};
  const recalled=key=>{try{return sessionStorage.getItem(prefKey(key))}catch{return null}};
  const sound=kind=>window.PROXITI_ALERTS?.play(kind);
  let presenceCheckedAt=0;
  async function updatePresence(){
    if(!state.db||Date.now()-presenceCheckedAt<20000)return;
    const db=state.db,uid=state.user?.id,generation=state.accessGeneration;
    presenceCheckedAt=Date.now();
    try{
      const rows=await query(db.from("staff_presence").select("staff_id")
        .gte("last_seen",new Date(Date.now()-60000).toISOString()).limit(50));
      if(state.db!==db||state.user?.id!==uid||state.accessGeneration!==generation)return;
      el("overview-online").textContent=isAdmin()
        ?(rows.length===1?"1 profissional online":rows.length+" profissionais online")
        :(rows.length?"Você está online":"Disponibilidade em atualização");
    }catch{if(state.db===db&&state.user?.id===uid&&state.accessGeneration===generation)
      el("overview-online").textContent="Presença em atualização";}
  }

  // Leituras persistidas no Supabase; armazenamento local serve só antes da primeira sincronização.
  const isOpen=t=>!["resolved","closed"].includes(t.status);
  const seenKey=id=>"proxiti-inbox-seen-v1-"+state.user?.id+"-"+id;
  const readKey=id=>"proxiti-inbox-read-v1-"+state.user?.id+"-"+id;
  async function loadReadReceipts(){
    if(!state.db||!state.user)return;
    if(state.readFetch)return state.readFetch;
    const db=state.db,uid=state.user.id,generation=state.accessGeneration,ids=state.tickets.map(t=>t.id);
    if(!ids.length){
      state.readReceipts=new Map();state.receiptsReady=true;state.readIssue=false;return;
    }
    state.readFetch=(async()=>{
      try{
        const rows=await query(db.from("ticket_read_receipts")
          .select("ticket_id,first_seen_at,last_read_customer_at")
          .eq("staff_id",uid).in("ticket_id",ids).limit(100));
        if(state.db!==db||state.user?.id!==uid||state.accessGeneration!==generation)return;
        state.readReceipts=new Map(rows.map(row=>[row.ticket_id,row]));
        state.receiptsReady=true;state.readIssue=false;
      }catch{
        if(state.db!==db||state.user?.id!==uid||state.accessGeneration!==generation)return;
        state.readIssue=true;
        el("ops-live").textContent="Leitura entre dispositivos temporariamente indisponível";
      }finally{
        if(state.db===db&&state.user?.id===uid&&state.accessGeneration===generation)state.readFetch=null;
      }
    })();
    return state.readFetch;
  }
  function seenTicket(id){
    if(state.seenFallback.has(id))return true;
    if(state.receiptsReady)return state.readReceipts.has(id);
    try{return localStorage.getItem(seenKey(id))==="1"}catch{return false}
  }
  function markTicketSeen(id){
    state.seenFallback.add(id);
    try{localStorage.setItem(seenKey(id),"1")}catch{}
  }
  function lastRead(id){
    if(state.readFallback.has(id))return state.readFallback.get(id);
    if(state.receiptsReady){
      const date=state.readReceipts.get(id)?.last_read_customer_at;
      return date?Date.parse(date)||0:0;
    }
    try{return Number(localStorage.getItem(readKey(id))||0)||0}catch{return 0}
  }
  function unreadMessages(id){
    if(!can("chat")||!state.messageReady)return 0;
    const timestamp=lastRead(id);
    return state.messageRows.filter(m=>m.ticket_id===id&&Date.parse(m.created_at)>timestamp).length;
  }
  const hasAttention=t=>window.PROXITI_OVERVIEW_MODEL.attention(t,seenTicket,unreadMessages,can("chat"),state.messageReady);
  const overviewComplete=()=>!state.readIssue&&(!can("chat")||(state.messageReady&&!state.messagesCapped));
  const overviewStatus=phase=>{
    const detail={phase,at:Date.now()};
    window.PROXITI_OVERVIEW_STATUS={userId:state.user?.id, ...detail};
    document.dispatchEvent(new CustomEvent("proxiti-overview-status",{detail}));
  };
  async function markMessagesSeen(id,list){
    if(document.hidden||el("operations").hidden||state.currentView!=="tickets"||
       el("ticket-detail").hidden||state.active?.id!==id||state.readSaving.has(id))return;
    const db=state.db,uid=state.user?.id,generation=state.accessGeneration;
    const valid=()=>state.db===db&&state.user?.id===uid&&
      state.accessGeneration===generation&&state.active?.id===id&&can("tickets_view");
    const latest=Math.max(0,...list.filter(m=>m.sender_kind==="customer")
      .map(m=>Date.parse(m.created_at)||0));
    if(state.receiptsReady&&state.readReceipts.has(id)&&latest<=lastRead(id))return;
    state.readSaving.add(id);
    try{
      await query(db.rpc("proxiti_mark_ticket_read",{p_ticket:id}));
      if(!valid())return;
      if(state.receiptsReady){
        state.readReceipts.set(id,{ticket_id:id,first_seen_at:new Date().toISOString(),
          last_read_customer_at:latest?new Date(latest).toISOString():null});
      }else state.readFallback.set(id,latest);
      markTicketSeen(id);updateInbox();renderTickets();
    }catch{
      if(!valid())return;
      state.readIssue=true;threadSync("read-error");
      updateInbox();renderTickets();
      overviewStatus("partial");
    }finally{state.readSaving.delete(id);}
  }

  function toast(message){
    const node=el("alert-toast");node.textContent=message;node.hidden=false;
    if(state.toastTimer)clearTimeout(state.toastTimer);
    state.toastTimer=setTimeout(()=>{node.hidden=true;state.toastTimer=null;},6500);
  }
  function browserNotice(kind,ticketId){
    if(!document.hidden||!("Notification" in window)||Notification.permission!=="granted")return;
    try{
      const n=new Notification("Central Técnica PROXITI",{
        body:kind==="ticket"?"Um novo chamado chegou à Central.":"Você recebeu uma mensagem de cliente.",
        tag:"proxiti-"+kind+"-"+ticketId,icon:new URL("./assets/favicon.svg",location.href).href
      });
      n.onclick=()=>{
        window.focus();n.close();
        window.PROXITI_OPEN_VIEW?.("tickets");
        if(ticketId)void openTicket(ticketId);
      };
    }catch{/* Notificações também podem ser bloqueadas pelo sistema operacional. */}
  }
  function browserPermissionLabel(){
    const control=el("browser-notifications"),hint=el("browser-notification-hint");
    if(!("Notification" in window)){
      control.disabled=true;control.textContent="Não disponível";hint.textContent="Este navegador não oferece notificações.";
    }else if(Notification.permission==="granted"){
      control.disabled=true;control.textContent="Notificações autorizadas";hint.textContent="Avisos aparecem enquanto a Central estiver aberta, mesmo em segundo plano.";
    }else if(Notification.permission==="denied"){
      control.disabled=true;control.textContent="Bloqueado pelo navegador";hint.textContent="Libere a permissão nas configurações do site.";
    }else{
      control.disabled=false;control.textContent="Ativar notificações do navegador";hint.textContent="Ative para receber avisos ao trabalhar em outra aba.";
    }
  }
  async function loadAudit(ticketId){
    if(!state.db||!ticketId||!can("tickets_view"))return;
    const db=state.db,uid=state.user?.id,generation=state.accessGeneration;
    const valid=()=>state.db===db&&state.user?.id===uid&&
      state.accessGeneration===generation&&state.active?.id===ticketId&&can("tickets_view");
    const list=el("ticket-audit-list");list.replaceChildren(elem("li","Consultando histórico…"));
    try{
      const events=await query(db.from("ticket_audit")
        .select("id,action,actor_id,previous_value,next_value,created_at")
        .eq("ticket_id",ticketId).order("created_at",{ascending:false}).limit(35));
      if(!valid())return;
      list.replaceChildren();
      if(!events.length)list.append(elem("li","Nenhuma movimentação registrada desde a ativação do histórico."));
      const names={created:"Solicitação registrada",claimed:"Atendimento assumido",assigned:"Responsável designado",
        unassigned:"Retornado à fila",status_changed:"Situação alterada",staff_replied:"Equipe respondeu",
        customer_replied:"Cliente enviou mensagem",note_added:"Nota técnica registrada",
        checklist_created:"Roteiro técnico criado",checklist_updated:"Etapa técnica atualizada",
        attachment_added:"Anexo privado incluído",appointment_created:"Compromisso planejado",appointment_updated:"Agenda atualizada",appointment_rescheduled:"Horário reagendado",device_updated:"Equipamento identificado",report_saved:"Relatório registrado"};
      for(const event of events){
        const item=elem("li");
        const actor=event.actor_id?staffName(event.actor_id):"Sistema / cliente";
        item.append(elem("strong",names[event.action]||"Movimentação"),elem("small",
          shortDate(event.created_at)+" · "+actor+
          (event.action==="status_changed"?" · "+(statusNames[event.previous_value]||event.previous_value||"")+
            " → "+(statusNames[event.next_value]||event.next_value||""):"")));
        list.append(item);
      }
    }catch{if(valid())list.replaceChildren(elem("li","O histórico está temporariamente indisponível."))}
  }

  function statusPill(value){
    const pill=elem("span","","ticket-status-pill status-"+value);
    const dot=elem("span","","ticket-status-dot");dot.setAttribute("aria-hidden","true");
    pill.append(dot,document.createTextNode(statusNames[value]||value));
    return pill;
  }
  function updateInbox(){
    if(!state.user)return;
    const pending=[];
    for(const t of state.tickets){
      if(t.status==="closed")continue;
      const fresh=["new","triage"].includes(t.status)&&!seenTicket(t.id);
      const unread=unreadMessages(t.id);
      if(!fresh&&!unread)continue;
      const latest=unread?state.messageRows.find(m=>m.ticket_id===t.id):null;
      pending.push({id:t.id,time:Date.parse(latest?.created_at||t.created_at)||0,
        label:unread?(unread+" "+(unread===1?"mensagem não lida":"mensagens não lidas")+" · #"+t.reference):
          "Chamado #"+t.reference+" ainda não visualizado",
        detail:fresh&&unread?"Novo chamado com resposta do cliente":unread?
          "Resposta do cliente pendente":t.subject,kind:unread?"message":"ticket"});
    }
    pending.sort((a,b)=>b.time-a.time);
    // Um chamado com novidade e mensagem continua sendo uma única pendência.
    const count=pending.length,partial=!overviewComplete();
    for(const id of ["notifications-count","ticket-badge"]){
      const node=el(id);node.textContent=partial?"?":count>99?"99+":String(count);
      node.hidden=!partial&&!count;node.title=partial?"Contagem de pendências incompleta":"";
    }
    const area=el("notifications-list");area.replaceChildren();
    if(!pending.length)area.append(elem("p",partial?
      "Conferência incompleta. Atualize a fila para verificar as pendências.":state.ticketsReady?
      "Nenhum chamado com novidade para revisar.":"Carregando notificações…","notifications-empty"));
    for(const item of pending.slice(0,12)){
      const entry=button(item.label,async()=>{
        el("notifications-panel").hidden=true;
        el("notifications-toggle").setAttribute("aria-expanded","false");
        window.PROXITI_OPEN_VIEW?.("tickets");
        await openTicket(item.id);
      },"notification-item");
      entry.append(elem("span",item.kind==="message"?"Mensagem":"Chamado","notification-kind "+item.kind),
        elem("strong",item.label),elem("small",item.detail));
      area.append(entry);
    }
    el("notifications-toggle").setAttribute("aria-label",partial?
      "Contagem de pendências incompleta, abrir notificações":
      count?count+" chamados com pendência, abrir notificações":"Abrir notificações");
    if(state.ticketsReady)publishOverview();
  }
  function publishOverview(){
    if(!state.user||!state.ticketsReady||!can("tickets_view"))return;
    const summary=window.PROXITI_OVERVIEW_MODEL.summarize(state.tickets,{
      seen:seenTicket,unread:unreadMessages,canReadMessages:can("chat"),
      messagesReady:state.messageReady,readIssue:state.readIssue||state.messagesCapped,
      activeId:state.active?.id,at:Date.now(),sampleLimit:100
    });
    window.PROXITI_OVERVIEW_SNAPSHOT={userId:state.user.id,detail:summary};
    document.dispatchEvent(new CustomEvent("proxiti-overview-updated",{detail:summary}));
  }

  function updateMetrics(){
    const count=condition=>state.tickets.filter(condition).length;
    el("ticket-metric-open").textContent=String(count(t=>["new","triage"].includes(t.status)));
    el("ticket-metric-progress").textContent=String(count(t=>t.status==="in_progress"));
    el("ticket-metric-waiting").textContent=String(count(t=>t.status==="waiting_customer"));
    el("ticket-metric-resolved").textContent=String(count(t=>t.status==="resolved"));
    el("ticket-metric-closed").textContent=String(count(t=>t.status==="closed"));
    el("ticket-filter-all-count").textContent=String(state.tickets.length);
    el("ticket-filter-unread-count").textContent=String(state.tickets.filter(hasAttention).length);
    for(const node of document.querySelectorAll("[data-ticket-filter]")){
      const active=node.dataset.ticketFilter===state.ticketFilter;
      node.classList.toggle("active",active);node.setAttribute("aria-pressed",String(active));
    }
  }
  function renderTickets(){
    if(!state.user)return;
    updateMetrics();
    const filter=state.ticketFilter,search=state.ticketSearch.trim().toLocaleLowerCase("pt-BR");
    const rows=state.tickets.filter(t=>{
      const unread=hasAttention(t);
      if(filter==="unread"&&!unread)return false;
      if(filter==="open"&&!["new","triage"].includes(t.status))return false;
      if(!["all","unread","open"].includes(filter)&&t.status!==filter)return false;
      if(search&&!String(t.reference).includes(search)&&
        !t.customer_name.toLocaleLowerCase("pt-BR").includes(search)&&
        !t.subject.toLocaleLowerCase("pt-BR").includes(search))return false;
      return true;
    });
    const signature=JSON.stringify([filter,search,rows.map(t=>[
      t.id,t.status,t.assigned_to,t.customer_name,t.subject,seenTicket(t.id),unreadMessages(t.id),state.active?.id
    ])]);
    if(signature===state.renderedTable)return;
    state.renderedTable=signature;
    const list=el("ticket-list");list.replaceChildren();
    if(!rows.length)list.append(elem("p",state.tickets.length?
      "Nenhum chamado corresponde aos filtros.":"A fila está vazia. Novos chamados aparecerão aqui.","ticket-list-empty"));
    for(const t of rows){
      const unread=unreadMessages(t.id),fresh=t.status!=="closed"&&!seenTicket(t.id)&&["new","triage"].includes(t.status);
      const item=elem("div","","ticket-inbox-item");item.setAttribute("role","listitem");
      const card=button("Abrir chamado #"+t.reference,()=>openTicket(t.id),
        "ticket-inbox-card"+(unread||fresh?" has-unread":"")+(state.active?.id===t.id?" selected":""));
      card.setAttribute("aria-label","Chamado "+t.reference+", "+t.subject+", "+statusNames[t.status]);
      if(state.active?.id===t.id)card.setAttribute("aria-current","true");
      const top=elem("span","","ticket-inbox-top");
      top.append(elem("strong","#"+t.reference+" · "+t.customer_name),elem("small",shortDate(t.created_at)));
      const subject=elem("span",t.subject,"ticket-inbox-subject");
      const foot=elem("span","","ticket-inbox-foot");
      foot.append(statusPill(t.status),elem("small",staffName(t.assigned_to)));
      if(unread||fresh)foot.append(elem("span",unread?unread+" não lida"+(unread===1?"":"s"):"Novo","ticket-inbox-unread"));
      card.replaceChildren(top,subject,foot);item.append(card);list.append(item);
    }
    el("ticket-table-result").textContent=rows.length+" de "+state.tickets.length;
  }
  async function checkNewMessages(){
    if(!state.db||!can("chat")||!can("tickets_view"))return;
    if(state.messageCheckPromise)return state.messageCheckPromise;
    const db=state.db,uid=state.user.id,generation=state.accessGeneration;
    state.messageCheckBusy=true;
    const stillAuthorized=()=>state.db===db&&state.user?.id===uid&&
      state.accessGeneration===generation&&can("tickets_view")&&can("chat");
    const work=(async()=>{
      try{
        const fetched=await query(db.from("support_messages")
          .select("id,ticket_id,sender_kind,created_at")
          .eq("sender_kind","customer").order("created_at",{ascending:false}).limit(251));
        if(!stillAuthorized())return;
        const rows=fetched.slice(0,250),ids=new Set(rows.map(m=>m.id));
        const changed=state.messageIds?rows.filter(m=>!state.messageIds.has(m.id)):[];
        state.messageRows=rows;state.messageIds=ids;
        state.messagesCapped=fetched.length>250;state.messageReady=true;
        if(changed.length){
          sound("message");
          toast(changed.length===1?"Nova mensagem de cliente recebida.":changed.length+" novas mensagens de clientes.");
          browserNotice("message",changed[0]?.ticket_id);
        }
        updateInbox();renderTickets();
        if(state.ticketsReady&&!state.ticketError)overviewStatus(overviewComplete()?"ready":"partial");
      }catch{
        if(!stillAuthorized())return;
        state.messageReady=false;state.messagesCapped=false;
        if(state.ticketsReady){
          updateInbox();renderTickets();
          if(!state.ticketError)overviewStatus("partial");
        }
      }finally{
        if(stillAuthorized()){
          state.messageCheckBusy=false;state.messageCheckPromise=null;
        }
      }
    })();
    state.messageCheckPromise=work;
    return work;
  }
  function showView(view){
    state.currentView=view;
    const names={tickets:["Chamados","Prioridades, responsáveis e histórico dos atendimentos."],
      staff:["Equipe e permissões","Convites, aprovações e acesso individual."],
      content:["Conteúdo do site","Textos publicados e personalizações autorizadas."],
      training:["Academia PROXITI","Materiais técnicos e capacitação privada."],
      agenda:["Agenda","Retornos, visitas e horários planejados por chamado."],
      tools:["Ferramentas","Inventário e equipamentos atribuídos."]};
    el("ops-heading").textContent=names[view]?.[0]||"Operação";
    el("ops-description").textContent=names[view]?.[1]||"";
    if(state.user)remember("view",view);
    for(const tab of el("ops-tabs").querySelectorAll("[data-ops-view]"))
      tab.classList.toggle("active",tab.dataset.opsView===view);
    for(const v of ["tickets","staff","content","agenda","training","tools"])el("ops-"+v).hidden=v!==view;
    notice("");
    if(view==="tickets")void loadTickets();
    if(view==="staff"&&isAdmin())void loadStaff();
    if(view==="content"&&isAdmin())void loadContent();
    if(view==="training"&&can("training"))void loadTraining();
    if(view==="agenda"&&can("tickets_view"))document.dispatchEvent(new Event("proxiti-agenda-refresh"));
    if(view==="tools"&&can("resources"))void loadTools();
    document.dispatchEvent(new CustomEvent("proxiti-view-changed",{detail:{view}}));
  }
  function updateNav(){
    for(const node of document.querySelectorAll("#operations [data-admin-only]"))
      node.hidden=!isAdmin();
    const allowed = {tickets:can("tickets_view"),agenda:can("tickets_view"),staff:isAdmin(),content:isAdmin(),
      training:can("training"),tools:can("resources")};
    for(const tab of el("ops-tabs").querySelectorAll("[data-ops-view]"))
      tab.hidden=!allowed[tab.dataset.opsView];
    el("notifications-toggle").hidden=!can("tickets_view");
    if(!allowed.tickets){
      // Revogação deve limpar dados da conta anterior inclusive em memória de interface.
      state.accessGeneration++;state.loading=false;state.messageCheckBusy=false;
      state.messageCheckPromise=null;state.readFetch=null;
      state.tickets=[];state.ticketsReady=false;state.ticketError=false;state.active=null;
      state.ticketIds=null;state.messageRows=[];state.messageIds=null;
      state.messageReady=false;state.messagesCapped=false;state.readIssue=false;
      state.readReceipts.clear();state.receiptsReady=false;state.renderedTable="";
      window.PROXITI_OVERVIEW_SNAPSHOT=null;window.PROXITI_OVERVIEW_STATUS=null;
      el("ticket-list").replaceChildren();el("ticket-detail").hidden=true;
      el("ticket-empty-state").hidden=false;
      clearTicketPresentation();ticketSync("restricted");announceTicket();
      for(const id of ["ticket-badge","notifications-count"]){
        const badge=el(id);badge.textContent="";badge.hidden=true;
      }
      el("notifications-list").replaceChildren();
      el("notifications-toggle").setAttribute("aria-label","Notificações indisponíveis para esta conta");
    }
    const first=Object.keys(allowed).find(key=>allowed[key]);
    el("operations").hidden=!first;
    if(first)showView(allowed[state.currentView]?state.currentView:first);
    // A Visão Geral deve sincronizar mesmo se a última aba foi Academia ou Ferramentas.
    if(allowed.tickets){
      if(!state.ticketsReady)void loadTickets();
      else if(can("chat")&&!state.messageReady)void checkNewMessages();
    }
    document.dispatchEvent(new CustomEvent("proxiti-navigation-updated",{detail:{allowed}}));
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
  function clearTicketPresentation(){
    for(const id of ["ticket-code","ticket-subject","ticket-customer",
      "ticket-description","ticket-audit-list","ticket-current-status"])
      el(id).replaceChildren();
    state.threadRevision++;state.threadRows.clear();state.threadExpanded=false;
    state.threadHasMore=false;state.threadOlderBusy=false;
    el("staff-messages").replaceChildren();el("staff-reply").value="";
    el("ticket-thread-older").hidden=true;el("ticket-thread-older").disabled=false;
    el("ticket-search").value="";
    threadSync("restricted");
  }
  function announceTicket(){
    window.PROXITI_ACTIVE_TICKET=state.active;
    document.dispatchEvent(new CustomEvent("proxiti-ticket-selected",{detail:{ticket:state.active}}));
  }
  async function loadTickets(){
    if(!state.db||!state.user||!can("tickets_view")||state.loading)return;
    const db=state.db,uid=state.user.id,generation=state.accessGeneration;
    const same=()=>state.db===db&&state.user?.id===uid&&
      state.accessGeneration===generation&&can("tickets_view");
    state.loading=true;
    ticketSync("loading");
    if(!state.ticketsReady)overviewStatus("loading");
    try{
      const tickets=await query(db.from("support_tickets")
        .select("id,reference,customer_name,customer_email,customer_phone,subject,description,status,source,assigned_to,created_at")
        .order("created_at",{ascending:false}).limit(100));
      if(!same())return;
      state.tickets=tickets;
      await loadReadReceipts();
      if(!same())return;
      if(can("chat")&&!state.messageReady)await checkNewMessages();
      if(!same())return;
      const ids=new Set(state.tickets.map(t=>t.id));
      const newArrivals=state.ticketIds?state.tickets.filter(t=>!state.ticketIds.has(t.id)):[];
      state.ticketIds=ids;
      if(newArrivals.length){
        sound("ticket");
        toast(newArrivals.length===1?"Novo chamado recebido na Central Técnica.":newArrivals.length+" novos chamados recebidos.");
        browserNotice("ticket",newArrivals[0]?.id);
      }
      const active=state.tickets.filter(isOpen).length;
      el("overview-open").textContent=active===1?"1 chamado ativo":active+" chamados ativos";
      void updatePresence();
      if(state.restoreTicketId&&!state.active){
        const recovered=state.tickets.find(t=>t.id===state.restoreTicketId);
        if(recovered){state.active=recovered;updateTicketHeading();announceTicket();void loadMessages();el("staff-reply").value=recalled("draft-"+recovered.id)||"";}
        state.restoreTicketId=null;
      }
      if(state.active){
        const found=state.tickets.find(t=>t.id===state.active.id);
        if(found){const changed=state.active.status!==found.status||state.active.assigned_to!==found.assigned_to;state.active=found;updateTicketHeading();if(changed)announceTicket();}
        else{state.active=null;clearTicketPresentation();announceTicket();remember("ticket","");
          el("ticket-detail").hidden=true;el("ticket-empty-state").hidden=false;}
      }
      if(state.ticketError)notice("");
      state.ticketsReady=true;state.ticketError=false;state.ticketLastUpdated=Date.now();
      ticketSync("ready");updateInbox();renderTickets();
      overviewStatus(overviewComplete()?"ready":"partial");
      if(state.restoreScroll!==null){
        const y=state.restoreScroll;state.restoreScroll=null;
        requestAnimationFrame(()=>window.scrollTo({top:y,behavior:"instant"}));
      }
    }catch{
      if(same()){
        state.ticketError=true;ticketSync("error");
        if(!state.ticketsReady)el("ticket-list").replaceChildren(elem("p",
          "A fila está temporariamente indisponível. Use Atualizar para tentar novamente.",
          "ticket-list-empty"));
        notice("Não foi possível atualizar os chamados. Você pode tentar novamente.",true);
        overviewStatus("error");
      }
    }finally{if(same())state.loading=false;}
  }
  function updateTicketHeading(){
    const t=state.active;if(!t)return;
    el("ticket-detail").hidden=false;el("ticket-empty-state").hidden=true;
    el("ticket-detail").dataset.status=t.status;
    el("ticket-code").textContent="CHAMADO #"+t.reference+" · "+shortDate(t.created_at);
    el("ticket-subject").textContent=t.subject;
    el("ticket-current-status").replaceChildren(statusPill(t.status));
    el("ticket-customer").textContent=t.customer_name+" · "+t.customer_email+
      (t.customer_phone?" · "+t.customer_phone:"");
    el("ticket-description").textContent=t.description;
    el("ticket-status").value=t.status;
    el("ticket-assignee").value=t.assigned_to||"";
    const closed=t.status==="closed",assigned=t.assigned_to===state.user.id;
    const manage=!closed&&(isAdmin()||assigned);
    el("claim-ticket").hidden=!!t.assigned_to||!can("tickets_claim")||
      ["closed","resolved"].includes(t.status);
    el("ticket-status").disabled=!manage;
    el("save-status").hidden=!manage;
    el("assign-group").hidden=!isAdmin()||closed;
    el("save-assignee").hidden=!isAdmin()||closed;
    el("staff-reply-form").hidden=!(manage&&can("chat"));
    el("ticket-conversation").hidden=!can("chat");
    el("ticket-thread-retry").hidden=!can("chat");
    el("ticket-status-help").textContent=closed?
      "Histórico encerrado: não é possível alterar situação, responsável ou resposta. Abra um novo atendimento quando necessário.":
      t.status==="resolved"?
      "Resolvido: revise o resultado antes do encerramento. A ação de encerrar é definitiva.":
      "As mudanças de situação ficam registradas no histórico do chamado.";
  }
  function renderThread(ticketId,prepend=false){
    if(state.active?.id!==ticketId)return;
    const rows=[...state.threadRows.values()].sort((a,b)=>
      (Date.parse(a.created_at)||0)-(Date.parse(b.created_at)||0)||
      String(a.id).localeCompare(String(b.id)));
    const box=el("staff-messages"),previousHeight=box.scrollHeight,previousTop=box.scrollTop;
    const nearBottom=previousHeight-previousTop-box.clientHeight<130;
    const signature=JSON.stringify([ticketId,state.threadHasMore,rows.map(item=>item.id)]);
    el("ticket-thread-older").hidden=!state.threadHasMore;
    el("ticket-thread-older").disabled=state.threadOlderBusy;
    threadSync(state.threadHasMore?"partial":"ready",rows.length);
    if(signature===state.renderedThread)return;
    box.replaceChildren();
    if(!rows.length)box.append(elem("p","Ainda não há mensagens.","ops-muted"));
    for(const message of rows){
      const bubble=elem("div","","ops-bubble"+(message.sender_kind==="staff"?" own":""));
      bubble.append(elem("small",(message.sender_kind==="staff"?"Equipe PROXITI":"Cliente")+
        " · "+shortDate(message.created_at)),elem("div",message.body));
      box.append(bubble);
    }
    if(prepend)box.scrollTop=previousTop+Math.max(0,box.scrollHeight-previousHeight);
    else if(nearBottom)box.scrollTop=box.scrollHeight;
    state.renderedThread=signature;
  }
  async function loadMessages(){
    if(state.threadOlderBusy)return;
    const ticket=state.active,db=state.db,uid=state.user?.id,generation=state.accessGeneration;
    const revision=++state.threadRevision;
    if(!ticket||!db||!can("chat")||!can("tickets_view"))return;
    const valid=()=>state.db===db&&state.user?.id===uid&&state.accessGeneration===generation&&
      state.threadRevision===revision&&state.active?.id===ticket.id&&can("chat")&&can("tickets_view");
    if(!state.threadRows.size)threadSync("loading");
    try{
      // Ordenação secundária evita perder ou repetir mensagens com o mesmo horário.
      const fetched=await query(db.from("support_messages")
        .select("id,sender_kind,body,created_at").eq("ticket_id",ticket.id)
        .order("created_at",{ascending:false}).order("id",{ascending:false}).limit(151));
      if(!valid())return;
      const latest=fetched.slice(0,150);
      if(!state.threadExpanded)state.threadRows=new Map(latest.map(item=>[item.id,item]));
      else for(const item of latest)state.threadRows.set(item.id,item);
      if(!state.threadExpanded)state.threadHasMore=fetched.length>150;
      renderThread(ticket.id);
      await markMessagesSeen(ticket.id,latest);
    }catch(error){
      if(!valid())return;
      threadSync("error");
      notice("Falha ao consultar conversa: "+error.message,true);
    }
  }
  async function loadEarlierMessages(){
    const ticket=state.active,db=state.db,uid=state.user?.id,generation=state.accessGeneration;
    const revision=state.threadRevision;
    if(!ticket||!db||!can("chat")||!state.threadHasMore||state.threadOlderBusy)return;
    const valid=()=>state.db===db&&state.user?.id===uid&&state.accessGeneration===generation&&
      state.threadRevision===revision&&state.active?.id===ticket.id&&can("chat")&&can("tickets_view");
    const oldest=[...state.threadRows.values()].sort((a,b)=>
      (Date.parse(a.created_at)||0)-(Date.parse(b.created_at)||0)||
      String(a.id).localeCompare(String(b.id)))[0];
    if(!oldest)return;
    state.threadOlderBusy=true;
    const button=el("ticket-thread-older");button.disabled=true;
    try{
      const ties=await query(db.from("support_messages")
        .select("id,sender_kind,body,created_at").eq("ticket_id",ticket.id)
        .eq("created_at",oldest.created_at).lt("id",oldest.id)
        .order("id",{ascending:false}).limit(151));
      if(!valid())return;
      let fetched=ties;
      if(ties.length<151){
        const earlier=await query(db.from("support_messages")
          .select("id,sender_kind,body,created_at").eq("ticket_id",ticket.id)
          .lt("created_at",oldest.created_at)
          .order("created_at",{ascending:false}).order("id",{ascending:false})
          .limit(151-ties.length));
        if(!valid())return;
        fetched=ties.concat(earlier);
      }
      for(const item of fetched.slice(0,150))state.threadRows.set(item.id,item);
      state.threadExpanded=true;state.threadHasMore=fetched.length>150;
      renderThread(ticket.id,true);
    }catch{
      if(valid())threadSync("history-error");
    }finally{
      if(valid()){state.threadOlderBusy=false;button.disabled=false;}
    }
  }
  async function openTicket(id){
    if(!can("tickets_view"))return;
    const ticket=state.tickets.find(item=>item.id===id);
    if(!ticket)return;
    const db=state.db,uid=state.user.id,generation=state.accessGeneration;
    if(state.active?.id&&state.active.id!==id)
      remember("draft-"+state.active.id,el("staff-reply").value);
    const changed=state.active?.id!==id;
    state.active=ticket;remember("ticket",id);
    if(changed){
      state.threadRevision++;state.threadRows.clear();state.threadExpanded=false;
      state.threadHasMore=false;state.threadOlderBusy=false;state.renderedThread="";
      el("ticket-thread-older").hidden=true;el("staff-messages").replaceChildren();
    }
    updateTicketHeading();announceTicket();updateInbox();renderTickets();
    el("staff-reply").value=recalled("draft-"+id)||"";
    void loadAudit(id);
    if(can("chat"))await loadMessages();
    else{
      try{
        await query(db.rpc("proxiti_mark_ticket_read",{p_ticket:id}));
        if(state.db===db&&state.user?.id===uid&&state.accessGeneration===generation&&
           state.active?.id===id&&can("tickets_view")){
          markTicketSeen(id);await loadReadReceipts();
          updateInbox();renderTickets();
        }
      }catch{
        if(state.db===db&&state.user?.id===uid&&state.accessGeneration===generation&&state.active?.id===id)
          notice("Não foi possível confirmar a leitura. Use Atualizar na fila para tentar novamente.",true);
      }
    }
    if(state.active?.id===id&&window.matchMedia("(max-width: 900px)").matches)
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
  function filterOpsList(inputId,listId,statusId,label){
    const q=el(inputId).value.trim().toLocaleLowerCase("pt-BR");
    const entries=[...el(listId).querySelectorAll(".ops-list-item")];
    let visible=0;
    for(const item of entries){
      const matches=!q||item.textContent.toLocaleLowerCase("pt-BR").includes(q);
      item.hidden=!matches;if(matches)visible++;
    }
    el(statusId).textContent=entries.length?(visible+" de "+entries.length+" "+label):"";
  }
  function loadTraining(){
    document.dispatchEvent(new Event("proxiti-academy-refresh"));
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
      filterOpsList("tools-search","tools-list","tools-search-status","ferramentas");
    }catch(e){notice("Falha ao carregar ferramentas: "+e.message,true);}
  }
  function stop(){
    const nextGeneration=state.accessGeneration+1;
    if(state.poll)clearInterval(state.poll);
    if(state.heartbeat)clearInterval(state.heartbeat);
    if(state.channel&&state.db)void state.db.removeChannel(state.channel);
    if(state.toastTimer)clearTimeout(state.toastTimer);
    Object.assign(state,{db:null,user:null,profile:null,tickets:[],staff:[],active:null,channel:null,poll:null,heartbeat:null,loading:false,accessGeneration:nextGeneration,ticketsReady:false,ticketError:false,ticketLastUpdated:0,threadRevision:0,threadRows:new Map(),threadExpanded:false,threadHasMore:false,threadOlderBusy:false,ticketIds:null,messageIds:null,restoreTicketId:null,restoreScroll:null,messageCheckBusy:false,messageCheckPromise:null,messageReady:false,messagesCapped:false,readIssue:false,ticketFilter:"all",ticketSearch:"",messageRows:[],renderedTable:"",renderedThread:"",seenFallback:new Set(),readFallback:new Map(),readReceipts:new Map(),receiptsReady:false,readFetch:null,readSaving:new Set(),toastTimer:null});
    el("alert-toast").hidden=true;el("notifications-panel").hidden=true;
    el("notifications-toggle").setAttribute("aria-expanded","false");
    el("notifications-count").hidden=true;el("ticket-badge").hidden=true;
    el("ticket-list").replaceChildren();clearTicketPresentation();
    el("notifications-list").replaceChildren();
    window.PROXITI_OVERVIEW_SNAPSHOT=null;window.PROXITI_OVERVIEW_STATUS=null;
    el("overview-open").textContent="Chamados: atualizando…";
    ticketSync("restricted");
    el("operations").hidden=true;el("ticket-detail").hidden=true;el("ticket-empty-state").hidden=false;notice("");announceTicket();
  }
  async function start(e){
    const {client,user,profile}=e.detail;
    if(state.db===client&&state.user?.id===user.id){
      state.profile=profile;updateNav();return;
    }
    stop();state.db=client;state.user=user;state.profile=profile;presenceCheckedAt=0;
    state.currentView=recalled("view")||"tickets";
    state.ticketFilter=recalled("ticket-filter")||"all";
    if(!["all","unread","open","in_progress","waiting_customer","resolved","closed"].includes(state.ticketFilter))state.ticketFilter="all";
    state.ticketSearch=recalled("ticket-search")||"";
    el("ticket-search").value=state.ticketSearch;
    state.restoreTicketId=recalled("ticket");
    const y=Number(recalled("scroll"));
    state.restoreScroll=Number.isFinite(y)&&y>0?y:null;
    if(isAdmin())await loadStaff();
    updateNav();void checkNewMessages();
    if(can("tickets_view")||can("chat")||can("training")||can("resources")){
      if(can("chat")){
        const heartbeat=async()=>{if(!state.db||document.hidden)return;try{await rpc("proxiti_heartbeat",{});}catch{}};
        void heartbeat();state.heartbeat=setInterval(heartbeat,25000);
      }
      state.poll=setInterval(()=>{
        if(!state.db)return;
        if(can("tickets_view"))void loadTickets();
        if(state.active&&can("chat"))void loadMessages();
        void checkNewMessages();void updatePresence();
      },6000);
      if(can("tickets_view")){
        state.channel=state.db.channel("proxiti-workspace-"+user.id)
          .on("postgres_changes",{event:"*",schema:"public",table:"support_tickets"},()=>void loadTickets())
          .on("postgres_changes",{event:"INSERT",schema:"public",table:"support_messages"},payload=>{
            if(state.active?.id===payload.new?.ticket_id)void loadMessages();
            void checkNewMessages();
          }).subscribe(status=>{
            el("ops-live").textContent=status==="SUBSCRIBED"?"Atualizações em tempo real":"Atualização automática ativa";
          });
      }else el("ops-live").textContent="Atualização automática ativa";
    }
  }
  document.addEventListener("proxiti-session-ready",e=>{void start(e);});
  document.addEventListener("proxiti-session-ended",stop);
  document.addEventListener("proxiti-profile-updated",e=>{
    if(!state.user||!e.detail)return;
    if(state.profile)state.profile.display_name=e.detail.display_name;
    const mine=state.staff.find(p=>p.id===state.user.id);
    if(mine)mine.display_name=e.detail.display_name;
    state.renderedTable="";
    if(state.currentView==="tickets"&&can("tickets_view"))void loadTickets();
  });
  // Recupera o contexto se o SDK autenticou antes de este script terminar de carregar.
  if(window.PROXITI_ACTIVE_SESSION)void start({detail:window.PROXITI_ACTIVE_SESSION});
  for(const tab of el("ops-tabs").querySelectorAll("[data-ops-view]"))
    tab.addEventListener("click",()=>showView(tab.dataset.opsView));
  document.addEventListener("proxiti-ticket-activity",event=>{
    if(state.active?.id===event.detail?.id)void loadAudit(state.active.id);
  });
  document.addEventListener("proxiti-overview-open-ticket",event=>{
    const id=event.detail?.id;
    if(typeof id!=="string"||!state.tickets.some(t=>t.id===id)||!can("tickets_view"))return;
    window.PROXITI_OPEN_VIEW?.("tickets");
    void openTicket(id);
  });
  el("reload-tickets").addEventListener("click",()=>void loadTickets());
  el("ticket-thread-retry").addEventListener("click",()=>{
    if(state.active&&can("chat"))void loadMessages();
  });
  el("ticket-thread-older").addEventListener("click",()=>void loadEarlierMessages());
  document.addEventListener("proxiti-overview-retry",()=>{if(can("tickets_view"))void loadTickets();});
  el("browser-notifications").addEventListener("click",async()=>{
    if(!("Notification" in window)||Notification.permission!=="default")return;
    try{await Notification.requestPermission()}catch{}
    browserPermissionLabel();
  });
  browserPermissionLabel();
  for(const n of document.querySelectorAll("[data-ticket-filter]"))n.addEventListener("click",()=>{
    state.ticketFilter=n.dataset.ticketFilter;remember("ticket-filter",state.ticketFilter);
    state.renderedTable="";renderTickets();
  });
  el("ticket-search").addEventListener("input",e=>{
    state.ticketSearch=e.target.value;remember("ticket-search",state.ticketSearch);
    state.renderedTable="";renderTickets();
  });
  function closeNotifications(){
    el("notifications-panel").hidden=true;
    el("notifications-toggle").setAttribute("aria-expanded","false");
  }
  el("notifications-toggle").addEventListener("click",()=>{
    const willOpen=el("notifications-panel").hidden;
    el("notifications-panel").hidden=!willOpen;
    el("notifications-toggle").setAttribute("aria-expanded",String(willOpen));
  });
  el("notifications-close").addEventListener("click",()=>{closeNotifications();el("notifications-toggle").focus();});
  document.addEventListener("click",event=>{
    if(!event.target.closest(".notification-hub"))closeNotifications();
  });
  document.addEventListener("keydown",event=>{
    if(event.key==="Escape"&&!el("notifications-panel").hidden){
      closeNotifications();el("notifications-toggle").focus();
    }
  });
  el("reload-staff").addEventListener("click",()=>void loadStaff());
  el("reload-content").addEventListener("click",()=>void loadContent());
  el("reload-tools").addEventListener("click",()=>void loadTools());
  el("tools-search").addEventListener("input",()=>filterOpsList("tools-search","tools-list","tools-search-status","ferramentas"));
  el("close-detail").addEventListener("click",()=>{state.active=null;announceTicket();remember("ticket","");el("ticket-detail").hidden=true;el("ticket-empty-state").hidden=false;state.renderedTable="";renderTickets();});
  el("staff-reply").addEventListener("input",()=>{if(state.active)remember("draft-"+state.active.id,el("staff-reply").value)});
  window.addEventListener("pagehide",()=>{if(state.user)remember("scroll",Math.round(window.scrollY))});
  document.addEventListener("visibilitychange",()=>{
    if(!document.hidden&&state.db){
      if(can("tickets_view"))void loadTickets();
      if(state.active&&can("chat"))void loadMessages();
      void checkNewMessages();
      if(can("chat"))void rpc("proxiti_heartbeat",{}).catch(()=>{});
    }
  });
  el("claim-ticket").addEventListener("click",async event=>{
    if(!state.active||!can("tickets_claim")||!can("tickets_view"))return;
    const ticket=state.active,db=state.db,uid=state.user.id,generation=state.accessGeneration;
    const button=event.currentTarget;button.disabled=true;
    try{
      const ok=await query(db.rpc("proxiti_claim_ticket",{p_ticket:ticket.id}));
      if(!ok)throw new Error("O chamado já foi assumido ou mudou de situação. Atualize a fila.");
      if(state.db!==db||state.user?.id!==uid||state.accessGeneration!==generation)return;
      if(state.active?.id===ticket.id){
        state.active.assigned_to=uid;
        if(state.active.status==="new")state.active.status="triage";
        updateTicketHeading();announceTicket();
        notice("Chamado #"+ticket.reference+" assumido.");
      }
      await loadTickets();
      if(state.active?.id===ticket.id&&can("chat"))void loadMessages();
    }catch(error){
      if(state.db===db&&state.user?.id===uid&&state.accessGeneration===generation)
        notice(error.message,true);
    }finally{button.disabled=false;}
  });
  el("save-status").addEventListener("click",async event=>{
    if(!state.active||!can("tickets_view")||state.active.status==="closed")return;
    const ticket=state.active,nextStatus=el("ticket-status").value;
    if(nextStatus===ticket.status){notice("A situação do chamado não mudou.");return;}
    const db=state.db,uid=state.user.id,generation=state.accessGeneration;
    const button=event.currentTarget;button.disabled=true;
    const same=()=>state.db===db&&state.user?.id===uid&&state.accessGeneration===generation;
    try{
      if(["resolved","closed"].includes(nextStatus)){
        const activeAppointments=await query(db.from("ticket_appointments")
          .select("id").eq("ticket_id",ticket.id)
          .in("status",["planned","confirmed"]).limit(1));
        if(!same()||state.active?.id!==ticket.id)return;
        if(activeAppointments.length){
          el("ticket-status").value=ticket.status;
          notice("Finalize ou cancele os compromissos pendentes na Agenda antes de "+
            "resolver ou encerrar este chamado.",true);
          return;
        }
      }
      if(nextStatus==="closed"){
        const [tasks,reports]=await Promise.all([
          query(db.from("ticket_tasks").select("state").eq("ticket_id",ticket.id).limit(31)),
          query(db.from("ticket_reports").select("id").eq("ticket_id",ticket.id)
            .eq("finalized",true).limit(1))
        ]);
        if(!same()||state.active?.id!==ticket.id)return;
        const pending=tasks.filter(item=>item.state==="pending").length;
        const missingReport=reports.length===0;
        const warnings=[];
        if(pending)warnings.push(pending+" etapa(s) do roteiro ainda pendente(s)");
        if(missingReport)warnings.push("nenhum relatório final registrado");
        const message="Encerrar o chamado #"+ticket.reference+"? "+
          "Após o encerramento, os registros técnicos serão somente leitura."+
          (warnings.length?"\n\nAtenção: "+warnings.join("; ")+".":"")+
          "\n\nConfirme somente depois de revisar a entrega ao cliente.";
        if(!window.confirm(message)){
          el("ticket-status").value=ticket.status;return;
        }
      }
      if(!same()||state.active?.id!==ticket.id)return;
      await query(db.rpc("proxiti_change_ticket_status",{
        p_ticket:ticket.id,p_status:nextStatus
      }));
      if(!same())return;
      if(state.active?.id===ticket.id){
        state.active.status=nextStatus;updateTicketHeading();announceTicket();
        notice("Situação do chamado #"+ticket.reference+" atualizada.");
      }
      await loadTickets();
    }catch(error){
      if(same()){
        if(state.active?.id===ticket.id)el("ticket-status").value=state.active.status;
        notice("Não foi possível alterar a situação: "+error.message,true);
      }
    }finally{button.disabled=false;}
  });
  el("save-assignee").addEventListener("click",async event=>{
    if(!state.active||!isAdmin()||state.active.status==="closed")return;
    const ticket=state.active,assignee=el("ticket-assignee").value||null;
    const db=state.db,uid=state.user.id,generation=state.accessGeneration;
    const button=event.currentTarget;button.disabled=true;
    try{
      await query(db.rpc("proxiti_admin_assign_ticket",{
        p_ticket:ticket.id,p_staff:assignee
      }));
      if(state.db!==db||state.user?.id!==uid||state.accessGeneration!==generation)return;
      if(state.active?.id===ticket.id){
        state.active.assigned_to=assignee;updateTicketHeading();announceTicket();
        notice("Responsável pelo chamado #"+ticket.reference+" atualizado.");
      }
      await loadTickets();
    }catch(error){
      if(state.db===db&&state.user?.id===uid&&state.accessGeneration===generation){
        if(state.active?.id===ticket.id)el("ticket-assignee").value=state.active.assigned_to||"";
        notice(error.message,true);
      }
    }finally{button.disabled=false;}
  });
  el("staff-reply-form").addEventListener("submit",async event=>{
    event.preventDefault();
    if(!state.active||!can("chat")||!can("tickets_view")||state.active.status==="closed")return;
    const ticket=state.active,db=state.db,uid=state.user.id,generation=state.accessGeneration;
    const field=el("staff-reply"),body=field.value.trim();
    if(!body)return;
    const send=event.currentTarget.querySelector('button[type="submit"]');
    send.disabled=true;
    try{
      await query(db.rpc("proxiti_staff_reply",{p_ticket:ticket.id,p_body:body}));
      if(state.db!==db||state.user?.id!==uid||state.accessGeneration!==generation)return;
      if(state.active?.id===ticket.id){
        if(field.value.trim()===body){
          field.value="";remember("draft-"+ticket.id,"");
        }
        await loadMessages();
        notice("Resposta enviada no chamado #"+ticket.reference+".");
      }
    }catch(error){
      if(state.db===db&&state.user?.id===uid&&state.accessGeneration===generation)
        notice("A resposta não foi confirmada. Verifique o histórico antes de reenviar: "+
          error.message,true);
    }finally{send.disabled=false;}
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
