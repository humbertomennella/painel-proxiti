-- PROPOSTA NÃO IMPLANTADA | PROXITI | 29/09/2026
-- Revisar, testar em ambiente isolado e obter autorização explícita do titular.
-- Esta instrução NUNCA deve ser aplicada sozinha: o painel atual precisa primeiro
-- oferecer matrícula TOTP para administrador com sessão AAL1 sem liberar dados
-- administrativos. Validar recuperação de acesso e ao menos um administrador
-- com fator funcional antes da mudança. Nenhuma conta real deve ser criada
-- ou alterada para simular testes.
--
-- Efeito esperado: funções que invocam proxiti_is_admin() e proxiti_can()
-- deixarão de autorizar administrador AAL1, inclusive sem TOTP cadastrado.
-- Técnicos seguem submetidos às suas permissões e às verificações próprias.
-- Funções com política ainda mais restritiva mantêm a restrição.
--
-- PLANO DE IMPLANTAÇÃO COORDENADA, NÃO EXECUTAR ESTE ARQUIVO DIRETAMENTE:
-- 1) Snapshot de DDL/ACL, backup, mapa de dependências e teste das rotas.
-- 2) Implantar UI de matrícula TOTP em modo restrito AAL1. Confirmar
--    cadastro e AAL2 com identidades autorizadas, sem exibir dados administrativos
--    ao usuário AAL1.
-- 3) Validar todas as RPCs administrativas com AAL1 e AAL2, administrador
--    suspenso, técnico com/sem permissão e cliente; auditar logs/resultados.
-- 4) Obter autorização para janela de implantação e procedimento de recuperação.
-- 5) Aplicar a função abaixo por migração versionada; verificar privilégios
--    e comportamento no Supabase; monitorar falhas e restaurar conforme política
--    autorizada. A migração não altera dados.
-- 6) Em rollback, restaurar o corpo/ACL da função do snapshot da implantação,
--    SEM presumir que o código V6 antigo continua adequado como política.
--
-- SQL PROPOSTO (NÃO EXECUTADO)
create or replace function public.proxiti_mfa_ready(p_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $proxiti_mfa_policy$
  select p_id is not null
    and p_id = (select auth.uid())
    and coalesce((select auth.jwt())->>'aal','aal1') = 'aal2'
    and exists (
      select 1 from auth.mfa_factors f
      where f.user_id = p_id
        and f.status = 'verified'
    );
$proxiti_mfa_policy$;

revoke all on function public.proxiti_mfa_ready(uuid)
from public, anon, authenticated;
