import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { Script } from "node:vm";

const get = path => readFileSync(new URL("../"+path,import.meta.url),"utf8");
const html=get("index.html");
const scriptPaths=[
  "assets/app.js","assets/alerts.js","assets/operations.js","assets/layout.js",
  "assets/profile.js","assets/appearance.js"
];
for (const path of scriptPaths) new Script(get(path),{filename:path});
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(x=>x[1]);
assert.equal(new Set(ids).size,ids.length,"IDs HTML duplicados");
for (const path of scriptPaths){
  const src=get(path);
  const refs=[...src.matchAll(/\bel\(["']([^"']+)["']\s*\)/g)].map(x=>x[1]);
  for(const id of refs)assert(ids.includes(id),path+": elemento #"+id+" não existe");
}
for(const id of ["ticket-workspace","ticket-list","ticket-detail","ticket-audit-list","browser-notifications","mfa-form","profile-mfa-start"])
  assert(html.includes('id="'+id+'"')||id==="ticket-workspace"&&html.includes('class="ticket-workspace"'),id+" ausente");
assert(get("assets/operations.js").includes("proxiti_mark_ticket_read"));
assert(get("assets/app.js").includes("getAuthenticatorAssuranceLevel"));
assert(get("assets/profile.js").includes("challengeAndVerify"));
assert(get("supabase/ticket_receipts_and_audit_v6.sql").includes("ticket_audit"));
assert(get("supabase/admin_totp_authorization_v6.sql").includes("proxiti_mfa_ready"));
assert(get("supabase/functions/proxiti-support/index.ts").includes('assurance !== "aal2"'));
for (const match of html.matchAll(/<script[^>]+src="\.\/([^"]+)"[^>]*>/g))
  assert(existsSync(new URL("../"+match[1],import.meta.url)),"Script local ausente: "+match[1]);
for (const link of html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="\.\/([^"]+)"[^>]*>/g))
  assert(existsSync(new URL("../"+link[1],import.meta.url)),"Estilo local ausente: "+link[1]);
for (const path of ["assets/proxiti-ui.css","assets/interface.css","assets/support-desk.svg","assets/overview-art.svg"])
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
console.log("PROXITI: sintaxe JS, IDs, inbox, MFA, framework, temas e sidebar verificados.");
