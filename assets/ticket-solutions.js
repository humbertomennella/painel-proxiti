/* PROXITI · Planos locais de solução. Hipóteses não são laudos nem execução remota. */
(() => {
"use strict";
const plan=(title,condition,steps,verification,stop)=>Object.freeze({
 title,condition,steps:steps.map(([title,action,expected,ifFailed])=>({title,action,expected,ifFailed})),verification,stop
});
const solutions={
 bitlocker:plan("Recuperar o acesso pela chave legítima","Confirme que a tela solicita a chave do BitLocker, e não uma senha de BIOS/UEFI.",[
 ["Identificar a tela","Identifique a etapa do bloqueio e, se exibido, o ID da chave, sem registrar a chave secreta. Não altere TPM, Secure Boot nem firmware.","A proteção e a tela foram identificadas.","Se o bloqueio ocorrer antes da tela do BitLocker, use o procedimento de firmware."],
 ["Localizar a chave com o titular","O próprio titular consulta https://aka.ms/myrecoverykey, impressão ou cópia USB; em aparelho corporativo, consulta o administrador autorizado. Não solicite a chave pelo chat.","O titular encontrou a chave correspondente ao ID da tela.","Sem chave legítima, interrompa tentativas e encaminhe ao responsável; acesso aos dados não é garantido."],
 ["Seguir a recuperação oficial","Se houver chave correta e a tela estiver acessível, oriente o titular a inserir a chave no próprio dispositivo e observar o resultado.","O volume é desbloqueado e a inicialização prossegue.","Se falhar, preserve dados e consulte o suporte oficial; não formate."]],
 "O titular confirma acesso ao Windows e aos arquivos essenciais, com backup disponível.",
 "Sem chave de recuperação legítima, não há promessa de desbloqueio da unidade criptografada."),
 firmware:plan("Resolver a senha do BIOS/UEFI pelo canal autorizado","Senha de firmware e chave do BitLocker são controles diferentes.",[
 ["Confirmar origem","Identifique a tela, fabricante e modelo; confirme a titularidade sem pedir senha ou número de série no chat.","O bloqueio foi identificado como BIOS/UEFI.","Se a solicitação for do BitLocker, use o roteiro específico."],
 ["Consultar fabricante","O titular contata o suporte oficial do fabricante ou TI responsável e apresenta documentos de propriedade quando exigidos.","O canal oficial indicou o procedimento aplicável.","Não tentar senhas universais, abrir equipamento ou limpar TPM."],
 ["Encaminhar ou executar o método oficial","Se o fabricante exigir serviço, encaminhe a assistência autorizada e documente limitações.","Acesso legítimo restabelecido ou encaminhamento autorizado.","Não prometa redefinição sem confirmação do fabricante."]],
 "Titular confirma acesso normal ao firmware, sem afetar proteção dos dados.",
 "Nunca contornar a senha nem sugerir retirada de bateria ou reset do TPM."),
 storage:plan("Preservar dados e tratar falha de armazenamento","Suspeita de falha física exige prioridade de preservação.",[
 ["Suspender gravações","Evite formatação, reparo automático e reinicializações repetidas na unidade suspeita.","Estado preservado sem novas operações destrutivas.","Ruído ou erros críticos exigem encaminhamento."],
 ["Conferir cópias e integridade","Com autorização, verifique backups e sinais de falha sem iniciar reparos ou escrever na unidade.","Risco e cópias disponíveis documentados.","Dados insubstituíveis sem backup exigem serviço especializado."],
 ["Escolher ação aprovada","Com orçamento e aceite, execute cópia/recuperação apropriada ou encaminhe profissional habilitado.","Dados acessíveis ou encaminhamento formalizado.","Não garantir recuperação."]],
 "Titular confirma arquivos prioritários ou aceita encaminhamento com riscos registrados.",
 "Não usar utilitários de reparo às cegas."),
 security:plan("Conter o incidente e proteger o acesso","Não solicite credenciais nem destrua evidências.",[
 ["Conter exposição","Avalie isolamento de rede quando há atividade maliciosa em curso e preserve registros essenciais.","Exposição imediata contida.","Fraude ou incidente corporativo deve ser escalado ao responsável."],
 ["Recuperar contas legitimamente","Titular troca credenciais em dispositivo confiável e revisa MFA e sessões pelos canais oficiais.","Titular controla seus acessos.","Não pedir códigos ou senhas."],
 ["Verificar e encaminhar","Documente sinais persistentes e encaminhe perícia/incidente além do suporte preventivo.","Plano de continuidade definido.","Não afirmar erradicação completa sem avaliação especializada."]],
 "Titular confirma medidas de contenção e controle das contas.",
 "Não apagar evidências, acessar contas sem autorização ou prometer segurança absoluta."),
 wifi:plan("Restabelecer conectividade pela causa confirmada","Compare dispositivo e rede antes de alterar configurações.",[
 ["Isolar alcance","Teste se afeta um aparelho ou todos e compare conexão local, cabo e Wi-Fi.","Falha delimitada no dispositivo, rede ou provedor.","Se todos falham, verifique serviço do provedor."],
 ["Corrigir o ponto identificado","Com autorização, confira IP, gateway, DNS, sinal e cabos; altere somente o fator diagnosticado.","Conexão e endereçamento funcionam.","Reinício de roteador pode afetar outros usuários."],
 ["Validar serviço real","Teste o aplicativo ou site citado pelo cliente, inclusive em outro dispositivo quando útil.","Serviço originalmente afetado funciona.","Persistindo falha externa, escale ao provedor."]],
 "Cliente confirma acesso estável ao serviço que falhava.",
 "Não alterar roteadores compartilhados sem autorização."),
 performance:plan("Corrigir a origem medida da lentidão","Não recomendar limpeza genérica sem diagnóstico.",[
 ["Reproduzir e medir","Observe CPU, memória, espaço, temperatura e saúde do armazenamento sem apagar dados.","Gargalo documentado.","Falha de unidade exige preservação antes de testes."],
 ["Aplicar correção pertinente","Após autorização e backup quando necessário, ajuste o aplicativo, serviço, driver ou componente identificado.","Gargalo tratado sem perda de dados.","Não formatar ou remover arquivos às cegas."],
 ["Comparar resultados","Repita a tarefa e compare sintomas e recursos.","Cliente nota melhoria na tarefa original.","Se não melhorar, investigue outra hipótese."]],
 "Tarefa original funciona dentro da expectativa registrada.",
 "Não prometer desempenho sem medição."),
 boot:plan("Recuperar a inicialização preservando arquivos","Diferencie falha do Windows, firmware e armazenamento.",[
 ["Identificar etapa","Registre tela de erro e confirme backup e estado do armazenamento.","Falha delimitada.","Tela BitLocker exige recuperação legítima antes de reparar."],
 ["Escolher recuperação apropriada","Com chave quando exigida, backup e autorização, use os procedimentos oficiais de recuperação do sistema.","Reparo adequado concluído sem apagar arquivos.","Se houver falha física, pare e encaminhe."],
 ["Validar sistema","Confira inicialização, login e arquivos essenciais com o titular.","Windows inicia e dados permanecem acessíveis.","Falha persistente exige nova análise."]],
 "Windows inicia normalmente e titular confirma arquivos essenciais.",
 "Não limpar TPM, partições ou reinstalar sem aceite."),
 power:plan("Isolar alimentação e encaminhar falha elétrica","Não abrir fonte ou bateria danificada.",[
 ["Verificar sinais externos","Observe cabo, tomada e luzes sem abrir o equipamento.","Condição externa identificada.","Cheiro, faísca ou bateria inchada exigem suspensão do uso."],
 ["Comparar fonte segura","Com autorização, teste fonte/adaptador compatível e periféricos externos.","Falha isolada.","Não improvisar adaptadores."],
 ["Encaminhar manutenção","Defeito interno requer bancada habilitada, escopo e orçamento.","Funcionamento restaurado ou encaminhamento registrado.","Não prometer reparo de placa."]],
 "Partida estável após verificação segura.",
 "Segurança elétrica vem antes do atendimento."),
 heat:plan("Restabelecer ventilação e estabilidade térmica","Não estressar equipamento instável.",[
 ["Reduzir carga","Interrompa tarefas pesadas e verifique ventilação externa.","Saídas desobstruídas.","Bateria inchada ou cheiro de queimado exige suspensão do uso."],
 ["Observar temperatura","Com autorização, observe temperatura e rotação em carga leve e conforme especificação.","Causa provável delimitada.","Evite teste de estresse."],
 ["Manutenção aprovada","Após diagnóstico e orçamento, execute limpeza/revisão em bancada apropriada.","Temperatura e ruído normalizados.","Persistindo falha, escale componente."]],
 "Uso habitual sem aquecimento excessivo ou desligamento.",
 "Não manipular baterias danificadas."),
 backup:plan("Restaurar cópia verificada sem sobrescrever originais","Preserve dados existentes e teste destino seguro.",[
 ["Localizar cópia","Confira histórico, lixeira, versões e backup com o titular sem gravar sobre a origem.","Cópia localizada.","Em unidade com falha, suspenda gravações."],
 ["Testar restauração","Com autorização, valide cópia em destino separado quando possível.","Arquivos teste íntegros.","Não sobrescrever única versão."],
 ["Restaurar e conferir","Execute restauração aprovada e peça abertura dos arquivos pelo titular.","Arquivos esperados acessíveis.","Sem cópia válida, registre limite e encaminhe."]],
 "Cliente confirma conteúdo e versão dos arquivos restaurados.",
 "Não garantir recuperação sem cópia ou avaliação."),
 printing:plan("Restabelecer impressão após isolar a falha","Não alterar firmware sem necessidade.",[
 ["Conferir equipamento","Verifique erro, papel, consumíveis e fila sem abrir partes quentes.","Origem provável identificada.","Dano mecânico exige assistência."],
 ["Corrigir conexão ou fila","Com autorização, ajuste conexão ou driver oficial conforme diagnóstico.","Página teste imprime.","Não limpar fila compartilhada sem aviso."],
 ["Validar no aplicativo","Teste impressão ou digitalização na tarefa do cliente.","Documento concluído sem erro.","Persistindo falha física, encaminhe."]],
 "Cliente confirma tarefa original de impressão ou digitalização.",
 "Evitar firmware de origem desconhecida."),
 accounts:plan("Restabelecer acesso pelos canais oficiais","Não pedir senha nem código MFA.",[
 ["Identificar serviço","Confirme plataforma, erro e titular sem coletar segredo.","Canal de recuperação legítimo identificado.","Suspeita de invasão exige contenção."],
 ["Recuperar legitimamente","Titular segue fluxo oficial em dispositivo confiável.","Acesso retomado.","Conta corporativa exige responsável autorizado."],
 ["Validar segurança","Titular revisa sessões e MFA e testa login normal.","Conta acessível e protegida.","Nunca contornar MFA."]],
 "Titular autentica pelo fluxo normal.",
 "Não receber senhas ou códigos."),
 audio:plan("Restabelecer áudio ou vídeo isolando o ponto de falha","Diferencie aplicativo, permissão e hardware.",[
 ["Conferir seleção","Veja dispositivo padrão, volume, conexão e permissões.","Entrada ou saída correta selecionada.","Não alterar configurações globais sem necessidade."],
 ["Comparar aplicativos","Teste outro aplicativo ou periférico com autorização.","Falha delimitada.","Problema físico exige manutenção."],
 ["Validar tarefa original","Repita reprodução ou chamada do cliente.","Áudio ou vídeo funciona.","Persistindo falha, registre combinação testada."]],
 "Cliente confirma função no aplicativo que apresentava falha.",
 "Use drivers oficiais."),
 general:plan("Determinar solução após confirmar a causa","Relato genérico não autoriza diagnóstico definitivo.",[
 ["Detalhar sintoma","Colete erro exato, momento e alcance sem dados pessoais.","Problema reproduzido ou delimitado.","Risco elétrico, segurança ou dados exige suspensão de testes."],
 ["Isolar hipótese","Teste uma variável por vez sem mudanças destrutivas.","Hipótese apoiada por evidência.","Sem evidência, não aplicar reparo genérico."],
 ["Corrigir e validar","Com autorização, execute ação pertinente e repita o teste.","Sintoma original não se repete.","Se persistir, escale com histórico."]],
 "Cliente confirma comportamento esperado.",
 "Não declarar resolução sem testes.")
};
window.PROXITI_SOLUTIONS=Object.freeze(solutions);
})();