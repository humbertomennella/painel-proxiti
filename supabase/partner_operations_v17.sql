-- PROXITI V17 | Perfil operacional de parceiros técnicos.
-- Migração aditiva. Não transforma certificado UNIPROXITI em autorização automática de atendimento.

create table if not exists public.partner_operational_profiles(
 user_id uuid primary key references public.profiles(id) on delete cascade,
 headline text not null default '' check(length(headline)<=140),
 bio text not null default '' check(length(bio)<=1200),
 experience_level text not null default 'beginner'
  check(experience_level in ('beginner','developing','experienced')),
 specialties text[] not null default '{}'::text[],
 regions text[] not null default '{}'::text[],
 accepts_remote boolean not null default true,
 accepts_on_site boolean not null default false,
 availability text not null default 'unavailable'
  check(availability in ('available','limited','unavailable')),
 availability_note text not null default '' check(length(availability_note)<=500),
 max_concurrent integer not null default 1 check(max_concurrent between 1 and 20),
 approved_for_assignment boolean not null default false,
 admin_note text not null default '' check(length(admin_note)<=800),
 reviewed_by uuid references public.profiles(id) on delete set null,
 reviewed_at timestamptz,
 updated_at timestamptz not null default now(),
 check(cardinality(specialties)<=12),
 check(cardinality(regions)<=20),
 check(not accepts_on_site or cardinality(regions)>0)
);

create table if not exists public.partner_operational_audit(
 id bigint generated always as identity primary key,
 user_id uuid not null references public.profiles(id) on delete cascade,
 actor_id uuid references public.profiles(id) on delete set null,
 action text not null check(action in ('self_updated','admin_reviewed')),
 before_snapshot jsonb,
 after_snapshot jsonb,
 created_at timestamptz not null default now()
);
create index if not exists partner_operational_audit_user_idx
 on public.partner_operational_audit(user_id,id desc);
create index if not exists partner_operational_lookup_idx
 on public.partner_operational_profiles(approved_for_assignment,availability,updated_at desc);

alter table public.partner_operational_profiles enable row level security;
alter table public.partner_operational_audit enable row level security;
revoke all on public.partner_operational_profiles,public.partner_operational_audit
 from public,anon,authenticated;
grant select on public.partner_operational_profiles,public.partner_operational_audit to authenticated;

drop policy if exists partner_operational_read on public.partner_operational_profiles;
create policy partner_operational_read on public.partner_operational_profiles
 for select to authenticated using(
   public.proxiti_is_admin() or user_id=(select auth.uid())
 );
drop policy if exists partner_operational_audit_read on public.partner_operational_audit;
create policy partner_operational_audit_read on public.partner_operational_audit
 for select to authenticated using(
   public.proxiti_is_admin() or user_id=(select auth.uid())
 );

create or replace function public.proxiti_partner_validate_specialties(p_items text[])
returns boolean language sql immutable set search_path='' as $$
 select coalesce(bool_and(v=any(array[
  'support','computers','networks','wifi','backup','security','infrastructure','privacy'
 ]::text[])),true)
 from unnest(coalesce(p_items,'{}'::text[])) x(v)
$$;
revoke all on function public.proxiti_partner_validate_specialties(text[]) from public,anon;
grant execute on function public.proxiti_partner_validate_specialties(text[]) to authenticated;

create or replace function public.proxiti_partner_save_self(
 p_headline text,p_bio text,p_experience text,p_specialties text[],p_regions text[],
 p_remote boolean,p_on_site boolean,p_availability text,p_availability_note text,p_capacity integer)
