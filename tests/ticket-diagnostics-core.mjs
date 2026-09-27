import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext,Script} from "node:vm";
const code=readFileSync(new URL("../assets/ticket-diagnostics-core.js",import.meta.url),"utf8");
new Script(code,{filename:"ticket-diagnostics-core.js"});
let exported;
const window={};
runInNewContext(code,{window});
exported=window.PROXITI_DIAGNOSTICS;
assert(exported&&exported.version==="1.0-local");
const checks=[
 ["O Wi-Fi caiu e outros aparelhos estão sem internet","wifi","Primeira triagem: rede"],
 ["O Windows está muito lento e o disco está 100%","performance","Lentidão e recursos"],
 ["O notebook liga, mas não inicia Windows e mostra tela azul","boot","Inicialização"],
 ["SSD com ruído e dados perdidos","storage","Preservar dados"],
 ["Cliquei num link suspeito, phishing e conta hackeada","security","Proteção de conta"],
 ["Backup falhou, preciso recuperar arquivos apagados","backup","Restauração"],
 ["A impressora não imprime e há papel preso","printing","Impressora"],
 ["Notebook não liga, carregador sem energia","power","Alimentação"],
 ["Está muito quente e o cooler faz barulho","heat","Temperatura"],
 ["Login bloqueado, não recebo código MFA","accounts","Autenticação"],
 ["Sem som no microfone e webcam","audio","Áudio"],
 ["O dispositivo apresenta erro desconhecido","general","Fallback"]
];
for(const [input,id,label]of checks){
 const r=exported.analyze(input);
 assert(!r.empty&&r.cases.some(item=>item.id===id),label+": hipótese não sugerida");
 assert(r.questions.length>=1&&r.cases.every(item=>item.steps.length>=3),"Etapas ausentes: "+label);
 assert(r.cases.every(item=>item.steps[0].level==="Inicial"),"Diagnóstico inicial ausente: "+label);
 assert(!r.summary.includes(input),"Texto do cliente não pode ser incluído automaticamente no resumo");
}
for(const raw of ["","  ","  /  "]){
 const res=exported.analyze(raw);
 assert(res.empty&&res.cases.length===0,"Entrada vazia gera diagnóstico indevido");
}
const suspicious=exported.analyze("O cliente recebeu phishing, ransomware e disse a senha pessoal.");
assert(suspicious.warning.includes("evidências"),"Incidente sem advertência");
assert(!exported.replyDraft(suspicious).includes("senha pessoal"),"Rascunho divulga dados do relato");
assert(exported.replyDraft(suspicious).includes("Não envie senhas"),"Orientação de segurança ausente");
const backup=exported.analyze("Arquivos perdidos no SSD preciso formatar");
assert(backup.cases.some(x=>x.id==="storage"||x.id==="backup"));
assert(backup.warning.includes("Não formate"),"Condição destrutiva sem aviso");
for(const tier of backup.cases.flatMap(item=>item.steps)){
 assert(!/execute|inicie um comando automaticamente/i.test(tier.title),"Execução automática proibida");
}
const accountOnly=exported.analyze("As credenciais expiraram e o login está bloqueado");
assert(accountOnly.cases.some(x=>x.id==="accounts"),"Falha de login ignorada");
assert(!accountOnly.cases.some(x=>x.id==="wifi"),"Substring de credenciais gerou falso positivo de rede");
const linux=exported.analyze("WiFi não conecta",{impact:"multiple",platform:"linux"});
assert(linux.priority.includes("Vários dispositivos"),"Impacto ignorado");
assert(linux.cases.some(x=>x.sources.some(y=>y.url.includes("help.ubuntu.com"))),"Linux sem documentação adequada");
assert(!linux.cases.some(x=>x.sources.some(y=>y.url.includes("microsoft.com"))),"Documentação de Windows sugerida para Linux");
const windows=exported.analyze("WiFi não conecta",{platform:"windows"});
assert(windows.cases.some(x=>x.sources.some(y=>y.url.includes("support.microsoft.com"))),"Windows sem documentação adequada");
assert(!windows.cases.some(x=>x.sources.some(y=>y.url.includes("help.ubuntu.com"))),"Documentação de Ubuntu sugerida para Windows");
const router=exported.analyze("WiFi não conecta",{platform:"network"});
assert(router.cases.every(x=>x.sources.every(y=>!/(microsoft.com|help.ubuntu.com)/.test(y.url))),"Rede/roteador exibe guia específico de sistema operacional");
assert(!/\b(fetch|XMLHttpRequest|sendBeacon|\.rpc)\s*\(/.test(code),"Motor local contém transporte de dados");
console.log("PASS: 12 famílias, níveis, termos inteiros, fontes por ambiente, risco de dados e isolamento local.");