# Agenda · entrega operacional e homologação

A Agenda é a terceira área da conclusão sequencial da Central Técnica PROXITI. Cada compromisso precisa pertencer a um chamado autorizado e ter um horário, duração, modalidade e situação. **Planejar não significa confirmar com o cliente** e a plataforma não envia convites, e-mails ou WhatsApp automaticamente.

## Fluxo operacional

1. Abra o chamado autorizado e registre o compromisso como **Planejado**. O horário do formulário segue o fuso local do dispositivo; o banco recebe o instante com fuso explícito (UTC). O registro é vinculado ao chamado, não a uma promessa de horário.
2. Depois de combinar efetivamente com o cliente, selecione o **canal do contato** e clique em **Registrar confirmação**. A RPC registra quem confirmou, a data da confirmação e o canal informado. O contato não é realizado pela plataforma.
3. Quando o compromisso for realizado, marque **Concluído**. Um horário planejado não pode ser concluído antes de ser confirmado. O atendimento principal permanece em sua situação atual.
4. Se não ocorrerá, use **Cancelar compromisso**, com confirmação explícita. Conclusões e cancelamentos são terminais, não podem ser revertidos por essas ações.
5. Para um novo dia, horário, duração ou modalidade, use **Reagendar**, preenchendo um motivo técnico breve. Um horário antes confirmado retorna a **Planejado**, pois a confirmação anterior não vale para o novo agendamento. O motivo e as alterações de horário, duração e modalidade ficam no histórico privado de reagendamentos. O contato com o cliente precisa acontecer novamente.
6. Use **Abrir chamado** para consultar o contexto do atendimento. A interface só mostra os dados de agendamentos e chamados aos quais a sessão tem permissão.

## Consultas, erros e privacidade

A aba **Próximos e em andamento** reúne registros planejados ou confirmados cujo período ainda está vigente; a aba de histórico permite ver também conclusões e cancelamentos. As páginas são carregadas em lotes de 60, em vez de esconder compromissos recentes atrás de 250 registros antigos. Os números da tela refletem o recorte carregado, não um total histórico global.

A Agenda distingue carregamento, consulta confirmada, falha de conexão e sessão restrita. Quando uma consulta falha, os registros da última atualização podem ficar visíveis **com aviso de desatualização**. A troca de conta ou revogação de acesso limpa os cartões e invalida respostas pendentes de outra sessão. A consulta do vínculo do chamado é obrigatória: um agendamento cujo chamado não é autorizado não será exibido.

Os detalhes privados do compromisso são tratados dentro do atendimento autorizado. Não registre senhas, credenciais ou dados desnecessários no motivo de reagendamento, no equipamento nem nas observações.

## Proteção do banco

A migração `supabase/agenda_integrity_v10.sql` preserva os registros existentes e restringe transições por RPC autenticada e autorização por chamado. As operações bloqueiam o chamado e depois o compromisso para impedir conflito com encerramento ou atualização simultânea. Os motivos de reagendamento são preservados na tabela privada `ticket_appointment_reschedules`, com RLS, sem envio ao cliente. A mudança de situação grava eventos em `ticket_audit`, e a confirmação registra canal, data e profissional. As tabelas operacionais não são graváveis diretamente por visitantes.

**Limites:** a Agenda não verifica a disponibilidade em agendas externas nem envia convites por e-mail, SMS, telefone ou WhatsApp. O horário escolhido precisa ser conferido pela equipe; um compromisso pode coincidir com outro até existir uma política operacional de conflitos e recursos. A indicação de confirmação é uma declaração do profissional após contato, não uma assinatura eletrônica do cliente.

## Critérios de teste

- `node tests/central-integrity.mjs`: sintaxe, IDs, arquivos e contratos estáticos da migração.
- `node tests/browser-smoke.mjs`: interface geral em cinco larguras.
- `node tests/overview-functional.mjs` e `node tests/tickets-functional.mjs`: regressões das duas áreas anteriores.
- `node tests/agenda-functional.mjs`: fila vazia legítima, filtros, recuperação de erro, confirmação com canal, conclusão, reagendamento, paginação, revogação, vínculo autorizado e acessibilidade responsiva nos temas claro e escuro. Todos os exemplos são simulados **no navegador**, não gravados no banco de produção.

Para homologar em ambiente real, o titular deve registrar um compromisso de atendimento efetivamente autorizado com conta administrativa e conta técnica distinta, verificar as políticas de leitura e alteração, confirmar o contato real com o cliente e conferir o histórico. A homologação com duas identidades reais não pode ser substituída por testes simulados nem requer que o titular compartilhe senhas ou MFA.
