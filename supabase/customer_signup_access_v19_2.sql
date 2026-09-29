-- V19.2: cadastro sem etapa de confirmação obrigatória, com e-mail de titularidade
-- NÃO comprovada separado do indicador interno do Auth. Sem alterações de chamados
-- ou das regras de permissão dos técnicos.
alter table public.customer_accounts
 add column if not exists email_ownership_verified_at timestamptz;
comment on column public.customer_accounts.email_ownership_verified_at is
 'Prova real de controle do e-mail. O auto-confirm interno do Auth no cadastro facilitado NÃO equivale a prova de titularidade.';

-- Migração executada ANTES de habilitar cadastro facilitado: preserva evidência
-- de confirmações reais preexistentes sem legitimar novas inscrições sem e-mail.
update public.customer_accounts c
set email_ownership_verified_at=u.email_confirmed_at
from auth.users u where u.id=c.user_id and u.email_confirmed_at is not null
  and c.email_ownership_verified_at is null;

-- Vincular ao CRM existente pode revelar histórico de outro cliente.
-- Um e-mail digitado, mesmo "confirmado" automaticamente para login, não prova
-- a titularidade. Mantém o vínculo em modo fechado até comprovação explícita.
create or replace function public.proxiti_customer_admin_link_crm(
 p_account uuid,p_client uuid)
returns void language plpgsql security definer set search_path='' as $$
declare v_email text;v_crm_email text;v_verified timestamptz;
begin
 if not public.proxiti_commercial_admin() then
  raise exception 'Administração com MFA obrigatória';end if;
 select lower(u.email),c.email_ownership_verified_at
 into v_email,v_verified
 from public.customer_accounts c join auth.users u on u.id=c.user_id
 where c.user_id=p_account and c.status='active';
 select lower(email) into v_crm_email from public.client_profiles
 where id=p_client and status='active';
 if v_verified is null then
  raise exception 'Comprove a titularidade do e-mail antes de vincular o cadastro existente';end if;
 if v_email is null or v_crm_email is null or v_email<>v_crm_email then
  raise exception 'O e-mail da conta não corresponde ao cadastro do cliente';end if;
 update public.customer_accounts set crm_client_id=p_client,updated_at=now()
 where user_id=p_account and status='active' and email_ownership_verified_at is not null;
 if not found then raise exception 'Conta do cliente não encontrada';end if;
 update public.support_tickets set client_id=p_client,updated_at=now()
 where id in (select ticket_id from public.customer_ticket_links where user_id=p_account)
  and client_id is null;
end; $$;
revoke all on function public.proxiti_customer_admin_link_crm(uuid,uuid)
 from public,anon;
grant execute on function public.proxiti_customer_admin_link_crm(uuid,uuid)
 to authenticated;

-- Disponibilizar o sinal ao painel administrativo, sem divulgar o timestamp.
create or replace function public.proxiti_customer_admin_directory()
returns jsonb language sql stable security definer set search_path='' as $$
 select case when public.proxiti_is_admin() then
 coalesce(jsonb_agg(jsonb_build_object(
  'user_id',c.user_id,'display_name',c.display_name,
  'email',u.email,'phone',c.phone,'city',c.city,
  'crm_client_id',c.crm_client_id,'email_ownership_verified',
    c.email_ownership_verified_at is not null,
  'status',c.status,
  'tickets',(select count(*) from public.customer_ticket_links l where l.user_id=c.user_id))
  order by c.created_at desc),'[]'::jsonb)
 else '[]'::jsonb end
 from public.customer_accounts c join auth.users u on u.id=c.user_id;
$$;
revoke all on function public.proxiti_customer_admin_directory()
 from public,anon;
grant execute on function public.proxiti_customer_admin_directory()
 to authenticated;