returns void language plpgsql security definer set search_path='' as $$
declare old_row public.partner_operational_profiles%rowtype;new_row public.partner_operational_profiles%rowtype;
begin
 if not exists(select 1 from public.profiles where id=(select auth.uid())
  and role='technician' and status='active')
 then raise exception 'Perfil técnico ativo necessário';end if;
 if p_headline is null or length(p_headline)>140 or p_bio is null or length(p_bio)>1200
  or p_experience not in ('beginner','developing','experienced')
  or cardinality(coalesce(p_specialties,'{}'::text[]))>12
  or not public.proxiti_partner_validate_specialties(p_specialties)
  or cardinality(coalesce(p_regions,'{}'::text[]))>20
  or exists(select 1 from unnest(coalesce(p_regions,'{}'::text[])) r where length(btrim(r)) not between 2 and 90)
  or p_remote is null or p_on_site is null
  or (p_on_site and cardinality(coalesce(p_regions,'{}'::text[]))=0)
  or p_availability not in ('available','limited','unavailable')
  or p_availability_note is null or length(p_availability_note)>500
  or p_capacity not between 1 and 20
 then raise exception 'Revise as informações operacionais';end if;

 select * into old_row from public.partner_operational_profiles
  where user_id=(select auth.uid()) for update;
 insert into public.partner_operational_profiles(
  user_id,headline,bio,experience_level,specialties,regions,accepts_remote,
  accepts_on_site,availability,availability_note,max_concurrent)
 values((select auth.uid()),btrim(p_headline),btrim(p_bio),p_experience,
  coalesce(p_specialties,'{}'::text[]),coalesce(p_regions,'{}'::text[]),p_remote,p_on_site,
  p_availability,btrim(p_availability_note),p_capacity)
 on conflict(user_id) do update set headline=excluded.headline,bio=excluded.bio,
  experience_level=excluded.experience_level,specialties=excluded.specialties,
  regions=excluded.regions,accepts_remote=excluded.accepts_remote,
  accepts_on_site=excluded.accepts_on_site,availability=excluded.availability,
  availability_note=excluded.availability_note,max_concurrent=excluded.max_concurrent,
  updated_at=now()
 returning * into new_row;
 insert into public.partner_operational_audit(user_id,actor_id,action,before_snapshot,after_snapshot)
 values((select auth.uid()),(select auth.uid()),'self_updated',
  case when old_row.user_id is null then null else
   to_jsonb(old_row)-'admin_note'-'reviewed_by' end,
  to_jsonb(new_row)-'admin_note'-'reviewed_by');
end; $$;
revoke all on function public.proxiti_partner_save_self(text,text,text,text[],text[],boolean,boolean,text,text,integer)
 from public,anon;
grant execute on function public.proxiti_partner_save_self(text,text,text,text[],text[],boolean,boolean,text,text,integer)
 to authenticated;

create or replace function public.proxiti_partner_admin_review(
 p_user uuid,p_approved boolean,p_admin_note text)
returns void language plpgsql security definer set search_path='' as $$
declare old_row public.partner_operational_profiles%rowtype;new_row public.partner_operational_profiles%rowtype;
begin
 if not public.proxiti_commercial_admin() then
   raise exception 'Administração com MFA necessário';
 end if;
 if p_approved is null or p_admin_note is null or length(p_admin_note)>800
 then raise exception 'Revise a decisão administrativa';end if;
 if not exists(select 1 from public.profiles where id=p_user and role='technician' and status='active')
 then raise exception 'Técnico ativo não encontrado';end if;
 select * into old_row from public.partner_operational_profiles where user_id=p_user for update;
 if old_row.user_id is null then
   insert into public.partner_operational_profiles(user_id,approved_for_assignment,admin_note,reviewed_by,reviewed_at)
   values(p_user,p_approved,btrim(p_admin_note),(select auth.uid()),now())
   returning * into new_row;
 else
   update public.partner_operational_profiles set approved_for_assignment=p_approved,
    admin_note=btrim(p_admin_note),reviewed_by=(select auth.uid()),reviewed_at=now(),updated_at=now()
   where user_id=p_user returning * into new_row;
 end if;
 insert into public.partner_operational_audit(user_id,actor_id,action,before_snapshot,after_snapshot)
 values(p_user,(select auth.uid()),'admin_reviewed',
  case when old_row.user_id is null then null else to_jsonb(old_row) end,to_jsonb(new_row));
end; $$;
revoke all on function public.proxiti_partner_admin_review(uuid,boolean,text) from public,anon;
grant execute on function public.proxiti_partner_admin_review(uuid,boolean,text) to authenticated;

create or replace function public.proxiti_partner_admin_list()
returns table(
 user_id uuid,display_name text,status text,headline text,experience_level text,
 specialties text[],regions text[],accepts_remote boolean,accepts_on_site boolean,
 availability text,availability_note text,max_concurrent integer,
 approved_for_assignment boolean,reviewed_at timestamptz,admin_note text,
 open_tickets bigint)
language sql security definer set search_path='' as $$
 select p.id,p.display_name,p.status,
  coalesce(o.headline,''),coalesce(o.experience_level,'beginner'),
  coalesce(o.specialties,'{}'::text[]),coalesce(o.regions,'{}'::text[]),
  coalesce(o.accepts_remote,true),coalesce(o.accepts_on_site,false),
  coalesce(o.availability,'unavailable'),coalesce(o.availability_note,''),
  coalesce(o.max_concurrent,1),coalesce(o.approved_for_assignment,false),
  o.reviewed_at,coalesce(o.admin_note,''),
  (select count(*) from public.support_tickets t
    where t.assigned_to=p.id and t.status not in ('resolved','closed'))
 from public.profiles p left join public.partner_operational_profiles o on o.user_id=p.id
 where p.role='technician' and public.proxiti_is_admin()
 order by p.display_name
$$;
revoke all on function public.proxiti_partner_admin_list() from public,anon;
grant execute on function public.proxiti_partner_admin_list() to authenticated;
