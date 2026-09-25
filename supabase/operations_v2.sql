-- PROXITI | Central Técnica V2: atendimento, permissões, chat, conteúdos e recursos.
-- Expansão aditiva: não modifica as credenciais nem remove dados existentes.
create extension if not exists pgcrypto with schema extensions;

alter table public.profiles add column if not exists permissions jsonb not null default '{"tickets_view":true,"tickets_claim":true,"chat":true,"training":true,"resources":true}'::jsonb;
alter table public.profiles add constraint proxiti_permissions_object check (jsonb_typeof(permissions) = 'object');
create index if not exists proxiti_profiles_status_idx on public.profiles(status,role);

create or replace function public.proxiti_is_admin() returns boolean
language sql stable security definer set search_path = ''
as $$ select exists(
  select 1 from public.profiles p
  where p.id = (select auth.uid()) and p.role = 'administrator' and p.status = 'active'
); $$;
revoke all on function public.proxiti_is_admin() from public,anon;
grant execute on function public.proxiti_is_admin() to authenticated;

create or replace function public.proxiti_can(p_key text) returns boolean
language sql stable security definer set search_path = ''
as $$ select exists(
  select 1 from public.profiles p where p.id=(select auth.uid()) and p.status='active'
  and (p.role='administrator' or coalesce((p.permissions->>p_key)::boolean,false))
); $$;
revoke all on function public.proxiti_can(text) from public,anon;
grant execute on function public.proxiti_can(text) to authenticated;

drop policy if exists profiles_admin_read on public.profiles;
create policy profiles_admin_read on public.profiles for select to authenticated using (public.proxiti_is_admin());

create or replace function public.proxiti_admin_update_technician(p_id uuid,p_name text,p_status text,p_permissions jsonb)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.proxiti_is_admin() then raise exception 'Acesso negado'; end if;
  if not exists(select 1 from public.profiles where id=p_id and role='technician') then raise exception 'O perfil técnico não existe'; end if;
  if p_status not in ('pending','active','suspended') then raise exception 'Status inválido'; end if;
  if p_name is null or length(btrim(p_name)) not between 2 and 120 then raise exception 'Nome inválido'; end if;
  if p_permissions is null or jsonb_typeof(p_permissions)<>'object' or
     exists(select 1 from jsonb_each(p_permissions) v
            where v.key not in ('tickets_view','tickets_claim','chat','training','resources')
               or jsonb_typeof(v.value)<>'boolean') then raise exception 'Permissões inválidas'; end if;
  update public.profiles set display_name=btrim(p_name),status=p_status,permissions=p_permissions where id=p_id;
end; $$;
revoke all on function public.proxiti_admin_update_technician(uuid,text,text,jsonb) from public,anon;
grant execute on function public.proxiti_admin_update_technician(uuid,text,text,jsonb) to authenticated;

