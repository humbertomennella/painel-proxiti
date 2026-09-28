/* PROXITI V15 | Operação comercial privada. Não faz checkout nem emissão fiscal. */
(()=>{
"use strict";
const el=id=>document.getElementById(id),root=el("ops-commercial");
const core=window.PROXITI_COMMERCIAL_CORE;
if(!root||!core)return;
const state={client:null,uid:null,epoch:0,loading:false,services:[],tickets:[],quotes:[],
 staff:[],detail:null,selected:null,offset:0,hasMore:false,prefill:null};
const name={draft:"Rascunho",issued:"Enviado / aguardando",accepted:"Aceito",
 declined:"Recusado",cancelled:"Cancelado"};
const channels={email:"E-mail",whatsapp:"WhatsApp",phone:"Telefone",
 in_person:"Presencial",other:"Outro"};
const methods={pix:"Pix",card:"Cartão",bank_transfer:"Transferência",cash:"Dinheiro",other:"Outro"};
const eventLabels={created:"Rascunho criado",item_added:"Serviço incluído",
 item_removed:"Serviço removido",issued:"Envio registrado",accepted:"Aceite registrado",
 declined:"Recusa registrada",cancelled:"Cancelamento registrado",
 receipt_recorded:"Recebimento registrado",refund_recorded:"Estorno registrado",
 payout_planned:"Repasse planejado",payout_recorded:"Pagamento de repasse registrado"};
const active=()=>window.PROXITI_ACTIVE_SESSION;
const admin=()=>active()?.profile?.role==="administrator"&&active()?.profile?.status==="active";
const ok=(client=state.client,uid=state.uid,epoch=state.epoch)=>
 !!client&&client===active()?.client&&uid===active()?.user?.id&&epoch===state.epoch&&admin();
const make=(tag,text="",cls="")=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=String(text);if(cls)n.className=cls;return n;};
const money=value=>core.asMoney(Number(value||0));
const timestamp=value=>value?new Date(value).toLocaleString("pt-BR",{dateStyle:"short",timeStyle:"short"}):"—";
const shortDate=value=>value?new Date(value+"T12:00:00").toLocaleDateString("pt-BR"):"—";
const read=promise=>Promise.resolve(promise).then(r=>{if(r.error)throw Error(r.error.message);return r.data;});
function feedback(message="",error=false){
 const node=el("commercial-feedback");node.textContent=message;
 node.className="message"+(error?" error":message?" success":"");
}
function empty(message){return make("p",message,"commercial-empty");}
function setOptions(node,items,placeholder,selected="",format){
 node.replaceChildren(new Option(placeholder,""));
 for(const item of items){const value=String(item.id),opt=new Option(format(item),value);node.add(opt);}
 node.value=selected&&[...node.options].some(o=>o.value===selected)?selected:"";
}
function resetService(){
 const f=el("commercial-service-form");f.reset();
 el("commercial-service-id").value="";
 el("commercial-service-unit").value="serviço";
 el("commercial-service-active").checked=true;
 f.querySelector('button[type="submit"]').textContent="Salvar serviço";
}
function clear(){
 state.epoch++;state.client=null;state.uid=null;state.loading=false;state.services=[];
 state.tickets=[];state.quotes=[];state.staff=[];state.detail=null;state.selected=null;
 state.offset=0;state.hasMore=false;state.prefill=null;
 resetService();el("commercial-create-form").reset();el("commercial-add-item-form").reset();
 el("commercial-transition-form").reset();el("commercial-payment-form").reset();
 el("commercial-payout-form").reset();
 el("commercial-services-list").replaceChildren();el("commercial-items").replaceChildren();
 el("commercial-payments-list").replaceChildren();el("commercial-payouts-list").replaceChildren();
 el("commercial-events-list").replaceChildren();el("commercial-quote-summary").replaceChildren();
 el("commercial-totals").replaceChildren();
 el("commercial-services-count").textContent="";
 for(const id of ["commercial-kpi-quotes","commercial-kpi-approved","commercial-kpi-received",
   "commercial-kpi-planned","commercial-kpi-paid"])el(id).textContent="—";
 for(const [id,placeholder] of [["commercial-ticket","Selecione um chamado autorizado"],
   ["commercial-parent","Orçamento principal"],["commercial-quotes","Nenhum orçamento selecionado"],
   ["commercial-item-service","Selecione um serviço ativo"],["commercial-payout-partner","Selecione o responsável"]])
   setOptions(el(id),[],placeholder);
 el("commercial-detail").hidden=true;el("commercial-more").hidden=true;
 el("commercial-quote-status").textContent="Selecione um orçamento.";
 feedback();
}
function begin(session){
 if(!session?.user||session.profile?.role!=="administrator"||session.profile?.status!=="active"){
   clear();return;
 }
 if(state.uid!==session.user.id||state.client!==session.client){
   clear();state.client=session.client;state.uid=session.user.id;
 }
 if(!root.hidden)void refresh();
}
function renderCatalog(){
 const host=el("commercial-services-list");host.replaceChildren();
 el("commercial-services-count").textContent=state.services.length+
 (state.services.length===1?" serviço cadastrado":" serviços cadastrados");
 if(!state.services.length){host.append(empty("Catálogo vazio. Cadastre primeiro um serviço com valores reais."));}
 for(const service of state.services){
   const card=make("article","","commercial-record"),top=make("div","","commercial-record-top");
   const label=make("strong",service.code+" · "+service.title),status=make("em",service.active?"Ativo":"Inativo");
   top.append(label,status);card.append(top);
   card.append(make("p",service.description||"Escopo ainda não informado."),
     make("small","Preço "+money(service.price_cents)+" / "+service.unit_label+
       " · Custo interno estimado "+money(service.internal_cost_cents)+
       " · Repasse estimado "+money(service.partner_cost_cents)));
   const edit=make("button","Editar serviço","secondary");edit.type="button";
   edit.addEventListener("click",()=>{
     if(!ok())return;
     el("commercial-service-id").value=service.id;
     el("commercial-service-code").value=service.code;
     el("commercial-service-title").value=service.title;
     el("commercial-service-description").value=service.description||"";
     el("commercial-service-unit").value=service.unit_label;
     el("commercial-service-minutes").value=service.estimated_minutes??"";
     for(const [id,key] of [["commercial-service-price","price_cents"],
       ["commercial-service-internal","internal_cost_cents"],
       ["commercial-service-partner","partner_cost_cents"]]){
       const cents=Number(service[key]);el(id).value=Math.floor(cents/100)+","+
         String(cents%100).padStart(2,"0");
     }
     el("commercial-service-active").checked=!!service.active;
     el("commercial-service-form").querySelector('button[type="submit"]').textContent="Salvar alterações";
     el("commercial-service-form").scrollIntoView({behavior:"smooth",block:"start"});
     el("commercial-service-title").focus();
   });
   card.append(edit);host.append(card);
 }
 const activeServices=state.services.filter(s=>s.active);
 const itemSelect=el("commercial-item-service"),old=itemSelect.value;
 setOptions(itemSelect,activeServices,"Selecione um serviço ativo",old,
  item=>item.code+" · "+item.title+" · "+money(item.price_cents));
}
function renderTicketChoices(){
 const ticket=el("commercial-ticket"),old=state.prefill||ticket.value;
 setOptions(ticket,state.tickets.filter(t=>t.status!=="closed"),
  "Selecione um chamado autorizado",old,t=>"#"+t.reference+" · "+t.subject);
 if(state.prefill&&ticket.value===state.prefill)state.prefill=null;
 renderParentChoices();
}
function renderParentChoices(){
 const ticket=el("commercial-ticket").value,select=el("commercial-parent"),old=select.value;
 setOptions(select,state.quotes.filter(q=>q.ticket_id===ticket&&q.status==="accepted"),
 "Orçamento principal (sem aditivo)",old,q=>"Proposta #"+q.reference+" · aceita");
}
function renderQuotes(){
 const select=el("commercial-quotes"),old=state.selected||select.value;
 setOptions(select,state.quotes,"Selecione um orçamento",old,q=>{
   const ticket=state.tickets.find(t=>t.id===q.ticket_id);
   return "Proposta #"+q.reference+" · Chamado #"+(ticket?.reference??"—")+
     " · "+(name[q.status]||q.status);
 });
 el("commercial-more").hidden=!state.hasMore;
}
function renderSummary(data){
 const pairs=[
 ["commercial-kpi-quotes",String(data.quotes??0)],
 ["commercial-kpi-approved",money(data.accepted_cents)],
 ["commercial-kpi-received",money(data.received_cents)],
 ["commercial-kpi-planned",money(data.payout_planned_cents)],
 ["commercial-kpi-paid",money(data.payout_recorded_cents)]];
 for(const [id,value] of pairs)el(id).textContent=value;
}
async function refresh({keepDetail=true}={}){
 if(!admin())return clear();
 if(state.loading)return;
 state.loading=true;
 const client=active().client,uid=active().user.id,epoch=state.epoch;
 feedback("Atualizando serviços, chamados, orçamentos e indicadores…");
 try{
   const [services,tickets,staff,quotes,summary]=await Promise.all([
     read(client.from("commercial_services").select("id,code,title,description,unit_label,price_cents,internal_cost_cents,partner_cost_cents,estimated_minutes,active").order("title").limit(500)),
     read(client.from("support_tickets").select("id,reference,subject,customer_name,status,assigned_to").order("created_at",{ascending:false}).limit(500)),
     read(client.from("profiles").select("id,display_name,role,status").eq("status","active").limit(500)),
     read(client.from("commercial_quotes").select("id,reference,ticket_id,parent_quote_id,status,valid_until,created_at").order("created_at",{ascending:false}).range(0,99)),
     read(client.rpc("proxiti_commercial_summary"))
   ]);
   if(!ok(client,uid,epoch))return;
   state.services=services||[];state.tickets=tickets||[];state.staff=staff||[];
   state.quotes=quotes||[];state.offset=state.quotes.length;state.hasMore=state.quotes.length===100;
   renderCatalog();renderTicketChoices();renderQuotes();renderSummary(summary);
   feedback("Dados atualizados. Operações financeiras exigem administrador autenticado com MFA.");
   if(keepDetail&&state.selected)await selectQuote(state.selected);
 }catch(error){
   if(ok(client,uid,epoch)){
     feedback("Não foi possível confirmar todos os dados. Tente Atualizar. "+error.message,true);
     for(const id of ["commercial-kpi-quotes","commercial-kpi-approved","commercial-kpi-received",
       "commercial-kpi-planned","commercial-kpi-paid"])el(id).textContent="—";
   }
 }finally{if(ok(client,uid,epoch))state.loading=false;}
}
async function loadMore(){
 if(!ok()||state.loading||!state.hasMore)return;
 state.loading=true;const client=state.client,uid=state.uid,epoch=state.epoch,from=state.offset;
 const button=el("commercial-more");button.disabled=true;
 try{
   const rows=await read(client.from("commercial_quotes")
     .select("id,reference,ticket_id,parent_quote_id,status,valid_until,created_at")
     .order("created_at",{ascending:false}).range(from,from+99));
   if(!ok(client,uid,epoch))return;
   state.quotes.push(...(rows||[]));state.offset+=rows.length;state.hasMore=rows.length===100;
   renderQuotes();feedback("Histórico carregado: "+state.quotes.length+" orçamentos.");
 }catch(error){if(ok(client,uid,epoch))feedback(error.message,true);}
 finally{if(ok(client,uid,epoch)){state.loading=false;button.disabled=false;}}
}
function safeField(node,text){node.append(make("span",text));}
function renderDetail(){
 const d=state.detail,rootDetail=el("commercial-detail");
 rootDetail.hidden=!d;
 if(!d){el("commercial-quote-status").textContent="Selecione um orçamento.";return;}
 const q=d.quote,t=d.ticket||{},issued=q.status!=="draft",accepted=q.status==="accepted";
 const status=name[q.status]||q.status;const expired=q.status==="issued"&&q.valid_until<
   new Date().toISOString().slice(0,10);
 el("commercial-quote-status").textContent="Proposta #"+q.reference+" · "+status+
   (expired?" · Validade encerrada. Não registre aceite de proposta vencida.":"");
 const sum=el("commercial-quote-summary");sum.replaceChildren();
 sum.append(make("strong","Chamado #"+t.reference+" · "+t.subject),
   make("span","Cliente: "+t.customer_name),
   make("small","Situação: "+status+" · Validade: "+shortDate(q.valid_until)+
     (q.parent_quote_id?" · Aditivo vinculado a proposta anterior":"")),
   make("small","Documento emitido: "+timestamp(q.issued_at)));
 if(q.client_notes)sum.append(make("p","Condições ao cliente: "+q.client_notes));
 if(q.internal_notes)sum.append(make("small","Nota interna (não imprimir): "+q.internal_notes));
 const items=el("commercial-items");items.replaceChildren();
 for(const item of d.items||[]){
   const card=make("article","","commercial-record"),top=make("div","","commercial-record-top");
   top.append(make("strong",item.title_snapshot),
     make("em",item.quantity+" × "+money(item.unit_price_cents)));
   card.append(top,make("p",item.scope_snapshot||"Escopo não informado."),
     make("small","Subtotal do cliente: "+
       money(core.lineCents(item.quantity,item.unit_price_cents))+
       " · Custo interno previsto: "+money(core.lineCents(item.quantity,item.unit_internal_cost_cents))+
       " · Repasse estimado: "+money(core.lineCents(item.quantity,item.unit_partner_cost_cents))));
   if(!issued){
     const remove=make("button","Remover item","secondary");remove.type="button";
     remove.addEventListener("click",()=>void perform(
       "Remover este item do rascunho?", "proxiti_commercial_remove_item",
       {p_item:item.id},"Item removido."));
     card.append(remove);
   }
   items.append(card);
 }
 if(!(d.items||[]).length)items.append(empty("Este rascunho ainda não tem serviços."));
 const total=el("commercial-totals");total.replaceChildren();
 const totalCents=Number(d.total_cents)||0,internal=Number(d.internal_cost_cents)||0,
   partner=Number(d.partner_estimate_cents)||0;
 for(const [label,value,cls] of [
   ["Total da proposta",money(totalCents),"primary"],
   ["Custo interno estimado",money(internal),""],
   ["Repasse estimado",money(partner),""],
   ["Resultado estimado antes de outras despesas e tributos",money(totalCents-internal-partner),""],
   ["Recebimento líquido registrado",money(core.paymentNet(d.payments)),""]]){
   const row=make("div","","commercial-total-row"+(cls?" "+cls:""));
   row.append(make("span",label),make("strong",value));total.append(row);
 }
 const form=el("commercial-add-item-form");form.hidden=issued;
 el("commercial-transition-form").hidden=!["draft","issued"].includes(q.status);
 renderTransitions(q,expired);
 el("commercial-finance").hidden=!accepted;
 renderFinance(d);
}
function renderTransitions(q,expired){
 const host=el("commercial-transitions");host.replaceChildren();
 const options=q.status==="draft"?[["issued","Registrar envio"],["cancelled","Cancelar rascunho"]]:
 q.status==="issued"?[["accepted","Registrar aceite do cliente"],["declined","Registrar recusa"],
   ["cancelled","Cancelar proposta"]]:[];
 for(const [next,label] of options){
   const btn=make("button",label,next==="issued"||next==="accepted"?"primary":"secondary");
   btn.type="button";btn.disabled=next==="accepted"&&expired;
   btn.addEventListener("click",()=>{
     const form=el("commercial-transition-form");if(!form.reportValidity())return;
     const channel=el("commercial-confirmation-channel").value,
       evidence=el("commercial-confirmation-proof").value.trim();
     const sentence=next==="accepted"?
       "Você recebeu a confirmação real do cliente e registrou uma referência verificável?":
       next==="issued"?"A proposta foi enviada por este canal? Nada será enviado automaticamente.":
       "Confirma o registro desta decisão no histórico?";
     void perform(sentence,"proxiti_commercial_transition_quote",
       {p_quote:q.id,p_next:next,p_channel:channel,p_evidence:evidence},
       next==="accepted"?"Aceite registrado com evidência.":"Movimentação registrada.");
   });host.append(btn);
 }
}
function renderFinance(d){
 const payments=el("commercial-payments-list");payments.replaceChildren();
 for(const p of d.payments||[]){
   const card=make("article","","commercial-record");
   card.append(make("strong",(p.kind==="received"?"Recebimento":"Estorno")+" · "+
      money(p.amount_cents)),make("small",(methods[p.method]||p.method)+
      " · "+timestamp(p.occurred_at)),make("p","Referência: "+p.reference));
   payments.append(card);
 }
 if(!d.payments?.length)payments.append(empty("Nenhum recebimento ou estorno registrado."));
 const pay=el("commercial-payout-partner"),assigned=d.ticket?.assigned_to,
   partner=state.staff.find(s=>s.id===assigned&&s.role==="technician"&&s.status==="active");
 setOptions(pay,partner?[partner]:[],"Parceiro responsável atribuído",pay.value,
   s=>s.display_name||"Técnico parceiro");
 const list=el("commercial-payouts-list");list.replaceChildren();
 for(const p of d.payouts||[]){
   const card=make("article","","commercial-record"),
     staff=state.staff.find(s=>s.id===p.partner_id);
   card.append(make("strong",money(p.agreed_cents)+" · "+
     (p.status==="paid"?"Pagamento registrado":"Repasse planejado")),
     make("small","Parceiro: "+(staff?.display_name||"Profissional cadastrado")),
     make("p","Acordo: "+p.agreement_reference),
     make("small",p.status==="paid"?"Referência: "+p.paid_reference+
       " · "+timestamp(p.paid_at):"Aguardando registro de transferência efetivamente realizada."));
   if(p.status==="planned"){
     const button=make("button","Registrar como pago","secondary");button.type="button";
     button.addEventListener("click",()=>{
       if(!ok())return;
       const ref=window.prompt("Informe a referência do comprovante da transferência efetivamente realizada:");
       if(ref===null)return;
       const proof=ref.trim();
       if(proof.length<6||proof.length>200){feedback("Referência de 6 a 200 caracteres necessária.",true);return;}
       void perform("Você confirma que transferiu "+money(p.agreed_cents)+
         " para o parceiro e possui o comprovante?","proxiti_commercial_mark_payout",
         {p_payout:p.id,p_reference:proof},"Repasse registrado como pago.");
     });card.append(button);
   }
   list.append(card);
 }
 if(!d.payouts?.length)list.append(empty("Nenhum repasse planejado. Registre apenas acordos efetivamente definidos."));
 const audit=el("commercial-events-list");audit.replaceChildren();
 for(const event of d.events||[]){
   const card=make("article","","commercial-record");
   card.append(make("strong",eventLabels[event.action]||event.action),
     make("small",timestamp(event.created_at)));
   if(event.detail?.channel)card.append(make("small","Canal: "+
     (channels[event.detail.channel]||"Outro")));
   if(event.detail?.reference)card.append(make("p","Referência: "+event.detail.reference));
   audit.append(card);
 }
 if(!d.events?.length)audit.append(empty("Sem movimentações registradas."));
}
async function selectQuote(id){
 if(!admin())return clear();
 if(!id){state.selected=null;state.detail=null;el("commercial-detail").hidden=true;
   el("commercial-quote-status").textContent="Selecione um orçamento.";return;}
 const client=state.client,uid=state.uid,epoch=state.epoch;
 state.selected=id;state.detail=null;el("commercial-detail").hidden=true;
 el("commercial-quote-status").textContent="Consultando o documento e os valores no servidor…";
 try{
   const detail=await read(client.rpc("proxiti_commercial_quote_detail",{p_quote:id}));
   if(!ok(client,uid,epoch)||state.selected!==id)return;
   if(!detail?.quote||detail.quote.id!==id)throw Error("Detalhes inconsistentes.");
   state.detail=detail;renderDetail();
 }catch(error){if(ok(client,uid,epoch)&&state.selected===id)
   feedback("Não foi possível consultar o orçamento. "+error.message,true);}
}
async function afterMutation(message,quoteId=state.selected){
 if(!ok())return;
 feedback(message);
 await refresh({keepDetail:false});
 if(!ok())return;
 if(quoteId){state.selected=quoteId;el("commercial-quotes").value=quoteId;
   await selectQuote(quoteId);}
}
async function perform(question,rpc,args,success,quoteId=state.selected){
 if(!admin()||!state.client||!ok())return;
 if(!window.confirm(question))return;
 const client=state.client,uid=state.uid,epoch=state.epoch;
 feedback("Enviando o registro ao servidor. Aguarde a confirmação.");
 try{
   await read(client.rpc(rpc,args));
   if(!ok(client,uid,epoch))return;
   await afterMutation(success,quoteId);
 }catch(error){if(ok(client,uid,epoch))
   feedback("Não houve confirmação. Confira o histórico antes de repetir. "+error.message,true);}
}
function printQuote(){
 if(!ok()||!state.detail)return;
 const d=state.detail,q=d.quote,t=d.ticket,items=d.items||[];
 if(!items.length){feedback("Adicione serviços antes de imprimir a proposta.",true);return;}
 const popup=window.open("","_blank");
 if(!popup){feedback("O navegador bloqueou a janela de impressão.",true);return;}
 popup.opener=null;
 const doc=popup.document;doc.title="Proposta #"+q.reference+" · PROXITI";
 const style=make("style","body{font:15px/1.55 Arial,sans-serif;color:#14263c;padding:30px;max-width:900px;margin:auto}"+
   "h1{font-size:25px;margin:0 0 7px}h2{font-size:19px}small{color:#546579}"+
   "table{width:100%;border-collapse:collapse;margin:18px 0}th,td{border-bottom:1px solid #dae0e8;padding:9px;text-align:left;vertical-align:top}"+
   ".total{text-align:right;font-size:23px;font-weight:bold}.note{white-space:pre-wrap}"+
   ".draft{padding:10px;border:2px solid #b75039;color:#9b3c28;font-weight:bold}"+
   "button{padding:10px 16px;margin-top:18px}@media print{button{display:none}body{padding:0}}");
 doc.head.append(style);
 const h=make("header");h.append(make("small","PROXITI · SERVIÇOS DE TECNOLOGIA"),
   make("h1","Proposta de atendimento #"+q.reference),
   make("p","Chamado #"+t.reference+" · "+t.subject),
   make("p","Destinatário: "+t.customer_name),
   make("p","Validade: "+shortDate(q.valid_until)));
 if(q.status==="draft")h.append(make("p","RASCUNHO INTERNO · NÃO ENVIAR","draft"));
 doc.body.append(h);
 const table=make("table"),head=make("thead"),tr=make("tr");
 for(const title of ["Serviço e escopo","Quantidade","Valor unitário","Subtotal"])tr.append(make("th",title));
 head.append(tr);table.append(head);
 const body=make("tbody");
 for(const item of items){
   const line=make("tr"),description=make("td");
   description.append(make("strong",item.title_snapshot));
   if(item.scope_snapshot)description.append(make("p",item.scope_snapshot));
   line.append(description,make("td",item.quantity+" "+item.unit_snapshot),
     make("td",money(item.unit_price_cents)),
     make("td",money(core.lineCents(item.quantity,item.unit_price_cents))));
   body.append(line);
 }
 table.append(body);doc.body.append(table);
 doc.body.append(make("p","Total: "+money(d.total_cents),"total"));
 if(q.client_notes){doc.body.append(make("h2","Condições da proposta"),
   make("p",q.client_notes,"note"));}
 if(q.parent_quote_id)doc.body.append(make("p",
   "Esta proposta é um aditivo vinculado a orçamento anterior; os itens e valores são adicionais."));
 doc.body.append(make("small","A proposta não equivale a nota fiscal, pagamento confirmado ou autorização automática de intervenção."));
 const print=make("button","Imprimir / Salvar PDF");print.type="button";
 print.addEventListener("click",()=>popup.print());doc.body.append(print);
 popup.focus();
}
el("commercial-refresh").addEventListener("click",()=>void refresh());
el("commercial-service-reset").addEventListener("click",resetService);
el("commercial-service-form").addEventListener("submit",event=>{
 event.preventDefault();if(!ok())return;
 const form=event.currentTarget;if(!form.reportValidity())return;
 try{
   const id=el("commercial-service-id").value||null;
   const params={p_id:id,p_code:el("commercial-service-code").value.trim().toUpperCase(),
     p_title:el("commercial-service-title").value.trim(),
     p_description:el("commercial-service-description").value.trim(),
     p_unit:el("commercial-service-unit").value.trim(),
     p_price:core.parseMoney(el("commercial-service-price").value),
     p_internal_cost:core.parseMoney(el("commercial-service-internal").value),
     p_partner_cost:core.parseMoney(el("commercial-service-partner").value),
     p_minutes:el("commercial-service-minutes").value?
       Number(el("commercial-service-minutes").value):null,
     p_active:el("commercial-service-active").checked};
   void perform(id?"Salvar a atualização? Orçamentos anteriores manterão seus valores.":
     "Cadastrar este serviço com os valores informados?","proxiti_commercial_save_service",
     params,"Serviço salvo no catálogo.").then(()=>{if(ok())resetService();});
 }catch(error){feedback(error.message,true);}
});
el("commercial-ticket").addEventListener("change",renderParentChoices);
el("commercial-create-form").addEventListener("submit",event=>{
 event.preventDefault();if(!ok()||!event.currentTarget.reportValidity())return;
 const ticket=el("commercial-ticket").value;
 if(!ticket)return;
 const params={p_ticket:ticket,p_valid_until:el("commercial-validity").value,
   p_client_notes:el("commercial-client-notes").value.trim(),
   p_internal_notes:el("commercial-internal-notes").value.trim(),
   p_parent:el("commercial-parent").value||null};
 if(!window.confirm(params.p_parent?
   "Criar rascunho de aditivo? A proposta já aceita não será alterada.":
   "Criar rascunho vinculado ao chamado selecionado?"))return;
 const client=state.client,uid=state.uid,epoch=state.epoch;
 feedback("Criando rascunho…");
 void read(client.rpc("proxiti_commercial_create_quote",params)).then(id=>{
   if(!ok(client,uid,epoch))return;
   el("commercial-create-form").reset();
   el("commercial-validity").value=defaultDate();
   void afterMutation("Rascunho criado. Adicione os serviços e revise os valores.",id);
 }).catch(error=>{if(ok(client,uid,epoch))feedback(error.message,true);});
});
el("commercial-add-item-form").addEventListener("submit",event=>{
 event.preventDefault();if(!ok()||!event.currentTarget.reportValidity()||!state.selected)return;
 const input=el("commercial-item-price").value.trim();
 try{
   const price=input?core.parseMoney(input):null;
   const reason=el("commercial-item-reason").value.trim();
   if(input&&reason.length<10)throw Error("Preço manual exige justificativa de no mínimo 10 caracteres.");
   const params={p_quote:state.selected,p_service:el("commercial-item-service").value,
     p_quantity:Number(el("commercial-item-quantity").value),
     p_price_override:price,p_override_reason:price!==null?reason:null};
   void perform("Adicionar o serviço ao rascunho com estes valores?",
     "proxiti_commercial_add_item",params,"Serviço incluído no rascunho.")
     .then(()=>{if(ok())el("commercial-add-item-form").reset();});
 }catch(error){feedback(error.message,true);}
});
el("commercial-payment-form").addEventListener("submit",event=>{
 event.preventDefault();if(!ok()||!event.currentTarget.reportValidity()||!state.selected)return;
 try{
   const params={p_quote:state.selected,p_kind:el("commercial-payment-kind").value,
     p_amount:core.parseMoney(el("commercial-payment-amount").value,{positive:true}),
     p_method:el("commercial-payment-method").value,
     p_reference:el("commercial-payment-proof").value.trim()};
   void perform("Confirma que este "+(params.p_kind==="received"?"recebimento":"estorno")+
     " ocorreu e que a referência foi conferida? O sistema não consulta bancos.",
     "proxiti_commercial_record_payment",params,"Movimento financeiro registrado.")
     .then(()=>{if(ok())el("commercial-payment-form").reset();});
 }catch(error){feedback(error.message,true);}
});
el("commercial-payout-form").addEventListener("submit",event=>{
 event.preventDefault();if(!ok()||!event.currentTarget.reportValidity()||!state.selected)return;
 try{
   const params={p_quote:state.selected,p_partner:el("commercial-payout-partner").value,
     p_amount:core.parseMoney(el("commercial-payout-amount").value,{positive:true}),
     p_agreement:el("commercial-payout-agreement").value.trim()};
   void perform("Confirma que este valor foi acordado com o parceiro e documentado?"+
      " Esta ação não transfere dinheiro.","proxiti_commercial_plan_payout",
      params,"Repasse planejado com referência do acordo.")
      .then(()=>{if(ok())el("commercial-payout-form").reset();});
 }catch(error){feedback(error.message,true);}
});
el("commercial-quotes").addEventListener("change",event=>void selectQuote(event.currentTarget.value));
el("commercial-more").addEventListener("click",()=>void loadMore());
el("commercial-print").addEventListener("click",printQuote);
el("ticket-open-commercial").addEventListener("click",()=>{
 if(!admin())return;
 const ticket=window.PROXITI_ACTIVE_TICKET;if(!ticket?.id)return;
 state.prefill=ticket.id;window.PROXITI_OPEN_VIEW?.("commercial");
 if(!root.hidden){
   if(state.tickets.length){renderTicketChoices();const quote=state.quotes.find(q=>q.ticket_id===ticket.id);
     if(quote){el("commercial-quotes").value=quote.id;void selectQuote(quote.id);}}
   else void refresh();
 }
});
document.addEventListener("proxiti-view-changed",event=>{
 if(event.detail?.view==="commercial"&&admin()){
   if(state.client&&state.uid===active()?.user?.id)void refresh();
   else begin(active());
 }
});
document.addEventListener("proxiti-session-ready",event=>begin(event.detail));
document.addEventListener("proxiti-session-ended",clear);
document.addEventListener("proxiti-ticket-selected",event=>{
 const t=event.detail?.ticket;el("ticket-open-commercial").disabled=!admin()||!t?.id;
});
function defaultDate(){
 const d=new Date();d.setDate(d.getDate()+7);
 return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+
   "-"+String(d.getDate()).padStart(2,"0");
}
el("commercial-validity").value=defaultDate();
if(active())begin(active());
})();
