# Central Técnica PROXITI — reformulação visual completa

Entrega exclusiva para revisão. Branch `central-visual-completo`, PR #10, base `uniproxiti-dashboard`. Depende do PR #9. Nenhum merge nem publicação.

## O que mudou

A apresentação foi reorganizada no HTML existente, com substituição dos dois estilos do reskin. Sidebar navy fixa (240 px no desktop; 72 px no tablet), topbar compacta, conteúdo com superfícies claras ou escuras independentes, banners fotográficos locais, controles e cartões consistentes.

Na UniProxiti, o banner fica imediatamente após a topbar. A ordem é: quatro indicadores reais e continuar, trilhas, retomada e atividade, ações de certificação, biblioteca e editor administrativo. Oito trilhas por linha em desktop a partir de 1280 px; quatro ou duas conforme o espaço; uma na largura mínima de 320 px. Resumos nativos abrem as aulas, preservando botões e navegação.

Chamados prioriza conversa e resposta antes dos registros técnicos. Técnicos separa convites de contas cadastradas. CMS separa formulário e lista de blocos. Agenda, ferramentas e perfil usam a mesma arquitetura de cartões.

## Arquivos e contratos

| Arquivo | Alteração | Preservação |
|---|---|---|
| `index.html` | Reordena blocos, integra banner e biblioteca, agrupa convites/CMS | 323 IDs da base; campos, tipos, labels, seletores e ações existentes |
| `assets/reskin-visual.css` | Substitui apresentação de shell, login e áreas internas | Estados hidden, permissões e controles operacionais |
| `assets/uniproxiti-dashboard.css` | Substitui composição do dashboard e trilhas | Progresso, notas, tentativas e certificado continuam dados do servidor |
| `assets/reskin-visual.js` | Imagens nas trilhas dinâmicas; foco e teclado do drawer | Não consulta Supabase nem substitui handlers operacionais |
| `assets/photos/technical-hero.webp` | Banner fotográfico ilustrativo original | Sem pessoa fictícia representando equipe |
| `assets/photos/computer.webp` | Miniatura de computadores | Conteúdo dinâmico continua em HTML |
| `assets/photos/networks.webp` | Miniatura de redes | Conteúdo dinâmico continua em HTML |
| `assets/photos/support.webp` | Miniaturas de atendimento/operação | Sem hotlink |
| `assets/photos/security.webp` | Miniaturas de segurança/backup/privacidade | Sem hotlink |
| `assets/photos/README.md` | Origem, prompts e tamanhos das imagens | Proveniência documentada |
| `tests/central-visual-integrity.mjs` | Auditoria contra SHA fixo do PR #9 | Scripts operacionais e Supabase comparados byte a byte |
| `tests/central-visual.mjs` | Matriz de telas, temas, larguras, capturas e controles | Fixtures somente em testes |
| `.github/workflows/central-visual-review.yml` | Executa QA e guarda evidências no PR | Sem job de deploy; contents: read |
| `docs/central-visual-inventario.md` | Inventário e base protegida | Escopo verificável |
| `docs/central-visual-revisao.md` | Este relatório | Pendências reais explicitadas |

## Comparação com a referência

| Elemento da imagem | Implementação | Diferença justificada |
|---|---|---|
| Sidebar navy e item ativo azul | Sidebar escura em ambos os temas, ícones outline e gradiente azul | Somente módulos existentes e permitidos para a conta |
| Topbar horizontal azul/navy | Conta, tema, alertas, notificações e saída | Não existe busca global; a busca de biblioteca permanece no contexto correto |
| Hero com foto e texto | Foto original de bancada técnica, título UniProxiti e subtítulo solicitado | Não apresenta personagem ilustrativo como integrante real |
| Quatro indicadores | Aprovações, última tentativa, progresso e emissão interna | Números vêm dos registros autorizados; nenhum valor da referência foi copiado |
| Trilhas compactas ilustradas | Oito no desktop amplo, responsivas; navegação e avaliações preservadas | Catálogo real tem 16 aulas; não foram inventados módulos, duração ou percentual de leitura |
| Retomada e atividade | Retomada pela conta e histórico de tentativas/aprovações | Sem pontuação fictícia por atividade |
| Certificado | Card somente após emissão efetiva; acesso ao estado pelo botão Meu certificado | Ausência do card antes da emissão é intencional |
| Cursos rápidos, equipamentos, clientes e relatórios independentes | Não adicionados | Funcionalidades inexistentes não foram inventadas |

