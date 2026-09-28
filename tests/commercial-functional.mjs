import assert from "node:assert/strict";
import {createServer} from "node:http";
import {readFile} from "node:fs/promises";
import {resolve,extname,sep} from "node:path";
import {fileURLToPath} from "node:url";
import {chromium} from "playwright";
const root=resolve(fileURLToPath(new URL("../",import.meta.url)));
const mime={".html":"text/html; charset=utf-8",".js":"application/javascript; charset=utf-8",
 ".css":"text/css; charset=utf-8",".svg":"image/svg+xml",".jpg":"image/jpeg",".webp":"image/webp"};
const server=createServer(async(req,res)=>{
 try{
  const part=new URL(req.url,"http://localhost").pathname;
  const file=resolve(root,"."+decodeURIComponent(part==="/"?"/index.html":part));
  if(!file.startsWith(root+sep)){res.writeHead(403);res.end();return;}
  const body=await readFile(file);
  res.writeHead(200,{"content-type":mime[extname(file)]||"application/octet-stream",
   "cache-control":"no-store"});res.end(body);
 }catch{res.writeHead(404);res.end("not found");}
});
await new Promise(done=>server.listen(0,"127.0.0.1",done));
const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
const base="http://127.0.0.1:"+server.address().port+"/";
const id={ticket:"00000000-0000-4000-8000-000000000121",
 admin:"00000000-0000-4000-8000-000000000001",
 partner:"00000000-0000-4000-8000-000000000102"};
