import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve,dirname} from "node:path";
import {fileURLToPath} from "node:url";
import {Script} from "node:vm";
const root=resolve(dirname(fileURLToPath(import.meta.url)),".."),read=p=>readFileSync(resolve(root,p),"utf8");
const html=read("index.html"),js=read("assets/partner-v17.js"),css=read("assets/partner-v17.css"),sql=read("supabase/partner_operations_v17.sql");
new Script(js,{filename:"partner-v17.js"});
for(const id of ["partner-v17-admin","partner-v17-admin-list","partner-v17-filter-availability","partner-v17-filter-specialty",
 "partner-v17-filter-mode","partner-v17-self","partner-v17-headline","partner-v17-bio","partner-v17-availability",
 "partner-v17-regions","partner-v17-self-review"])
 assert(html.includes('id="'+id+'"'),"Elemento ausente: "+id);
assert(html.includes("Certificados e disponibilidade ajudam na análise, mas não atribuem chamados automaticamente."));
assert(html.includes("Estar disponível não garante chamado, e nenhum serviço é aceito automaticamente."));
for(const asset of ["assets/partner-v17.js","assets/partner-v17.css"])assert(html.includes(asset),"Asset não carregado: "+asset);
assert(sql.includes("create table if not exists public.partner_operational_profiles"));
assert(sql.includes("create table if not exists public.partner_operational_audit"));
assert(!/drop table|truncate|delete from/i.test(sql),"Migração operacional não pode apagar dados");
assert(sql.includes("approved_for_assignment boolean not null default false"),
 "Nenhum parceiro deve ser considerado revisado por padrão");
assert(sql.includes("public.proxiti_commercial_admin()"),"Revisão administrativa deve exigir MFA/AAL2");
assert(sql.includes("public.proxiti_is_admin() or user_id=(select auth.uid())"),
 "RLS deve limitar parceiro ao próprio perfil");
assert(sql.includes("role='technician' and status='active'"),"Edição própria exige técnico ativo");
for(const rpc of ["proxiti_partner_save_self","proxiti_partner_admin_review","proxiti_partner_admin_list"])
 assert(js.includes(rpc)&&sql.includes(rpc),"RPC ausente: "+rpc);
assert(!/innerHTML\s*=|localStorage|sessionStorage/.test(js),
 "Disponibilidade não deve ser persistida no storage local ou renderizada como HTML não confiável");
assert(!/certificate.*approved_for_assignment|approved_for_assignment.*certificate/i.test(sql),
 "Certificação não pode liberar atribuição automaticamente");
assert(css.includes("@media(max-width:620px)")&&css.includes(".partner-v17-admin-list"),
 "Responsividade operacional ausente");
assert.equal((css.match(/{/g)||[]).length,(css.match(/}/g)||[]).length);
console.log("PASS: Parceiros V17 preserva autonomia, RLS, MFA e revisão independente de certificados.");
