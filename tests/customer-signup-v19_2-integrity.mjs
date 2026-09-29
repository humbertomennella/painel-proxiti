import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve,dirname} from "node:path";
import {fileURLToPath} from "node:url";
const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const read=p=>readFileSync(resolve(root,p),"utf8");
const edge=read("supabase/functions/proxiti-support/index.ts"),
 sql=read("supabase/customer_signup_access_v19_2.sql"),
 old=read("supabase/customer_workspace_v19.sql");
assert(edge.includes('action === "customer_register"')&&
 edge.includes('admin.auth.admin.createUser({')&&edge.includes("email_confirm:true")&&
 edge.includes('proxiti_account_type:"customer"'),
 "A inscrição imediata precisa do servidor, com perfil cliente e Auth próprio.");
assert(edge.includes('const password=typeof body.password==="string"?body.password:""')&&
 edge.includes("password.length>=10&&password.length<=72")&&
 edge.includes('/\\p{L}/u.test(password)')&&
 edge.includes('/[0-9]/.test(password)')&&
 edge.includes('/[^\\p{L}\\p{N}\\s]/u.test(password)'),
 "Backend e formulário precisam exigir 10+ caracteres, letra, número e símbolo.");
assert(edge.includes('limit("customer-register-ip:"+network,true,6)')&&
 edge.includes('limit("customer-register-email:"+email,false,3)')&&
 edge.includes('body.privacy_accepted !== true')&&
 edge.includes("clean(body.company_website, 200)"),
 "Cadastro público requer consentimento, honeypot e limite de abuso.");
assert(edge.includes('select("user_id").eq("user_id",created.user.id).maybeSingle()')&&
 edge.includes("admin.auth.admin.deleteUser(created.user.id)")&&
 edge.includes('return json({ok:true,login_ready:true},201,origin)'),
 "Não declarar sucesso quando o perfil não foi criado.");
assert(sql.includes("email_ownership_verified_at timestamptz")&&
 sql.includes("c.email_ownership_verified_at is not null")&&
 sql.includes("if v_verified is null then")&&
 sql.includes("Comprove a titularidade do e-mail")&&
 sql.includes("u.email_confirmed_at is not null"),
 "O login facilitado NÃO pode comprovar titularidade para vincular CRM antigo.");
assert(!/drop table|truncate|delete from public\.commercial_quotes/i.test(sql),
 "Migração não pode apagar dados existentes.");
assert(old.includes("extensions.digest(convert_to(p_access_token,'UTF8'),'sha256')")&&
 old.includes("lower(v_ticket.customer_email)<>v_email"),
 "Vínculo de chamado antigo continua exigindo chave privada e mesmo endereço.");
console.log("PASS: registro cliente 10+ forte, login sem e-mail obrigatório, limites públicos e CRM protegido.");
