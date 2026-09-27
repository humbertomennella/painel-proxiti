# PROXITI · Reskin visual · Revisão antes do merge

**Branch:** `reskin-visual` (originada de `main`). **PR de revisão:** [#8](https://github.com/humbertomennella/painel-proxiti/pull/8), em draft. Nenhum merge, publicação no Pages nem alteração de banco foi executado nesta entrega. A versão de produção segue na `main`.

## Contrato de escopo e arquivos

| Arquivo | Alteração visual ou de QA | Funcionalidades preservadas |
|---|---|---|
| `index.html` | Inclui o CSS e JS visuais por último, botão de Ajuda no rodapé lateral, backdrop móvel e iniciais de avatar. | Todos os 295 IDs preexistentes; formulários de Auth/MFA/recuperação; filtros, botões, campos e navegação. Nenhuma ação removida. |
| `assets/reskin-visual.css` | Tokens, cores, tipografia, sidebar navy, topbar, login, cards, estados de chamados, trilhas existentes, listas, editores, responsividade, foco e loading. | Visual sobreposto sem remover classes, IDs, atributos de dados, `hidden`, listeners ou elementos atuais. |
| `assets/reskin-visual.js` | Ajustes exclusivamente de interface: saudação por hora, iniciais quando não há foto, Ajuda que abre o guia atual, drawer/backdrop e presença descrita como contas. | Apenas DOM e estado visual; não chama Supabase nem modifica sessão/autorização. O guia, menu e tema existentes continuam executando suas ações. |
| `assets/alerts.js` | Troca exclusivamente três textos para distinguir **Som ligado/desligado** de **Notificações**. | Áudio, desbloqueio do navegador, armazenamento da preferência e alertas de chamados sem mudanças de comportamento. |
| `assets/overview.js` | Formata a data de abertura dos chamados como DD/MM/AAAA, mantendo o horário. | Uma única substituição de apresentação, conferida contra `main`; consultas, sessão e indicadores permanecem idênticos. |
| `assets/academy-learning.js` | Formata a data do certificado e da impressão como DD/MM/AAAA. | Uma única substituição de apresentação, conferida contra `main`; aulas, notas, correção e emissão permanecem idênticas. |
| `tests/reskin-visual.mjs` | Compara branch com `origin/main`, verifica contratos HTML, alterações autorizadas, tokens e contraste de pares representativos; exercita Chromium e ferramentas locais. | Garante que nenhuma dependência funcional precise ser reescrita para o novo tema. |
| `.github/workflows/browser-smoke.yml` | Faz checkout com histórico para comparar com `main`, adiciona auditoria visual, guarda capturas e verifica os testes existentes. | Todos os passos de regressão anteriores continuam no job. |
| `docs/reskin-fase0-protecao.md` | Registra proteção da `main` e os caminhos proibidos. | Nenhuma alteração operacional. |
| `docs/reskin-revisao.md` | Mapa de alterações, fases e QA com evidência e limites. | Nenhuma alteração operacional. |

**Arquivos operacionais intocados:** `assets/app.js`, `assets/profile.js`, `assets/operations.js`, `assets/academy.js`, `assets/academy-curriculum.js`, `assets/agenda.js`, `assets/ticket-*.js`, `assets/technical-tools*.js`, `assets/config.js`, `supabase/**`, Edge Functions e políticas/RPCs. As duas exceções estritamente de exibição, em `assets/overview.js` e `assets/academy-learning.js`, têm comparação byte a byte contra o arquivo da `main` depois da substituição de data prevista. O CI bloqueia qualquer alteração adicional.

## Fases entregues

**Fase 0 · proteção:** branch isolada e contrato versionado. **Fase 1 · tokens:** cores azul/navy, claro/escuro, escalas e estados. **Fase 2 · shell:** sidebar 240 px no desktop, 72 px no tablet, drawer com hambúrguer abaixo de 768 px, topbar e login; a busca global não foi inventada. **Fase 3 · telas:** reskin de Login, Visão Geral, Chamados, Técnicos, CMS, Agenda, UniProxiti, Ferramentas e Meu Perfil. UniProxiti, quizzes e certificados que **já estão na versão atual** foram mantidos; não foram criados módulos extras do mockup. **Fase 4 · microcopy:** áudio versus notificações, presença de contas, saudação local e duas datas legadas em DD/MM/AAAA. **Fase 5 · responsividade e acessibilidade:** foco por teclado, cartões responsivos, skeleton de atualização, contraste de tokens e preferência de movimento reduzido. **Fase 6 · QA:** ver checklist.

A imagem fornecida é referência estética. Números, clientes, técnicos, progresso, notas e certificados nela são ilustrativos e **não foram inseridos** no Supabase ou no HTML de produção.

## QA obrigatório: situação e evidência

A evidência automatizada está no job [Interface responsiva · execução de revisão](https://github.com/humbertomennella/painel-proxiti/actions/runs/36220414369). Para as validações que dependem de contas reais, o resultado correto é **pendente**, não “aprovado por simulação”.

| Verificação | Situação | Evidência ou pendência |
|---|---|---|
| Login, logout e recuperação de senha | **Parcial** | Formulários, campos, mensagens e IDs preservados; Auth não foi alterado. Login/recuperação com conta real ainda não repetidos. |
| Suspensão de técnico e mensagem de bloqueio | **Pendente em ambiente real** | Auth e bloqueio não foram alterados; requer conta suspensa legítima. |
| Fila, filtros e conversa em tempo real | **Parcial** | Testes de Chamados em Chromium com sessão e dados simulados passaram. Duas contas em dois navegadores reais não foram testadas nesta revisão. |
| Anexos até 5 MB e rejeição acima do limite | **Parcial** | Upload, regra de 5 MB e comportamento ambíguo preservados; teste de anexo com backend simulado passou. Teste real de limites ainda pendente. |
| CMS autenticado e anonimato dos rascunhos | **Parcial** | HTML, `textContent`, publicação, código, RLS e Supabase não foram alterados. Verificação de publicação e leitura anônima com tokens reais não foi reexecutada. |
| Convite técnico e exigência de MFA | **Pendente em ambiente real** | Código, formulário e RPCs intocados; exige conta administrativa com MFA verificado e destinatário real. |
| Ferramentas sem rede | **Verificado em navegador simulado** | CIDR /31 e SHA-256 com hash conhecido executados em Chromium com instrumentação de requisições. /32 permanece no teste estático existente. |
| Tema claro/escuro e contraste | **Verificado no escopo automatizado** | Dez larguras (320 a 1920 px), oito superfícies internas em três larguras e dois temas, pares de cores AA; inspeção manual de todas as combinações ainda recomendada. |
| Menu por teclado e mobile drawer | **Verificado em Chromium** | Foco visível via Tab, sidebar 240/72 px, backdrop e fechamento do drawer, ação real da Ajuda. |
| Datas de abertura e certificado | **Verificado por diff exato** | As duas exceções de apresentação passam a usar DD/MM/AAAA; as rotinas e os dados de origem não foram alterados. |
| Zero regressão de código operacional | **Verificado por diff e CI** | 295 IDs originais e valores dos contratos de navegação preservados; apenas arquivos permitidos alterados; smoke das cinco áreas operacionais atuais passou. |
| Nenhum segredo ou chave introduzidos | **Verificado no diff** | Caminhos de config/SQL/Edge Functions inalterados e busca preventiva por padrões de chave privada/segredo nas linhas adicionadas. |

**Revisão adicional:** foi corrigido o reconhecimento visual de “1 profissional online”/“2 profissionais online”. O teste de Chromium verifica ambas as mensagens, preserva “Você está online” para conta técnica e cobre os limites das quatro saudações (00, 05, 06, 11, 12, 17, 18 e 23 horas). A suíte integral passou no commit visual testado, sem alteração do código de presença nem de autenticação. A formatação de duas datas foi restringida por diff exato, sem alterar os fluxos de curso ou de chamados.

**Limite explícito:** os testes de Chromium usam contas e registros simulados. Não reivindicam homologação de autenticação real, convite/MFA, múltiplas contas, upload, publicação CMS ou entrega de notificações externas. Esses ensaios só podem ser concluídos com autorização e credenciais legítimas, sem compartilhar senhas ou códigos MFA em PRs ou chats.

## Revisão visual do titular

As capturas do Chromium estão disponíveis no artefato `proxiti-central-visual-smoke` da [execução de revisão](https://github.com/humbertomennella/painel-proxiti/actions/runs/36220414369), incluindo login, shell e UniProxiti em claro/escuro nas larguras principais. Validar o visual em celular e desktop antes de autorizar qualquer merge.

**Regra de publicação:** PR permanece draft. Não há merge automático. A branch só pode ser integrada após sua revisão explícita.
