import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve,dirname} from "node:path";
import {fileURLToPath} from "node:url";
import {Script} from "node:vm";
const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const read=p=>readFileSync(resolve(root,p),"utf8");
const sql=read("supabase/customer_quote_portal_v18.sql"),
 edge=read("supabase/functions/proxiti-support/index.ts"),
 commercial=read("assets/commercial-v15.js");
new Script(commercial,{filename:"commercial-v15.js"});
for(const action of ["quotes","quote_decision"])
 assert(edge.includes('action === "'+action+'"'),"Ação ausente: "+action);
for(const rpc of ["proxiti_customer_quote_list","proxiti_customer_quote_decide"])
 assert(sql.includes("function public."+rpc)&&edge.includes('admin.rpc("'+rpc+'"'),
  "RPC ausente ou não conectada: "+rpc);
for(const property of ["unit_internal_cost_cents","unit_partner_cost_cents","internal_notes",
 "agreement_reference","recorded_by","access_hash',q.","customer_email"])
 assert(!sql.includes(property),"A consulta pública não pode incluir dados internos: "+property);
assert(sql.includes("where q.ticket_id=p_ticket and q.issued_at is not null"),
 "A consulta do cliente não pode disponibilizar rascunhos ou propostas alheias");
assert(sql.includes("t.id=p_ticket and t.access_hash=p_access_hash"),
 "Confirmar identidade do chamado no banco é obrigatório");
assert(sql.includes("where id=p_quote and ticket_id=p_ticket and issued_at is not null for update"),
 "A resposta deve trancar a proposta associada ao chamado");
assert(sql.includes("if q.valid_until<current_date")&&sql.includes("if q.status<>'issued'")&&
 sql.includes("p_confirm is distinct from true")&&sql.includes("v_ticket_status='closed'"),
 "Bloqueios de expiração, status, confirmação e chamado encerrado ausentes");
assert(sql.includes("already_recorded',true")&&
 sql.includes("where e.quote_id=p_quote and e.action=v_action"),
 "Reenvios idempotentes da mesma decisão devem preservar o evento");
assert(sql.includes("insert into public.commercial_quote_events")&&
 sql.includes("'customer_portal'")&&sql.includes("actor_id"),
 "O aceite deve registrar evento sem associar identidade falsa de funcionário");
for(const name of ["proxiti_customer_quote_list(uuid,text)",
 "proxiti_customer_quote_decide(uuid,text,uuid,text,boolean)"]){
 assert(sql.includes("revoke all on function public."+name)&&
   sql.includes("grant execute on function public."+name),
   "RPC privada sem ACL explícita: "+name);
}
assert(!/\bgrant execute on function public\.proxiti_customer_quote_\w+\([^;]+ to (anon|authenticated|public)/i.test(sql),
 "Não liberar RPCs que usam service_role a navegadores");
assert(edge.includes("await checkTicket(ticketId,secret)")&&
 edge.includes("await digest(secret)")&&edge.includes("body.confirmed!==true")&&
 edge.includes('limit("quote-decision:"+ticketId,true,8)'),
 "A função de borda precisa conferir token, decisão e limitar requisições");
assert(edge.includes("if(!data?.already_recorded)")&&
 edge.includes('notifyAdministrators(ticket.reference,"quote_decision",quoteId)'),
 "Notificar a equipe uma única vez após decisão registrada");
assert(commercial.includes('customer_accepted:"Cliente aceitou pelo portal"')&&
 commercial.includes('customer_declined:"Cliente recusou pelo portal"'));
assert(!/drop table|truncate table|delete from public\.commercial_quotes/i.test(sql));
console.log("PASS: consulta privada V18, snapshot público limitado, decisão atômica, idempotência e auditoria.");
