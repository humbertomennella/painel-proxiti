/* PROXITI · Apoio local à triagem. Não acessa APIs nem dados externos. */
(() => {
"use strict";
const links=Object.freeze({
 wifi:{label:"Microsoft: solucionar problemas de Wi-Fi",url:"https://support.microsoft.com/pt-br/windows/experience/connectivity-networking/fix-wi-fi-connection-issues-in-windows"},
 cable:{label:"Microsoft: problemas de Ethernet",url:"https://support.microsoft.com/pt-br/windows/experience/connectivity-networking/fix-ethernet-connection-problems-in-windows"},
 linux:{label:"Ubuntu: diagnóstico de rede sem fio",url:"https://help.ubuntu.com/community/WifiDocs/WirelessTroubleShootingGuide"},
 boot:{label:"Microsoft Learn: problemas de inicialização",url:"https://learn.microsoft.com/pt-br/troubleshoot/windows-client/performance/windows-boot-issues-troubleshooting"},
 speed:{label:"Microsoft: desempenho do computador",url:"https://support.microsoft.com/pt-br/windows/experience/performance-optimization/tips-to-improve-pc-performance-in-windows"},
 backup:{label:"Microsoft: backup e restauração",url:"https://support.microsoft.com/pt-br/windows/experience/backup-recovery/backup-restore-and-recovery-in-windows"},
 phishing:{label:"FTC: identificar mensagens fraudulentas",url:"https://consumer.ftc.gov/articles/how-recognize-avoid-phishing-scams"},
 scams:{label:"FTC: golpes de suporte técnico",url:"https://consumer.ftc.gov/articles/how-spot-avoid-and-report-tech-support-scams"}
});
const S=(level,title,detail,warning="")=>({level,title,detail,warning});
const K=(id,title,terms,question,steps,refs,alert="")=>Object.freeze({id,title,terms,question,steps,refs,alert});
const rules=Object.freeze([
 K("storage","Armazenamento e integridade dos dados",["ssd","hd","disco","smart","ruido no disco","clique no hd","arquivos sumiram","arquivos corrompidos","nao reconhece unidade","erro de leitura","bad block","setor defeituoso","dados perdidos"],[
  "O dispositivo ainda reconhece a unidade? Houve ruído, quedas ou desligamentos inesperados?",
  "Quais dados são prioritários e existe cópia de segurança verificada?"],[
  S("Inicial","Preservar o estado atual","Evite novas gravações, instalações, reinicializações repetidas e ferramentas de reparo antes de entender o risco.","Possível perda de dados: não formate e não rode utilitários de reparo às cegas."),
  S("Intermediário","Verificar informações sem alterar a unidade","Com autorização, identifique modelo, detecção pelo firmware, conexões e indicadores de integridade disponíveis sem iniciar reparos."),
  S("Avançado","Planejar cópia ou encaminhamento especializado","Se houver falha física ou dados insubstituíveis, explique limites, orçamento e encaminhamento profissional; nenhuma recuperação é garantida.","Intervenção física ou clonagem depende de escopo, riscos e autorização.")],["backup"],"Preservação de dados prioritária. Não prometa recuperação."),
 K("security","Suspeita de golpe, phishing ou comprometimento",["phishing","golpe","fraude","invasao","hackeado","ransomware","malware","virus","trojan","conta invadida","link suspeito","anexo suspeito","acesso indevido","roubo de senha","caiu no golpe"],[
  "O cliente clicou no link, abriu anexo ou digitou credenciais? Há outros dispositivos ou contas afetados?",
  "Quando começou e há registros do ocorrido que possam ser preservados?"],[
  S("Inicial","Conter a exposição com orientação","Evite abrir novamente links ou anexos. Se houver atividade maliciosa em curso, avalie desconectar o dispositivo da rede sem destruir evidências.","Não solicite senha, código MFA ou acesso irrestrito."),
  S("Intermediário","Delimitar o incidente e proteger contas","Oriente o titular a trocar credenciais em dispositivo confiável e revisar MFA e sessões, conforme o tipo de incidente; registre somente o necessário."),
  S("Avançado","Encaminhar além do suporte preventivo","Se houver fraude financeira, exfiltração ou ambiente empresarial comprometido, acione o responsável e encaminhe a especialista habilitado.","A PROXITI não oferece perícia, pentest nem SOC.")],["phishing","scams"],"Possível incidente: evite apagar evidências."),
 K("wifi","Conectividade Wi-Fi e internet",["wifi","wi-fi","rede","sem internet","internet caiu","internet lenta","nao conecta","nao conecta no wifi","rede sem fio","roteador","modem","sinal fraco","dns","dhcp","ethernet","cabo de rede","ip 169.254"],[
  "O problema ocorre em um ou vários aparelhos? A conexão é Wi-Fi, cabo ou ambas?",
  "O dispositivo conecta à rede local? Há acesso a outros sites e houve mudança recente?"],[
  S("Inicial","Distinguir rede local, aparelho e provedor","Confira estado da conexão, modo avião, cabos e luzes do equipamento; compare com outro dispositivo autorizado."),
  S("Intermediário","Verificar endereçamento e qualidade de sinal","Com autorização, examine IP, gateway, DNS, DHCP, banda de 2,4/5 GHz e interferência, sem modificar configurações críticas."),
  S("Avançado","Investigar serviços e configurações","Teste rotas, DNS, política de firewall e equipamento de rede com plano de reversão; mudanças no roteador exigem autorização.","Reiniciar roteador pode interromper outros usuários e serviços.")],["wifi","cable","linux"]),
 K("performance","Lentidão e travamentos do computador",["lento","lentidao","travando","congelando","alto uso","100% disco","100% cpu","memoria cheia","muito demorado","demora para abrir","desempenho","processo pesado"],[
  "A lentidão ocorre ao iniciar ou durante qual tarefa? Começou após atualização ou instalação?",
  "Há alertas de armazenamento, aquecimento ou perda de arquivos?"],[
  S("Inicial","Reproduzir o sintoma e mapear o impacto","Confira espaço livre, processos ativos, atualizações pendentes e histórico do problema, sem apagar arquivos."),
  S("Intermediário","Isolar aplicativo, inicialização ou recurso","Com autorização, compare o uso de CPU, memória, armazenamento e processos; registre resultados e preserve dados."),
  S("Avançado","Planejar manutenção ou substituição","Se houver indício físico ou necessidade de alteração de sistema, valide backup, orçamento e teste de reversão.","Otimizações destrutivas e instalação de utilitários dependem de aceite.")],["speed","backup"]),
 K("boot","Falha de inicialização ou tela azul",["nao inicia","nao inicializa","nao liga o windows","tela azul","bsod","boot","inicializacao","reinicia sozinho","loop de reinicio","sem sistema","erro ao iniciar","kernel panic"],[
  "O equipamento liga e mostra a tela do fabricante? Qual é a mensagem de erro exata?",
  "Existe backup e o erro surgiu após atualização, queda ou troca de peça?"],[
  S("Inicial","Identificar a etapa em que falha","Diferencie ausência de energia, ausência de vídeo, falha de firmware e falha de carregamento do sistema."),
  S("Intermediário","Consultar recuperação sem alterar dados","Quando possível, consulte registros e opções de inicialização segura sem reinstalar ou formatar."),
  S("Avançado","Preparar reparo autorizado","Antes de reparar bootloader, atualizar firmware ou reinstalar, documente riscos, backup e consentimento.","Falha de unidade pode piorar com tentativas repetidas de inicialização.")],["boot","backup"]),
 K("power","Falha elétrica ou equipamento sem ligar",["nao liga","sem energia","sem sinal de vida","fonte","carregador","bateria nao carrega","desliga sozinho","tomada","botao power","placa mae"],[
  "Há LED, ventilador ou bip? O problema ocorre também com outra fonte compatível?",
  "Houve líquido, cheiro, faísca, queda ou superaquecimento?"],[
  S("Inicial","Evitar risco elétrico","Verifique o estado externo do cabo, tomada e carregador sem abrir o equipamento."),
  S("Intermediário","Isolar componentes externos","Com autorização, teste fonte compatível, periféricos e condições de alimentação seguras."),
  S("Avançado","Encaminhar medição e reparo especializado","Avalie bancada habilitada e orçamento antes de abrir fonte, placa ou bateria.","Não abra fontes nem manuseie bateria danificada; risco de choque/incêndio.")],[], "Segurança elétrica antes de qualquer intervenção."),
 K("heat","Aquecimento e ventilação",["esquentando","superaquecimento","temperatura alta","cooler","ventoinha","barulho do ventilador","thermal","muito quente"],[
  "O desligamento ocorre sob carga? As saídas de ar estão obstruídas?",
  "Houve limpeza ou intervenção recente? O equipamento está em superfície adequada?"],[
  S("Inicial","Reduzir a carga e verificar ventilação","Interrompa tarefas intensivas, confirme superfícies e ventilação; registre sintomas."),
  S("Intermediário","Observar temperaturas com ferramenta confiável","Com autorização, compare temperaturas e rotação em repouso e carga segura, sem estressar sistema instável."),
  S("Avançado","Planejar manutenção física","Considere limpeza e revisão térmica apenas em bancada apropriada, após diagnóstico e orçamento.","Não manipule bateria inchada ou equipamento com odor de queimado.")],["speed"]),
 K("backup","Backup, restauração e exclusão de arquivos",["backup","restaurar","recuperar arquivos","arquivo apagado","pasta sumiu","sincronizacao","nuvem","onedrive","copia de seguranca","dados excluidos","formatar"],[
  "Existe cópia testada? A exclusão foi local, na nuvem ou em ambos?",
  "Qual arquivo é prioritário, quando foi visto pela última vez e houve gravações depois?"],[
  S("Inicial","Evitar sobrescrita","Confirme que o arquivo não foi movido ou está em lixeira/histórico sem gravar novos dados na unidade."),
  S("Intermediário","Conferir versões e cópias existentes","Com o titular, verifique backups disponíveis e o destino de restauração; não sobrescreva a única cópia."),
  S("Avançado","Avaliar recuperação ou encaminhamento","Só após diagnóstico e orçamento considere restauração controlada ou serviço especializado.","Nunca garanta recuperação e não formate sem autorização específica.")],["backup"],"Confirme o backup antes de procedimentos destrutivos."),
 K("printing","Impressão, scanner e periféricos",["impressora","imprimir","fila de impressao","scanner","digitalizar","papel preso","toner","cartucho","usb nao funciona","periferico"],[
  "O problema ocorre apenas neste computador ou em todos? A impressora exibe código de erro?",
  "Conexão USB, Wi-Fi ou rede? Há falhas físicas de alimentação de papel?"],[
  S("Inicial","Confirmar estado e mensagem","Verifique energia, papel, indicadores e fila de impressão, sem abrir partes aquecidas."),
  S("Intermediário","Isolar conexão e fila","Com autorização, teste página local, conexão e driver apropriado do fabricante."),
  S("Avançado","Planejar intervenção técnica","Registre erros persistentes e encaminhe manutenção mecânica ou firmware ao fabricante conforme escopo.","Não atualize firmware em equipamento instável sem plano de recuperação.")],[]),
 K("accounts","Acesso a contas e autenticação",["nao consigo entrar","esqueci senha","senha incorreta","mfa","2fa","codigo de acesso","conta bloqueada","login","autenticacao","verificacao em duas etapas","e-mail bloqueado"],[
  "Qual serviço apresenta erro? Há método de recuperação oficial disponível?",
  "O titular reconhece a atividade recente ou há suspeita de invasão?"],[
  S("Inicial","Usar os canais oficiais do serviço","Confirme domínio e fluxo de recuperação com o titular, sem solicitar que ele revele senhas ou códigos."),
  S("Intermediário","Verificar segurança da conta","Oriente o titular a revisar dispositivos, sessões e fatores MFA em dispositivo confiável."),
  S("Avançado","Escalar bloqueio ou suspeita de fraude","Acione o suporte oficial e preserve os registros necessários com autorização.","Nunca contorne MFA, compartilhe credenciais ou peça códigos de autenticação.")],["phishing"]),
 K("audio","Áudio, vídeo e comunicação",["sem som","microfone","camera","webcam","video nao aparece","alto falante","fone nao funciona","audio cortando","chamada sem audio"],[
  "O problema ocorre em um único aplicativo ou em todos? Qual dispositivo de entrada/saída está selecionado?",
  "Houve atualização ou conexão recente de periférico?"],[
  S("Inicial","Conferir seleção e permissões","Valide volume, dispositivo padrão e permissões do aplicativo."),
  S("Intermediário","Isolar aplicativo e periférico","Com autorização, faça teste local e compare outro aplicativo ou dispositivo."),
  S("Avançado","Revisar driver ou hardware","Verifique logs e compatibilidade antes de atualização de driver ou substituição." )],[]),
 K("general","Triagem inicial do atendimento",[],[
  "Qual é a mensagem ou comportamento exato? Quando começou e quais ações o antecederam?",
  "A falha ocorre em um ou vários dispositivos? Existe cópia de segurança verificada?"],[
  S("Inicial","Confirmar escopo e reproduzir com segurança","Peça ao cliente uma descrição objetiva e registre o comportamento observado, sem solicitar senhas."),
  S("Intermediário","Isolar uma variável por vez","Verifique sistema, conectividade, periféricos e eventos recentes; anote o resultado de cada teste."),
  S("Avançado","Definir intervenção ou encaminhamento","Se o diagnóstico exigir acesso, mudança de configuração ou peça, apresente escopo, risco e orçamento antes da execução.","Não prometa resultado sem evidência.")],[])
]);
const normalize=value=>String(value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^\p{L}\p{N}.]+/gu," ").replace(/\s+/g," ").trim();
function analyze(text,options={}){
 const cleaned=normalize(text),platform=String(options.platform||"unspecified"),impact=String(options.impact||"unspecified");
 if(!cleaned)return {empty:true,cases:[],warning:"Descreva um sintoma sem dados pessoais para iniciar a triagem.",questions:[],priority:"A confirmar",summary:""};
 const ranked=rules.filter(rule=>rule.id!=="general").map(rule=>({
  rule,matched:rule.terms.filter(term=>cleaned.includes(normalize(term)))
 })).filter(item=>item.matched.length).sort((a,b)=>{
  const weight=x=>x.matched.reduce((n,term)=>n+Math.min(normalize(term).length/8,3),0)+(x.rule.alert?0.15:0);
  return weight(b)-weight(a);
 });
 const cases=(ranked.length?ranked.slice(0,3):[{rule:rules.find(rule=>rule.id==="general"),matched:[]}]).map(item=>({
  id:item.rule.id,title:item.rule.title,matched:item.matched,questions:[...item.rule.question],
  steps:item.rule.steps.map(step=>({...step})),sources:item.rule.refs.map(key=>({...links[key]})),
  alert:item.rule.alert
 }));
 const dataRisk=/(arquivo|dados|backup|format|apag|restaur|disco|ssd|hd|ransomware)/.test(cleaned)||
   cases.some(c=>["storage","backup","security"].includes(c.id));
 const priority=impact==="security"?"Segurança ou dados em risco: avaliar contenção":
  impact==="business"?"Operação essencial afetada: priorizar triagem":
  impact==="multiple"?"Vários dispositivos afetados: verificar causa comum":
  impact==="single"?"Um dispositivo afetado":"Impacto a confirmar com o cliente";
 const questions=[...new Set(cases.flatMap(c=>c.questions))].slice(0,5);
 const warning=dataRisk?"Preserve dados e evidências. Não formate, apague nem altere configurações críticas sem verificar backup, escopo e autorização.":"Confirme autorização, escopo e impactos antes de alterar o ambiente do cliente.";
 const summary=["Triagem assistida local · hipóteses não confirmadas.",priority,
  "Áreas sugeridas: "+cases.map(c=>c.title).join("; ")+".",
  "Perguntas: "+questions.join(" "),
  "Verificações iniciais: "+cases.map(c=>c.steps[0].title+" — "+c.steps[0].detail).join(" | "),
  warning].join("\n");
 return {empty:false,cases,questions,warning,priority,platform,impact,summary};
}
function replyDraft(result){
 if(!result||result.empty)return "";
 return "Para entender melhor o problema, preciso confirmar alguns pontos:\n"+
 result.questions.slice(0,3).map((question,i)=>(i+1)+". "+question).join("\n")+
 "\nCom essas informações, verificarei as alternativas mais seguras antes de propor qualquer intervenção. Não envie senhas ou códigos de autenticação.";
}
window.PROXITI_DIAGNOSTICS=Object.freeze({analyze,replyDraft,version:"1.0-local",sourceLabels:Object.freeze(Object.values(links).map(link=>link.label))});
})();