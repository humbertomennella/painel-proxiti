import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { Script } from "node:vm";

const get = path => readFileSync(new URL("../"+path,import.meta.url),"utf8");
const html=get("index.html");
const scriptPaths=[
  "assets/app.js","assets/alerts.js","assets/operations.js","assets/layout.js",
  "assets/profile.js","assets/appearance.js","assets/overview.js","assets/ticket-workflow.js"
];
for (const path of scriptPaths) new Script(get(path),{filename:path});
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(x=>x[1]);
assert.equal(new Set(ids).size,ids.length,"IDs HTML duplicados");
for (const path of scriptPaths){
  const src=get(path);
  const refs=[...src.matchAll(/\bel\(["']([^"']+)["']\s*\)/g)].map(x=>x[1]);
  for(const id of refs)assert(ids.includes(id),path+": elemento #"+id+" não existe");
}
for(const id of ["ticket-workspace","ticket-list","ticket-detail","ticket-audit-list","browser-notifications","mfa-form","profile-mfa-start","overview-home","overview-focus-toggle","overview-kpi-unread","overview-recent-list"])
  assert(html.includes('id="'+id+'"')||id==="ticket-workspace"&&html.includes('class="ticket-workspace"'),id+" ausente");
assert(get("assets/operations.js").includes("proxiti_mark_ticket_read"));
assert(get("assets/app.js").includes("getAuthenticatorAssuranceLevel"));
assert(get("assets/profile.js").includes("challengeAndVerify"));
assert(get("supabase/ticket_receipts_and_audit_v6.sql").includes("ticket_audit"));
assert(get("supabase/admin_totp_authorization_v6.sql").includes("proxiti_mfa_ready"));
assert(get("supabase/functions/proxiti-support/index.ts").includes('assurance !== "aal2"'));
for (const match of html.matchAll(/<script[^>]+src="\.\/([^"]+)"[^>]*>/g))
  assert(existsSync(new URL("../"+match[1].split(/[?#]/,1)[0],import.meta.url)),"Script local ausente: "+match[1]);
for (const link of html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="\.\/([^"]+)"[^>]*>/g))
  assert(existsSync(new URL("../"+link[1],import.meta.url)),"Estilo local ausente: "+link[1]);
for (const path of ["assets/proxiti-ui.css","assets/interface.css","assets/overview-comfort.css","assets/ticket-workflow.css","assets/support-desk.svg","assets/overview-art.svg"])
  assert(existsSync(new URL("../"+path,import.meta.url)),path+" ausente");
assert(html.includes('id="theme-toggle-public"')&&html.includes('id="theme-toggle-panel"'),"Tema público/privado ausente");
assert(!html.includes('id="palette-select"'),"Paletas antigas ainda presentes na interface");
assert(html.includes('data-theme="light"'),"Tema claro inicial ausente");
assert(get("assets/appearance.js").includes('proxiti-theme-v3'),"Preferência de tema incompatível com o site");
assert(get("assets/layout.js").includes('sidebar.addEventListener("pointerenter"'),"Hover lateral ausente");
assert(get("assets/layout.js").includes('sidebar.addEventListener("pointerleave"'),"Recolhimento lateral ausente");
assert(get("assets/alerts.js").includes("tone([650,480]"),"Som de desativação ausente");
const interfaceCss=get("assets/interface.css");
assert(interfaceCss.includes('html[data-theme="light"]')&&interfaceCss.includes('html[data-theme="dark"]'),"Temas incompletos");
assert.equal((interfaceCss.match(/{/g)||[]).length,(interfaceCss.match(/}/g)||[]).length,"Chaves CSS desbalanceadas");
assert(get("assets/operations.js").includes("function publishOverview()"),"Resumo de chamados não é publicado");
assert(get("assets/overview.js").includes("proxiti-overview-updated"),"Painel inicial sem eventos operacionais");
for(const id of ["overview-reading-toggle","overview-reading-label","overview-guide-toggle","overview-guide","overview-guide-tickets"]){
 assert(html.includes('id="'+id+'"'),"Controle de conforto ausente: "+id);
}
assert(html.includes('aria-controls="overview-guide"'),"Guia sem vínculo acessível");
assert(html.includes('aria-pressed="false" title="Ampliar o texto da visão geral"'),"Leitura sem estado acessível");
const comfortCss=get("assets/overview-comfort.css");
assert(comfortCss.includes("overview-reading-mode"),"Leitura ampliada sem estilo");
assert(comfortCss.includes("overview-guide-grid"),"Guia contextual sem layout");
assert(comfortCss.includes("grid-template-columns:1fr"),"Guia sem adaptação móvel");
assert.equal((comfortCss.match(/{/g)||[]).length,(comfortCss.match(/}/g)||[]).length,"Chaves de conforto CSS desbalanceadas");
const overviewJs=get("assets/overview.js");
assert(overviewJs.includes("localStorage.setItem(readingKey(userId)"),"Preferência visual não é persistida por conta");
assert(overviewJs.includes('el("overview-guide-tickets").hidden=!canTickets'),"Orientação ignora permissões");
assert(overviewJs.includes('if(active)setGuide(false)'),"Modo de foco não recolhe o guia");

// Fluxo técnico V7: contratos estáticos. Testes funcionais de duas contas continuam obrigatórios.
for(const id of ["ticket-workflow","ticket-note-form","ticket-note-body","ticket-notes-list",
 "ticket-tasks-start","ticket-tasks-create","ticket-tasks-list","ticket-file-form",
 "ticket-file-input","ticket-files-list","ticket-report-form"]){
 assert(html.includes('id="'+id+'"'),"Fluxo técnico sem #"+id);
}
assert(html.includes('src="./assets/ticket-workflow.js?v=1"'),"Script técnico não carregado");
assert(html.includes('href="./assets/ticket-workflow.css?v=1"'),"Estilos técnicos não carregados");
const techCss=get("assets/ticket-workflow.css");
assert.equal((techCss.match(/{/g)||[]).length,(techCss.match(/}/g)||[]).length,"CSS técnico incompleto");
const techJs=get("assets/ticket-workflow.js");
for(const name of ["proxiti_add_ticket_note","proxiti_prepare_ticket_checklist","proxiti_update_ticket_task",
 "proxiti_attach_ticket_file","proxiti-ticket-selected"]){
 assert(techJs.includes(name),"Operação técnica ausente: "+name);
}
assert(techJs.includes('selected.status!=="closed"'),"Histórico encerrado permite edição técnica");
assert(techJs.includes('file.size>5242880'),"Anexos sem tamanho máximo");
assert(techJs.includes('document.createElement(tag)'),"Relatório sem criação segura de DOM");
const migration=get("supabase/ticket_workflow_v7.sql");
for(const rule of ["create or replace function public.proxiti_ticket_access",
 "create table if not exists public.ticket_internal_notes",
 "create table if not exists public.ticket_tasks",
 "create table if not exists public.ticket_attachments",
 "values('proxiti-ticket-files','proxiti-ticket-files',false",
 "revoke all on public.ticket_internal_notes from public,anon,authenticated",
 "revoke all on public.ticket_tasks from public,anon,authenticated",
 "revoke all on public.ticket_attachments from public,anon,authenticated"]){
 assert(migration.includes(rule),"Permissão ou estrutura ausente: "+rule);
}
assert(get("assets/operations.js").includes('const unread=t=>t.status!=="closed"'),
 "Histórico encerrado ainda aparece como pendência");
assert(techCss.includes("@media(max-width:680px)"),"Ferramentas sem layout móvel");
assert(get("assets/layout.js").includes('el("overview-home").hidden=!overview'),"Visão geral não é isolada");
console.log("PROXITI: JS, IDs, inbox, MFA, temas, sidebar e Visão geral verificados.");
