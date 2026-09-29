(()=>{
"use strict";
const el=id=>document.getElementById(id);
const make=(tag,value,cls)=>{const n=document.createElement(tag);
 if(value!==undefined&&value!==null)n.textContent=String(value);
 if(cls)n.className=cls;return n;};
const view=()=>window.PROXITI_ACTIVE_SESSION||null;
const active=s=>s?.user?.id&&s.profile?.status==="active";
const admin=s=>active(s)&&s.profile.role==="administrator";
const tech=s=>active(s)&&s.profile.role==="technician";
const read=async p=>{const {data,error}=await p;if(error)throw error;return data;};
const when=value=>value?new Date(value).toLocaleString("pt-BR",{dateStyle:"short",timeStyle:"short"}):"—";
const money=cents=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(Number(cents||0)/100);
const message=(id,text,error=false)=>{const n=el(id);n.textContent=text;n.dataset.state=error?"error":"ready";};
const options=(id,items,placeholder,getId,getName)=>{
 const select=el(id),old=select.value;select.replaceChildren();
 const first=make("option",placeholder);first.value="";select.append(first);
 for(const row of items){const opt=make("option",getName(row));opt.value=getId(row);select.append(opt);}
 if(items.some(row=>getId(row)===old))select.value=old;
};
const record=(title,description)=>{
 const node=make("article",undefined,"customer-network-record");
 node.append(make("strong",title),make("p",description));return node;
};
const button=(label,fn)=>{
 const b=make("button",label,"secondary");b.type="button";b.addEventListener("click",fn);return b;
};
const noRows=(id,label)=>el(id).replaceChildren(make("p",label,"ops-muted"));
let epoch=0,portfolio=null,queue=null,approved=[],approvedQuotes=[],accounts=[],crm=[];
const match=(s,epochAt)=>s&&view()?.user?.id===s.user.id&&epochAt===epoch;
function clear(){
 epoch++;portfolio=null;queue=null;approved=[];approvedQuotes=[];accounts=[];crm=[];
 for(const id of ["partner-offer-list","partner-client-list","customer-network-schedules",
 "customer-network-preferences","customer-network-open-offers","customer-network-accounts-list"])
 el(id).replaceChildren();
 el("partner-portfolio").hidden=true;
 el("customer-network-admin").hidden=true;
 el("customer-network-accounts").hidden=true;
 el("partner-client-feedback-form").hidden=true;
}
async function loadPortfolio(){
 const s=view();if(!tech(s))return;const e=epoch,client=s.client;
 message("partner-portfolio-status","Consultando suas oportunidades e carteira…");
 try{
  const result=await read(client.rpc("proxiti_partner_my_portfolio"));
  if(!match(s,e))return;portfolio=result;
  renderPortfolio();message("partner-portfolio-status","Sua carteira foi atualizada.");
 }catch(error){if(match(s,e))message("partner-portfolio-status",
   "Não foi possível consultar a carteira: "+error.message,true);}
}
function renderPortfolio(){
 const offers=el("partner-offer-list"),clients=el("partner-client-list");
 offers.replaceChildren();clients.replaceChildren();
 const rows=portfolio?.opportunities||[];
 const offered=rows.filter(o=>o.status==="offered");
 el("partner-portfolio-count").textContent=offered.length?
  offered.length+" oferta(s) em aberto":"Sem ofertas pendentes";
 for(const offer of offered){
  const item=record("Chamado #"+offer.ticket_reference+" · "+offer.subject,
   (offer.modality==="remote"?"Remoto":"Presencial")+
   " · Remuneração oferecida: "+money(offer.agreed_cents)+
   " · Responder até: "+when(offer.expires_at));
  item.append(make("p",offer.scope),make("small","Condições: "+offer.agreement_reference));
  const actions=make("div",undefined,"customer-network-actions");
  actions.append(button("Aceitar oportunidade",()=>void decideOffer(offer,true)),
   button("Recusar",()=>void decideOffer(offer,false)));item.append(actions);offers.append(item);
 }
 if(!offered.length)noRows("partner-offer-list",
  "Nenhuma oportunidade pendente. Você continua livre para informar sua disponibilidade.");
 for(const t of portfolio?.tickets||[]){
  const item=record("Chamado #"+t.reference+" · "+t.subject,
   "Cliente do atendimento: "+t.customer_name+" · "+(t.status||"—")+
   " · Atualizado em "+when(t.updated_at));
  item.append(button("Abrir na fila",()=>{
   window.PROXITI_OPEN_VIEW?.("tickets");
   el("ticket-search").value=String(t.reference);
   el("ticket-search").dispatchEvent(new Event("input",{bubbles:true}));
  }));
  clients.append(item);
 }
 if(!(portfolio?.tickets||[]).length)noRows("partner-client-list",
  "Sua carteira ainda não tem atendimentos designados. Os dados aparecem depois do aceite e da autorização.");
 const r=portfolio?.ratings;
 if(r?.count)clients.prepend(make("p",
  "Avaliações recebidas: "+r.count+" · Média: "+r.average+" de 5","ops-muted"));
 const closed=(portfolio?.tickets||[]).filter(t=>["resolved","closed"].includes(t.status));
 options("partner-feedback-ticket",closed,"Escolha um atendimento concluído",
  t=>t.id,t=>"#"+t.reference+" · "+t.subject);
 el("partner-client-feedback-form").hidden=!closed.length;
}
async function decideOffer(offer,accept){
 const s=view();if(!tech(s))return;
 if(!window.confirm((accept?"Aceitar":"Recusar")+" a oportunidade do chamado #"+
  offer.ticket_reference+"? "+(accept?"Confirme que leu o escopo, a remuneração e as condições.":"")))
 return;
 try{
  const result=await read(s.client.rpc("proxiti_partner_offer_decide",
   {p_id:offer.id,p_accept:accept}));
  await loadPortfolio();
  message("partner-portfolio-status",result==="accepted"?
   "Oportunidade aceita. O chamado foi designado à sua carteira.":
   "Oportunidade recusada. A administração poderá encaminhá-la a outro profissional.");
  if(accept)document.dispatchEvent(new Event("proxiti-tickets-refresh"));
 }catch(error){message("partner-portfolio-status",
   "Não foi possível registrar a decisão: "+error.message,true);}
}
async function loadAdmin(){
 const s=view();if(!admin(s))return;const e=epoch,client=s.client;
 message("customer-network-admin-status","Consultando preferências e oportunidades…");
 try{
  const [q,quotes,partners]=await Promise.all([
   read(client.rpc("proxiti_customer_admin_queue")),
   read(client.from("commercial_quotes").select("id,reference,ticket_id,status,valid_until")
    .eq("status","accepted").order("created_at",{ascending:false}).limit(150)),
   read(client.rpc("proxiti_partner_admin_list"))]);
  if(!match(s,e))return;
  queue=q;approvedQuotes=quotes||[];approved=(partners||[]).filter(x=>
    x.status==="active"&&x.approved_for_assignment);
  renderAdmin();message("customer-network-admin-status","Encaminhamentos atualizados.");
 }catch(error){if(match(s,e))message("customer-network-admin-status",
  "Não foi possível consultar os encaminhamentos: "+error.message,true);}
}
function renderAdmin(){
 const schedules=el("customer-network-schedules"),prefs=el("customer-network-preferences"),
  offers=el("customer-network-open-offers");
 schedules.replaceChildren();prefs.replaceChildren();offers.replaceChildren();
 for(const r of queue?.requests||[]){
  const item=record("Chamado #"+r.ticket_reference+" · "+when(r.preferred_at),
   (r.modality==="remote"?"Remoto":"Presencial")+" · Solicitação aguardando confirmação");
  if(r.note)item.append(make("p",r.note));
  const actions=make("div",undefined,"customer-network-actions");
  actions.append(button("Ver agenda",()=>window.PROXITI_OPEN_VIEW?.("agenda")),
    button("Marcar em análise",()=>void reviewSchedule(r,"reviewed")),
    button("Não confirmar",()=>void reviewSchedule(r,"declined")));
  item.append(actions);schedules.append(item);
 }
 if(!(queue?.requests||[]).length)noRows("customer-network-schedules",
  "Nenhuma solicitação de horário pendente.");
 for(const p of queue?.preferences||[]){
  const item=record("Chamado #"+p.ticket_reference,
    "Profissional de preferência: "+p.partner_name+
    ". Consulte a disponibilidade antes de preparar uma oferta.");
  prefs.append(item);
 }
 if(!(queue?.preferences||[]).length)noRows("customer-network-preferences",
  "Nenhuma preferência solicitada em chamados abertos.");
 for(const offer of queue?.offers||[]){
  const item=record("Oferta · chamado #"+offer.ticket_reference,
   "Parceiro: "+(approved.find(x=>x.user_id===offer.partner_id)?.display_name||
    "Profissional autorizado")+" · Até "+when(offer.expires_at));
  item.append(button("Cancelar oferta pendente",()=>void cancelOffer(offer)));
  offers.append(item);
 }
 if(!(queue?.offers||[]).length)noRows("customer-network-open-offers",
  "Nenhuma oferta aguardando resposta.");
 options("customer-network-offer-quote",approvedQuotes.filter(q=>
  !(queue?.offers||[]).some(x=>x.ticket_id===q.ticket_id)),
  "Selecione uma proposta já aceita",q=>q.id,
  q=>"Proposta #"+q.reference+" · chamado vinculado");
 options("customer-network-offer-partner",approved,"Selecione um parceiro habilitado",
  p=>p.user_id,p=>p.display_name+(p.availability?" · "+p.availability:""));
}
async function reviewSchedule(request,next){
 const s=view();if(!admin(s))return;
 if(!window.confirm(next==="reviewed"?
   "Marcar o pedido como analisado? Isso NÃO confirma o agendamento. Registre um compromisso e confirme com o cliente pela Agenda.":
   "Recusar este pedido de horário? Informe a alternativa ao cliente pelo chamado."))return;
 try{
  await read(s.client.rpc("proxiti_customer_admin_review_schedule",{
    p_id:request.id,p_status:next}));
  await loadAdmin();message("customer-network-admin-status",next==="reviewed"?
    "Pedido analisado. A confirmação do compromisso ainda precisa ser registrada na Agenda.":
    "Pedido marcado como não confirmado. Oriente o cliente pelo chamado.");
 }catch(error){message("customer-network-admin-status",error.message,true);}
}
async function cancelOffer(offer){
 const s=view();if(!admin(s))return;
 if(!window.confirm("Cancelar esta oferta ainda pendente?"))return;
 try{await read(s.client.rpc("proxiti_partner_cancel_offer",{p_id:offer.id}));
  await loadAdmin();message("customer-network-admin-status","Oferta cancelada.");
 }catch(error){message("customer-network-admin-status",error.message,true);}
}
function parseCents(value){
 const str=String(value||"").trim();
 if(!/^(?:0|[1-9]\d{0,6})(?:,\d{1,2})?$/.test(str))
  throw new Error("Use um valor em reais, por exemplo 80,00, sem pontos de milhar.");
 const [integer,fraction=""]=str.split(",");
 const cents=Number(integer)*100+Number(fraction.padEnd(2,"0"));
 if(!Number.isSafeInteger(cents)||cents<1||cents>1000000000)
  throw new Error("Informe uma remuneração válida.");
 return cents;
}
async function loadAccounts(){
 const s=view();if(!admin(s))return;const e=epoch,client=s.client;
 message("customer-network-accounts-status","Consultando contas confirmadas…");
 try{
  const [a,c]=await Promise.all([
   read(client.rpc("proxiti_customer_admin_directory")),
   read(client.from("client_profiles").select("id,display_name,email,status")
    .eq("status","active").order("display_name").limit(500))]);
  if(!match(s,e))return;accounts=a||[];crm=c||[];
  renderAccounts();message("customer-network-accounts-status","Contas atualizadas.");
 }catch(error){if(match(s,e))message("customer-network-accounts-status",
  "Não foi possível carregar as contas: "+error.message,true);}
}
function renderAccounts(){
 const host=el("customer-network-accounts-list");host.replaceChildren();
 for(const a of accounts){
  const item=record(a.display_name,"E-mail: "+a.email+" · "+a.tickets+
   " chamado(s) vinculado(s) · "+(a.crm_client_id?"CRM vinculado":
   a.email_ownership_verified?"Identidade conferida · CRM ainda separado":
   "E-mail ainda não comprovado · não vincular ao CRM"));
  if(a.city)item.append(make("small","Região informada: "+a.city));
  host.append(item);
 }
 if(!accounts.length)noRows("customer-network-accounts-list",
  "Nenhum cliente criou conta na Minha PROXITI por enquanto.");
 options("customer-network-account",accounts.filter(a=>!a.crm_client_id&&a.email_ownership_verified),
  "Selecione uma conta com e-mail comprovado",a=>a.user_id,
  a=>a.display_name+" · "+a.email);
 options("customer-network-crm",crm,"Selecione o cadastro interno confirmado",
  c=>c.id,c=>c.display_name+" · "+c.email);
}
function activate(){
 const s=view();epoch++;
 el("partner-portfolio").hidden=!tech(s);
 el("customer-network-admin").hidden=!admin(s);
 el("customer-network-accounts").hidden=!admin(s);
 if(tech(s))void loadPortfolio();
 if(admin(s)){void loadAdmin();void loadAccounts();}
}
el("partner-portfolio-refresh").addEventListener("click",()=>void loadPortfolio());
el("customer-network-refresh").addEventListener("click",()=>void loadAdmin());
el("customer-network-accounts-refresh").addEventListener("click",()=>void loadAccounts());
el("partner-client-feedback-form").addEventListener("submit",async event=>{
 event.preventDefault();const s=view();if(!tech(s)||!event.currentTarget.reportValidity())return;
 try{
  await read(s.client.rpc("proxiti_partner_client_feedback",{
    p_ticket:el("partner-feedback-ticket").value,
    p_readiness:el("partner-feedback-readiness").value,
    p_communication:el("partner-feedback-communication").value,
    p_note:el("partner-feedback-note").value}));
  event.currentTarget.reset();message("partner-portfolio-status",
   "Registro factual salvo apenas para a operação interna.");
 }catch(error){message("partner-portfolio-status",error.message,true);}
});
el("customer-network-offer-form").addEventListener("submit",async event=>{
 event.preventDefault();const s=view();if(!admin(s)||!event.currentTarget.reportValidity())return;
 const quote=approvedQuotes.find(q=>q.id===el("customer-network-offer-quote").value);
 const partner=approved.find(p=>p.user_id===el("customer-network-offer-partner").value);
 if(!quote||!partner){message("customer-network-admin-status","Revise a proposta e o parceiro.",true);return;}
 let price;try{price=parseCents(el("customer-network-offer-value").value);}
 catch(error){message("customer-network-admin-status",error.message,true);return;}
 const modality=el("customer-network-offer-modality").value;
 if((modality==="remote"&&!partner.accepts_remote)||(modality==="on_site"&&!partner.accepts_on_site)){
  message("customer-network-admin-status","Este parceiro não está habilitado para a modalidade.",true);return;
 }
 const at=new Date(el("customer-network-offer-expiry").value);
 if(Number.isNaN(at.getTime())){message("customer-network-admin-status","Informe um prazo válido.",true);return;}
 if(!window.confirm("Enviar proposta ao parceiro "+partner.display_name+
  " por "+money(price)+"? Confirme o escopo e as condições antes de continuar."))return;
 try{
  await read(s.client.rpc("proxiti_partner_offer",{
    p_ticket:quote.ticket_id,p_quote:quote.id,p_partner:partner.user_id,
    p_scope:el("customer-network-offer-scope").value,p_modality:modality,
    p_agreed_cents:price,p_agreement:el("customer-network-offer-agreement").value,
    p_expiry:at.toISOString()}));
  event.currentTarget.reset();await loadAdmin();
  message("customer-network-admin-status",
   "Oportunidade oferecida. O parceiro poderá aceitar ou recusar na Central Técnica.");
 }catch(error){message("customer-network-admin-status",error.message,true);}
});
el("customer-network-link-crm").addEventListener("submit",async event=>{
 event.preventDefault();const s=view();if(!admin(s)||!event.currentTarget.reportValidity())return;
 const a=accounts.find(x=>x.user_id===el("customer-network-account").value),
   c=crm.find(x=>x.id===el("customer-network-crm").value);
 if(!a||!c||!a.email_ownership_verified||a.email?.toLowerCase()!==c.email?.toLowerCase()){
  message("customer-network-accounts-status",
   "A conta e o cadastro interno precisam ter o mesmo e-mail confirmado.",true);return;}
 if(!window.confirm("Vincular "+a.display_name+" ao cadastro interno "+c.display_name+
  "? Chamados já vinculados à conta serão associados ao CRM quando ainda não tiverem cadastro."))return;
 try{
  await read(s.client.rpc("proxiti_customer_admin_link_crm",{
    p_account:a.user_id,p_client:c.id}));
  await loadAccounts();message("customer-network-accounts-status","Conta vinculada ao CRM após confirmação.");
 }catch(error){message("customer-network-accounts-status",error.message,true);}
});
document.addEventListener("proxiti-session-ready",activate);
document.addEventListener("proxiti-session-ended",clear);
document.addEventListener("proxiti-view-changed",event=>{
 const name=event.detail?.view;
 if(name==="tickets"&&tech(view()))void loadPortfolio();
 if(name==="commercial"&&admin(view()))void loadAdmin();
 if(name==="clients"&&admin(view()))void loadAccounts();
});
if(view())activate();
})();