## Limites da verificação

Testes funcionais usam sessões e respostas simuladas, executando os scripts reais do repositório no Chromium. Capturas são do HTML real com essas fixtures; não são imagens geradas da interface nem dados de produção.

Axe verifica contraste renderizado onde pode determinar o fundo. Gradientes e fotografias podem retornar verificação incompleta; esses trechos exigem inspeção visual e cálculo conservador das cores, não devem ser apresentados como aprovação automática integral de WCAG.

Permanecem pendentes: login e recuperação com e-mail real, MFA/TOTP real, convite real, upload/storage real, conversa em tempo real entre dois navegadores autenticados, publicação real do CMS e emissão de certificado no banco real. Não foram acionadas operações reais para produzir capturas.

## Resultados automatizados

Execução aprovada: https://github.com/humbertomennella/painel-proxiti/actions/runs/36269094001. A aba Checks do PR registra a execução de cada commit posterior.

| Verificação | Resultado | Escopo |
|---|---|---|
| Três suítes de integridade | Aprovado | 323 IDs; campos e seletores; scripts operacionais e árvore Supabase byte a byte contra o PR #9 |
| Smoke responsivo existente | Aprovado | Cinco larguras, dois temas, controles alcançáveis |
| Visão geral | Aprovado | 11 cenários: permissões, falhas, vazio, dados, retomada e layout |
| Chamados | Aprovado | 10 cenários: rascunhos, leitura, paginação, concorrência, notas, anexos e encerramento |
| Agenda | Aprovado | 11 cenários: confirmação, reagendamento, auditoria, filtros e acesso |
| Biblioteca UniProxiti | Aprovado | 11 cenários: revisão, versões, concorrência, pesquisa, falhas e arquivos |
| Capacitação | Aprovado | Nove fluxos: aulas, avaliações, progresso, reprovação e certificado |
| Nova matriz de telas internas | Aprovado | Oito áreas × 1920/1366/768/375/320 px × dois temas: 80 verificações sem overflow |
| Login | Aprovado | Cinco larguras × dois temas; estados de recuperação, redefinição e MFA renderizados |
| CMS, perfil e ferramentas | Aprovado | Texto literal, edição/salvamento/exclusão simulados; nome; CIDR /31; SHA-256 conhecido |
| Menu móvel | Aprovado | Entrada de foco, Escape, retorno de foco e backdrop |
| Contraste automático | Aprovado no escopo determinável | Axe color-contrast, oito áreas e login, dois temas; limitações de fundos complexos descritas acima |
| Cores principais | Aprovado | Cálculo conservador de sete pares: de 5,01:1 a 13,41:1 |
| Erros JavaScript na nova matriz autenticada | Nenhum | Sessão simulada, HTML e scripts reais |

## Checklist de homologação real

- [x] Reorganização integrada ao HTML real, com evidências de navegador.
- [x] Componentes funcionais preservados nos testes e contratos.
- [x] Estados sem dados, falhas e dados variados testados por fixtures.
- [x] Inspeção visual de composição, hierarquia, imagens, cards e temas.
- [ ] Login, recuperação de e-mail e MFA/TOTP com conta real.
- [ ] Convite e alteração de permissões com administrador real.
- [ ] Uploads, anexos e storage reais.
- [ ] Mensagens em tempo real entre dois navegadores autenticados.
- [ ] Publicação real do CMS e certificado efetivamente persistido.
- [ ] Aprovação do responsável antes de qualquer merge ou publicação.
