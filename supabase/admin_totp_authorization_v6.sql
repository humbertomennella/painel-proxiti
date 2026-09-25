-- PROXITI V6: operações administrativas respeitam o nível de autenticação após TOTP ativado.
create or replace function public.proxiti_mfa_ready(p_id uuid)
returns boolean language sql stable security definer set search_path=''
as $$
 select not exists(select 1 from auth.mfa_factors f where f.user_id=p_id and f.status='verified')
   or coalesce(auth.jwt()->>'aal','aal1')='aal2';
$$;
revoke all on function public.proxiti_mfa_ready(uuid) from public,anon,authenticated;

create or replace function public.proxiti_is_admin() returns boolean
language sql stable security definer set search_path=''
as $$
 select exists(select 1 from public.profiles p
   where p.id=(select auth.uid()) and p.role='administrator' and p.status='active'
     and public.proxiti_mfa_ready(p.id));
$$;
revoke all on function public.proxiti_is_admin() from public,anon;
grant execute on function public.proxiti_is_admin() to authenticated;

create or replace function public.proxiti_can(p_key text) returns boolean
language sql stable security definer set search_path=''
as $$
 select exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.status='active'
   and ((p.role='administrator' and public.proxiti_mfa_ready(p.id))
      or (p.role='technician' and coalesce((p.permissions->>p_key)::boolean,false))));
$$;
revoke all on function public.proxiti_can(text) from public,anon;
grant execute on function public.proxiti_can(text) to authenticated;

create or replace function public.proxiti_admin_update_technician(
 p_id uuid,p_name text,p_status text,p_permissions jsonb)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.proxiti_is_admin() then raise exception 'Acesso negado'; end if;
 if coalesce(auth.jwt()->>'aal','aal1')<>'aal2' then
   raise exception 'Ative e confirme a verificação em duas etapas em Meu perfil antes de gerenciar técnicos';
 end if;
 if not exists(select 1 from public.profiles where id=p_id and role='technician') then
   raise exception 'O perfil técnico não existe';
 end if;
 if p_status not in ('pending','active','suspended') then raise exception 'Status inválido'; end if;
 if p_name is null or length(btrim(p_name)) not between 2 and 120 then raise exception 'Nome inválido'; end if;
 if p_permissions is null or jsonb_typeof(p_permissions)<>'object' or
    exists(select 1 from jsonb_each(p_permissions) v where
      v.key not in ('tickets_view','tickets_claim','chat','training','resources') or
      jsonb_typeof(v.value)<>'boolean') then raise exception 'Permissões inválidas'; end if;
 update public.profiles
 set display_name=btrim(p_name),status=p_status,permissions=p_permissions
 where id=p_id;
end;
$$;
revoke all on function public.proxiti_admin_update_technician(uuid,text,text,jsonb) from public,anon;
grant execute on function public.proxiti_admin_update_technician(uuid,text,text,jsonb) to authenticated;
