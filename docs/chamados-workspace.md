# Chamados — workspace operacional

Reformulação baseada na `main` em `281f4638a2ccf62f50cfecafd06e01b07c6c1710`. Branch: `reformulacao-chamados`. Revisão: [PR #17](https://github.com/humbertomennella/painel-proxiti/pull/17).

## Implementação

- Caixa de entrada recolhível também no desktop; controle de reabertura fora da área recolhida. Seleção e contadores existentes preservados. Aviso quando o atendimento está fora do filtro.
- Conversa permanente no desktop e alternância conversa/ferramenta no celular. Rascunhos de resposta mantêm o isolamento já existente.
- Oito abas reais: Diagnóstico, Notas, Roteiro, Equipamento, Agenda, Anexos, Relatório e Histórico. Conteúdo anterior não fica visível. Os formulários não são recriados pela troca de aba. Teclas direcionais, Home/End, foco visível e relações ARIA.
- Cabeçalho compacto com número, assunto, cliente, situação e responsável autorizado. Contato detalhado, descrição e ações ficam em uma área expansível. Banner compacto mantém a imagem temática.
- Rascunhos de equipamento, agendamento e relatório por chamado em memória; etapas não salvas do roteiro e arquivo selecionado também permanecem na sessão. Limpeza ao encerrar sessão ou perder o contexto autorizado. Nenhum desses rascunhos é apresentado como gravação definitiva.
- Roteiro com numeração alinhada ao início do título, botão Salvar compacto e distinção entre registro salvo e alteração não salva.
- Diagnóstico mantém o motor e os procedimentos existentes, incluindo separação BitLocker/UEFI. Critério final sempre visível. Progresso do guia pode ser salvo **somente por ação explícita** em uma nota interna privada, pela RPC existente. O marcador contém versão do motor, identificador da hipótese, posição e resultados enumerados; não copia sintomas, senhas ou chaves. Retomada explícita, após consulta autorizada da nota e seleção da mesma hipótese. Mudanças na versão do motor impedem reaplicação automática de etapas antigas.
- Relatório assistido consulta etapas já registradas e identificação mínima do equipamento. Cada sugestão pode ser editada, destinada a um campo, incluída ou descartada individualmente. Não importa conversa, anexos, notas internas, observações privadas do equipamento ou patrimônio. Não preenche automaticamente causa confirmada. Versões, revisão final e confirmação existentes continuam em vigor.

## Arquivos

Alterados: `index.html`, `assets/operations.js`, `assets/ticket-desk.js`, `assets/ticket-extras.js`, `assets/ticket-workflow.js`, `tests/central-integrity.mjs`, `tests/tickets-functional.mjs`, `tests/agenda-functional.mjs`, `tests/refinement-functional.mjs`.

Criados: `assets/ticket-workspace.js`, `assets/ticket-workspace.css`, `docs/chamados-workspace.md`.

Nenhuma alteração em Supabase Auth, RLS, tabelas, migrações, Edge Functions ou configuração de armazenamento privado. CSS novo restrito à página Chamados.

## Verificação

Os resultados definitivos e o commit examinado constam nos checks do PR. As suítes obrigatórias são:

| Suíte | Verificações |
| --- | --- |
| `central-integrity.mjs` | Sintaxe, IDs, arquivos, contratos e preservação dos controles existentes |
| `ticket-diagnostics-core.mjs` | 14 famílias, planos de solução, BitLocker/UEFI e fontes por ambiente |
| `browser-smoke.mjs` | Estrutura da Central, controles e overflow nos dois temas |
| `refinement-functional.mjs` | Busca, menus, fotos e banners; limite específico do banner compacto de Chamados |
| `overview-functional.mjs` | Contagens, falhas, atualização de permissões e isolamento |
| `tickets-functional.mjs` | Seleção, paginação, resposta tardia, rascunhos, encerramento, revogação, anexos, guia, retomada de nota, roteiro, equipamento e relatório assistido |
| `agenda-functional.mjs` | Confirmação, reagendamento, encerramento condicionado, histórico e permissões |
| `academy-functional.mjs` e `academy-learning-functional.mjs` | Regressões das áreas não alteradas |

A matriz de Chamados percorre as oito abas em **320, 375, 430, 768, 1024, 1366 e 1920 px**, nos temas claro e escuro: 112 combinações. Verifica uma única ferramenta visível, ausência de overflow e conversa persistente no desktop. Capturas de cada aba em 375 e 1366 px, nos dois temas, são guardadas pelo workflow `PROXITI | Interface responsiva`.

O teste antigo de banner mínimo de 240 px foi substituído apenas em Chamados por um intervalo de 100–220 px, conforme o novo requisito. O teste de agenda foi adaptado para abrir as ações do chamado antes de alterar a situação; as condições de autorização e resultado continuam sendo verificadas.

## Limites da homologação

Dados e sessões dos testes são simulados no navegador do GitHub Actions. Nenhum cliente real foi criado, editado ou contatado. Os testes não substituem uma verificação com dois usuários reais e tokens distintos no Supabase.

A Central pública exige login; não havia sessão de homologação autenticada disponível. O navegador interativo desta sessão bloqueou acesso à prévia local. A inspeção visual foi realizada sobre capturas geradas em Chromium no CI, comparadas às nove referências fornecidas. Não se afirma homologação autenticada de produção nem teste em aparelho físico.

O guia salvo usa notas privadas existentes e não requer nova estrutura de banco. A lista de notas consulta até 150 registros: um checkpoint mais antigo que esse recorte não será oferecido. Retomar não transforma hipótese em causa confirmada nem equivale a autorização do cliente.

Os outros rascunhos ficam apenas na memória desta sessão e são perdidos ao recarregar a página. O arquivo selecionado permanece local até o envio explícito. Não há armazenamento novo de dados privados em localStorage nem processamento por IA externa.

## Publicação

A integração e a publicação só podem ocorrer com os checks aplicáveis aprovados e sem regressões conhecidas. O PR e o histórico do GitHub Pages são a referência para SHA integrado e estado do deploy, evitando registrar aqui um status que pode ficar desatualizado.
