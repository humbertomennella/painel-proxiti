-- PROXITI V16 | Cadastro administrativo de clientes e vínculo explícito com chamados.
-- Migração aditiva. Não tenta inferir automaticamente identidade de cliente por e-mail/telefone.

create table if not exists public.client_profiles(
 id uuid primary key default gen_random_uuid(),
 display_name text not null check(length(btrim(display_name)) between 2 and 140),
 customer_type text not null default 'person' check(customer_type in ('person','business')),
 organization text not null default '' check(length(organization)<=160),
 email text not null default '' check(length(email)<=254),
 phone text not null default '' check(length(phone)<=40),
 preferred_channel text not null default 'email'
   check(preferred_channel in ('email','whatsapp','phone','other')),
 city text not null default '' check(length(city)<=120),
 internal_notes text not null default '' check(length(internal_notes)<=1800),
 status text not null default 'active' check(status in ('active','inactive')),
 created_by uuid references public.profiles(id) on delete set null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check(email<>'' or phone<>'')
);
create index if not exists client_profiles_name_idx
 on public.client_profiles(lower(display_name));
create index if not exists client_profiles_email_idx
 on public.client_profiles(lower(email)) where email<>'';
create index if not exists client_profiles_phone_idx
 on public.client_profiles(phone) where phone<>'';

alter table public.support_tickets
 add column if not exists client_id uuid references public.client_profiles(id) on delete set null;
create index if not exists support_tickets_client_idx
 on public.support_tickets(client_id,created_at desc);

create table if not exists public.client_profile_audit(
 id bigint generated always as identity primary key,
 client_id uuid not null references public.client_profiles(id) on delete restrict,
 actor_id uuid references public.profiles(id) on delete set null,
 action text not null check(action in ('created','updated','ticket_linked','ticket_unlinked')),
 before_snapshot jsonb,
 after_snapshot jsonb,
 created_at timestamptz not null default now()
);
create index if not exists client_profile_audit_idx
 on public.client_profile_audit(client_id,id desc);

alter table public.client_profiles enable row level security;
alter table public.client_profile_audit enable row level security;
revoke all on public.client_profiles,public.client_profile_audit from public,anon,authenticated;
grant select on public.client_profiles,public.client_profile_audit to authenticated;
drop policy if exists client_profiles_admin_read on public.client_profiles;
create policy client_profiles_admin_read on public.client_profiles
 for select to authenticated using(public.proxiti_is_admin());
drop policy if exists client_profile_audit_admin_read on public.client_profile_audit;
create policy client_profile_audit_admin_read on public.client_profile_audit
 for select to authenticated using(public.proxiti_is_admin());

