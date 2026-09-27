# Central visual completo — inventário anterior à reformulação

Base de trabalho: `342d80a131c8fc50d4f7de876343fcab93a00225` (`uniproxiti-dashboard`).
Main inspecionada: `4fccc0d01b60f38fb47a840ca33278311f1102af`. PR #9 aberto e Draft em 26/09/2026. Nenhum merge ou deploy autorizado.

| Superfície | Contratos / scripts existentes preservados |
|---|---|
| Login, recuperação, reset, MFA, bloqueio | `app.js`, `config.js`, IDs dos formulários, atributos autocomplete/required, mensagens ao vivo |
| Shell, tema, alertas, perfil no topo | `layout.js`, `appearance.js`, `alerts.js`, data-side-view, data-ops-view, data-summary-view |
| Visão geral | `overview.js`, `overview-model.js`, filtros, métricas reais, foco, leitura, ajuda e retomada |
| Chamados | `operations.js`, `ticket-workflow.js`, `ticket-extras.js`: fila, rascunhos, conversa, notas, roteiros, anexos, equipamentos, agenda e relatório |
| Técnicos | `operations.js`: convites, status, permissões e exigência MFA |
| Conteúdo | `operations.js`: textContent, edição, publicação, exclusão |
| Agenda | `agenda.js`: filtro, compromissos, confirmação, reagendamento, auditoria |
| UniProxiti | `academy.js`, `academy-learning.js`, `academy-curriculum.js`: biblioteca, cursos, perguntas por RPC, notas, tentativas, emissão real e PDF |
| Ferramentas | `technical-tools.js`, `technical-tools-core.js`: CIDR, SHA-256, arquivos locais; inventário já existente em operations.js |
| Perfil | `profile.js`: nome, foto, MFA, senha e encerramento de sessão |

`index.html` contém todas as superfícies; scripts se vinculam a IDs e seletores data-* após defer. O catálogo constrói as trilhas dinamicamente. A apresentação precisa responder às reconstruções sem capturar ou reimplementar eventos operacionais.

CSS base: style.css, proxiti-ui.css, interface.css, overview-comfort.css, ticket-workflow.css, operations-v8.css. CSS de apresentação substituído nesta etapa: reskin-visual.css e uniproxiti-dashboard.css. Nenhum CSS novo sobreposto.

Escopo protegido: todos os scripts operacionais acima e toda a árvore supabase/. A auditoria compara bytes com a base do PR #9, IDs, atributos de formulário e contratos data-*; os testes do repositório exercitam os fluxos com sessões simuladas. Contas reais, MFA real, comunicação entre navegadores e storage real continuam sujeitos à homologação.
