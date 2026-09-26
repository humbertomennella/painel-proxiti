# UniProxiti · dashboard da capacitação interna

Branch: `uniproxiti-dashboard`. Integração com `main` somente após revisão do titular. Não há alterações no Supabase, RLS, Edge Functions ou nas RPCs de correção.

## Renomeação

O rótulo público do módulo é **UniProxiti** e o subtítulo é **Programa interno de capacitação PROXITI**. IDs HTML, tabelas `academy_*`, funções `proxiti_academy_*`, eventos de sessão, nomes de arquivos históricos e versão do currículo continuam inalterados para preservar compatibilidade. Os erros legados recebidos do banco com a palavra “Academia” são apresentados com o nome novo na interface, sem reescrever as funções publicadas. Não existem templates próprios de e-mail da Academia no código desta Central; não foram inventados envios nem modificadas mensagens genéricas do Auth.

## Fonte dos indicadores

- `academy_courses`: cursos ativos, trilha e classificação `required` com RLS de capacitação; se a consulta falhar ou faltar parte do catálogo, a interface mostra informação indisponível, não números presumidos.
- `academy_course_progress`: `best_score`, `last_score`, `attempts`, `completed_at` e `updated_at`. Progresso geral = aulas com `completed_at` dividido pelos cursos ativos verificados. Média = melhor nota das aulas aprovadas, como na regra da prova no servidor.
- `academy_quiz_attempts`: histórico das oito tentativas mais recentes, somente `course_id`, `score`, `passed` e `created_at`. Não consulta respostas, gabarito ou dados de outra conta.
- `academy_certificates`: única fonte para declarar certificação **Disponível**, exibir card e habilitar impressão/PDF pelo fluxo já existente. Concluir aulas e alcançar uma média isoladamente não emite certificado: prova final, média ponderada e questões críticas são verificadas no servidor.

Todas essas tabelas e políticas **já existiam**. Foram acrescentadas apenas leituras RLS na interface, sem migração.

## Limite deliberado de “Continuar de onde parou”

O sistema não salva posição de leitura ou percentual individual de uma aula. A home retoma uma aula com tentativa registrada, se houver, ou recomenda a próxima não aprovada, e exibe **percentual da trilha baseado em aprovações**. Não apresenta um percentual de leitura falso. Registrar leitura no banco exige aprovação de uma evolução funcional separada.

## Layout e acessibilidade

Quatro indicadores, hero compacto, trilhas com categoria oriunda do banco, CTA por estado, atividade recente, retomada e certificado condicionado à emissão. Os controles originais de trilhas, provas, biblioteca e publicação continuam no DOM. Os critérios extensos ficam em um `details` acessível. O CSS corrige o contraste dos chips dinâmicos da Visão Geral em ambos os temas.

## QA antes do merge

1. `node tests/central-integrity.mjs`: código estático e contratos.
2. `node tests/academy-learning-functional.mjs`: dados simulados variados e fluxos reais de UI no Chromium, incluindo ausência de histórico, notas, badge, retomada, prova e certificado emitido pelo mock.
3. `node tests/uniproxiti-integrity.mjs`: IDs de `main` preservados, tabelas existentes, mudanças permitidas e pares de contraste AA.
4. `node tests/browser-smoke.mjs`, `node tests/overview-functional.mjs`, `node tests/academy-functional.mjs` e demais suites anteriores.

**Pendentes de homologação real:** login da equipe, leitura das quatro tabelas com perfil técnico e administrador, provas corrigidas pelo banco, certificado após aprovação e edição/publicação da biblioteca sob RLS. Não marcar como executados por testes de contas simuladas.
