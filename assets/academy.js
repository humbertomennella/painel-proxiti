(() => {
"use strict";
const el=id=>document.getElementById(id),root=el("ops-training");
if(!root)return;
const PAGE=40,VERSION_PAGE=30,bucket="proxiti-training";
const formats={"application/pdf":".pdf","image/png":".png",
 "image/jpeg":".jpg","image/webp":".webp"};
const session=()=>window.PROXITI_ACTIVE_SESSION;
const isAdmin=s=>s?.profile?.status==="active"&&s.profile.role==="administrator"&&!!s.user&&!!s.client;
const canRead=s=>isAdmin(s)||(!!s?.client&&!!s.user&&s.profile?.status==="active"&&
 s.profile.permissions?.training===true);
const valid=(g,s)=>g===generation&&canRead(session())&&
 session()?.user?.id===s.user.id&&session()?.client===s.client;
const make=(tag,text="",cls="")=>{
 const n=document.createElement(tag);if(text!==null)n.textContent=String(text);
 if(cls)n.className=cls;return n;
};
const query=async request=>{
 const {data,error}=await request;
 if(error)throw new Error(error.message||"O servidor não confirmou a operação.");
 return data;
};
const shortDate=value=>{
 const v=String(value),dateOnly=v.length===10&&v[4]==="-"&&v[7]==="-";
 const d=new Date(dateOnly?v+"T12:00:00":value);
 return Number.isNaN(d.getTime())?"Sem revisão registrada":
   d.toLocaleDateString("pt-BR");
};
const https=value=>{
 if(!value)return null;
 try{
   const u=new URL(value);
   return u.protocol==="https:"&&u.hostname.includes(".")?u.href:null;
 }catch{return null;}
};
const today=()=>new Date().toLocaleDateString("en-CA");
const readKey=(user,item)=>"proxiti-academy-read-v2-"+user.id+"-"+item.id+"-"+item.updated_at;
let generation=0,entries=[],loaded=0,hasMore=false,fetching=false,
 signature="",lastSync=0,editItem=null,editorBusy=false,searchTimer=null;
function message(text="",error=false){
 const n=el("training-editor-feedback");n.textContent=text;n.hidden=!text;
 n.className="ticket-workflow-feedback"+(error?" error":"");
}
function phase(kind){
 const n=el("training-sync-state");n.dataset.phase=kind;
 el("reload-training").disabled=kind==="loading"||kind==="restricted";
 el("training-load-more").disabled=kind==="loading"||kind==="restricted";
 if(kind==="loading")n.textContent=lastSync?
   "Atualizando a biblioteca. Os materiais visíveis são da consulta anterior.":
   "Consultando a biblioteca autorizada…";
 else if(kind==="ready")n.textContent="Biblioteca consultada às "+
   new Date(lastSync).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})+
   (hasMore?". Há mais materiais nesta pesquisa.":".");
 else if(kind==="error")n.textContent=lastSync?
   "Falha na atualização. Os materiais exibidos podem estar desatualizados. Tente novamente.":
   "Não foi possível consultar a UniProxiti. Use Atualizar para tentar novamente.";
 else n.textContent="A UniProxiti não está habilitada para esta conta.";
}
function kind(){
 const article=el("training-kind").value==="article";
 el("training-article-fields").hidden=!article;
 el("training-file-fields").hidden=article;
 el("training-body").required=article;
 el("training-file").required=!article&&!editItem;
}
function resetEditor(){
 editItem=null;
 const form=el("training-form");form.reset();delete form.dataset.edit;
 el("training-kind").disabled=false;el("training-editor-title").textContent="Publicar material técnico";
 el("training-save").textContent="Salvar material";el("training-cancel").hidden=true;
 el("training-reviewed").checked=false;
 message("");kind();
}
function clear(){
 generation++;entries=[];loaded=0;hasMore=false;fetching=false;
 signature="";lastSync=0;editorBusy=false;
 if(searchTimer){clearTimeout(searchTimer);searchTimer=null;}
 resetEditor();
 el("training-list").replaceChildren(make("p","Entre na Central para consultar a UniProxiti.","ops-muted"));
 el("training-search-status").textContent="";
 el("training-load-more").hidden=true;el("training-load-more").disabled=false;
 phase("restricted");
}
function renderBody(text,host){
 for(const raw of String(text||"").split(/\r?\n/)){
   const line=raw.trim();if(!line)continue;
   const h=line.startsWith("# ")?1:line.startsWith("## ")?2:0;
   const n=make(h?(h===1?"h5":"h6"):"p",
     h?line.slice(h===1?2:3):line.startsWith("- ")?line.slice(2):line);
   if(!h&&line.startsWith("- "))n.className="academy-bullet";
   host.append(n);
 }
}
function edit(item){
 const s=session();if(!isAdmin(s)||editorBusy)return;
 editItem=item;const form=el("training-form");form.dataset.edit=item.id;
 el("training-kind").value=item.kind;el("training-kind").disabled=true;
 el("training-category").value=item.category||"Geral";
 el("training-title").value=item.title;
 el("training-description").value=item.description||"";
 el("training-reference").value=item.reference_url||"";
 el("training-body").value=item.body||"";
 el("training-published").checked=!!item.published;
 el("training-reviewed").checked=false;
 el("training-editor-title").textContent="Revisar material existente";
 el("training-save").textContent="Salvar nova versão";
 el("training-cancel").hidden=false;message("");kind();
 form.scrollIntoView({behavior:"smooth",block:"start"});
 el("training-title").focus({preventScroll:true});
}
function printArticle(item){
 const s=session();if(!canRead(s))return;
 const popup=window.open("","_blank");
 if(!popup){message("Permita a janela de impressão no navegador.",true);return;}
 popup.opener=null;
 const doc=popup.document;doc.title="PROXITI · "+item.title;
 const style=make("style","body{font:16px/1.64 system-ui,Arial,sans-serif;color:#15233b;max-width:800px;margin:32px auto;padding:0 22px}h1{font-size:28px;line-height:1.3}h5{font-size:21px;margin:24px 0 8px}h6{font-size:17px;margin:17px 0 7px}p{margin:7px 0;white-space:pre-wrap}small{color:#58667c}.academy-bullet{padding-left:18px}button{margin:20px 0;padding:12px;border-radius:8px}@media print{button{display:none}body{margin:0;max-width:none}}");doc.head.append(style);
 doc.body.append(make("h1",item.title),
   make("small","PROXITI · "+item.category+" · "+(item.reviewed_at?
     "revisado em "+shortDate(item.reviewed_at):"revisão pendente")));
 renderBody(item.body,doc.body);
 const ref=https(item.reference_url);
 if(ref)doc.body.append(make("p","Referência técnica: "+ref));
 const button=make("button","Imprimir / Salvar como PDF");button.type="button";
 button.addEventListener("click",()=>popup.print());doc.body.append(button);
 popup.focus();
}
async function openFile(item){
 const s=session(),g=generation;
 if(!canRead(s)||!item.storage_path)return;
 const popup=window.open("","_blank");
 if(!popup){message("Permita a abertura de uma aba para consultar o arquivo privado.",true);return;}
 popup.opener=null;
 try{
   const data=await query(s.client.storage.from(bucket).createSignedUrl(item.storage_path,90));
   if(!valid(g,s)){popup.close();return;}
   if(!isAdmin(s)&&!item.published){popup.close();return;}
   const url=new URL(data?.signedUrl||"",s.client.supabaseUrl||window.location.href);
   if(url.protocol!=="https:"||(s.client.supabaseUrl&&
     url.origin!==new URL(s.client.supabaseUrl).origin))
     throw new Error("O endereço de acesso privado não é válido.");
   popup.location.replace(url.href);
 }catch(error){
   popup.close();if(valid(g,s))message("Arquivo privado indisponível: "+error.message,true);
 }
}
function markRead(item,button){
 const s=session();if(!canRead(s))return;
 const key=readKey(s.user,item);
 try{
   const next=localStorage.getItem(key)!=="1";
   localStorage.setItem(key,next?"1":"0");
   button.setAttribute("aria-pressed",String(next));
   button.textContent=next?"Consultado neste navegador ✓":"Marcar como consultado neste navegador";
 }catch{message("O navegador não permitiu guardar sua preferência local.",true);}
}
function archive(item){
 const s=session(),g=generation;
 if(!isAdmin(s)||!item.published||editorBusy)return;
 if(!window.confirm("Arquivar este material? Ele deixará de aparecer para técnicos, "+
   "mas continuará no banco e no histórico editorial."))return;
 void (async()=>{
   try{
     const result=await query(s.client.from("training_materials")
       .update({published:false}).eq("id",item.id)
       .eq("updated_at",item.updated_at).select("id").maybeSingle());
     if(!valid(g,s)||!isAdmin(session()))return;
     if(!result)throw new Error("Outra edição foi salva antes desta. Atualize para revisar.");
     if(editItem?.id===item.id)resetEditor();
     message("Material arquivado. O conteúdo e as versões anteriores foram preservados.");
     await load();
   }catch(error){
     if(valid(g,s))message("Arquivamento não confirmado. Atualize antes de repetir: "+
       error.message,true);
   }
 })();
}
function history(item,card){
 const s=session(),g=generation;
 const details=make("details",null,"academy-versions");
 details.append(make("summary","Histórico de versões anteriores"));
 const list=make("ol",null,"academy-version-list");
 const more=make("button","Carregar versões anteriores","secondary");more.type="button";
 more.hidden=true;
 details.append(list,more);
 let offset=0,busy=false,done=false;
 async function fetchHistory(){
   if(busy||done||!isAdmin(session())||!valid(g,s))return;
   busy=true;more.disabled=true;
   if(!offset)list.replaceChildren(make("li","Consultando versões…"));
   try{
     const data=await query(s.client.from("training_material_versions")
       .select("id,previous_snapshot,changed_by,recorded_at")
       .eq("material_id",item.id)
       .order("recorded_at",{ascending:false}).order("id",{ascending:false})
       .range(offset,offset+VERSION_PAGE));
     if(!valid(g,s)||!isAdmin(session())||!card.isConnected)return;
     if(!offset)list.replaceChildren();
     for(const row of data.slice(0,VERSION_PAGE)){
       const v=row.previous_snapshot||{},li=make("li",null,"academy-version");
       const date=row.recorded_at?new Date(row.recorded_at).toLocaleString("pt-BR"):"Data indisponível";
       li.append(make("strong",v.title||item.title),
         make("small","Versão anterior registrada em "+date+
           " · "+(v.published?"Publicada":"Rascunho")+
           (v.reviewed_at?" · revisão: "+shortDate(v.reviewed_at):" · sem revisão")));
       if(v.kind==="article"&&v.body){
         const disclosure=make("details");
         disclosure.append(make("summary","Consultar texto desta versão"));
         const content=make("div",null,"academy-body");renderBody(v.body,content);
         disclosure.append(content);li.append(disclosure);
         const restore=make("button","Carregar esta versão no editor como rascunho","secondary");
         restore.type="button";
         restore.addEventListener("click",()=>{
           if(!isAdmin(session())||!card.isConnected)return;
           edit(item);el("training-title").value=v.title||item.title;
           el("training-description").value=v.description||"";
           el("training-category").value=v.category||item.category;
           el("training-reference").value=v.reference_url||"";
           el("training-body").value=v.body;
           el("training-published").checked=false;el("training-reviewed").checked=false;
           message("Versão carregada no editor. Salve como rascunho e revise antes de publicar.");
         });
         li.append(restore);
       }
       if(v.kind==="file"&&v.storage_path){
         const file=make("button","Abrir arquivo desta versão","secondary");file.type="button";
         file.addEventListener("click",()=>{if(isAdmin(session()))void openFile(v);});
         li.append(file);
       }
       list.append(li);
     }
     if(!list.children.length)list.append(make("li","Este material ainda não possui revisões anteriores."));
     offset+=Math.min(data.length,VERSION_PAGE);done=data.length<=VERSION_PAGE;
     more.hidden=done;
   }catch(error){
     if(valid(g,s)&&card.isConnected){
       if(!offset)list.replaceChildren(make("li","Histórico indisponível: "+error.message));
       more.hidden=false;
     }
   }finally{busy=false;more.disabled=false;}
 }
 details.addEventListener("toggle",()=>{if(details.open&&!offset)void fetchHistory();});
 more.addEventListener("click",()=>void fetchHistory());
 return details;
}
function card(item,g,s){
 const entry=make("article",null,"ops-list-item academy-entry");
 entry.dataset.category=item.category||"Geral";entry.dataset.materialId=item.id;
 const head=make("div",null,"academy-entry-head");
 head.append(make("strong",item.title),make("span",item.category||"Geral","ops-badge"));
 const pub=make("span",item.published?"Publicado":"Rascunho","ops-badge");
 pub.dataset.published=String(!!item.published);head.append(pub);
 entry.append(head,make("p",item.description||"Sem descrição"),
   make("small",(item.kind==="article"?"Procedimento interno":"Arquivo privado")+
     " · "+(item.reviewed_at?"Revisão: "+shortDate(item.reviewed_at):"Revisão pendente"),
     "academy-meta"));
 if(item.kind==="article"&&item.body){
   const details=make("details",null,"academy-article");
   const content=make("div",null,"academy-body");
   renderBody(item.body,content);
   const ref=https(item.reference_url);
   if(ref){const link=make("a","Abrir referência técnica ↗","academy-reference");
     link.href=ref;link.target="_blank";link.rel="noopener noreferrer";content.append(link);}
   details.append(make("summary","Ler procedimento"),content);
   entry.append(details);
 }
 const controls=make("div",null,"ops-controls academy-actions");
 if(item.kind==="article") {
   const print=make("button","Imprimir / Salvar PDF","secondary");print.type="button";
   print.addEventListener("click",()=>printArticle(item));controls.append(print);
 }
 if(item.storage_path){
   const open=make("button","Abrir arquivo privado","secondary");open.type="button";
   open.addEventListener("click",()=>void openFile(item));controls.append(open);
 }
 const consulted=make("button","Marcar como consultado neste navegador","secondary academy-mark-read");
 consulted.type="button";
 let seen=false;try{seen=localStorage.getItem(readKey(s.user,item))==="1";}catch{}
 consulted.setAttribute("aria-pressed",String(seen));
 if(seen)consulted.textContent="Consultado neste navegador ✓";
 consulted.addEventListener("click",()=>markRead(item,consulted));controls.append(consulted);
 if(isAdmin(s)){
   const editButton=make("button","Editar","secondary");editButton.type="button";
   editButton.addEventListener("click",()=>edit(item));controls.append(editButton);
   if(item.published){
     const archiveButton=make("button","Arquivar","secondary");archiveButton.type="button";
     archiveButton.addEventListener("click",()=>archive(item));controls.append(archiveButton);
   }
 }
 entry.append(controls);
 if(isAdmin(s))entry.append(history(item,entry));
 return entry;
}
function render(){
 const s=session();if(!canRead(s)){clear();return;}
 const list=el("training-list");list.replaceChildren();
 if(!entries.length)list.append(make("p",fetching?"Consultando os materiais autorizados…":
   hasMore?"Nenhum material nesta página. Carregue a próxima.":"Nenhum material para os filtros atuais.",
   "ops-muted"));
 for(const item of entries)list.append(card(item,generation,s));
 el("training-search-status").textContent=entries.length+" material"+
   (entries.length===1?"":"is")+" carregado"+(entries.length===1?"":"s")+
   (hasMore?" · há mais resultados":"");
 el("training-load-more").hidden=!hasMore;
 el("training-load-more").disabled=fetching;
}
function filters(){
 return {q:el("training-search").value.trim().slice(0,120),
  category:el("training-category-filter").value,
  status:isAdmin(session())?el("training-status-filter").value:"published"};
}
async function load(more=false){
 const s=session();
 if(!canRead(s)){clear();return;}
 if(more&&(!hasMore||fetching))return;
 const f=filters(),next=JSON.stringify(f),changed=signature!==next;
 if(!more){
   generation++;
   if(changed){entries=[];loaded=0;hasMore=false;lastSync=0;}
   signature=next;
 }
 const g=generation,offset=more?loaded:0;
 fetching=true;phase("loading");if(changed)render();
 try{
   let request=s.client.from("training_materials")
     .select("id,title,description,storage_path,published,created_at,kind,category,body,reference_url,reviewed_at,updated_at,content_key")
     .order("created_at",{ascending:false}).order("id",{ascending:false});
   if(f.q)request=request.textSearch("search_index",f.q,{type:"websearch",config:"portuguese"});
   if(f.category)request=request.eq("category",f.category);
   if(!isAdmin(s)||f.status!=="all")
     request=request.eq("published",!isAdmin(s)||f.status==="published");
   const rows=await query(request.range(offset,offset+PAGE));
   if(!valid(g,s))return;
   const batch=rows.slice(0,PAGE);
   if(!more){entries=[];loaded=0;}
   const seen=new Set(entries.map(item=>item.id));
   for(const item of batch)if(!seen.has(item.id)){entries.push(item);seen.add(item.id);}
   loaded=offset+batch.length;hasMore=rows.length>PAGE;
   lastSync=Date.now();fetching=false;render();phase("ready");
 }catch(error){
   if(!valid(g,s))return;
   fetching=false;phase("error");render();
   message("Não foi possível consultar a biblioteca: "+error.message,true);
 }finally{if(valid(g,s))fetching=false;}
}
async function save(event){
 event.preventDefault();
 const s=session(),g=generation;if(!isAdmin(s)||editorBusy)return;
 const form=event.currentTarget,original=editItem,kindValue=el("training-kind").value;
 const body=el("training-body").value.trim(),file=el("training-file").files?.[0];
 const reviewed=el("training-reviewed").checked,published=el("training-published").checked;
 const ref=el("training-reference").value.trim();
 const title=el("training-title").value.trim(),description=el("training-description").value.trim();
 const category=el("training-category").value,button=el("training-save");
 const contentChanged=!original||(kindValue==="article"&&body!==original.body)||!!file;
 if(title.length<3||title.length>160||description.length>2000||
   !["article","file"].includes(kindValue)||ref&&!https(ref)||
   (kindValue==="article"&&(body.length<100||body.length>16000))||
   (kindValue==="file"&&!file&&!original)){
   message("Revise título, formato, conteúdo e referência HTTPS.",true);return;
 }
 if(file&&(!formats[file.type]||file.size<1||file.size>10485760)){
   message("Use PDF, PNG, JPG ou WebP de até 10 MB.",true);return;
 }
 if(published&&(contentChanged||!original?.reviewed_at)&&!reviewed){
   message("Confirme a revisão técnica do material antes de publicar esta versão.",true);return;
 }
 editorBusy=true;button.disabled=true;message("Registrando material…");
 let uploadedPath=null,uploaded=false;
 const still=()=>valid(g,s)&&isAdmin(session())&&editItem===original;
 try{
   let path=original?.storage_path||null;
   if(file){
     uploadedPath=crypto.randomUUID()+formats[file.type];path=uploadedPath;
     await query(s.client.storage.from(bucket).upload(path,file,
       {cacheControl:"60",upsert:false,contentType:file.type}));
     uploaded=true;
   }
   if(!still())throw new Error("O acesso ou o material em edição mudou durante o envio.");
   const payload={title,description,kind:kindValue,category,
     body:kindValue==="article"?body:"",
     reference_url:ref||null,storage_path:kindValue==="file"?path:null,
     published,reviewed_at:reviewed?today():(contentChanged?null:original?.reviewed_at||null)};
   const request=original?s.client.from("training_materials").update(payload)
     .eq("id",original.id).eq("updated_at",original.updated_at):
     s.client.from("training_materials").insert(payload);
   const saved=await query(request.select("id,storage_path,updated_at").maybeSingle());
   if(!saved)throw new Error("Outra edição pode ter sido salva antes desta. Atualize a biblioteca e confira a versão antes de reenviar.");
   if(!still())return;
   resetEditor();message(original?"Nova versão registrada.":"Material cadastrado.");
   await load();
 }catch(error){
   if(uploaded){
     let verification;
     try{
       verification=await query(s.client.from("training_materials")
         .select("id").eq("storage_path",uploadedPath).maybeSingle());
     }catch{verification=undefined;}
     if(verification){
       if(still()){
         resetEditor();message("Material salvo. A confirmação foi recuperada pela consulta.");
         await load();
       }
       return;
     }
     if(verification===null){
       try{await query(s.client.storage.from(bucket).remove([uploadedPath]));}
       catch{
         if(still())message("Não foi possível confirmar nem limpar o arquivo privado. "+
           "Peça revisão administrativa antes de reenviar.",true);
         return;
       }
     }else{
       if(still())message("Não foi possível confirmar a gravação do arquivo. "+
         "Não reenvie antes de verificar a biblioteca e o armazenamento privado.",true);
       return;
     }
   }
   if(still())message("Material não confirmado: "+error.message+
     " Atualize a biblioteca antes de repetir.",true);
 }finally{editorBusy=false;button.disabled=false;}
}
el("reload-training").addEventListener("click",()=>void load());
el("training-load-more").addEventListener("click",()=>void load(true));
el("training-search").addEventListener("input",()=>{
 if(searchTimer)clearTimeout(searchTimer);
 searchTimer=setTimeout(()=>{searchTimer=null;void load();},280);
});
el("training-category-filter").addEventListener("change",()=>void load());
el("training-status-filter").addEventListener("change",()=>void load());
el("training-kind").addEventListener("change",kind);
el("training-cancel").addEventListener("click",resetEditor);
el("training-form").addEventListener("submit",event=>void save(event));
document.addEventListener("proxiti-academy-refresh",()=>void load());
document.addEventListener("proxiti-session-ended",clear);
document.addEventListener("proxiti-session-ready",event=>{
 generation++;
 if(!canRead(event.detail)){clear();return;}
 if(!root.hidden)void load();
});
if(!canRead(session()))clear();
else{kind();if(!root.hidden)void load();}
})();
