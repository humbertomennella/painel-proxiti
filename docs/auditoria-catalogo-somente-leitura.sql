-- PROXITI | CONSULTAS DE AUDITORIA SOMENTE LEITURA
-- PostgreSQL/Supabase. Não consulta conteúdo, e-mails, senhas, tokens,
-- contas ou registros de clientes. Não tem INSERT/UPDATE/DELETE/DDL.
-- Executar por pessoa autorizada após revisar escopo e conexão.

-- SECURITY DEFINER: papel de execução e search_path por função.
select p.proname,
       pg_get_function_identity_arguments(p.oid) as arguments,
       p.prosecdef as security_definer,
       has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_execute,
       has_function_privilege('anon',p.oid,'EXECUTE') as anon_execute,
       exists (
         select 1 from unnest(coalesce(p.proconfig,array[]::text[])) opt
         where opt like 'search_path=%'
       ) as explicit_search_path
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.prosecdef
order by p.proname,arguments;

-- RLS e quantidade de políticas por tabela pública.
select c.relname as table_name,
       c.relrowsecurity as rls_enabled,
       c.relforcerowsecurity as rls_forced,
       count(pol.polname) as policy_count
from pg_class c join pg_namespace n on n.oid=c.relnamespace
left join pg_policy pol on pol.polrelid=c.oid
where n.nspname='public' and c.relkind in ('r','p')
group by c.relname,c.relrowsecurity,c.relforcerowsecurity
order by c.relname;

-- Contratos das políticas: somente metadados públicos do catálogo.
select tablename,policyname,permissive,roles,cmd,qual,with_check
from pg_policies
where schemaname='public'
order by tablename,policyname;

-- Verificar apenas dependências administrativas de MFA.
select p.proname,
       pg_get_function_identity_arguments(p.oid) as arguments,
       pg_get_functiondef(p.oid) as definition
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public'
  and p.proname in ('proxiti_mfa_ready','proxiti_is_admin',
                   'proxiti_can','proxiti_commercial_admin',
                   'proxiti_admin_assign_ticket','proxiti_admin_update_technician')
order by p.proname;

-- Revise cuidadosamente o diff do corpo dessas funções antes de
-- aprovar qualquer mudança; nenhuma consulta acima modifica a produção.
