# PROXITI V16 · Cadastro consolidado de clientes

A V16 complementa a página **Clientes** sem substituir o histórico dos chamados. Técnicos continuam enxergando apenas contatos presentes nos chamados que já podem consultar. O cadastro consolidado é administrativo.

## Princípios

- Nenhum cliente existente é criado automaticamente a partir de e-mail ou telefone.
- O administrador revisa o contato e vincula explicitamente cada chamado ao cadastro correto.
- O vínculo acrescenta `support_tickets.client_id`; nome, e-mail e telefone gravados no chamado permanecem como histórico do atendimento.
- Corrigir vínculo exige desvincular antes. A operação não apaga o chamado.
- CPF, RG, senha, credenciais e documentos não fazem parte do cadastro V16.
- Escritas exigem administrador com MFA/AAL2, reutilizando a mesma proteção do módulo Comercial.

## Campos

Nome/identificação, pessoa ou empresa, organização opcional, e-mail, telefone, canal preferido, cidade/região, observação interna necessária e situação ativa/inativa. Ao menos e-mail ou telefone é obrigatório.

## Histórico

`client_profile_audit` registra criação, atualização, vínculo e desvínculo. Observações internas não são copiadas para os snapshots de auditoria.

O resumo administrativo agrega quantidade de chamados vinculados, chamados ainda abertos, propostas comerciais, valores de propostas aceitas e recebimentos líquidos registrados. Esses valores continuam sendo registros operacionais do módulo Comercial, não saldo bancário ou contabilidade.

## Segurança

`client_profiles` e `client_profile_audit` usam RLS administrativo. Não há leitura anônima nem escrita direta pelas tabelas. As RPCs `proxiti_client_save`, `proxiti_client_link_ticket` e `proxiti_client_unlink_ticket` exigem administrador com MFA. O módulo não usa localStorage/sessionStorage para contatos.

## Homologação

Testar com conta administrativa e MFA: cadastrar cliente, editar, vincular um chamado, abrir resumo, desvincular e confirmar preservação do chamado. Com técnico comum, conferir ausência do cadastro consolidado e manutenção da visão baseada somente nos chamados autorizados. Testar mobile e desktop e falha de conexão antes de repetir gravações.
