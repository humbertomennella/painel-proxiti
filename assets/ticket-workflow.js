(() => {
  "use strict";
  const el=id=>document.getElementById(id);
  const root=el("ticket-workflow");
  if(!root)return;
  const bucket="proxiti-ticket-files";
  const formats={"application/pdf":".pdf","image/png":".png","image/jpeg":".jpg","image/webp":".webp"};
  let selected=null,revision=0,taskRows=[];
  const noteDrafts=new Map();
  const session=()=>window.PROXITI_ACTIVE_SESSION;
  const database=()=>session()?.client;
  const isAdmin=()=>session()?.profile?.role==="administrator"&&session()?.profile?.status==="active";
  const canRead=()=>!!selected&&!!session()?.user&&session()?.profile?.status==="active"&&
    (isAdmin()||(session()?.profile?.permissions?.tickets_view===true&&
      (selected.assigned_to===session().user.id||selected.assigned_to===null)));
  const canEdit=()=>canRead()&&selected.status!=="closed"&&
    (isAdmin()||selected.assigned_to===session().user.id);
  const canReport=()=>canRead()&&(isAdmin()||selected.assigned_to===session().user.id);
  const stamp=date=>new Date(date).toLocaleString("pt-BR",{dateStyle:"short",timeStyle:"short"});
  const make=(tag,label="",className="")=>{
    const element=document.createElement(tag);
    if(label!=="")element.textContent=String(label);
    if(className)element.className=className;
    return element;
  };
  const note=(message="",error=false)=>{
    const area=el("ticket-workflow-feedback");
    area.textContent=message;area.hidden=!message;
    area.className="ticket-workflow-feedback"+(error?" error":"");
  };
  async function query(action){
    const {data,error}=await action;
    if(error)throw new Error(error.message||"Operação indisponível.");
    return data;
  }
  async function rpc(name,params){return query(database().rpc(name,params));}
  function empty(area,message){
    area.replaceChildren(make("li",message,"ticket-workflow-empty"));
  }
  function displayNotes(rows){
    const list=el("ticket-notes-list");list.replaceChildren();
    if(!rows.length){empty(list,"Nenhuma nota interna registrada.");return;}
    for(const item of rows){
      const li=make("li","","ticket-workflow-entry");
      const author=item.author_id===session()?.user?.id?"Você":"Equipe autorizada";
      li.append(make("small",author+" · "+stamp(item.created_at)),
        make("p",item.body));
      list.append(li);
    }
  }
  function displayTasks(rows){
    taskRows=rows;
    const list=el("ticket-tasks-list");list.replaceChildren();
    const completed=rows.filter(x=>x.state==="done").length,
      skipped=rows.filter(x=>x.state==="skipped").length;
    el("ticket-tasks-progress").textContent=rows.length
      ? completed+" concluídas · "+skipped+" não aplicáveis · "+rows.length+" etapas"
      : "Nenhum roteiro iniciado";
    el("ticket-tasks-start").hidden=!!rows.length||!canEdit();
    if(!rows.length){
      empty(list,canEdit()?"Escolha um modelo para começar. O roteiro poderá ser adaptado ao caso.":"Nenhum roteiro registrado.");
      return;
    }
    for(const task of rows){
      const item=make("li","","ticket-workflow-task");
      const top=make("div","","ticket-workflow-task-title");
      top.append(make("span",String(task.position).padStart(2,"0"),"ticket-workflow-step"),
        make("strong",task.title));
      item.append(top);
      if(canEdit()){
        const controls=make("div","","ticket-workflow-task-controls");
        const chooser=make("select");
        chooser.setAttribute("aria-label","Situação da etapa "+task.position);
        for(const [value,label] of [["pending","Pendente"],["done","Concluída"],["skipped","Não aplicável"]]){
          const option=make("option",label);option.value=value;chooser.append(option);
        }
        chooser.value=task.state;
        const explanation=make("input");explanation.type="text";explanation.maxLength=400;
        explanation.value=task.note||"";explanation.placeholder="Observação ou motivo de não aplicabilidade";
        explanation.setAttribute("aria-label","Observação da etapa "+task.position);
        const save=make("button","Salvar etapa","secondary");save.type="button";
        save.addEventListener("click",async()=>{
          if(selected?.id!==task.ticket_id||!canEdit())return;
          save.disabled=true;note("");
          try{
            await rpc("proxiti_update_ticket_task",{
              p_task:task.id,p_state:chooser.value,p_note:explanation.value.trim()
            });
            note("Etapa salva.");document.dispatchEvent(new CustomEvent("proxiti-ticket-activity",{detail:{id:task.ticket_id}}));await refresh("tasks",selected.id);
          }catch(error){note(error.message,true);}
          finally{save.disabled=false;}
        });
        controls.append(chooser,explanation,save);item.append(controls);
      }else{
        const stateLabel={pending:"Pendente",done:"Concluída",skipped:"Não aplicável"};
        item.append(make("small",stateLabel[task.state]||task.state,"ticket-workflow-task-status"));
        if(task.note)item.append(make("p",task.note));
      }
      list.append(item);
    }
  }
  function displayFiles(rows){
    const list=el("ticket-files-list");list.replaceChildren();
    if(!rows.length){empty(list,"Nenhum anexo privado registrado.");return;}
    for(const file of rows){
      const item=make("li","","ticket-workflow-file");
      const info=make("div","","ticket-workflow-file-info");
      info.append(make("strong",file.file_name),
        make("small",(file.byte_size/1048576).toFixed(2)+" MB · "+stamp(file.created_at)));
      const open=make("button","Baixar","secondary");open.type="button";
      open.addEventListener("click",async()=>{
        if(selected?.id!==file.ticket_id||!canRead())return;
        const db=database(),uid=session().user.id,rev=revision;
        open.disabled=true;note("");
        try{
          const blob=await query(db.storage.from(bucket).download(file.storage_path));
          if(rev!==revision||selected?.id!==file.ticket_id||database()!==db||
             session()?.user?.id!==uid||!canRead())return;
          const objectUrl=URL.createObjectURL(blob),a=make("a");
          a.href=objectUrl;a.download=file.file_name.replace(/[^\p{L}\p{N} .()_\-]/gu,"_");
          document.body.append(a);a.click();a.remove();
          window.setTimeout(()=>URL.revokeObjectURL(objectUrl),60000);
          note("Download autorizado. O arquivo não fica em uma URL pública permanente.");
        }catch(error){note("Não foi possível baixar o anexo: "+error.message,true);}
        finally{open.disabled=false;}
      });
      item.append(info,open);list.append(item);
    }
  }
  async function refresh(section,ticketId){
    const db=database(),rev=revision,uid=session()?.user?.id;
    if(!db||!ticketId||!canRead())return;
    const tables={
      notes:["ticket_internal_notes","id,ticket_id,author_id,body,created_at","created_at",false],
      tasks:["ticket_tasks","id,ticket_id,title,position,state,note,updated_at","position",true],
      files:["ticket_attachments","id,ticket_id,file_name,storage_path,byte_size,created_at","created_at",false]
    };
    const [table,fields,order,ascending]=tables[section];
    try{
      const rows=await query(db.from(table).select(fields).eq("ticket_id",ticketId)
        .order(order,{ascending}).limit(150));
      if(rev!==revision||selected?.id!==ticketId||database()!==db||
         session()?.user?.id!==uid||!canRead())return;
      if(section==="notes")displayNotes(rows||[]);
      if(section==="tasks")displayTasks(rows||[]);
      if(section==="files")displayFiles(rows||[]);
    }catch(error){
      if(rev!==revision||selected?.id!==ticketId||database()!==db||
         session()?.user?.id!==uid||!canRead())return;
      note("Não foi possível consultar "+({notes:"as notas",tasks:"o roteiro",files:"os anexos"}[section])+
        ": "+error.message,true);
    }
  }
  function choose(ticket){
    if(selected?.id&&el("ticket-note-body").value.trim())
      noteDrafts.set(selected.id,el("ticket-note-body").value);
    revision++;
    const changed=selected?.id!==ticket?.id;
    selected=ticket||null;
    root.hidden=!selected||!canRead();
    if(!selected){
      el("ticket-note-body").value="";
      el("ticket-report-form").reset();
      taskRows=[];note("");return;
    }
    const writable=canEdit();
    el("ticket-workflow-mode").textContent=writable?"Edição autorizada":
      selected.status==="closed"?"Histórico encerrado · somente leitura":"Consulta · somente leitura";
    el("ticket-note-form").hidden=!writable;
    el("ticket-file-form").hidden=!writable;
    el("ticket-tasks-start").hidden=!writable||taskRows.length>0;
    el("ticket-report-panel").hidden=!canReport();
    if(changed){
      el("ticket-note-body").value=noteDrafts.get(selected.id)||"";el("ticket-file-form").reset();
      el("ticket-report-form").reset();el("ticket-report-panel").open=false;
      note("");empty(el("ticket-notes-list"),"Carregando notas…");
      empty(el("ticket-tasks-list"),"Carregando roteiro…");
      empty(el("ticket-files-list"),"Carregando anexos…");
      taskRows=[];
      const id=selected.id;
      for(const section of ["notes","tasks","files"])void refresh(section,id);
    }else{
      displayTasks(taskRows);
    }
  }
  el("ticket-note-form").addEventListener("submit",async event=>{
    event.preventDefault();if(!canEdit())return;
    const ticket=selected,submit=event.currentTarget.querySelector('[type="submit"]');
    const body=el("ticket-note-body").value.trim();
    if(body.length<3)return;
    submit.disabled=true;note("");
    try{
      await rpc("proxiti_add_ticket_note",{p_ticket:ticket.id,p_body:body});
      if(selected?.id===ticket.id){
        if(el("ticket-note-body").value.trim()===body){
          el("ticket-note-body").value="";noteDrafts.delete(ticket.id);
        }
        note("Nota interna registrada.");
        document.dispatchEvent(new CustomEvent("proxiti-ticket-activity",{detail:{id:ticket.id}}));
        await refresh("notes",ticket.id);
      }
    }catch(error){if(selected?.id===ticket.id)note(error.message,true);}
    finally{submit.disabled=false;}
  });
  el("ticket-tasks-create").addEventListener("click",async event=>{
    if(!canEdit())return;
    const ticket=selected,button=event.currentTarget;button.disabled=true;note("");
    try{
      const count=await rpc("proxiti_prepare_ticket_checklist",{
        p_ticket:ticket.id,p_template:el("ticket-task-template").value
      });
      if(selected?.id===ticket.id){
        note(count?"Roteiro criado. Ajuste as etapas de acordo com o atendimento.":"O roteiro deste chamado já existe.");
        if(count)document.dispatchEvent(new CustomEvent("proxiti-ticket-activity",{detail:{id:ticket.id}}));
        await refresh("tasks",ticket.id);
      }
    }catch(error){if(selected?.id===ticket.id)note(error.message,true);}
    finally{button.disabled=false;}
  });
  el("ticket-file-form").addEventListener("submit",async event=>{
    event.preventDefault();if(!canEdit())return;
    const ticket=selected,form=event.currentTarget,send=form.querySelector('[type="submit"]');
    const file=el("ticket-file-input").files?.[0];
    if(!file)return;
    const ext=formats[file.type];
    if(!ext||file.size<1||file.size>5242880||file.name.length>160){
      note("Use PDF, PNG, JPG ou WebP de até 5 MB e nome de até 160 caracteres.",true);return;
    }
    send.disabled=true;note("Enviando arquivo privado…");
    const path=ticket.id+"/"+crypto.randomUUID()+ext;
    let uploaded=false;
    try{
      await query(database().storage.from(bucket).upload(path,file,{
        contentType:file.type,cacheControl:"60",upsert:false
      }));
      uploaded=true;
      await rpc("proxiti_attach_ticket_file",{
        p_ticket:ticket.id,p_path:path,p_name:file.name,p_mime:file.type,p_size:file.size
      });
      if(selected?.id===ticket.id){
        form.reset();note("Anexo privado registrado.");
        document.dispatchEvent(new CustomEvent("proxiti-ticket-activity",{detail:{id:ticket.id}}));await refresh("files",ticket.id);
      }
    }catch(error){
      if(uploaded)try{await database().storage.from(bucket).remove([path]);}catch{}
      if(selected?.id===ticket.id)note("Falha ao adicionar anexo: "+error.message,true);
    }finally{send.disabled=false;}
  });
  el("ticket-report-form").addEventListener("submit",event=>{
    event.preventDefault();
    if(!canReport())return;
    const ticket=selected;
    const diagnosis=el("ticket-report-diagnosis").value.trim();
    const service=el("ticket-report-service").value.trim();
    const advice=el("ticket-report-advice").value.trim();
    if(diagnosis.length<5||service.length<5){note("Preencha o diagnóstico e o serviço realizado.",true);return;}
    const popup=window.open("","_blank");
    if(!popup){note("Seu navegador bloqueou a janela do relatório. Permita pop-ups desta Central e tente novamente.",true);return;}
    const doc=popup.document;
    doc.title="PROXITI · Relatório do chamado #"+ticket.reference;
    const style=doc.createElement("style");
    style.textContent="*{box-sizing:border-box}body{font:16px/1.55 system-ui,Arial,sans-serif;color:#162133;max-width:760px;margin:36px auto;padding:0 22px}h1{font-size:27px}h2{font-size:18px;margin:24px 0 8px;border-bottom:1px solid #d7e0eb;padding-bottom:7px}p{white-space:pre-wrap;margin:6px 0}.meta{color:#536175;font-size:14px}.warn{border:1px solid #cbd5e1;border-radius:8px;padding:12px;font-size:13px;color:#485367}button{padding:11px 15px;border:0;border-radius:8px;background:#2f6df6;color:#fff;font-weight:700;cursor:pointer}@media print{button{display:none}body{margin:0;max-width:none}}";
    doc.head.append(style);
    const add=(tag,text,parent=doc.body,cls="")=>{
      const node=doc.createElement(tag);node.textContent=text;if(cls)node.className=cls;parent.append(node);return node;
    };
    const title=add("h1","PROXITI · Relatório de atendimento");
    add("p","Chamado #"+ticket.reference+" · Emitido em "+stamp(new Date()),doc.body,"meta");
    add("p","Cliente: "+ticket.customer_name+" · Assunto: "+ticket.subject,doc.body,"meta");
    add("h2","Diagnóstico");add("p",diagnosis);
    add("h2","Serviço realizado ou encaminhamento");add("p",service);
    add("h2","Testes e orientações");add("p",advice||"Não informado.");
    add("p","Documento preparado pelo profissional na Central Técnica. Confira o conteúdo e as autorizações antes de compartilhar.",doc.body,"warn");
    const print=add("button","Imprimir / Salvar em PDF");print.type="button";
    print.addEventListener("click",()=>popup.print());
    popup.opener=null;title.focus?.();popup.focus();
    note("Relatório aberto para revisão. Nenhuma nota interna foi incluída.");
  });
  document.addEventListener("proxiti-ticket-selected",event=>choose(event.detail?.ticket||null));
  el("ticket-note-body").addEventListener("input",()=>{
    if(selected?.id)noteDrafts.set(selected.id,el("ticket-note-body").value);
  });
  document.addEventListener("proxiti-session-ended",()=>{choose(null);noteDrafts.clear();});
  document.addEventListener("proxiti-session-ready",event=>{
    if(event.detail?.profile?.status!=="active"||
       (event.detail?.profile?.role!=="administrator"&&event.detail?.profile?.permissions?.tickets_view!==true)){
      choose(null);noteDrafts.clear();
    }
  });
  if(window.PROXITI_ACTIVE_TICKET)choose(window.PROXITI_ACTIVE_TICKET);
})();