create table if not exists public.support_tickets (
 id uuid primary key default gen_random_uuid(),
 reference bigint generated always as identity unique,
 customer_name text not null check(length(btrim(customer_name)) between 2 and 120),
 customer_email text not null check(length(customer_email) between 6 and 254),
 customer_phone text check(customer_phone is null or length(customer_phone)<=40),
 subject text not null check(length(btrim(subject)) between 4 and 160),
 description text not null check(length(btrim(description)) between 8 and 3000),
 service_type text check(service_type is null or length(service_type)<=80),
 impact text check(impact is null or length(impact)<=120),
 customer_type text check(customer_type is null or length(customer_type)<=60),
 source text not null default 'form' check(source in ('form','chat')),
 status text not null default 'new' check(status in ('new','triage','in_progress','waiting_customer','resolved','closed')),
 assigned_to uuid references public.profiles(id) on delete set null,
 access_hash text not null check(length(access_hash)=64),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists proxiti_ticket_queue_idx on public.support_tickets(status,assigned_to,created_at desc);
create index if not exists proxiti_ticket_assignee_idx on public.support_tickets(assigned_to,created_at desc);
alter table public.support_tickets enable row level security;
revoke all on public.support_tickets from public,anon,authenticated;
grant select on public.support_tickets to authenticated;
drop policy if exists tickets_staff_read on public.support_tickets;
create policy tickets_staff_read on public.support_tickets for select to authenticated using (
 public.proxiti_is_admin() or
 (public.proxiti_can('tickets_view') and (assigned_to=(select auth.uid()) or assigned_to is null))
);
-- A linha de ticket não é gravável por navegador; apenas RPCs ou rota server-side validada.

create table if not exists public.support_messages (
 id uuid primary key default gen_random_uuid(),
 ticket_id uuid not null references public.support_tickets(id) on delete cascade,
 sender_kind text not null check(sender_kind in ('customer','staff')),
 sender_id uuid references public.profiles(id) on delete set null,
 body text not null check(length(btrim(body)) between 1 and 2000),
 created_at timestamptz not null default now(),
 constraint sender_consistency check ((sender_kind='staff' and sender_id is not null) or (sender_kind='customer' and sender_id is null))
);
create index if not exists proxiti_messages_ticket_idx on public.support_messages(ticket_id,created_at);
alter table public.support_messages enable row level security;
revoke all on public.support_messages from public,anon,authenticated;
grant select on public.support_messages to authenticated;
drop policy if exists messages_staff_read on public.support_messages;
create policy messages_staff_read on public.support_messages for select to authenticated using (
 exists(select 1 from public.support_tickets t where t.id=ticket_id)
 and (public.proxiti_is_admin() or public.proxiti_can('chat'))
);

create or replace function public.proxiti_claim_ticket(p_ticket uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare changed integer;
begin
 if not public.proxiti_can('tickets_claim') then raise exception 'Sem permissão para aceitar chamados'; end if;
 update public.support_tickets
 set assigned_to=(select auth.uid()),status='triage',updated_at=now()
 where id=p_ticket and assigned_to is null and status not in ('closed','resolved');
 get diagnostics changed=row_count;
 return changed=1;
end; $$;
revoke all on function public.proxiti_claim_ticket(uuid) from public,anon;
grant execute on function public.proxiti_claim_ticket(uuid) to authenticated;

create or replace function public.proxiti_admin_assign_ticket(p_ticket uuid,p_staff uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
 if not public.proxiti_is_admin() then raise exception 'Acesso negado'; end if;
 if p_staff is not null and not exists(
  select 1 from public.profiles where id=p_staff and status='active'
    and (role='administrator' or coalesce((permissions->>'tickets_view')::boolean,false))
 ) then raise exception 'Profissional indisponível'; end if;
 update public.support_tickets set assigned_to=p_staff,updated_at=now()
 where id=p_ticket and status not in ('closed');
 if not found then raise exception 'Chamado inexistente ou encerrado'; end if;
end; $$;
revoke all on function public.proxiti_admin_assign_ticket(uuid,uuid) from public,anon;
grant execute on function public.proxiti_admin_assign_ticket(uuid,uuid) to authenticated;

create or replace function public.proxiti_change_ticket_status(p_ticket uuid,p_status text) returns void
language plpgsql security definer set search_path = '' as $$
begin
 if p_status not in ('new','triage','in_progress','waiting_customer','resolved','closed') then raise exception 'Status inválido'; end if;
 if not public.proxiti_is_admin() and not public.proxiti_can('tickets_view') then raise exception 'Acesso negado'; end if;
 update public.support_tickets set status=p_status,updated_at=now()
 where id=p_ticket and
 (public.proxiti_is_admin() or assigned_to=(select auth.uid()));
 if not found then raise exception 'Chamado não autorizado ou inexistente'; end if;
end; $$;
revoke all on function public.proxiti_change_ticket_status(uuid,text) from public,anon;
grant execute on function public.proxiti_change_ticket_status(uuid,text) to authenticated;

create or replace function public.proxiti_staff_reply(p_ticket uuid,p_body text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare new_id uuid;
begin
 if p_body is null or length(btrim(p_body)) not between 1 and 2000 then raise exception 'Mensagem inválida'; end if;
 if not public.proxiti_is_admin() and not public.proxiti_can('chat') then raise exception 'Acesso negado'; end if;
 if not exists(
  select 1 from public.support_tickets where id=p_ticket
    and status not in ('closed') and
       (public.proxiti_is_admin() or assigned_to=(select auth.uid()))
 ) then raise exception 'Conversa não autorizada'; end if;
 insert into public.support_messages(ticket_id,sender_kind,sender_id,body)
 values(p_ticket,'staff',(select auth.uid()),btrim(p_body)) returning id into new_id;
 update public.support_tickets set updated_at=now() where id=p_ticket;
 return new_id;
end; $$;
revoke all on function public.proxiti_staff_reply(uuid,text) from public,anon;
grant execute on function public.proxiti_staff_reply(uuid,text) to authenticated;

create table if not exists public.staff_presence (
 staff_id uuid primary key references public.profiles(id) on delete cascade,
 last_seen timestamptz not null default now()
);
alter table public.staff_presence enable row level security;
revoke all on public.staff_presence from public,anon,authenticated;
grant select on public.staff_presence to authenticated;
drop policy if exists staff_presence_read on public.staff_presence;
create policy staff_presence_read on public.staff_presence for select to authenticated
using (public.proxiti_is_admin() or staff_id=(select auth.uid()));

create or replace function public.proxiti_heartbeat() returns void
language plpgsql security definer set search_path = '' as $$
begin
 if not public.proxiti_can('chat') then raise exception 'Acesso negado'; end if;
 insert into public.staff_presence(staff_id,last_seen) values((select auth.uid()),now())
 on conflict(staff_id) do update set last_seen=now();
end; $$;
revoke all on function public.proxiti_heartbeat() from public,anon;
grant execute on function public.proxiti_heartbeat() to authenticated;

-- A taxa de requisições públicas é controlada pelo servidor, sem expor IP/e-mail em texto claro.
create table if not exists public.support_limits (
 identity_hash text not null,
 bucket_start timestamptz not null,
 hits integer not null default 0,
 primary key(identity_hash,bucket_start)
);
alter table public.support_limits enable row level security;
revoke all on public.support_limits from public,anon,authenticated;
create or replace function public.proxiti_consume_limit(p_identity text,p_bucket timestamptz,p_limit integer)
returns boolean language plpgsql security definer set search_path = '' as $$
declare current_hits integer;
begin
 if (select auth.role()) <> 'service_role' then raise exception 'Acesso negado'; end if;
 if p_identity is null or length(p_identity)<>64 or p_limit not between 1 and 30 then raise exception 'Parâmetros inválidos'; end if;
 insert into public.support_limits(identity_hash,bucket_start,hits)
 values(p_identity,p_bucket,1)
 on conflict(identity_hash,bucket_start) do update set hits=public.support_limits.hits+1
 where public.support_limits.hits < p_limit
 returning hits into current_hits;
 return current_hits is not null;
end; $$;
revoke all on function public.proxiti_consume_limit(text,timestamptz,integer) from public,anon,authenticated;
grant execute on function public.proxiti_consume_limit(text,timestamptz,integer) to service_role;

-- CMS de textos estruturados: conteúdo publicado legível, alteração restrita ao administrador.
create table if not exists public.site_content (
 content_key text primary key check(content_key ~ '^[a-z0-9][a-z0-9._-]{2,100}$'),
 label text not null check(length(label) between 2 and 160),
 value text not null check(length(value) between 1 and 3000),
 is_published boolean not null default true,
 updated_at timestamptz not null default now()
);
alter table public.site_content enable row level security;
revoke all on public.site_content from public,anon,authenticated;
grant select on public.site_content to anon,authenticated;
grant insert,update,delete on public.site_content to authenticated;
drop policy if exists cms_public_read on public.site_content;
create policy cms_public_read on public.site_content for select to anon,authenticated
using(is_published or public.proxiti_is_admin());
drop policy if exists cms_admin_write on public.site_content;
create policy cms_admin_write on public.site_content for all to authenticated
using(public.proxiti_is_admin()) with check(public.proxiti_is_admin());

insert into public.site_content(content_key,label,value) values
('home.contact.intro','Introdução do contato','Não é necessário saber o nome técnico do problema. Informe o que acontece, em qual equipamento ou rede e como isso afeta sua rotina.'),
('home.triage.intro','Introdução da solicitação','Descreva o problema para abrir um chamado na Central Técnica. Nossa equipe analisará as informações antes de propor um atendimento.'),
('home.hero.fact','Fato do atendimento','Atendimento mediante solicitação'),
('partner.panel.intro','Introdução do painel de técnicos','Os atendimentos são registrados na Central Técnica e encaminhados conforme a disponibilidade e as permissões dos profissionais.')
on conflict(content_key) do nothing;

-- Módulos internos privados, sem arquivos públicos no GitHub.
create table if not exists public.training_materials (
 id uuid primary key default gen_random_uuid(),
 title text not null check(length(btrim(title)) between 3 and 160),
 description text not null default '' check(length(description)<=2000),
 storage_path text unique check(storage_path is null or length(storage_path)<=300),
 published boolean not null default false,
 created_at timestamptz not null default now()
);
alter table public.training_materials enable row level security;
revoke all on public.training_materials from public,anon,authenticated;
grant select,insert,update,delete on public.training_materials to authenticated;
drop policy if exists training_read on public.training_materials;
create policy training_read on public.training_materials for select to authenticated
using(public.proxiti_is_admin() or (published and public.proxiti_can('training')));
drop policy if exists training_admin_write on public.training_materials;
create policy training_admin_write on public.training_materials for all to authenticated
using(public.proxiti_is_admin()) with check(public.proxiti_is_admin());

create table if not exists public.tool_inventory (
 id uuid primary key default gen_random_uuid(),
 name text not null check(length(btrim(name)) between 2 and 160),
 serial_label text check(serial_label is null or length(serial_label)<=160),
 assigned_to uuid references public.profiles(id) on delete set null,
 notes text not null default '' check(length(notes)<=2000),
 created_at timestamptz not null default now()
);
alter table public.tool_inventory enable row level security;
revoke all on public.tool_inventory from public,anon,authenticated;
grant select,insert,update,delete on public.tool_inventory to authenticated;
drop policy if exists tools_staff_read on public.tool_inventory;
create policy tools_staff_read on public.tool_inventory for select to authenticated
using(public.proxiti_is_admin() or (assigned_to=(select auth.uid()) and public.proxiti_can('resources')));
drop policy if exists tools_admin_write on public.tool_inventory;
create policy tools_admin_write on public.tool_inventory for all to authenticated
using(public.proxiti_is_admin()) with check(public.proxiti_is_admin());

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('proxiti-training','proxiti-training',false,10485760,ARRAY['application/pdf','image/png','image/jpeg','image/webp'])
on conflict(id) do nothing;
drop policy if exists proxiti_training_files_read on storage.objects;
create policy proxiti_training_files_read on storage.objects for select to authenticated
using(bucket_id='proxiti-training' and (public.proxiti_is_admin() or public.proxiti_can('training')));
drop policy if exists proxiti_training_files_write on storage.objects;
create policy proxiti_training_files_write on storage.objects for insert to authenticated
with check(bucket_id='proxiti-training' and public.proxiti_is_admin());
drop policy if exists proxiti_training_files_delete on storage.objects;
create policy proxiti_training_files_delete on storage.objects for delete to authenticated
using(bucket_id='proxiti-training' and public.proxiti_is_admin());

-- Eventos internos: o frontend também faz atualização periódica como fallback.
do $$ begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') then
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='support_tickets') then
   alter publication supabase_realtime add table public.support_tickets;
  end if;
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='support_messages') then
   alter publication supabase_realtime add table public.support_messages;
  end if;
 end if;
end $$;