const errors=[];
let page;
try{
 page=await browser.newPage({viewport:{width:375,height:810},deviceScaleFactor:1});
 page.on("pageerror",e=>errors.push(e.message));
 page.on("dialog",d=>d.accept(d.type()==="prompt"?"Comprovante PIX registrado":""));
 await page.route("https://cdn.jsdelivr.net/**",route=>route.abort());
 await page.goto(base,{waitUntil:"load"});
 await page.evaluate(id=>{
  document.body.classList.add("workspace-mode");
  document.getElementById("setup").hidden=true;
  document.getElementById("auth-screen").hidden=true;
  document.getElementById("panel").hidden=false;
  document.getElementById("workspace").hidden=false;
  document.getElementById("operations").hidden=false;
  document.getElementById("ops-commercial").hidden=false;
  const now=new Date().toISOString();
  const fixture=window.__commercialFixture={
   services:[],tickets:[{id:id.ticket,reference:77,subject:"Notebook sem iniciar",
     status:"new",customer_name:"Cliente de teste",assigned_to:id.partner,created_at:now}],
   profiles:[{id:id.admin,role:"administrator",status:"active",display_name:"Administrador"},
     {id:id.partner,role:"technician",status:"active",display_name:"Técnico de teste"}],
   quotes:[],lines:[],payments:[],payouts:[],events:[],calls:[],counter:0
  };
  const created=prefix=>prefix+ ++fixture.counter;
  const ok=data=>Promise.resolve({data,error:null});
  const error=message=>Promise.resolve({data:null,error:{message}});
  const client={
   from(table){
    const filters=[];let sort=null,offset=0,limit=null;
    const chain={
     select(){return chain;},
     eq(k,v){filters.push([k,v]);return chain;},
     order(k,{ascending=true}={}){sort={k,ascending};return chain;},
     limit(n){limit=n;return chain;},
     range(a,b){offset=a;limit=b-a+1;return chain;},
     then(resolve,reject){
      let rows=[...(fixture[{commercial_services:"services",commercial_quotes:"quotes",
       support_tickets:"tickets",profiles:"profiles"}[table]||table]||[])];
      for(const [k,v]of filters)rows=rows.filter(x=>x[k]===v);
      if(sort)rows.sort((a,b)=>{const x=a[sort.k],y=b[sort.k];
       return x===y?0:(x<y?-1:1)*(sort.ascending?1:-1)});
      return Promise.resolve({data:limit!==null?rows.slice(offset,offset+limit):rows,error:null})
       .then(resolve,reject);
     }
    };
    return chain;
   },
   rpc(method,p={}){
    fixture.calls.push(method);
    if(method==="proxiti_commercial_summary"){
     const total=fixture.quotes.filter(q=>q.status==="accepted")
       .reduce((s,q)=>s+fixture.lines.filter(i=>i.quote_id===q.id)
         .reduce((n,i)=>n+i.quantity*i.unit_price_cents,0),0);
     return ok({quotes:fixture.quotes.length,accepted_cents:total,
      received_cents:fixture.payments.reduce((s,x)=>s+(x.kind==="received"?1:-1)*x.amount_cents,0),
      payout_planned_cents:fixture.payouts.filter(x=>x.status==="planned")
        .reduce((s,x)=>s+x.agreed_cents,0),
      payout_recorded_cents:fixture.payouts.filter(x=>x.status==="paid")
        .reduce((s,x)=>s+x.agreed_cents,0)});
    }
    if(method==="proxiti_commercial_save_service"){
     let row=fixture.services.find(x=>x.id===p.p_id);
     if(!row){row={id:created("service-")};fixture.services.push(row);}
     Object.assign(row,{code:p.p_code,title:p.p_title,description:p.p_description,
      unit_label:p.p_unit,price_cents:p.p_price,internal_cost_cents:p.p_internal_cost,
      partner_cost_cents:p.p_partner_cost,estimated_minutes:p.p_minutes,active:p.p_active});
     return ok(row.id);
    }
    if(method==="proxiti_commercial_create_quote"){
     const ticket=fixture.tickets.find(t=>t.id===p.p_ticket);
     if(!ticket||ticket.status==="closed")return error("Chamado encerrado");
     const quote={id:created("quote-"),reference:fixture.quotes.length+1,
      ticket_id:p.p_ticket,parent_quote_id:p.p_parent,status:"draft",
      valid_until:p.p_valid_until,client_notes:p.p_client_notes,internal_notes:p.p_internal_notes,
      created_at:new Date().toISOString(),issued_at:null,accepted_at:null};
     fixture.quotes.push(quote);fixture.events.push({id:created("event-"),quote_id:quote.id,
      action:"created",created_at:quote.created_at,detail:{}});return ok(quote.id);
    }
    if(method==="proxiti_commercial_add_item"){
     const q=fixture.quotes.find(q=>q.id===p.p_quote),service=fixture.services.find(x=>x.id===p.p_service);
     if(!q||q.status!=="draft"||!service?.active)return error("Rascunho indisponível");
     const row={id:created("line-"),quote_id:q.id,service_id:service.id,position:fixture.lines.length+1,
      title_snapshot:service.title,code_snapshot:service.code,scope_snapshot:service.description,
      unit_snapshot:service.unit_label,quantity:p.p_quantity,
      unit_price_cents:p.p_price_override??service.price_cents,
      unit_internal_cost_cents:service.internal_cost_cents,
      unit_partner_cost_cents:service.partner_cost_cents};
     fixture.lines.push(row);return ok(row.id);
    }
    if(method==="proxiti_commercial_remove_item"){
     const index=fixture.lines.findIndex(l=>l.id===p.p_item);
     if(index<0)return error("Item não encontrado");
     const q=fixture.quotes.find(q=>q.id===fixture.lines[index].quote_id);
     if(q.status!=="draft")return error("Orçamento imutável");
     fixture.lines.splice(index,1);return ok(null);
    }
    if(method==="proxiti_commercial_transition_quote"){
     const q=fixture.quotes.find(q=>q.id===p.p_quote);
     const transitions={draft:["issued","cancelled"],issued:["accepted","declined","cancelled"]};
     if(!q||!transitions[q.status]?.includes(p.p_next))return error("Estado inválido");
     if(p.p_next==="issued"&&!fixture.lines.some(i=>i.quote_id===q.id))return error("Sem itens");
     q.status=p.p_next;
     if(p.p_next==="issued")q.issued_at=new Date().toISOString();
     if(p.p_next==="accepted")q.accepted_at=new Date().toISOString();
     q.confirmation_channel=p.p_channel;q.confirmation_reference=p.p_evidence;
     fixture.events.push({id:created("event-"),quote_id:q.id,
      action:q.status,created_at:new Date().toISOString(),
      detail:{channel:p.p_channel,reference:p.p_evidence}});
     return ok(null);
    }
    if(method==="proxiti_commercial_record_payment"){
     const q=fixture.quotes.find(q=>q.id===p.p_quote);
     if(!q||q.status!=="accepted")return error("Orçamento não aceito");
     const total=fixture.lines.filter(i=>i.quote_id===q.id).reduce((s,i)=>s+i.quantity*i.unit_price_cents,0);
     const already=fixture.payments.filter(x=>x.quote_id===q.id)
       .reduce((s,i)=>s+(i.kind==="received"?1:-1)*i.amount_cents,0);
     if((p.p_kind==="received"&&already+p.p_amount>total)||
        (p.p_kind==="refunded"&&already-p.p_amount<0))return error("Saldo inválido");
     const row={id:created("payment-"),quote_id:q.id,kind:p.p_kind,amount_cents:p.p_amount,
      method:p.p_method,reference:p.p_reference,occurred_at:new Date().toISOString()};
     fixture.payments.push(row);return ok(row.id);
    }
    if(method==="proxiti_commercial_plan_payout"){
     const q=fixture.quotes.find(q=>q.id===p.p_quote);
     if(q?.status!=="accepted"||fixture.tickets.find(t=>t.id===q.ticket_id).assigned_to!==p.p_partner)
       return error("Parceiro não autorizado");
     let row=fixture.payouts.find(x=>x.quote_id===q.id&&x.partner_id===p.p_partner);
     if(!row){row={id:created("payout-"),quote_id:q.id,partner_id:p.p_partner,status:"planned"};
       fixture.payouts.push(row);}
     if(row.status==="paid")return error("Repasse já pago");
     Object.assign(row,{agreed_cents:p.p_amount,agreement_reference:p.p_agreement,created_at:new Date().toISOString()});
     return ok(row.id);
    }
    if(method==="proxiti_commercial_mark_payout"){
     const row=fixture.payouts.find(x=>x.id===p.p_payout);
     if(!row||row.status!=="planned")return error("Repasse já registrado");
     row.status="paid";row.paid_reference=p.p_reference;row.paid_at=new Date().toISOString();
     return ok(null);
    }
    if(method==="proxiti_commercial_quote_detail"){
     const q=fixture.quotes.find(q=>q.id===p.p_quote);
     if(!q)return error("Não existe");
     const lines=fixture.lines.filter(i=>i.quote_id===q.id);
     return ok({quote:structuredClone(q),
      ticket:structuredClone(fixture.tickets.find(t=>t.id===q.ticket_id)),
      items:structuredClone(lines),total_cents:lines.reduce((s,i)=>s+i.quantity*i.unit_price_cents,0),
      internal_cost_cents:lines.reduce((s,i)=>s+i.quantity*i.unit_internal_cost_cents,0),
      partner_estimate_cents:lines.reduce((s,i)=>s+i.quantity*i.unit_partner_cost_cents,0),
      payments:structuredClone(fixture.payments.filter(x=>x.quote_id===q.id)),
      payouts:structuredClone(fixture.payouts.filter(x=>x.quote_id===q.id)),
      events:structuredClone(fixture.events.filter(x=>x.quote_id===q.id))});
    }
    return error("RPC não simulada: "+method);
   }
  };
  window.PROXITI_ACTIVE_SESSION={client,user:{id:id.admin},
   profile:{role:"administrator",status:"active",permissions:{tickets_view:true}}};
  document.dispatchEvent(new CustomEvent("proxiti-view-changed",{detail:{view:"commercial"}}));
 },id);
 await page.waitForFunction(()=>document.getElementById("commercial-kpi-quotes").textContent==="0");
 assert.equal(await page.locator("#commercial-services-list .commercial-empty").count(),1);
 assert.equal(await page.locator("#commercial-detail").isVisible(),false);
 assert.equal(await page.locator("#commercial-ticket option").count(),2);
 assert.equal(await page.locator("#commercial-quotes option").count(),1);

 await page.fill("#commercial-service-code","SUPORTE_NOTEBOOK");
 await page.fill("#commercial-service-title","Diagnóstico de notebook");
 await page.fill("#commercial-service-description","Avaliação de inicialização, sem substituição de peças.");
 await page.fill("#commercial-service-price","150,00");
 await page.fill("#commercial-service-internal","20,00");
 await page.fill("#commercial-service-partner","60,00");
 await page.fill("#commercial-service-minutes","90");
 await page.click("#commercial-service-form button[type=submit]");
 await page.waitForFunction(()=>window.__commercialFixture.services.length===1);
 assert.equal(await page.locator("#commercial-service-price").inputValue(),"");
 assert((await page.textContent("#commercial-services-list")).includes("R$"));
 await page.selectOption("#commercial-ticket",id.ticket);
 await page.fill("#commercial-client-notes","O diagnóstico não inclui troca de peças nem backup.");
 await page.fill("#commercial-internal-notes","Custo interno confidencial para teste.");
 await page.click("#commercial-create-form button[type=submit]");
 await page.waitForFunction(()=>window.__commercialFixture.quotes.length===1);
 await page.waitForFunction(()=>!!document.querySelector("#commercial-detail:not([hidden])"),
   {timeout:5000}).catch(async error=>{
     console.log("DIAGNÓSTICO COMERCIAL:",JSON.stringify(await page.evaluate(()=>({
       feedback:document.getElementById("commercial-feedback").textContent,
       quoteStatus:document.getElementById("commercial-quote-status").textContent,
       selected:document.getElementById("commercial-quotes").value,
       options:[...document.getElementById("commercial-quotes").options].map(o=>o.value),
       calls:window.__commercialFixture.calls.slice(-20),
       quoteCount:window.__commercialFixture.quotes.length,
       detailHidden:document.getElementById("commercial-detail").hidden
     }))));throw error;
   });
 assert.equal(await page.locator("#commercial-add-item-form").isVisible(),true);
 await page.selectOption("#commercial-item-service","service-1");
 await page.fill("#commercial-item-quantity","2");
 await page.click("#commercial-add-item-form button[type=submit]");
 await page.waitForFunction(()=>window.__commercialFixture.lines.length===1);
 assert((await page.textContent("#commercial-totals")).includes("300,00"));
 const [popup]=await Promise.all([page.waitForEvent("popup"),page.click("#commercial-print")]);
 await popup.waitForSelector("main,p");
 const content=await popup.locator("body").innerText();
 assert(content.includes("RASCUNHO INTERNO · NÃO ENVIAR"));
 assert(content.includes("300,00"));
 assert(!content.includes("Custo interno confidencial"));
 assert(!content.includes("Repasse estimado"));
 await popup.close();
 await page.selectOption("#commercial-confirmation-channel","email");
 await page.fill("#commercial-confirmation-proof","Enviado por e-mail em teste às 10h");
 await page.getByRole("button",{name:"Registrar envio"}).click();
 await page.waitForFunction(()=>window.__commercialFixture.quotes[0].status==="issued");
 assert.equal(await page.locator("#commercial-add-item-form").isVisible(),false);
 await page.getByRole("button",{name:"Editar serviço"}).click();
 await page.fill("#commercial-service-price","200,00");
 await page.click("#commercial-service-form button[type=submit]");
 await page.waitForFunction(()=>window.__commercialFixture.services[0].price_cents===20000);
 await page.selectOption("#commercial-quotes","quote-2");
 assert((await page.textContent("#commercial-totals")).includes("300,00"),
  "Catálogo atualizado não altera o snapshot da proposta");
 await page.selectOption("#commercial-confirmation-channel","whatsapp");
 await page.fill("#commercial-confirmation-proof","Cliente confirmou valor e escopo em teste");
 await page.getByRole("button",{name:"Registrar aceite do cliente"}).click();
 await page.waitForFunction(()=>window.__commercialFixture.quotes[0].status==="accepted");
 assert.equal(await page.locator("#commercial-add-item-form").isVisible(),false);
 assert.equal(await page.locator("#commercial-finance").isVisible(),true);
 await page.fill("#commercial-payment-amount","100,00");
 await page.selectOption("#commercial-payment-method","pix");
 await page.fill("#commercial-payment-proof","PIX-SIMULADO-001");
 await page.click("#commercial-payment-form button[type=submit]");
 await page.waitForFunction(()=>window.__commercialFixture.payments.length===1);
 assert((await page.textContent("#commercial-kpi-received")).includes("100,00"));
 await page.selectOption("#commercial-payout-partner",id.partner);
 await page.fill("#commercial-payout-amount","80,00");
 await page.fill("#commercial-payout-agreement","Acordo simulado de serviço com o parceiro");
 await page.click("#commercial-payout-form button[type=submit]");
 await page.waitForFunction(()=>window.__commercialFixture.payouts.length===1);
 assert((await page.textContent("#commercial-kpi-planned")).includes("80,00"));
 await page.getByRole("button",{name:"Registrar como pago"}).click();
 await page.waitForFunction(()=>window.__commercialFixture.payouts[0].status==="paid");
 assert((await page.textContent("#commercial-kpi-paid")).includes("80,00"));
 for(const width of [375,430,768,1366]){
   await page.setViewportSize({width,height:850});
   const measured=await page.evaluate(()=>({screen:window.innerWidth,
    commercial:document.getElementById("ops-commercial").getBoundingClientRect().width,
    quote:document.querySelector(".commercial-quote-detail").getBoundingClientRect().width,
    document:document.documentElement.scrollWidth}));
   assert(measured.quote<=measured.screen+3&&measured.document<=measured.screen+4,
      "Layout comercial ultrapassa a tela: "+JSON.stringify(measured));
 }
 await page.evaluate(()=>{window.PROXITI_ACTIVE_SESSION=null;
   document.dispatchEvent(new Event("proxiti-session-ended"));});
 assert.equal(await page.locator("#commercial-items").innerText(),"");
 assert.equal(await page.locator("#commercial-payments-list").innerText(),"");
 assert.equal(await page.locator("#commercial-kpi-approved").innerText(),"—");
 assert.deepEqual(errors,[]);
 console.log("PASS: catálogo sem valores inventados, proposta imutável, impressão sem custos, recebimento, repasse e limpeza da sessão.");
}finally{await page?.close();await browser.close();await new Promise(done=>server.close(done));}
