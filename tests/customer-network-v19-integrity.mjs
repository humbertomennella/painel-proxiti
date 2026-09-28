import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve,dirname} from "node:path";
import {fileURLToPath} from "node:url";
import {Script} from "node:vm";
const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const read=path=>readFileSync(resolve(root,path),"utf8");
const html=read("index.html"),customer=read("supabase/customer_workspace_v19.sql"),
 partner=read("supabase/partner_portfolio_v19.sql"),
 edge=read("supabase/functions/proxiti-support/index.ts"),
 js=read("assets/customer-network-v19.js"),css=read("assets/customer-network-v19.css");
new Script(js,{filename:"customer-network-v19.js"});
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
assert.equal(new Set(ids).size,ids.length,"IDs duplicados na Central Técnica");
for(const match of js.matchAll(/\bel\(["']([^"']+)["']\)/g))
 assert(ids.includes(match[1]),"Controle sem ID: "+match[1]);
for(const id of ["partner-portfolio","partner-client-list","partner-offer-list",
 "customer-network-admin","customer-network-offer-form","customer-network-accounts",
 "customer-network-link-crm","partner-client-feedback-form"])
 assert(html.includes('id="'+id+'"'));
assert(html.includes('customer-network-v19.js')&&html.includes('customer-network-v19.css'));
assert((css.match(/{/g)||[]).length===(css.match(/}/g)||[]).length);
for(const name of ["customer_accounts","customer_devices","customer_ticket_links",
 "customer_schedule_requests","customer_partner_preferences","customer_service_ratings"])
 assert(customer.includes("create table if not exists public."+name)&&
  customer.includes("alter table public."+name+" enable row level security"),
  "Falta isolamento RLS para "+name);
assert(customer.includes("coalesce(new.raw_user_meta_data->>'proxiti_account_type','')='customer'")&&
 customer.includes("insert into public.profiles(id,display_name)"),
 "O cadastro não deve transformar clientes em técnicos nem quebrar os convites legados");
assert(customer.includes("email_confirmed_at is not null")&&
 customer.includes("extensions.digest(convert_to(p_access_token,'UTF8'),'sha256')")&&
 customer.includes("lower(v_ticket.customer_email)<>v_email"),
 "Vínculo de chamado antigo exige token real e e-mail confirmado do titular");
assert(customer.includes("coalesce((select auth.role()),'')<>'service_role'")&&
 customer.includes("insert into public.customer_ticket_links(ticket_id,user_id)"),
 "Abertura do chamado deve ser atômica, vinculada e somente pelo servidor");
assert(customer.includes("user_id=(select auth.uid())")&&
 customer.includes("p.approved_for_assignment")&&
 customer.includes("staff.status='active'"),
 "Recursos pessoais e diretório devem preservar o controle de acesso");
assert(partner.includes("where status in ('offered','accepted')")&&
 partner.includes("p.approved_for_assignment")&&
 partner.includes("where id=offer.ticket_id for update")&&
 partner.includes("q.status='accepted'")&&partner.includes("partner_id=(select auth.uid())"),
 "Oportunidades exigem orçamento aprovado, elegibilidade, lock e titular");
assert(partner.includes("partner_client_feedback")&&
 partner.includes("Registre apenas atendimentos concluídos"),
 "Avaliação operacional deve ser privada e limitada a atendimentos reais");
for(const name of ["proxiti_customer_open_ticket_server","proxiti_customer_dashboard",
 "proxiti_customer_link_ticket","proxiti_customer_schedule",
 "proxiti_customer_rate","proxiti_customer_admin_directory",
 "proxiti_partner_offer","proxiti_partner_offer_decide","proxiti_partner_my_portfolio"])
 assert(customer.includes("function public."+name)||partner.includes("function public."+name),
  "RPC ausente: "+name);
for(const route of ["account_open","account_conversation","account_reply",
 "account_quotes","account_quote_decision"])
 assert(edge.includes('action==="'+route+'"'),"Rota de cliente não conectada: "+route);
assert(edge.includes("admin.auth.getUser(jwt)")&&
 edge.includes('eq("user_id",customer.id)')&&
 edge.includes('eq("ticket_id",ticketId)')&&
 edge.includes("email_confirmed_at")&&
 edge.includes("proxiti_customer_open_ticket_server"),
 "Acesso da conta deve validar JWT e vínculo antes de consultar chamados");
for(const sql of [customer,partner]){
 assert(!/\bdrop table\b|\btruncate table\b|delete from public\.(?:support_tickets|commercial_quotes|profiles)/i.test(sql),
  "Migração não pode remover dados de produção");
 assert(!/grant (?:insert|update|delete|all) on public\.(?:customer_accounts|customer_ticket_links|partner_opportunities) to authenticated/i.test(sql),
  "Alterações sensíveis precisam de RPC e não devem ficar graváveis pelo navegador");
}
const hardened=read("supabase/customer_workspace_hardening_v19_1.sql");
for(const table of ["customer_devices","customer_ticket_links","customer_schedule_requests",
 "customer_partner_preferences","customer_service_ratings"])
 assert(hardened.includes("public."+table)&&hardened.includes("public.proxiti_customer_verified()"),
  "Isolamento de conta suspensa ausente: "+table);
assert(hardened.includes("partner_offer_own_or_admin")&&
 hardened.includes("public.proxiti_can('tickets_view')"),
 "Parceiro suspenso não deve consultar ofertas antigas por acesso direto");
console.log("PASS: Minha PROXITI V19, Auth separado, RLS por cliente, chave e e-mail do chamado, encaminhamento de parceiros e carteira restrita.");
