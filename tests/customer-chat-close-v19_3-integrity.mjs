import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve,dirname} from "node:path";
import {fileURLToPath} from "node:url";
const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const read=path=>readFileSync(resolve(root,path),"utf8");
const sql=read("supabase/customer_chat_close_v19_3.sql");
const edge=read("supabase/functions/proxiti-support/index.ts");
assert(sql.includes("function public.proxiti_customer_close_chat_ticket("));
assert(sql.includes("security definer set search_path=''")&&
 sql.includes("where id=p_ticket for update")&&
 sql.includes("v_hash is distinct from p_access_hash"),
 "A RPC precisa validar a chave hash sob bloqueio transacional");
assert(sql.includes("status in ('planned','confirmed')")&&
 sql.includes("status in ('issued','accepted')"),
 "Compromissos e propostas ativas precisam impedir o encerramento");
assert(sql.includes("if v_status='closed'")&&
 sql.includes("'already_closed'")&&
 sql.includes("set status='closed',updated_at=now()"),
 "Encerramento precisa ser idempotente e persistido no ticket original");
assert(sql.includes("revoke all on function public.proxiti_customer_close_chat_ticket(uuid,text)")&&
 sql.includes("from public,anon,authenticated")&&
 sql.includes("to service_role"),
 "O navegador não pode executar diretamente RPC com poderes de serviço");
assert(edge.includes('action === "conversation" || action === "reply" || action === "close"')&&
 edge.includes('const ticket = await checkTicket(ticketId,secret)')&&
 edge.includes('if (body.confirmed !== true)')&&
 edge.includes('limit("customer-close:"+ticketId,true,8)')&&
 edge.includes('admin.rpc("proxiti_customer_close_chat_ticket"')&&
 edge.includes('p_access_hash:hash')&&
 edge.includes("already_closed")&&edge.includes("outcome?.result===\"blocked\""),
 "O endpoint deve conferir identidade, confirmação, limite e retorno protegido");
assert(!/delete\s+from\s+public\.(support_tickets|support_messages)/i.test(sql),
 "Encerrar não pode apagar o histórico do atendimento");
console.log("PASS: encerramento seguro, atômico, idempotente, sem excluir histórico ou compromissos.");
