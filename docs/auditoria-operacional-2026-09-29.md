# PROXITI | Auditoria operacional e segurança | 29/09/2026

**Status:** auditoria inicial registrada. Este documento é um controle de evidências, **não** uma homologação integral nem autorização para alterar permissões de produção. Nenhum dado de cliente, token, senha, fator de autenticação ou cobrança real foi alterado.

## 1. Linha de base e recuperação

- Site `humbertomennella/proxiti`: `main` na coleta inicial `3b9582890397e662cb5f0fce6354dca8db2daa48`. CI do site e Pages concluídos com sucesso. Uma correção **somente documental** do checkout foi integrada depois, no PR #41; confirmar `main` antes de qualquer mudança posterior.
- Central `humbertomennella/painel-proxiti`: `main` `c880bffd9e995cea01d01bf30732cd485b4519cc`, com CI, smoke da API e Pages concluídos com sucesso. A branch desta auditoria foi criada a partir desse SHA. PR #12 de revisão visual permanece aberto e **não** foi integrado por esta auditoria.
- Supabase: projeto operacional `ACTIVE_HEALTHY`, PostgreSQL 17 e organização no plano gratuito. A função publicada `proxiti-support` está na versão 10; seu `index.ts` publicado coincide com o arquivo no repositório. O backend público usa `verify_jwt=false` por ter rotas de atendimento anônimo; rotas de conta e administração verificam explicitamente a identidade. A condição não pode ser tratada isoladamente como falha de autorização.
- **Recuperação:** cada alteração precisa de branch/PR específico, comparação com a linha de base, CI e teste de regressão. Migrações exigem backup/estratégia de rollback e validação de papéis em ambiente isolado, além de autorização do titular. A versão anterior de cada Edge Function deve permanecer identificável; não tratar rollback do GitHub como rollback automático do banco.

Evidências: workflows oficiais dos dois repositórios, catálogo PostgreSQL somente leitura, advisory do Supabase, lista de migrations e metadados da Edge Function.

## 2. Segurança do banco e MFA

Consulta a `pg_proc` e `pg_namespace`: 82 funções `SECURITY DEFINER` em `public`, 71 executáveis por `authenticated`, nenhuma diretamente por `anon`, todas com `search_path` explícito. **71 alertas não equivalem a 71 vulnerabilidades.** Cada RPC deve ser classificada por finalidade, `EXECUTE`, vínculo com registro, papel, status e exigência de AAL2.

**Defeito de política comprovado por inspeção da função publicada:** `proxiti_mfa_ready(p_id)` retorna verdadeiro quando **não existe fator TOTP verificado** ou quando o token informa `aal2`. Como `proxiti_is_admin()` utiliza esse resultado, um administrador ativo sem segundo fator cadastrado pode passar por parte das verificações administrativas com sessão `aal1`. Há funções adicionais que exigem `aal2` diretamente, como `proxiti_commercial_admin()` e a atualização de técnicos, de modo que a proteção é **inconsistente**, não ausente em toda a operação. Exemplo de impacto: `proxiti_admin_assign_ticket` chama `proxiti_is_admin()` sem segunda checagem de AAL2.

**Correção preparada, NÃO aplicada:** `docs/propostas/mfa-aal2-obrigatorio-v20.sql`, que torna `proxiti_mfa_ready` estrito. **Não executar diretamente**: antes é obrigatório criar um fluxo de cadastro do segundo fator que permita ao administrador AAL1 acessar somente a ativação TOTP, testar a transição para AAL2, confirmar que todas as rotas administrativas permanecem bloqueadas antes disso, preparar recuperação administrativa autorizada e só então implantar com autorização. Em particular, o painel atual só solicita TOTP se o Supabase já indica `nextLevel=aal2`; administrador sem fator ainda entra no layout geral. A migração isolada resultaria em interface parcialmente acessível com RPCs negadas.

Outras funções examinadas no banco: `proxiti_customer_link_ticket` exige token, hash, e-mail correspondente e ausência de vínculo com outra conta; `proxiti_customer_open_ticket_server` e `proxiti_customer_quote_decide` exigem `service_role`; `proxiti_partner_offer_decide` verifica titular da oferta, qualificação e disponibilidade do chamado; `proxiti_commercial_mark_payout` exige administrador com MFA, mas apenas registra uma referência manual, sem movimentação bancária.

RLS está habilitada nas tabelas públicas inspecionadas. Três tabelas com RLS sem política (`academy_questions`, `academy_track_exam_questions`, `support_limits`) bloqueiam leitura direta; averiguar as RPCs que expõem cada conteúdo antes de classificá-las. Quatro alertas de políticas permissivas sobrepostas e os privilégios de todas as RPCs ainda precisam de testes de isolamento usando papéis reais e tokens distintos, sem dados de clientes na saída.

