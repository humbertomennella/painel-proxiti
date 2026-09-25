# Central Técnica PROXITI

Repositório público da interface privada da PROXITI. A autenticação, as regras de acesso e os dados operacionais ficam no projeto Supabase **Central Técnica PROXITI**; arquivos privados não são publicados no GitHub.

**Painel:** https://humbertomennella.github.io/painel-proxiti/  
**Site público:** https://proxiti.com.br/  
**Atendimento e chat:** https://proxiti.com.br/atendimento/

## Recursos implantados

- Login por Supabase Auth, recuperação de senha e acesso restrito a contas autorizadas.
- Administração de técnicos: convite por e-mail, situação pendente/ativa/suspensa, nome e permissões individuais.
- Fila de chamados: cliente abre no site; administrador visualiza todos; técnico autorizado visualiza seus chamados e a fila sem responsável, aceita chamados e atualiza a situação.
- Chat integrado ao chamado: visitantes acompanham e respondem com uma chave aleatória guardada **somente no navegador**; a equipe responde pelo painel. O visitante recebe novas mensagens por atualização automática (~4 s); o painel recebe alterações em tempo real, com atualização periódica de reserva.
- Presença: um técnico com acesso ao chat e painel visível envia sinal periódico. Quando disponível, pode receber uma conversa iniciada pelo site.
- Conteúdo gerenciável: edição, publicação e remoção das personalizações de texto integradas do site (atualmente quatro blocos em `public.site_content`).
- Academia: cadastro de materiais e upload privado de PDF/imagem até 10 MB; liberação apenas a parceiros com permissão.
- Ferramentas: cadastro, alteração, atribuição a um técnico e exclusão do registro.
- Proteção por RLS no banco; privilégios não dependem apenas de elementos ocultos no HTML.

## O que foi testado

- Projeto e tabelas Supabase criados; políticas RLS e grants verificados.
- Fluxo público de ticket criado com dados sintéticos, consulta da conversa, mensagem do visitante e bloqueio de chave inválida. O registro sintético foi excluído do banco após o teste.
- API de disponibilidade, recusa de solicitação sem consentimento, recusa de convite sem autenticação, leitura pública do CMS e bloqueio anônimo da tabela de chamados.
- Publicações GitHub Pages do painel e do site concluídas anteriormente com sucesso.

**Ainda requer testes manuais com contas reais:** convite por e-mail (entrega pode depender da configuração de SMTP), técnico secundário, mensagens entre dois navegadores, upload e acesso ao material privado, edição do CMS e estados de indisponibilidade. Não declare estes fluxos verificados até concluir os testes.

## Operação do administrador

1. Entre no painel e abra **Gestão PROXITI → Chamados** para atender, designar e responder. O contato direto por telefone/e-mail continua no site.
2. Em **Técnicos e permissões**, convide uma pessoa; o perfil fica pendente até a aprovação. Permita somente os módulos necessários. Suspensão bloqueia o acesso a novos dados.
3. Em **Conteúdo do site**, edite blocos por identificador. A exclusão da personalização restaura o texto estático original. O editor utiliza `textContent`, nunca HTML arbitrário.
4. Em **Academia**, publique arquivos no bucket **privado** `proxiti-training`. Em **Ferramentas**, registre e atribua equipamentos.

## Limite importante: controle do site

Este painel permite administrar **os dados operacionais, técnicos, arquivos autorizados e os blocos de conteúdo já vinculados**. **Ele ainda não edita todo o HTML, CSS, JavaScript, páginas estáticas, layouts, domínio ou checkout do GitHub.** Para controlar o código-fonte sem abrir o editor do GitHub, falta construir uma integração de publicação por servidor usando uma GitHub App autorizada exclusivamente no repositório da PROXITI, com permissão mínima, proteção de branch e trilha de auditoria. Nunca coloque token GitHub ou chave Supabase privada no navegador.

Os cursos completos com progresso/avaliações, portfólios públicos individuais e alterações arbitrárias do site também não estão implementados. Os materiais privados da Academia já têm upload e gestão.

## Arquitetura

- `index.html`, `assets/style.css`, `assets/app.js`: autenticação e interface.
- `assets/operations.js`: chamados, chat da equipe, convites, CMS, Academia e Ferramentas.
- `assets/config.js`: URL e **chave pública** do Supabase. Nunca coloque `service_role`, `sb_secret_` ou dados dos clientes no repositório.
- `supabase/schema.sql`: perfis V1.
- `supabase/operations_v2.sql` e `supabase/fix_public_cms_rls_v2.sql`: expansão aditiva e correção de RLS.
- `supabase/functions/proxiti-support/index.ts`: rota Edge Function com tokens de conversa para o visitante, validação JWT para convites e limitação de solicitações.
- `.github/workflows/integration-smoke.yml`: testes automáticos não destrutivos.

## Cuidados antes de ampliar a operação

- A autenticação e os dados estão no Supabase Free; monitore limites, disponibilidade e backups. Defina política de retenção e um procedimento de exportação segura antes do uso em escala.
- A Edge Function é pública **somente nas operações de visitante** e usa chave aleatória por conversa, validação de origem, honeypot e limite por identificador técnico. O limite não substitui proteção anti-bot dedicada, como Turnstile.
- Revise o aviso de privacidade com os fluxos efetivamente oferecidos, habilite recursos de segurança de senha disponíveis no plano e teste recuperação de acesso.
- Nenhum serviço começa automaticamente só porque o chamado foi aberto. Os técnicos precisam de autorização e as condições comerciais devem estar formalizadas.
