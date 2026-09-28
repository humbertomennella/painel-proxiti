import assert from "node:assert/strict";
import {readFileSync,existsSync} from "node:fs";
import {resolve,dirname} from "node:path";
import {fileURLToPath} from "node:url";
import {Script,runInNewContext} from "node:vm";
const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const read=p=>readFileSync(resolve(root,p),"utf8");
const coreSource=read("assets/commercial-core.js");
const ui=read("assets/commercial-v15.js"),sql=read("supabase/commercial_operations_v15.sql"),
 html=read("index.html"),css=read("assets/commercial-v15.css"),
 operations=read("assets/operations.js");
new Script(coreSource,{filename:"commercial-core.js"});
new Script(ui,{filename:"commercial-v15.js"});
const w={};runInNewContext(coreSource,{window:w,Intl,Number,Error,String,Object,RegExp});
const core=w.PROXITI_COMMERCIAL_CORE;
for(const [input,value] of [["0",0],["0,00",0],["12,3",1230],
 ["125",12500],["125,09",12509],["10000000,00",1000000000]])
 assert.equal(core.parseMoney(input),value,"Erro de conversão: "+input);
for(const bad of ["","-2","1.200,00","12.5","12,345","NaN","1e3",
 "10000000,01","0002","  ","R$ 50,00"])
 assert.throws(()=>core.parseMoney(bad),Error,"Não aceite valor ambíguo: "+bad);
assert.throws(()=>core.parseMoney("0",{positive:true}),Error);
assert.equal(core.lineCents(3,1525),4575);
assert.equal(core.paymentNet([{kind:"received",amount_cents:6000},
 {kind:"refunded",amount_cents:1000}]),5000);
assert.throws(()=>core.paymentNet([{kind:"test",amount_cents:1}]),Error);
assert(core.asMoney(12509).includes("125,09"));
for(const asset of ["assets/commercial-core.js","assets/commercial-v15.js",
 "assets/commercial-v15.css","assets/photos/operacao-pexels.jpg"])
 assert(existsSync(resolve(root,asset)),"Arquivo ausente: "+asset);
for(const id of ["ops-commercial","reports-commercial","reports-commercial-approved",
 "reports-commercial-received","reports-commercial-planned","reports-commercial-paid",
 "reports-open-commercial","commercial-service-form","commercial-create-form",
 "commercial-add-item-form","commercial-transition-form","commercial-payment-form",
 "commercial-payout-form","commercial-totals","commercial-quote-summary",
 "commercial-events-list","commercial-print","commercial-ticket",
 "commercial-parent","commercial-quotes","ticket-open-commercial"])
 assert.equal((html.match(new RegExp('id="'+id+'"',"g"))||[]).length,1,
  "ID ausente ou duplicado: "+id);
for(const source of ["commercial-core.js","commercial-v15.js","commercial-v15.css"])
 assert(html.includes(source),"Módulo não carregado: "+source);
assert(html.includes('data-side-view="commercial"')&&
 html.includes('data-ops-view="commercial" data-admin-only')&&
 html.includes('id="ops-commercial" class="ops-view px-panel" hidden data-admin-only'),
 "Navegação comercial não restrita à administração");
assert(operations.includes('commercial:isAdmin()')&&
 operations.includes('"commercial","reports"')&&
 operations.includes('commercial:["Comercial"'),
 "A área Comercial precisa integrar o roteador existente");
assert(ui.includes("reports-commercial-status")&&ui.includes("proxiti_commercial_summary"),
 "Painel de relatórios precisa consultar resumo global no servidor");
assert(!/innerHTML\s*=|service_role|sb_secret_|payout.*localStorage/i.test(ui),
 "Não renderize dados comerciais como HTML nem armazene valores privados no navegador");
for(const method of ["proxiti_commercial_save_service","proxiti_commercial_create_quote",
 "proxiti_commercial_add_item","proxiti_commercial_remove_item",
 "proxiti_commercial_transition_quote","proxiti_commercial_record_payment",
 "proxiti_commercial_plan_payout","proxiti_commercial_mark_payout",
 "proxiti_commercial_quote_detail","proxiti_commercial_summary"])
 assert(sql.includes("function public."+method)&&ui.includes('"'+method+'"'),
 "RPC ou integração ausente: "+method);
for(const table of ["commercial_services","commercial_quotes","commercial_quote_items",
 "commercial_quote_events","commercial_payments","commercial_partner_payouts"])
 assert(sql.includes("create table if not exists public."+table),
 "Tabela ausente: "+table);
assert(!/drop table|truncate table|delete from public\.support_tickets/i.test(sql),
 "Migração destrutiva não permitida");
assert(sql.includes("alter table public.%I enable row level security")&&
 sql.includes("revoke all on public.%I from public,anon,authenticated")&&
 sql.includes("create policy %I on public.%I for select to authenticated using (public.proxiti_is_admin())"),
 "Acesso aos dados financeiros deve ser restrito ao administrador");
assert(sql.includes("p_price_override")&&sql.includes("override_reason")&&
 sql.includes("Somente rascunhos aceitam alterações")&&
 sql.includes("Orçamento emitido é imutável"),
 "Preços de propostas emitidas devem ser snapshots imutáveis");
assert(sql.includes("p_parent")&&sql.includes("Aditivo exige orçamento aceito"),
 "Serviço adicional deve exigir proposta separada");
assert(sql.includes("current_date")&&sql.includes("Orçamento vencido"),
 "Não aceite propostas vencidas");
assert(sql.includes("v_received+p_amount>v_total")&&
 sql.includes("v_received-p_amount<0"),
 "Recebimentos e estornos precisam respeitar os valores registrados");
assert(sql.includes("assigned_to")&&sql.includes("status='active'")&&
 sql.includes("Repasse pago não pode ser alterado"),
 "Controle interno de repasses precisa validar responsável e imutabilidade");
assert(ui.includes("RASCUNHO INTERNO · NÃO ENVIAR")&&
 ui.includes("A proposta não equivale a nota fiscal")&&
 !ui.includes("window.print();")&&
 ui.includes("printQuote()"),"Revisão e impressão de proposta com distinção de rascunho");
assert(css.includes("#ops-commercial [hidden]{display:none!important}")&&
 css.includes("@media(max-width:720px)"),"Acessibilidade e responsividade mínimas");
console.log("PASS: preços exatos em centavos, navegação restrita, snapshots, propostas, recebimentos e repasses V15.");
