import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const deployedBaseline=read("supabase/admin_totp_authorization_v6.sql");
const proposed=read("docs/propostas/mfa-aal2-obrigatorio-v20.sql");
const report=read("docs/auditoria-operacional-2026-09-29.md");
const catalog=read("docs/auditoria-catalogo-somente-leitura.sql");
const panel=read("assets/app.js");

assert(deployedBaseline.includes("not exists(select 1 from auth.mfa_factors"),
 "O teste deve ser atualizado se a política de produção mudar: esta proposta depende do estado V6");
assert(proposed.includes("PROPOSTA NÃO IMPLANTADA")&&
 proposed.includes("NÃO EXECUTADO")&&
 proposed.includes("p_id = (select auth.uid())")&&
 proposed.includes("f.status = 'verified'")&&
 proposed.includes("= 'aal2'")&&
 proposed.includes("revoke all on function public.proxiti_mfa_ready(uuid)"),
 "A proposta deve garantir identidade própria, fator verificado e AAL2, sem ser tratada como implantação");
assert(!proposed.includes("not exists(select 1 from auth.mfa_factors")&&
 !proposed.includes("or coalesce(auth.jwt()"),
 "O cadastro ausente não pode equivaler a MFA concluído");
assert(panel.includes('aal?.nextLevel==="aal2"&&aal?.currentLevel!=="aal2"')&&
 report.includes("painel atual só solicita TOTP")&&
 report.includes("NÃO aplicada"),
 "A implantação depende de fluxo de matrícula TOTP sem dados administrativos para AAL1");
assert(catalog.includes("pg_policies")&&catalog.includes("pg_proc")&&
 catalog.includes("has_function_privilege")&&
 !/\b(?:insert|update|delete|truncate|alter|drop|create)\s+(?:table|function|index|policy|into|public\.)/i.test(
  catalog.replace(/--[^\n]*/g,"")),
 "A consulta de catálogo deve permanecer somente leitura");
console.log("PASS: proposta MFA estrita não aplicada; consulta de catálogo somente leitura; onboarding obrigatório documentado.");