**Proteção contra senha vazada:** aviso ativo. A documentação do Supabase informa que o recurso nativo exige plano Pro ou superior; a organização atual é Free. Não afirmar que o problema foi corrigido por configuração indisponível. Revisar política de senha, prevenção de abuso, reautenticação e eventual mudança de plano com decisão comercial.

Referências: https://supabase.com/docs/guides/auth/password-security ; https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable .

## 3. Atendimento, integração e evidência real

- O teste de fumaça do repositório Central, na linha de base, fez chamadas HTTP de produção para `online`, bloqueio de cadastro sem consentimento, convite sem JWT, consulta pública ao CMS e negação de acesso anônimo às tabelas de chamados/auditoria/recibos. O resultado do workflow foi sucesso; esse teste **não** exercita a jornada completa nem simula identidades de clientes reais.
- No banco, contagem agregada inicial: 10 chamados (8 encerrados, 1 novo e 1 aguardando cliente), 3 propostas (1 rascunho, 1 emitida e 1 recusada), 2 contas de cliente ativas e nenhuma oportunidade de parceiro registrada. Contagens podem mudar; não expor dados pessoais nem usar esses registros para teste destrutivo.
- O domínio de envio transacional do Resend está verificado e habilitado. A consulta a logs de e-mail apresentou mensagens operacionais com status `delivered` na amostra recente. Isso comprova entrega desses avisos específicos segundo o provedor, **não** confiabilidade universal, aviso em todas as condições, nem leitura pelo destinatário.
- Ainda faltam testes autorizados de cliente A/B, técnico designado/não designado/suspenso, administrador AAL1/AAL2, anexos, encerramento sob concorrência, repetição de mensagens e retomada após falha de rede. Os testes de navegador do projeto usam dados simulados e não substituem essa validação.

**Risco de integridade a testar:** criação pública de chamado e primeira mensagem ocorre em duas operações de banco na Edge Function; uma falha intermediária pode deixar chamado sem a mensagem inicial. Respostas sem identificador de idempotência podem ser duplicadas em reenvio após falha de rede. Preparar RPC transacional/idempotência em ambiente isolado, preservando chamadas existentes, antes de produção.

## 4. Central, comercial, parceiros e arquivos

- A Central guarda o rascunho de resposta por conta/chamado em `sessionStorage`. Isso não é persistência segura de longo prazo, e scripts da mesma origem têm acesso a esse texto. Não migrar automaticamente para `localStorage`, nem expor dados do rascunho em relatórios. O estado visual de “em edição”, “salvo localmente”, “registrado” e “enviado” requer validação com técnicos antes de alterações de UX.
- O comercial diferencia rascunho, proposta emitida, aceite, recebimento e repasse manual; não equiparar lançamento a transferência bancária. Sem autorização, não criar registros financeiros, cobranças ou estornos de teste.
- Parceiros: a RPC de aceite exige oferta do próprio técnico, perfil operacional aprovado, proposta aceita e chamado disponível. Nenhuma oportunidade estava registrada na consulta inicial. A operação de parceiros exige validação contratual, fiscal e operacional antes de ativação; certificação interna não concede automaticamente acesso a clientes.
- PC Seguro: no site, checkout Kiwify está ativo; **não** há prova de compra e entrega real do kit apenas pelo link. O documento do site foi atualizado no PR #41 sem alterar vendas. Requer teste de comprador autorizado, cinco PDFs íntegros, preenchimento após salvar/reabrir e análise do DRM.
- A auditoria visual entre cartão, atendimento, site, cliente e Central continua pendente de validação conjunta real em mobile; nenhum redesign novo foi iniciado.

## 5. Próximos critérios de homologação

1. Validar acesso a dados com identidades separadas e tabelas/RPCs reais, **somente com contas de teste autorizadas** em ambiente apropriado. Rejeições precisam ser verificadas no banco e no front-end.
2. Preparar e testar cadastro/recuperação de MFA para administradores sem segundo fator, e somente então aprovar a migração estrita de AAL2.
3. Testar chamada pública e autenticada com confirmação na Central, histórico, mensagens duplicadas/falhas, anexos, proposta, autorização, agendamento e encerramento. Preservar cada versão e evidência sanitizada.
4. Confirmar checkout e distribuição Kiwify com o titular; nenhuma compra real foi feita nesta auditoria.
5. Revalidar dependências, CI e publicação após cada mudança. Distinguir sempre: código implementado, teste com simulação, teste HTTP real sem credencial, teste real autenticado e operação comercial comprovada.

**Estado final deste documento:** inventário e parte da inspeção de segurança concluídos; alertas classificados preliminarmente; mudança de MFA somente proposta; operação ponta a ponta e entrega comercial ainda não homologadas.