create or replace function public.proxiti_client_save(
 p_id uuid,p_name text,p_type text,p_organization text,p_email text,p_phone text,
 p_channel text,p_city text,p_notes text,p_status text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;old_row public.client_profiles%rowtype;new_row public.client_profiles%rowtype;
 v_email text;v_phone text;
begin
 if not public.proxiti_commercial_admin() then
   raise exception 'Administração com MFA necessário';
 end if;
 v_email:=lower(btrim(coalesce(p_email,'')));
 v_phone:=btrim(coalesce(p_phone,''));
 if p_name is null or length(btrim(p_name)) not between 2 and 140
  or p_type not in ('person','business')
  or p_organization is null or length(p_organization)>160
  or length(v_email)>254 or length(v_phone)>40 or (v_email='' and v_phone='')
  or (v_email<>'' and v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')
  or p_channel not in ('email','whatsapp','phone','other')
  or p_city is null or length(p_city)>120
  or p_notes is null or length(p_notes)>1800
  or p_status not in ('active','inactive')
 then raise exception 'Revise os dados do cliente';end if;

 if p_id is null then
   insert into public.client_profiles(display_name,customer_type,organization,email,phone,
    preferred_channel,city,internal_notes,status,created_by)
   values(btrim(p_name),p_type,btrim(p_organization),v_email,v_phone,p_channel,
    btrim(p_city),btrim(p_notes),p_status,(select auth.uid()))
   returning * into new_row;
   v_id:=new_row.id;
   insert into public.client_profile_audit(client_id,actor_id,action,after_snapshot)
   values(v_id,(select auth.uid()),'created',to_jsonb(new_row)-'internal_notes');
 else
   select * into old_row from public.client_profiles where id=p_id for update;
   if old_row.id is null then raise exception 'Cliente não encontrado';end if;
   update public.client_profiles set display_name=btrim(p_name),customer_type=p_type,
    organization=btrim(p_organization),email=v_email,phone=v_phone,
    preferred_channel=p_channel,city=btrim(p_city),internal_notes=btrim(p_notes),
    status=p_status,updated_at=now()
   where id=p_id returning * into new_row;
   v_id:=p_id;
   insert into public.client_profile_audit(client_id,actor_id,action,before_snapshot,after_snapshot)
   values(v_id,(select auth.uid()),'updated',
    to_jsonb(old_row)-'internal_notes',to_jsonb(new_row)-'internal_notes');
 end if;
 return v_id;
end; $$;
revoke all on function public.proxiti_client_save(uuid,text,text,text,text,text,text,text,text,text)
 from public,anon;
grant execute on function public.proxiti_client_save(uuid,text,text,text,text,text,text,text,text,text)
 to authenticated;

create or replace function public.proxiti_client_link_ticket(p_client uuid,p_ticket uuid)
returns void language plpgsql security definer set search_path='' as $$
declare old_client uuid;
begin
 if not public.proxiti_commercial_admin() then
   raise exception 'Administração com MFA necessário';
 end if;
 if not exists(select 1 from public.client_profiles where id=p_client and status='active')
 then raise exception 'Cliente inexistente ou inativo';end if;
 select client_id into old_client from public.support_tickets where id=p_ticket for update;
 if not found then raise exception 'Chamado não encontrado';end if;
 if old_client is not null and old_client<>p_client
 then raise exception 'Chamado já vinculado a outro cliente; desvincule explicitamente antes';end if;
 update public.support_tickets set client_id=p_client,updated_at=now() where id=p_ticket;
 if old_client is null then
   insert into public.client_profile_audit(client_id,actor_id,action,after_snapshot)
   values(p_client,(select auth.uid()),'ticket_linked',jsonb_build_object('ticket_id',p_ticket));
 end if;
end; $$;
revoke all on function public.proxiti_client_link_ticket(uuid,uuid) from public,anon;
grant execute on function public.proxiti_client_link_ticket(uuid,uuid) to authenticated;

create or replace function public.proxiti_client_unlink_ticket(p_client uuid,p_ticket uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.proxiti_commercial_admin() then
   raise exception 'Administração com MFA necessário';
 end if;
 perform 1 from public.support_tickets where id=p_ticket and client_id=p_client for update;
 if not found then raise exception 'Vínculo não encontrado';end if;
 update public.support_tickets set client_id=null,updated_at=now() where id=p_ticket;
 insert into public.client_profile_audit(client_id,actor_id,action,before_snapshot)
 values(p_client,(select auth.uid()),'ticket_unlinked',jsonb_build_object('ticket_id',p_ticket));
end; $$;
revoke all on function public.proxiti_client_unlink_ticket(uuid,uuid) from public,anon;
grant execute on function public.proxiti_client_unlink_ticket(uuid,uuid) to authenticated;

create or replace function public.proxiti_client_summary(p_client uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.client_profiles%rowtype;ticket_count integer;open_count integer;
 quote_count integer;accepted bigint;received bigint;
begin
 if not public.proxiti_is_admin() then raise exception 'Área administrativa';end if;
 select * into c from public.client_profiles where id=p_client;
 if c.id is null then raise exception 'Cliente não encontrado';end if;
 select count(*),count(*) filter(where status not in ('resolved','closed'))
 into ticket_count,open_count from public.support_tickets where client_id=p_client;
 select count(distinct q.id),
  coalesce(sum(i.quantity::bigint*i.unit_price_cents) filter(where q.status='accepted'),0)
 into quote_count,accepted
 from public.commercial_quotes q
 join public.support_tickets t on t.id=q.ticket_id
 left join public.commercial_quote_items i on i.quote_id=q.id
 where t.client_id=p_client;
 select coalesce(sum(case when p.kind='received' then p.amount_cents else -p.amount_cents end),0)
 into received
 from public.commercial_payments p
 join public.commercial_quotes q on q.id=p.quote_id
 join public.support_tickets t on t.id=q.ticket_id
 where t.client_id=p_client;
 return jsonb_build_object('client',to_jsonb(c),'tickets',ticket_count,'open_tickets',open_count,
  'quotes',quote_count,'accepted_cents',accepted,'received_cents',received);
end; $$;
revoke all on function public.proxiti_client_summary(uuid) from public,anon;
grant execute on function public.proxiti_client_summary(uuid) to authenticated;
