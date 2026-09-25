-- PROXITI V8: 10 procedimentos técnicos internos originais, sem dados de clientes.
-- Chaves editoriais estáveis: reexecutar não duplica nem sobrescreve edições locais.
alter table public.training_materials add column if not exists content_key text;
alter table public.training_materials drop constraint if exists training_material_content_key_check;
alter table public.training_materials add constraint training_material_content_key_check
 check(content_key is null or content_key ~ '^[a-z0-9][a-z0-9._-]{4,99}$');
create unique index if not exists proxiti_training_content_key_idx on public.training_materials(content_key)
 where content_key is not null;
insert into public.training_materials(content_key,title,description,kind,category,body,reference_url,reviewed_at,published)
values('sop.atendimento.abertura','01 · Recebimento, triagem e autorização','Como registrar o problema, delimitar o escopo e evitar intervenções sem consentimento.','article','Atendimento','# Recebimento, triagem e autorização
Finalidade: converter uma solicitação em um atendimento documentado, sem prometer diagnóstico antes de examinar o equipamento.

## Antes de tocar no equipamento
- Confirme com o solicitante quem é o responsável autorizado pelo dispositivo, rede ou conta.
- Registre o sintoma nas palavras do cliente, quando começou, frequência, impacto, mensagens de erro e alterações recentes.
- Pergunte se há urgência operacional, dados sem cópia e risco à continuidade do trabalho.
- Explique quais verificações são apenas observacionais e quais podem alterar arquivos, configurações ou disponibilidade.
- Não solicite senha, código de recuperação, token MFA nem acesso irrestrito à conta do cliente.

## Classificação do chamado
- Novo: ainda sem triagem.
- Em triagem: coleta de contexto e verificação do escopo.
- Em atendimento: execução autorizada.
- Aguardando cliente: informação, decisão ou disponibilidade pendente.
- Resolvido: intervenção concluída, testes registrados e orientação preparada.
- Encerrado: histórico finalizado; não deve aparecer como tarefa pendente.

## Registro mínimo
Indique equipamento ou serviço afetado, problema, ações autorizadas, responsável técnico, próxima ação e comunicação ao cliente. Se surgirem fatos novos, registre o motivo da mudança de escopo antes de executar.

## Critério de avanço
Somente iniciar procedimentos potencialmente disruptivos quando houver autorização específica. Se existir dúvida sobre titularidade, escopo, risco de perda de dados ou cobrança, interrompa a intervenção e esclareça o ponto.

## Encerramento
Resuma o diagnóstico verificado, a intervenção realizada, os testes executados, as limitações e o que permanece sob responsabilidade do cliente. Não trate ausência de reclamação como aceite formal.',NULL,date '2026-09-25',true)
on conflict(content_key) where content_key is not null do nothing;
insert into public.training_materials(content_key,title,description,kind,category,body,reference_url,reviewed_at,published)
values('sop.computadores.diagnostico','02 · Diagnóstico seguro de computadores e notebooks','Roteiro para lentidão, falhas de inicialização e defeitos sem sacrificar os dados do cliente.','article','Computadores','# Diagnóstico seguro de computadores e notebooks
Objetivo: identificar a causa provável e produzir evidências suficientes antes de alterar o sistema.

## Segurança e autorização
- Confirme a identificação do equipamento e registre, quando relevante, alimentação, fonte, bateria e sinais físicos de dano.
- Verifique se há arquivos importantes sem backup recente. Não formate, redefina, reinstale ou particione sem autorização específica.
- Se a unidade estiver criptografada, peça que o titular confirme previamente que possui acesso à recuperação. A chave BitLocker não deve ser enviada por chat nem anotada na Central.
- Desligue e isole equipamentos com indícios de dano elétrico, bateria inchada, líquido ou aquecimento perigoso; não prossiga com testes energizados nessas condições.

## Coleta observacional
1. Anote o sintoma e tente reproduzi-lo de forma segura.
2. Confira espaço livre, estado de armazenamento, temperatura aparente e uso de recursos sem instalar utilitários de origem desconhecida.
3. Identifique alterações recentes: atualizações, periféricos, aplicativos, movimentação física ou interrupções de energia.
4. Diferencie lentidão geral de problema isolado em programa, rede ou armazenamento.
5. Se surgirem erros de disco, priorize preservação de dados, minimizando escrita e testes de estresse.

## Decisão técnica
Relacione hipótese, evidência e teste adicional. Evite atribuir causa ao componente apenas porque um indicador está alto. Explique ao cliente opções e risco de cada intervenção. Em caso de dúvida sobre confiabilidade do armazenamento, não prometa recuperação.

## Conclusão
Depois da intervenção autorizada, reproduza o cenário original, registre resultado, funcionamento básico e limitações. Entregue orientações de manutenção compatíveis com a configuração real do dispositivo.','https://support.microsoft.com/pt-br/windows/security/encryption/back-up-your-bitlocker-recovery-key',date '2026-09-25',true)
on conflict(content_key) where content_key is not null do nothing;
insert into public.training_materials(content_key,title,description,kind,category,body,reference_url,reviewed_at,published)
values('sop.linux.workstation','03 · Triagem de estação Linux sem mudanças desnecessárias','Coleta de contexto, logs e componentes antes de alterar pacotes, serviços ou permissões.','article','Computadores','# Triagem de estação Linux
Escopo: estações Linux em atendimento autorizado. Nunca pressupor distribuição, versão, gerenciador de pacotes ou init.

## Levantamento
- Registre distribuição, versão, ambiente gráfico, kernel, uso principal, tipo de armazenamento e sintoma relatado.
- Confirme se existem dados sem cópia e se o problema afeta inicialização, rede, interface, periféricos ou aplicativos.
- Comece com consultas somente de leitura e verifique disponibilidade de espaço e inodes quando o sintoma envolver atualizações ou gravação.
- Não cole no chamado saídas com tokens, segredos, nomes de usuários, IPs internos ou diretórios pessoais sem necessidade.

## Isolamento da causa
1. Compare o comportamento com e sem periféricos opcionais, apenas se isso for seguro.
2. Verifique eventos do sistema correspondentes ao horário do problema; diferencie mensagens antigas de falhas atuais.
3. Em rede, separe camada física, endereçamento, resolução de nomes e serviço remoto.
4. Em aplicativos, diferencie instalação do sistema, pacote isolado, perfil do usuário e dependências.
5. Evite misturar múltiplas alterações antes de observar o resultado de cada uma.

## Alteração controlada
Descreva ao cliente o que será alterado e como voltar atrás. Faça backup de arquivos de configuração relevantes. Não execute scripts remotos nem comandos de limpeza abrangentes por conveniência; revise o conteúdo e a procedência.

## Validação
Confirme o serviço ou aplicativo no cenário originalmente afetado, persistência após reinício somente quando autorizado, e ausência de efeitos colaterais observáveis. Documente versões e mudanças efetivamente realizadas.',NULL,date '2026-09-25',true)
on conflict(content_key) where content_key is not null do nothing;
insert into public.training_materials(content_key,title,description,kind,category,body,reference_url,reviewed_at,published)
values('sop.rede.wifi','04 · Diagnóstico de rede e Wi-Fi em residências e pequenos negócios','Método para separar falhas físicas, interferência, endereçamento e serviços.','article','Redes','# Diagnóstico de rede e Wi-Fi
Objetivo: descobrir em qual etapa a conectividade falha sem redefinir a rede por tentativa e erro.

## Contexto e permissão
Identifique escopo autorizado, equipamentos afetados, horários do problema, alterações recentes, quantidade aproximada de clientes, presença de dispositivos críticos e se existe uma janela para interrupção. Não fotografe senhas de roteadores nem compartilhe credenciais em tickets.

## Sequência de verificação
1. Energia e cabeamento: conectores, alimentação, indicadores e conexão física segura.
2. Link local: se o dispositivo alcança a rede local, recebe configuração coerente e encontra o gateway.
3. Serviços: diferencie DNS, acesso à internet, autenticação Wi-Fi e indisponibilidade de aplicação.
4. Rádio: verifique localização, obstáculos, congestionamento, distância e roaming quando houver múltiplos pontos de acesso.
5. Compare cabo e Wi-Fi, um dispositivo e vários, e horários estáveis e instáveis. Anote evidências.

## Mudanças
Antes de alterar endereço LAN, DHCP, DNS, canal ou modo de segurança, documente o estado inicial e combine interrupção possível com o responsável. Não faça reset de fábrica em roteador sem ter a configuração necessária e autorização específica.

## Testes de aceitação
Valide com o cliente os dispositivos e serviços afetados, verifique funcionamento após a mudança e registre limites físicos do ambiente. Não prometa cobertura integral sem medição no local.',NULL,date '2026-09-25',true)
on conflict(content_key) where content_key is not null do nothing;
insert into public.training_materials(content_key,title,description,kind,category,body,reference_url,reviewed_at,published)
values('sop.backup.validacao','05 · Backup, recuperação e verificação de restauração','Procedimento de proteção de dados com autorização, destino seguro e teste de recuperação.','article','Backup','# Backup, recuperação e verificação de restauração
Um arquivo copiado não equivale a uma recuperação testada. A decisão sobre o destino e o acesso aos dados pertence ao responsável pelos dados.

## Antes de iniciar
- Defina com o titular quais dados são necessários, quais podem ser excluídos e qual é a finalidade da cópia.
- Registre volume estimado, origem, destino, criptografia, proteção física e quem terá acesso.
- Confirme capacidade disponível, compatibilidade do sistema de arquivos e tempo de indisponibilidade.
- Evite manter apenas uma cópia conectada permanentemente ao dispositivo de origem.
- Nunca armazene senhas, chaves de recuperação ou arquivos pessoais nos anexos da Central sem justificativa e procedimento específico.

## Execução autorizada
1. Preserve a fonte antes de operações destrutivas. Em caso de indício de falha física, interrompa testes que aumentem desgaste.
2. Copie para destino controlado e confira mensagens de erro.
3. Compare contagem de itens, tamanho total e, onde apropriado, integridade por hash ou mecanismo de verificação da ferramenta.
4. Faça teste de restauração representativo em ambiente autorizado. Abra arquivos de tipos relevantes sem expor o conteúdo no relatório.
5. Documente limitações, arquivos inacessíveis e qualquer dado não incluído.

## Continuidade
A CISA recomenda cópias offline e testes regulares de integridade e restauração para dados críticos. Defina frequência e responsabilidade com o cliente; a Central não executa nem agenda backups automaticamente.

## Entrega
Registre localização lógica do backup sem revelar credenciais, data, resultado do teste e instruções para o responsável. Não declare backup concluído quando restarem erros não resolvidos.','https://www.cisa.gov/stopransomware/ransomware-guide',date '2026-09-25',true)
on conflict(content_key) where content_key is not null do nothing;
insert into public.training_materials(content_key,title,description,kind,category,body,reference_url,reviewed_at,published)
values('sop.seguranca.acessos','06 · Contas, permissões e autenticação multifator','Boas práticas para reduzir privilégios sem assumir controle de contas do cliente.','article','Segurança','# Contas, permissões e autenticação multifator
Princípio central: a conta é do cliente; o técnico orienta, documenta e age somente dentro do escopo autorizado.

## Verificação inicial
- Identifique quem é o proprietário ou administrador legítimo e quais contas serão analisadas.
- Levante funções e necessidade real de privilégios; usuários cotidianos não precisam manter privilégios administrativos por padrão.
- Confirme meios de recuperação antes de ativar, trocar ou remover fatores de autenticação.
- Nunca solicite senha, código temporário, chave TOTP, código de backup nem chave de recuperação no chat.

## Ajustes com consentimento
1. Revise acessos desnecessários e contas antigas, com validação do proprietário.
2. Oriente uso de senhas exclusivas e gerenciador confiável, sem copiar credenciais para o chamado.
3. Ative MFA com o titular presente e confira fator de recuperação sob controle dele.
4. Evite remover o único administrador ou o único método de acesso recuperável.
5. Considere implicações de dispositivos compartilhados, contas corporativas e políticas da organização.

## Validação
Teste a autenticação com o titular, identifique efeitos sobre dispositivos e aplicativos vinculados e documente apenas a conclusão, nunca o segredo. Em incidente ativo, preserve evidências e coordene mudanças para não destruir registros úteis.

## Segurança da Central
A própria conta de administrador PROXITI deve ativar TOTP no perfil. Não é possível ativar o fator em nome do titular sem que ele cadastre pessoalmente o aplicativo.','https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html',date '2026-09-25',true)
on conflict(content_key) where content_key is not null do nothing;
insert into public.training_materials(content_key,title,description,kind,category,body,reference_url,reviewed_at,published)
values('sop.incidentes.resposta','07 · Suspeita de incidente: preservar, conter e encaminhar','Orientação operacional proporcional para suspeitas de malware, fraude ou acesso indevido.','article','Segurança','# Suspeita de incidente de segurança
Este material orienta a triagem. Não substitui resposta forense especializada nem determina comunicação legal obrigatória.

## Primeiros minutos
1. Identifique o impacto: indisponibilidade, conta comprometida, criptografia de arquivos, transações suspeitas ou exposição de dados.
2. Registre horário, sistemas afetados, sinais observáveis e ações já tomadas. Evite copiar dados pessoais desnecessários para a Central.
3. Oriente a pessoa a não apagar evidências, reinstalar sistemas ou executar ferramentas aleatórias.
4. Se houver risco de propagação, avalie contenção apropriada com o responsável; a decisão depende de segurança e continuidade.

## Triagem e limites
Diferencie fato observado, hipótese técnica e relato do cliente. Não atribua autoria, origem ou alcance sem evidências. Quando o caso exceder o escopo contratado ou envolver possível crime, perda financeira ou grande volume de dados, encaminhe para resposta especializada e canais oficiais pertinentes.

## Recuperação
Planeje restauração apenas após entender a origem provável do problema e preservar o necessário. A restauração de backup não resolve credenciais comprometidas ou a causa de acesso inicial por si só.

## Depois do incidente
Registre mudanças autorizadas, testes, itens não verificados e medidas preventivas. A revisão 3 do NIST SP 800-61 integra resposta a incidentes à gestão contínua de riscos; use a publicação como referência complementar, não como checklist universal para qualquer organização.','https://csrc.nist.gov/pubs/sp/800/61/r3/final',date '2026-09-25',true)
on conflict(content_key) where content_key is not null do nothing;
insert into public.training_materials(content_key,title,description,kind,category,body,reference_url,reviewed_at,published)
values('sop.documentacao.relatorio','08 · Evidências, relatório e encerramento sem promessas','Como preparar um registro técnico verificável, comunicar limites e revisar dados compartilhados.','article','Atendimento','# Evidências, relatório e encerramento
O registro deve permitir compreender o que foi pedido, o que foi feito e o que foi testado, sem transformar hipótese em resultado.

## Notas internas
Anote sinais observáveis, hipóteses, decisões de escopo, obstáculos e informações úteis para continuidade. Use linguagem profissional e não registre segredos, credenciais ou detalhes pessoais que não afetem o atendimento. As notas internas não são enviadas ao cliente.

## Anexos
Use somente documentos ou imagens indispensáveis, com autorização. Prefira recortes que ocultem dados de terceiros. A Central limita tipos e tamanho, mas não realiza varredura antimalware; avalie a procedência antes de abrir. Nunca carregue material pago ou dados sensíveis sem processo de tratamento definido.

## Relatório compartilhável
- Identificação do chamado e assunto.
- Diagnóstico: fatos observados e testes realizados.
- Intervenção: somente ações efetivamente executadas e autorizadas.
- Validação: resultado dos testes com contexto.
- Orientação final: cuidados, limitações, pendências e próximos passos.

## Revisão
Antes de salvar ou imprimir, confira nomes, dados, linguagem e autorização de compartilhamento. Não inclua conversa, notas internas ou anexos no relatório. Um relatório emitido não representa assinatura nem aceite automático do cliente.

## Fechamento
Confirme se há retorno pendente, se o serviço foi efetivamente entregue e se existe orientação que o cliente precisa compreender. Encerre o chamado apenas quando o fluxo contratual permitir; preserve o histórico de maneira proporcional à finalidade.',NULL,date '2026-09-25',true)
on conflict(content_key) where content_key is not null do nothing;
insert into public.training_materials(content_key,title,description,kind,category,body,reference_url,reviewed_at,published)
values('sop.atendimento.remoto','09 · Suporte remoto com consentimento e término verificável','Início, sessão, comunicação e encerramento de um acesso remoto autorizado.','article','Atendimento','# Suporte remoto com consentimento
Uma sessão remota deve ter escopo, autorização e encerramento claros. Não utilize acesso permanente como padrão.

## Preparação
- Confirme identidade do solicitante e titularidade ou autoridade sobre o dispositivo.
- Explique a ferramenta, sua origem, tipo de acesso, possibilidade de controle e observação da tela.
- Solicite aprovação para cada operação capaz de alterar dados, instalar software, acessar contas ou reiniciar o equipamento.
- Oriente o cliente a fechar arquivos pessoais e aplicativos que não fazem parte do serviço.
- Nunca peça que o cliente compartilhe senha, código MFA, chave de recuperação ou dados bancários.

## Durante o atendimento
Execute apenas ações necessárias ao problema. Ao encontrar informação não relacionada, interrompa a visualização. Se houver necessidade de elevar privilégios, deixe a decisão e a digitação das credenciais sob controle do titular. Documente alterações materiais e riscos comunicados.

## Falha de conexão
Evite múltiplas sessões paralelas sem confirmação. Em perda de conexão, não suponha que a sessão anterior terminou; verifique seu estado antes de retomar.

## Encerramento
Peça que o cliente confirme o resultado, finalize a sessão, remova acesso persistente quando não contratado e oriente a revogar permissões temporárias. Registre o atendimento sem capturar gravações ou telas por padrão.',NULL,date '2026-09-25',true)
on conflict(content_key) where content_key is not null do nothing;
insert into public.training_materials(content_key,title,description,kind,category,body,reference_url,reviewed_at,published)
values('sop.ativos.inventario','10 · Identificação de equipamentos e controle de ferramentas','Cadastro mínimo, atribuição e guarda de equipamentos usados em atendimentos.','article','Infraestrutura','# Equipamentos de clientes e ferramentas PROXITI
São conjuntos diferentes de dados e não devem ser misturados.

## Equipamento do atendimento
Registre somente categoria, fabricante/modelo, sistema operacional e referência de patrimônio quando necessário e autorizado. Não utilize número de série como identificação pública. Notas sobre o equipamento devem referir-se ao serviço, sem copiar arquivos particulares.

## Ferramenta de propriedade ou responsabilidade da PROXITI
Cadastre nome, identificação patrimonial disponível, responsável autorizado e observações de conservação. Não crie itens fictícios para preencher o inventário. Atribuições devem refletir quem realmente recebeu o equipamento.

## Entrega e devolução
Documente data, estado observado e eventuais acessórios. Se a ferramenta guardar dados ou logs, verifique limpeza autorizada antes de repassar a outra pessoa. Mídias de armazenamento usadas em cliente exigem tratamento específico para evitar vazamento.

## Continuidade
Em novo chamado do mesmo cliente, não copie automaticamente dados de um atendimento anterior sem verificar identidade, autorização e necessidade. O módulo de equipamento atualmente é por chamado: não representa uma base global de identificação de clientes.

## Conferência periódica
Reveja inventário, responsáveis e itens sem movimentação. Separe ferramentas danificadas ou sem segurança de uso e registre a providência necessária.',NULL,date '2026-09-25',true)
on conflict(content_key) where content_key is not null do nothing;