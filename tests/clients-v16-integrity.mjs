import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve,dirname} from "node:path";
import {fileURLToPath} from "node:url";
import {Script} from "node:vm";
const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const read=p=>readFileSync(resolve(root,p),"utf8");
const html=read("index.html"),js=read("assets/clients-v16.js"),css=read("assets/clients-v16.css"),sql=read("supabase/client_crm_v16.sql");
new Script(js,{filename:"clients-v16.js"});
for(const id of ["ops-clients","clients-v16-admin","clients-v16-form","clients-v16-link-form","clients-v16-list",
 "clients-v16-detail","clients-v16-summary","clients-v16-tickets","clients-v16-audit",
 "clients-v16-search","clients-v16-refresh"])
 assert(html.includes('id="'+id+'"'),"ID ausente: "+id);
assert(html.includes('data-admin-only hidden')&&html.includes("CPF, documentos e credenciais não são campos deste cadastro."));
for(const file of ["assets/clients-v16.js","assets/clients-v16.css","supabase/client_crm_v16.sql"])
 assert(html.includes(file)||file.endsWith(".sql"),"Asset não carregado: "+file);
for(const table of ["client_profiles","client_profile_audit"])
 assert(sql.includes("create table if not exists public."+table),"Tabela ausente: "+table);
assert(sql.includes("add column if not exists client_id uuid references public.client_profiles"),
 "Chamados precisam de vínculo opcional e não destrutivo");
assert(!/delete from|truncate|drop table/i.test(sql),"Migração não pode apagar histórico");
assert(sql.includes("public.proxiti_commercial_admin()"),"Escrita de CRM deve exigir administrador com MFA");
assert(sql.includes("alter table public.client_profiles enable row level security")&&
 sql.includes("using(public.proxiti_is_admin())"),"Leitura do cadastro consolidado deve ser administrativa");
assert(sql.includes("p_client uuid,p_ticket uuid")&&sql.includes("Chamado já vinculado a outro cliente"),
 "Vínculo deve ser explícito e não sobrescrever outro cliente");
assert(!/innerHTML\s*=|localStorage|sessionStorage/.test(js),
 "CRM não deve persistir contatos no storage local nem renderizar HTML não confiável");
for(const rpc of ["proxiti_client_save","proxiti_client_link_ticket","proxiti_client_unlink_ticket","proxiti_client_summary"])
 assert(js.includes(rpc)&&sql.includes(rpc),"RPC ausente: "+rpc);
assert(js.includes("Nenhum chamado foi vinculado automaticamente")&&
 js.includes("compare o contato")===false===false,"Confirmação manual precisa ficar explícita");
assert(css.includes("@media(max-width:720px)")&&css.includes(".clients-v16-summary"),
 "Layout responsivo do CRM ausente");
assert.equal((css.match(/{/g)||[]).length,(css.match(/}/g)||[]).length,"CSS desbalanceado");
console.log("PASS: CRM V16 administrativo, vínculo explícito, MFA/RLS e histórico sem inferência automática.");
