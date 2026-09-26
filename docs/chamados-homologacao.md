# Chamados · revisão operacional e homologação

**Escopo:** segunda área da conclusão sequencial da Central Técnica PROXITI. A implementação usa o repositório existente, o Supabase do projeto e o histórico atual. Não foram criados chamados, contas, clientes ou equipamentos fictícios no banco de produção.

## Jornada de atendimento

1. **Entrada e triagem:** um chamado novo não lido aparece uma vez na fila e no contador. Técnicos com permissão podem consultar os chamados sem responsável e assumir um deles; somente o primeiro a assumir recebe a atribuição.
2. **Atribuição:** o técnico pode assumir um chamado ainda elegível. Se já estiver em atendimento ou aguardando cliente, assumir **não** redefine sua situação para triagem. A designação administrativa continua restrita ao administrador.
3. **Conversa:** a interface carrega as 150 mensagens mais recentes em ordem cronológica, deixando explícito quando existem mensagens anteriores. Ao mudar de chamado, conversas pendentes não podem preencher o atendimento seguinte. Uma leitura só é marcada depois da confirmação da RPC do banco.
4. **Notas, roteiro e anexos:** notas internas não entram no relatório ao cliente; o rascunho de nota é mantido **somente em memória nesta sessão** e apagado ao sair. Roteiros são registrados por chamado e a equipe precisa justificar uma etapa não aplicável. Anexos PDF/imagem têm limite de 5 MB e são privados, sem URL permanente. Se a confirmação da gravação falhar, a interface consulta o metadado antes de decidir pela remoção do objeto.
5. **Equipamento e agenda:** informações técnicas e retornos são vinculados ao chamado e carregados somente em sessão autorizada. Planejar um retorno **não** confirma com o cliente nem envia convite automaticamente.
6. **Relatórios e encerramento:** versões privadas do relatório permanecem no histórico, com distinção entre rascunho e versão revisada. Para encerrar, a interface solicita confirmação e avisa quando há etapas pendentes ou nenhum relatório final. O banco impede alterar a situação de um chamado já encerrado; o atendimento posterior deverá ser registrado em novo chamado. O encerramento não é aceite, assinatura ou comunicação automática ao cliente.

## Proteção do banco

A migração `supabase/ticket_safety_v9.sql` modifica apenas `proxiti_claim_ticket` e `proxiti_change_ticket_status`; não altera registros existentes. A primeira só altera o estado de `new` para `triage`. A segunda faz bloqueio `FOR UPDATE` e recusa mudanças em histórico `closed`. Ambas exigem acesso autenticado e autorização do perfil. Chamados não possuem privilégio de UPDATE direto para `authenticated` nem para `anon`. Notas, tarefas, anexos, dispositivos, agendamentos e relatórios permanecem com RLS e RPCs específicas.

## Falhas e recuperação

- Fila indisponível não é exibida como vazia. A interface mantém o último resultado com aviso de desatualização e oferece Atualizar.
- Se a conversa não carregar, o técnico pode tentar novamente. Uma leitura não confirmada mantém a indicação de pendência; a confirmação não é simulada.
- Respostas em trânsito mantêm o identificador original do chamado. Ao trocar de atendimento durante o envio, o retorno tardio não apaga rascunhos do atendimento atual.
- O arquivo com upload confirmado e retorno ambíguo da RPC é verificado em `ticket_attachments` antes de limpeza. Se não for possível determinar a situação, a interface solicita verificação administrativa, em vez de apagar um possível anexo válido.

## Verificação técnica

- `node tests/central-integrity.mjs` valida sintaxe, IDs, restrições estáticas e migração.
- `node tests/browser-smoke.mjs` cobre o layout geral nos temas e larguras principais.
- `node tests/overview-functional.mjs` mantém a regressão dos indicadores de atendimento.
- `node tests/tickets-functional.mjs` exercita a jornada com dados **simulados só no navegador**: assumir preservando situação, falha/recuperação de leitura, conversa longa, envio concorrente com rascunho, confirmação de encerramento, notas por chamado e gravação de anexo com confirmação ambígua.

## Limites que não podem ser chamados de homologação real

- Ainda é necessário testar com **duas contas legítimas**, uma administrativa e uma técnica, autorizadas pelo titular. Os testes de navegador não provam as permissões efetivas com dois tokens do Supabase nem substituem a checagem da interface autenticada em celular e computador.
- O histórico da conversa mostra inicialmente as 150 mensagens mais recentes. Quando há mais mensagens, o sistema informa o recorte; não afirme que a interface apresentou a conversa inteira.
- A fila consulta até 100 chamados acessíveis; os totais são desse recorte. O histórico completo permanece no banco sujeito às políticas e limites de consulta.
- Uma mensagem registrada na conversa não prova envio de e-mail ou SMS. Não há promessa de notificação transacional externa sem teste de entrega separado.
- Conferir a versão final do relatório, autorizações, retenção de evidências e procedimento de eliminação antes de operar com dados reais.

**Validação humana sugerida:** no próximo atendimento expressamente autorizado, confirmar fluxo novo → atribuído → em atendimento → aguardando cliente → resolvido → encerrado, visualizando a conversa de ambas as contas; revisar também leitura, nota interna, checklist, documento impresso e negação de edição após encerramento. Não compartilhar códigos de acesso, fatores TOTP ou dados de cliente no chat.
