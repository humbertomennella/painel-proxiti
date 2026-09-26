import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { Script, runInNewContext } from "node:vm";

const get = path => readFileSync(new URL("../"+path,import.meta.url),"utf8");
const html=get("index.html");
const scriptPaths=[
  "assets/app.js","assets/alerts.js","assets/operations.js","assets/layout.js",
  "assets/profile.js","assets/appearance.js","assets/overview-model.js","assets/overview.js","assets/ticket-workflow.js",
  "assets/ticket-extras.js","assets/agenda.js","assets/technical-tools-core.js","assets/technical-tools.js"
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
for (const path of ["assets/proxiti-ui.css","assets/interface.css","assets/overview-comfort.css","assets/ticket-workflow.css","assets/operations-v8.css","assets/support-desk.svg","assets/overview-art.svg"])
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
assert(html.includes('src="./assets/ticket-workflow.js?v=20260926-1"'),"Script técnico não carregado");
assert(html.includes('href="./assets/ticket-workflow.css?v=20260926-1"'),"Estilos técnicos não carregados");
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
assert(get("assets/operations.js").includes("const nextGeneration=state.accessGeneration+1"),
 "Reingresso não deve aceitar consultas da sessão anterior");
assert(get("assets/operations.js").includes("state.tickets.filter(hasAttention)")&&
 get("assets/overview-model.js").includes('ticket.status!=="closed"'),
 "Fila e visão geral devem excluir históricos encerrados das pendências");
assert(techCss.includes("@media(max-width:680px)"),"Ferramentas sem layout móvel");
for(const id of ["training-search","training-search-status","tools-search","tools-search-status"])
 assert(html.includes('id="'+id+'"'),"Pesquisa sem controle: "+id);
assert(get("assets/operations.js").includes("function filterOpsList("),"Busca local ausente");
assert(techCss.includes(".ops-list-item[hidden]"),"Busca não recolhe itens no CSS");
assert(get("assets/layout.js").includes('el("overview-home").hidden=!overview'),"Visão geral não é isolada");
console.log("PROXITI: JS, IDs, inbox, MFA, temas, sidebar e Visão geral verificados.");

for(const id of ["ops-agenda","reload-agenda","agenda-filter","agenda-list","agenda-count",
 "training-kind","training-body","training-category","training-category-filter","training-reference",
 "training-cancel","ticket-device-form","ticket-device-summary","ticket-appointment-form",
 "ticket-appointments-list","ticket-report-save","ticket-report-history","ticket-extras-feedback",
 "subnet-form","subnet-result","hash-form","hash-result"]){
 assert(html.includes('id="'+id+'"'),"Central V8 sem #"+id);
}
assert(html.includes('data-side-view="agenda"')&&html.includes('data-summary-view="agenda"'),
 "Agenda sem acesso na navegação");
assert(html.includes('src="./assets/technical-tools-core.js?v=1"'),"Core das ferramentas não carregado");
assert(html.includes('src="./assets/ticket-extras.js?v=20260926-2"'),"Integração de compromissos não carregada");
const cssV8=get("assets/operations-v8.css");
assert.equal((cssV8.match(/{/g)||[]).length,(cssV8.match(/}/g)||[]).length,
 "CSS V8 desbalanceado");
assert(cssV8.includes(".academy-body")&&cssV8.includes(".digital-toolkit"),
 "Academia ou ferramentas sem estilo");
const v8=get("supabase/central_operations_v8.sql"),academy=get("supabase/academy_content_v8.sql");
for(const rule of ["ticket_appointments","ticket_devices","ticket_reports",
 "proxiti_schedule_appointment","proxiti_update_appointment","proxiti_save_ticket_device",
 "proxiti_save_ticket_report","for select to authenticated using(public.proxiti_ticket_access"]){
 assert(v8.includes(rule),"Schema V8 sem proteção "+rule);
}
assert.equal((academy.match(/insert into public.training_materials\(/g)||[]).length,10,
 "Academia deve ter dez procedimentos completos");
assert(academy.includes("on conflict(content_key) where content_key is not null do nothing"),
 "Migração editorial precisa preservar edições existentes");
const ctx={window:{}};
runInNewContext(get("assets/technical-tools-core.js"),ctx);
const calculator=ctx.window.PROXITI_TOOL_CORE.subnet;
assert.equal(calculator("192.168.10.25",24).network,"192.168.10.0");
assert.equal(calculator("192.168.10.25",24).mask,"255.255.255.0");
assert.equal(calculator("192.168.10.25",24).hosts,254);
assert.equal(calculator("10.0.0.3",31).first,"10.0.0.2");
assert.equal(calculator("10.0.0.3",31).hosts,2);
assert.equal(calculator("10.0.0.3",32).hosts,1);
assert.equal(calculator("0.0.0.0",0).hosts,4294967294);
assert.throws(()=>calculator("300.0.0.1",24));
assert.throws(()=>calculator("10.0.0.1",33));
assert.throws(()=>calculator("001.0.0.1",24));
console.log("PROXITI V8: Academia, agenda, dispositivos, relatórios e calculadora IPv4 testados.");

for(const id of ["overview-sync-state","overview-retry","overview-resume","overview-resume-action",
 "overview-data-note","overview-metric-unread-label","overview-metric-unread-description"]){
 assert(html.includes('id="'+id+'"'),"Visão geral sem #"+id);
}
assert(html.indexOf("assets/overview-model.js")<html.indexOf("assets/operations.js"),
 "Modelo de indicadores deve carregar antes da fila");
assert(get("assets/operations.js").includes("window.PROXITI_OVERVIEW_MODEL.summarize"),
 "Fila e painel não compartilham critério de contagem");
assert(get("assets/operations.js").includes("if(state.ticketsReady)publishOverview()"),
 "Indicadores não devem ser publicados antes da fila estar disponível");
assert(get("assets/overview.js").includes('setSync("loading")'),
 "Visão geral sem tentativa de sincronização");
assert(get("assets/overview.js").includes('status.dataset.phase="restricted"'),
 "Acesso restrito sem estado explícito");
const overviewContext={window:{}};
runInNewContext(get("assets/overview-model.js"),overviewContext);
const model=overviewContext.window.PROXITI_OVERVIEW_MODEL;
const tickets=[
 {id:"new",reference:1,subject:"Novo",status:"new",created_at:"2026-09-25T12:00:00Z"},
 {id:"progress",reference:2,subject:"Execução",status:"in_progress",created_at:"2026-09-25T11:00:00Z"},
 {id:"closed",reference:3,subject:"Histórico",status:"closed",created_at:"2026-09-25T10:00:00Z"},
 {id:"triage",reference:4,subject:"Triagem",status:"triage",created_at:"2026-09-25T09:00:00Z"}
];
const options={seen:id=>id!=="new",unread:id=>["new","progress","closed"].includes(id)?1:0,
 canReadMessages:true,messagesReady:true,activeId:"progress",at:1,sampleLimit:100};
const complete=model.summarize(tickets,options);
assert.equal(complete.unread,2,"Chamado novo com mensagem deve contar uma vez");
assert.equal(complete.active,3,"Chamado encerrado não é ativo");
assert.equal(complete.open,2);
assert.equal(complete.progress,1);
assert.equal(complete.recent.some(t=>t.status==="closed"),false);
assert.equal(complete.resume.id,"progress");
assert.equal(model.summarize(tickets,{...options,messagesReady:false}).unread,null,
 "Sem sincronização das mensagens não pode exibir falso zero");
assert.equal(model.summarize(tickets,{...options,readIssue:true}).unread,null);
assert.equal(model.summarize(tickets,{...options,canReadMessages:false}).unread,1,
 "Sem permissão para chat, só novos chamados devem contar");
assert.equal(model.attention(tickets[2],()=>false,()=>4,true,true),false,
 "Encerrados nunca são pendências acionáveis");
assert(existsSync(new URL("../docs/visao-geral-homologacao.md",import.meta.url)),
 "Documentação de homologação da Visão Geral ausente");
assert(get("README.md").includes("docs/visao-geral-homologacao.md"),
 "Roteiro de homologação não está disponível no README");
assert(get("assets/operations.js").includes('node.textContent=partial?"?"'),
 "Badge não distingue atualização parcial");
console.log("Visão geral: contagens, acesso, estado parcial e retomada testados.");


for(const id of ["ticket-sync-status","ticket-thread-status","ticket-thread-retry","ticket-status-help"]){
 assert(html.includes('id="'+id+'"'),"Chamados sem estado acessível #"+id);
}
const ticketSafety=get("supabase/ticket_safety_v9.sql");
assert(ticketSafety.includes("status=case when status='new' then 'triage' else status end"),
 "Assunção altera indevidamente o estado em andamento");
assert(ticketSafety.includes("if previous_status='closed' then")&&ticketSafety.includes("for update"),
 "Histórico encerrado pode ser reaberto ou alterado durante concorrência");
assert(ticketSafety.includes("revoke all on function public.proxiti_claim_ticket(uuid) from public,anon"),
 "Assumir chamado exposto ao público");
assert(ticketSafety.includes("revoke all on function public.proxiti_change_ticket_status(uuid,text) from public,anon"),
 "Mudança de situação exposta ao público");
assert(get("assets/operations.js").includes('order("created_at",{ascending:false}).order("id",{ascending:false}).limit(151)'),
 "Chat não carrega mensagens recentes com ordenação estável");
assert(html.includes('id="ticket-thread-older"')&&
 get("assets/operations.js").includes('async function loadEarlierMessages()'),
 "Conversa sem acesso ao histórico anterior");
assert(get("assets/operations.js").includes('threadSync("read-error")'),
 "Falha na confirmação de leitura não é comunicada");
assert(techJs.includes("verification=await query(db.from(\"ticket_attachments\")"),
 "Falha de upload pode apagar arquivo já registrado");
assert(techJs.includes("noteDrafts.clear()"),"Notas em rascunho sobrevivem ao logout");
assert(get("assets/ticket-extras.js").includes("const same=(rev,ticketId,client,uid)"),
 "Extras do chamado sem proteção contra leitura tardia");
assert(existsSync(new URL("../tests/tickets-functional.mjs",import.meta.url)),
 "Testes funcionais de chamados não existem");
console.log("Chamados: segurança, histórico, conversa e integridade técnica verificados.");

for(const id of ["agenda-sync-state","agenda-feedback","agenda-load-more","agenda-list","agenda-filter"]){
 assert(html.includes('id="'+id+'"'),"Agenda sem estado ou controle acessível: "+id);
}
assert(html.includes('src="./assets/agenda.js?v=20260926-1"'),"Módulo Agenda não carregado");
const agendaJs=get("assets/agenda.js"),agendaSql=get("supabase/agenda_integrity_v10.sql");
for(const rpc of ["proxiti_confirm_appointment","proxiti_update_appointment",
 "proxiti_reschedule_appointment"]){
 assert(agendaJs.includes(rpc),"Agenda sem operação "+rpc);
 assert(agendaSql.includes("public."+rpc),"RPC da Agenda não existe na migração: "+rpc);
}
assert(agendaSql.includes("confirmation_channel")&&agendaSql.includes("confirmed_at"),
 "Confirmação não armazena evidência de contato");
assert(agendaSql.includes("for update")&&
 agendaSql.includes("old_status in ('done','cancelled')"),
 "A transição da agenda não protege estados terminais ou concorrência");
assert(agendaSql.includes("status='planned',confirmed_at=null"),
 "Reagendamento não invalida confirmação anterior");
assert(agendaJs.includes(".range(offset,offset+PAGE_SIZE)"),
 "Agenda não possui paginação de histórico");
assert(agendaJs.includes("session()?.client===active.client"),
 "Agenda pode exibir resposta atrasada de outra sessão");
assert(existsSync(new URL("../tests/agenda-functional.mjs",import.meta.url)),
 "Testes funcionais da Agenda não foram adicionados");
console.log("Agenda: migração, permissões, paginação e testes funcionais verificados.");
