(()=>{
"use strict";
const root=document.getElementById("ops-clients");if(!root)return;
const el=id=>document.getElementById(id);
const state={client:null,uid:null,epoch:0,clients:[],tickets:[],audit:[],selected:null,loading:false};
const session=()=>window.PROXITI_ACTIVE_SESSION||null;
const admin=()=>session()?.profile?.role==="administrator"&&session()?.profile?.status==="active";
const valid=(client,uid,epoch)=>admin()&&state.client===client&&state.uid===uid&&state.epoch===epoch;
const text=(v,fallback="")=>String(v??fallback);
const fmtDate=v=>v?new Date(v).toLocaleString("pt-BR",{dateStyle:"short",timeStyle:"short"}):"—";
const money=v=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(Number(v||0)/100);
function make(tag,value,cls){const n=document.createElement(tag);if(value!==undefined&&value!==null)n.textContent=String(value);if(cls)n.className=cls;return n;}
function read(result){if(result?.error)throw result.error;return result?.data;}
function message(msg,error=false){const n=el("clients-status");n.textContent=msg;n.dataset.state=error?"error":"ready";}
function resetForm(){
 const f=el("clients-v16-form");f.reset();el("clients-v16-id").value="";
 el("clients-v16-type").value="person";el("clients-v16-channel").value="email";
 el("clients-v16-active").checked=true;el("clients-v16-form-title").textContent="Cadastrar cliente";
}
function setOptions(select,rows,placeholder,label){
 const old=select.value;select.replaceChildren();const first=document.createElement("option");
 first.value="";first.textContent=placeholder;select.append(first);
 for(const row of rows){const opt=document.createElement("option");opt.value=row.id;opt.textContent=label(row);select.append(opt);}
 if([...select.options].some(o=>o.value===old))select.value=old;
}
function clearAdmin(){
 state.epoch++;state.client=null;state.uid=null;state.clients=[];state.tickets=[];state.audit=[];state.selected=null;
 el("clients-v16-admin").hidden=true;el("clients-list").hidden=false;el("clients-v16-detail").hidden=true;
 el("clients-v16-list").replaceChildren();el("clients-v16-tickets").replaceChildren();el("clients-v16-audit").replaceChildren();
 resetForm();
}
function searchRows(){
 const q=el("clients-v16-search").value.trim().toLocaleLowerCase("pt-BR");
 const rows=!q?state.clients:state.clients.filter(c=>
  [c.display_name,c.organization,c.email,c.phone,c.city].some(v=>text(v).toLocaleLowerCase("pt-BR").includes(q)));
 el("clients-v16-search-status").textContent=rows.length+" "+(rows.length===1?"resultado":"resultados");
 return rows;
}
function renderRegistry(){
 const host=el("clients-v16-list");host.replaceChildren();
 const rows=searchRows();el("clients-v16-count").textContent=state.clients.length+" "+(state.clients.length===1?"cliente":"clientes");
 if(!rows.length){host.append(make("p",state.clients.length?"Nenhum cliente corresponde à pesquisa.":"Nenhum cliente cadastrado. Cadastre somente quando houver necessidade operacional.","clients-v16-empty"));return;}
 for(const c of rows){
  const card=make("article",null,"clients-v16-record");
  const head=make("div",null,"clients-v16-record-head");
  head.append(make("strong",c.display_name),make("span",c.status==="active"?"Ativo":"Inativo","clients-v16-state "+c.status));
  card.append(head);
  if(c.organization)card.append(make("p",c.organization));
  const contact=[c.email,c.phone].filter(Boolean).join(" · ");if(contact)card.append(make("small",contact));
  const meta=[c.customer_type==="business"?"Empresa / negócio":"Pessoa",c.city,c.preferred_channel==="whatsapp"?"WhatsApp":c.preferred_channel==="phone"?"Telefone":c.preferred_channel==="email"?"E-mail":"Outro"].filter(Boolean).join(" · ");
  card.append(make("small",meta,"clients-v16-muted"));
  const actions=make("div",null,"clients-v16-actions");
  const detail=make("button","Abrir histórico","secondary");detail.type="button";detail.addEventListener("click",()=>void openDetail(c.id));
  const edit=make("button","Editar","secondary");edit.type="button";edit.addEventListener("click",()=>editClient(c.id));
  actions.append(detail,edit);card.append(actions);host.append(card);
 }
}
function renderLinkChoices(){
 setOptions(el("clients-v16-link-client"),state.clients.filter(c=>c.status==="active"),"Selecione um cliente ativo",c=>c.display_name+(c.email?" · "+c.email:""));
 setOptions(el("clients-v16-link-ticket"),state.tickets.filter(t=>!t.client_id),"Selecione um chamado sem vínculo",t=>"#"+t.reference+" · "+t.customer_name+" · "+t.subject);
}
function editClient(id){
 const c=state.clients.find(x=>x.id===id);if(!c)return;
 el("clients-v16-id").value=c.id;el("clients-v16-name").value=c.display_name;
 el("clients-v16-type").value=c.customer_type;el("clients-v16-organization").value=c.organization||"";
 el("clients-v16-email").value=c.email||"";el("clients-v16-phone").value=c.phone||"";
 el("clients-v16-channel").value=c.preferred_channel;el("clients-v16-city").value=c.city||"";
 el("clients-v16-notes").value=c.internal_notes||"";el("clients-v16-active").checked=c.status==="active";
 el("clients-v16-form-title").textContent="Editar cliente";
 el("clients-v16-form").scrollIntoView({behavior:"smooth",block:"start"});el("clients-v16-name").focus();
}
function eventLabel(action){return ({created:"Cadastro criado",updated:"Cadastro atualizado",ticket_linked:"Chamado vinculado",ticket_unlinked:"Chamado desvinculado"})[action]||action;}
async function openDetail(id){
 const s=session(),client=s?.client,uid=s?.user?.id,epoch=state.epoch;if(!valid(client,uid,epoch))return;
 const c=state.clients.find(x=>x.id===id);if(!c)return;
 state.selected=id;el("clients-v16-detail").hidden=false;el("clients-v16-detail-title").textContent=c.display_name;
 const summary=el("clients-v16-summary");summary.replaceChildren();summary.append(make("p","Consultando histórico consolidado…","clients-v16-muted"));
 try{
  const data=await read(await client.rpc("proxiti_client_summary",{p_client:id}));
  if(!valid(client,uid,epoch)||state.selected!==id)return;
  summary.replaceChildren();
  const metrics=[["Chamados vinculados",data.tickets],["Chamados abertos",data.open_tickets],["Orçamentos",data.quotes],["Propostas aceitas",money(data.accepted_cents)],["Recebido líquido registrado",money(data.received_cents)]];
  for(const [label,value] of metrics){const a=make("article");a.append(make("span",label),make("strong",value));summary.append(a);}
  const ticketsHost=el("clients-v16-tickets");ticketsHost.replaceChildren();
  const linked=state.tickets.filter(t=>t.client_id===id);
  if(!linked.length)ticketsHost.append(make("p","Nenhum chamado vinculado.","clients-v16-empty"));
  for(const t of linked){
   const card=make("article",null,"clients-v16-mini");
   card.append(make("strong","#"+t.reference+" · "+t.subject),make("small",t.status+" · "+fmtDate(t.created_at)));
   const actions=make("div",null,"clients-v16-actions");
   const open=make("button","Abrir em Chamados","secondary");open.type="button";open.addEventListener("click",()=>{
    el("ticket-search").value=String(t.reference);el("ticket-search").dispatchEvent(new Event("input",{bubbles:true}));
    window.PROXITI_OPEN_VIEW?.("tickets");
   });
   const unlink=make("button","Desvincular","secondary");unlink.type="button";unlink.addEventListener("click",()=>void unlinkTicket(id,t.id));
   actions.append(open,unlink);card.append(actions);ticketsHost.append(card);
  }
  const auditHost=el("clients-v16-audit");auditHost.replaceChildren();
  const rows=state.audit.filter(a=>a.client_id===id).slice(0,40);
  if(!rows.length)auditHost.append(make("p","Nenhuma alteração administrativa registrada.","clients-v16-empty"));
  for(const e of rows){const card=make("article",null,"clients-v16-mini");card.append(make("strong",eventLabel(e.action)),make("small",fmtDate(e.created_at)));auditHost.append(card);}
  el("clients-v16-detail").scrollIntoView({behavior:"smooth",block:"start"});
 }catch(error){if(valid(client,uid,epoch)){summary.replaceChildren(make("p","Não foi possível consultar o histórico: "+error.message,"clients-v16-empty"));}}
}
async function load(){
 const s=session();if(!admin()){el("clients-v16-admin").hidden=true;el("clients-list").hidden=false;return;}
 const client=s.client,uid=s.user.id,epoch=++state.epoch;state.client=client;state.uid=uid;state.loading=true;
 el("clients-v16-admin").hidden=false;el("clients-list").hidden=true;message("Consultando cadastro consolidado…");
 try{
  const [clients,tickets,audit]=await Promise.all([
   read(await client.from("client_profiles").select("id,display_name,customer_type,organization,email,phone,preferred_channel,city,internal_notes,status,created_at,updated_at").order("display_name").limit(1000)),
   read(await client.from("support_tickets").select("id,reference,customer_name,customer_email,customer_phone,subject,status,client_id,created_at").order("created_at",{ascending:false}).limit(500)),
   read(await client.from("client_profile_audit").select("id,client_id,action,created_at").order("id",{ascending:false}).limit(1000))
  ]);
  if(!valid(client,uid,epoch))return;
  state.clients=clients||[];state.tickets=tickets||[];state.audit=audit||[];
  renderRegistry();renderLinkChoices();message("Cadastro atualizado. Vincule chamados somente após confirmar a identidade do cliente.");
  if(state.selected&&state.clients.some(c=>c.id===state.selected))void openDetail(state.selected);
 }catch(error){
  if(valid(client,uid,epoch)){message("Cadastro de clientes indisponível: "+error.message,true);el("clients-v16-list").replaceChildren(make("p","Não foi possível carregar o cadastro administrativo.","clients-v16-empty"));}
 }finally{if(valid(client,uid,epoch))state.loading=false;}
}
async function save(event){
 event.preventDefault();const s=session();if(!admin())return;
 const payload={p_id:el("clients-v16-id").value||null,p_name:el("clients-v16-name").value,p_type:el("clients-v16-type").value,
  p_organization:el("clients-v16-organization").value,p_email:el("clients-v16-email").value,p_phone:el("clients-v16-phone").value,
  p_channel:el("clients-v16-channel").value,p_city:el("clients-v16-city").value,p_notes:el("clients-v16-notes").value,
  p_status:el("clients-v16-active").checked?"active":"inactive"};
 if(!payload.p_email.trim()&&!payload.p_phone.trim()){message("Informe ao menos e-mail ou telefone para identificar o contato.",true);return;}
 const button=event.submitter;button.disabled=true;message("Salvando cadastro…");
 try{await read(await s.client.rpc("proxiti_client_save",payload));resetForm();await load();message("Cliente salvo. Nenhum chamado foi vinculado automaticamente.");}
 catch(error){message("Não foi possível salvar: "+error.message,true);}finally{button.disabled=false;}
}
async function link(event){
 event.preventDefault();const s=session();if(!admin())return;
 const p_client=el("clients-v16-link-client").value,p_ticket=el("clients-v16-link-ticket").value;if(!p_client||!p_ticket)return;
 const ticket=state.tickets.find(t=>t.id===p_ticket),client=state.clients.find(c=>c.id===p_client);
 if(!window.confirm("Vincular o chamado #"+ticket.reference+" ("+ticket.customer_name+") ao cadastro "+client.display_name+"?"))return;
 event.submitter.disabled=true;message("Registrando vínculo…");
 try{await read(await s.client.rpc("proxiti_client_link_ticket",{p_client,p_ticket}));await load();state.selected=p_client;await openDetail(p_client);message("Chamado vinculado ao cadastro confirmado.");}
 catch(error){message("Não foi possível vincular: "+error.message,true);}finally{event.submitter.disabled=false;}
}
async function unlinkTicket(clientId,ticketId){
 const s=session();if(!admin())return;
 const t=state.tickets.find(x=>x.id===ticketId);if(!window.confirm("Desvincular o chamado #"+(t?.reference??"—")+" deste cadastro? O chamado não será apagado."))return;
 message("Removendo vínculo…");
 try{await read(await s.client.rpc("proxiti_client_unlink_ticket",{p_client:clientId,p_ticket:ticketId}));await load();state.selected=clientId;await openDetail(clientId);message("Vínculo removido. O chamado e seu histórico foram preservados.");}
 catch(error){message("Não foi possível desvincular: "+error.message,true);}
}
el("clients-v16-form").addEventListener("submit",event=>void save(event));
el("clients-v16-link-form").addEventListener("submit",event=>void link(event));
el("clients-v16-reset").addEventListener("click",resetForm);
el("clients-v16-refresh").addEventListener("click",()=>void load());
el("clients-v16-search").addEventListener("input",renderRegistry);
el("clients-v16-close-detail").addEventListener("click",()=>{state.selected=null;el("clients-v16-detail").hidden=true;});
document.addEventListener("proxiti-session-ready",()=>{if(!root.hidden)void load();});
document.addEventListener("proxiti-session-ended",clearAdmin);
document.addEventListener("proxiti-view-changed",event=>{if(event.detail?.view==="clients")queueMicrotask(()=>void load());});
window.PROXITI_CLIENTS_V16={load};
})();