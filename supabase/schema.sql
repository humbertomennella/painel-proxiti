-- Execute no SQL Editor do seu projeto Supabase. V1: perfis e controle de acesso.
-- Revise antes de aplicar em projeto que já contenha public.profiles.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Novo parceiro' check (char_length(display_name) between 1 and 120),
  role text not null default 'technician' check (role in ('administrator','technician')),
  status text not null default 'pending' check (status in ('pending','active','suspended')),
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
revoke all on table public.profiles from public,anon,authenticated;
grant select on table public.profiles to authenticated;
drop policy if exists profiles_read_own on public.profiles;
create policy profiles_read_own on public.profiles for select to authenticated
  using (id = (select auth.uid()));
-- Os usuários não podem criar, alterar ou apagar perfis via navegador.
create or replace function public.proxiti_create_auth_profile()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(nullif(left(split_part(coalesce(new.email,''),'@',1),120),''),'Novo parceiro'))
  on conflict (id) do nothing;
  return new;
end;
$$;
revoke all on function public.proxiti_create_auth_profile() from public,anon,authenticated;
drop trigger if exists proxiti_on_auth_user_created on auth.users;
create trigger proxiti_on_auth_user_created after insert on auth.users
  for each row execute function public.proxiti_create_auth_profile();
insert into public.profiles(id,display_name)
select id,coalesce(nullif(left(split_part(coalesce(email,''),'@',1),120),''),'Novo parceiro')
from auth.users on conflict(id) do nothing;
-- Depois de criar seu usuário em Authentication > Users, ative-o no SQL Editor:
-- update public.profiles set role='administrator',status='active'
-- where id=(select id from auth.users where lower(email)=lower('EMAIL_ADMIN_AQUI'));
-- Nunca conceda ao navegador permissões para editar role/status.
