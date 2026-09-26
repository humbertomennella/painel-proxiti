# Reskin PROXITI · Fase 0 · proteção e contrato de escopo

Branch de trabalho: `reskin-visual`, criada a partir de `main`. Nenhuma alteração será mesclada sem aprovação do titular.

**Escopo permitido:** somente apresentação e acessibilidade do HTML/CSS; um módulo independente e estritamente de interface para saudação, avatar visual, ajuda e responsividade; microcopy do botão de áudio sem alterar sua lógica; testes de regressão visual e documentação.

**Escopo protegido:** `assets/app.js`, `assets/profile.js`, `assets/operations.js`, `assets/overview.js`, `assets/academy*.js`, `assets/agenda.js`, `assets/ticket-*.js`, `assets/technical-tools*.js`, `assets/config.js`, todas as migrações `supabase/**` e Edge Functions. Não modificar consultas, credenciais, persistência de rascunhos, fluxos de publicação, políticas nem permissões.

**HTML:** preservar IDs, atributos de dados, nomes de classes usados pelos scripts, `hidden`, formulários, `aria-*`, opções e ações. A sidebar não ganha módulos que existem somente na referência; os módulos efetivos permanecem condicionados às permissões atuais.

**Imagem de referência:** orientação estética, não fonte de dados. Não copiar os números, notas, certificados, pessoas, eventos ou cursos fictícios do mockup para o banco ou para a interface real.

**Plano de validação:** comparar `main` com a branch; garantir nenhum arquivo protegido modificado e nenhum segredo adicionado; rodar testes existentes, testar cada uma das nove superfícies com estado simulado, responsividade, tema e navegação. Fluxos que exigem duas contas reais ou envio de e-mail ficam identificados como não homologados até serem executados com autorização.
