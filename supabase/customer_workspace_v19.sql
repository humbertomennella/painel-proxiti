-- Minha PROXITI V19: contas de clientes separadas de perfis técnicos e vínculos verificáveis.
-- Migração aditiva; os chamados sem login e a aprovação atual dos parceiros permanecem.
create table if not exists public.customer_accounts(
 user_id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null check(length(btrim(display_name)) between 2 and 120),
 phone text not null default '' check(length(phone)<=40),
 city text not null default '' check(length(city)<=120),
 preferred_channel text not null default 'email'
  check(preferred_channel in ('email','whatsapp','phone')),
 crm_client_id uuid unique references public.client_profiles(id) on delete set null,
 status text not null default 'active' check(status in ('active','suspended')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table if not exists public.customer_devices(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.customer_accounts(user_id) on delete cascade,
 label text not null check(length(btrim(label)) between 2 and 90),
 category text not null check(category in ('desktop','notebook','router','network','printer','phone','other')),
 brand text not null default '' check(length(brand)<=90),
 model text not null default '' check(length(model)<=110),
 notes text not null default '' check(length(notes)<=500),
 archived boolean not null default false,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists customer_devices_owner_idx on public.customer_devices(user_id,created_at desc);
create table if not exists public.customer_ticket_links(
 ticket_id uuid primary key references public.support_tickets(id) on delete restrict,
 user_id uuid not null references public.customer_accounts(user_id) on delete cascade,
 linked_at timestamptz not null default now()
);
create index if not exists customer_links_owner_idx on public.customer_ticket_links(user_id,linked_at desc);
create table if not exists public.customer_schedule_requests(
 id uuid primary key default gen_random_uuid(),
 ticket_id uuid not null references public.support_tickets(id) on delete restrict,
 user_id uuid not null references public.customer_accounts(user_id) on delete cascade,
 preferred_at timestamptz not null,
 modality text not null check(modality in ('remote','on_site')),
 note text not null default '' check(length(note)<=500),
 status text not null default 'pending'
   check(status in ('pending','reviewed','declined','cancelled')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists customer_schedule_ticket_idx on public.customer_schedule_requests(ticket_id,created_at desc);
create table if not exists public.customer_partner_preferences(
 ticket_id uuid primary key references public.support_tickets(id) on delete restrict,
 user_id uuid not null references public.customer_accounts(user_id) on delete cascade,
 partner_id uuid not null references public.profiles(id) on delete restrict,
 created_at timestamptz not null default now()
);
create table if not exists public.customer_service_ratings(
 ticket_id uuid primary key references public.support_tickets(id) on delete restrict,
 user_id uuid not null references public.customer_accounts(user_id) on delete cascade,
 partner_id uuid not null references public.profiles(id) on delete restrict,
 stars integer not null check(stars between 1 and 5),
 comment text not null default '' check(length(comment)<=500),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists customer_ratings_partner_idx on public.customer_service_ratings(partner_id,created_at desc);

-- Não transformar cliente que faz cadastro público em técnico pendente.
-- O fluxo de convite técnico sem a marca 'customer' é preservado.
create or replace function public.proxiti_create_auth_profile()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_name text;
begin
 if coalesce(new.raw_user_meta_data->>'proxiti_account_type','')='customer' then
   if new.email is null or new.email='' then
     raise exception 'O cadastro de cliente requer e-mail';end if;
   v_name=btrim(left(coalesce(new.raw_user_meta_data->>'display_name',''),120));
   if length(v_name)<2 then
     v_name=left(split_part(new.email,'@',1),120);end if;
   if length(v_name)<2 then v_name='Cliente PROXITI';end if;
   insert into public.customer_accounts(user_id,display_name)
    values(new.id,v_name) on conflict(user_id) do nothing;
 else
   insert into public.profiles(id,display_name)
    values(new.id,coalesce(nullif(left(split_part(coalesce(new.email,''),'@',1),120),''),'Novo parceiro'))
    on conflict(id) do nothing;
 end if;
 return new;
end; $$;

alter table public.customer_accounts enable row level security;
alter table public.customer_devices enable row level security;
alter table public.customer_ticket_links enable row level security;
alter table public.customer_schedule_requests enable row level security;
alter table public.customer_partner_preferences enable row level security;
alter table public.customer_service_ratings enable row level security;
revoke all on public.customer_accounts,public.customer_devices,public.customer_ticket_links,
 public.customer_schedule_requests,public.customer_partner_preferences,
 public.customer_service_ratings from public,anon,authenticated;
grant select on public.customer_accounts,public.customer_devices,public.customer_ticket_links,
 public.customer_schedule_requests,public.customer_partner_preferences,
 public.customer_service_ratings to authenticated;
create policy customer_account_own_select on public.customer_accounts
 for select to authenticated using(user_id=(select auth.uid()) or public.proxiti_is_admin());
create policy customer_device_own_select on public.customer_devices
 for select to authenticated using(user_id=(select auth.uid()) or public.proxiti_is_admin());
create policy customer_ticket_own_select on public.customer_ticket_links
 for select to authenticated using(user_id=(select auth.uid()) or public.proxiti_is_admin());
create policy customer_schedule_own_select on public.customer_schedule_requests
 for select to authenticated using(user_id=(select auth.uid()) or public.proxiti_is_admin());
create policy customer_preference_own_select on public.customer_partner_preferences
 for select to authenticated using(user_id=(select auth.uid()) or public.proxiti_is_admin());
create policy customer_ratings_own_select on public.customer_service_ratings
 for select to authenticated using(user_id=(select auth.uid()) or public.proxiti_is_admin());

create or replace function public.proxiti_customer_verified()
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.customer_accounts c
 join auth.users u on u.id=c.user_id
 where c.user_id=(select auth.uid()) and c.status='active'
   and u.email_confirmed_at is not null and u.email is not null);
$$;
revoke all on function public.proxiti_customer_verified() from public,anon;
grant execute on function public.proxiti_customer_verified() to authenticated;

create or replace function public.proxiti_customer_update(
 p_name text,p_phone text,p_city text,p_channel text)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.proxiti_customer_verified() then raise exception 'Confirme seu e-mail para usar Minha PROXITI';end if;
 if p_name is null or length(btrim(p_name)) not between 2 and 120
    or p_phone is null or length(p_phone)>40
    or p_city is null or length(p_city)>120
    or p_channel not in ('email','whatsapp','phone')
 then raise exception 'Revise os dados do perfil';end if;
 update public.customer_accounts set display_name=btrim(p_name),
  phone=btrim(p_phone),city=btrim(p_city),preferred_channel=p_channel,updated_at=now()
 where user_id=(select auth.uid()) and status='active';
 if not found then raise exception 'Perfil indisponível';end if;
end; $$;
revoke all on function public.proxiti_customer_update(text,text,text,text) from public,anon;
grant execute on function public.proxiti_customer_update(text,text,text,text) to authenticated;

create or replace function public.proxiti_customer_save_device(
 p_id uuid,p_label text,p_category text,p_brand text,p_model text,p_notes text,p_archived boolean)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
 if not public.proxiti_customer_verified() then raise exception 'Conta não autorizada';end if;
 if p_label is null or length(btrim(p_label)) not between 2 and 90
   or p_category not in ('desktop','notebook','router','network','printer','phone','other')
   or p_brand is null or length(p_brand)>90 or p_model is null or length(p_model)>110
   or p_notes is null or length(p_notes)>500 or p_archived is null
 then raise exception 'Revise os dados do equipamento';end if;
 if p_id is null then
   insert into public.customer_devices(user_id,label,category,brand,model,notes,archived)
   values((select auth.uid()),btrim(p_label),p_category,btrim(p_brand),btrim(p_model),btrim(p_notes),p_archived)
   returning id into v_id;
 else
   update public.customer_devices set label=btrim(p_label),category=p_category,
    brand=btrim(p_brand),model=btrim(p_model),notes=btrim(p_notes),archived=p_archived,
    updated_at=now()
   where id=p_id and user_id=(select auth.uid()) returning id into v_id;
   if v_id is null then raise exception 'Equipamento não encontrado';end if;
 end if;
 return v_id;
end; $$;
revoke all on function public.proxiti_customer_save_device(uuid,text,text,text,text,text,boolean) from public,anon;
grant execute on function public.proxiti_customer_save_device(uuid,text,text,text,text,text,boolean) to authenticated;

create or replace function public.proxiti_customer_link_ticket(
 p_ticket uuid,p_access_token text)
returns void language plpgsql security definer set search_path='' as $$
declare v_email text;v_ticket public.support_tickets%rowtype;v_owner uuid;
begin
 if not public.proxiti_customer_verified() then raise exception 'Conta não autorizada';end if;
 if p_access_token is null or p_access_token !~ '^[a-f0-9]{64}$'
 then raise exception 'Chave de acesso inválida';end if;
 select lower(email) into v_email from auth.users where id=(select auth.uid());
 select * into v_ticket from public.support_tickets
  where id=p_ticket and access_hash=encode(extensions.digest(convert_to(p_access_token,'UTF8'),'sha256'),'hex')
  for update;
 if v_ticket.id is null or lower(v_ticket.customer_email)<>v_email
 then raise exception 'O chamado e o e-mail confirmado não correspondem';end if;
 select user_id into v_owner from public.customer_ticket_links where ticket_id=p_ticket;
 if v_owner is not null and v_owner<>(select auth.uid())
 then raise exception 'Chamado já vinculado a outra conta';end if;
 insert into public.customer_ticket_links(ticket_id,user_id)
 values(p_ticket,(select auth.uid())) on conflict(ticket_id) do nothing;
end; $$;
revoke all on function public.proxiti_customer_link_ticket(uuid,text) from public,anon;
grant execute on function public.proxiti_customer_link_ticket(uuid,text) to authenticated;

create or replace function public.proxiti_customer_schedule(
 p_ticket uuid,p_at timestamptz,p_modality text,p_note text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;v_service text;
begin
 if not public.proxiti_customer_verified() or not exists(
  select 1 from public.customer_ticket_links l join public.support_tickets t on t.id=l.ticket_id
  where l.ticket_id=p_ticket and l.user_id=(select auth.uid())
   and t.status not in ('closed','resolved'))
 then raise exception 'Chamado indisponível para agendamento';end if;
 if p_at is null or p_at<now()+interval '2 hours' or p_at>now()+interval '120 days'
  or p_modality not in ('remote','on_site') or p_note is null or length(p_note)>500
 then raise exception 'Revise horário, modalidade e observações';end if;
 if (select count(*) from public.customer_schedule_requests
  where user_id=(select auth.uid()) and status='pending')>=5
 then raise exception 'Aguarde a revisão das solicitações anteriores';end if;
 insert into public.customer_schedule_requests(ticket_id,user_id,preferred_at,modality,note)
 values(p_ticket,(select auth.uid()),p_at,p_modality,btrim(p_note)) returning id into v_id;
 return v_id;
end; $$;
revoke all on function public.proxiti_customer_schedule(uuid,timestamptz,text,text) from public,anon;
grant execute on function public.proxiti_customer_schedule(uuid,timestamptz,text,text) to authenticated;

create or replace function public.proxiti_customer_set_partner(p_ticket uuid,p_partner uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.proxiti_customer_verified() or not exists(
 select 1 from public.customer_ticket_links l join public.support_tickets t on t.id=l.ticket_id
 where l.ticket_id=p_ticket and l.user_id=(select auth.uid()) and t.status<>'closed')
 then raise exception 'Chamado não autorizado';end if;
 if p_partner is not null and not exists(
   select 1 from public.partner_operational_profiles p
   join public.profiles staff on staff.id=p.user_id
   where p.user_id=p_partner and p.approved_for_assignment and
     staff.status='active' and staff.role='technician')
 then raise exception 'Profissional indisponível';end if;
 if p_partner is null then
  delete from public.customer_partner_preferences
   where ticket_id=p_ticket and user_id=(select auth.uid());
 else
  insert into public.customer_partner_preferences(ticket_id,user_id,partner_id)
   values(p_ticket,(select auth.uid()),p_partner)
   on conflict(ticket_id) do update set partner_id=excluded.partner_id,created_at=now()
   where public.customer_partner_preferences.user_id=excluded.user_id;
 end if;
end; $$;
revoke all on function public.proxiti_customer_set_partner(uuid,uuid) from public,anon;
grant execute on function public.proxiti_customer_set_partner(uuid,uuid) to authenticated;

create or replace function public.proxiti_customer_rate(p_ticket uuid,p_stars integer,p_comment text)
returns void language plpgsql security definer set search_path='' as $$
declare v_partner uuid;
begin
 if not public.proxiti_customer_verified() or p_stars not between 1 and 5
    or p_comment is null or length(p_comment)>500
 then raise exception 'Avaliação inválida';end if;
 select t.assigned_to into v_partner from public.support_tickets t
 join public.customer_ticket_links l on l.ticket_id=t.id and l.user_id=(select auth.uid())
 where t.id=p_ticket and t.status in ('resolved','closed');
 if v_partner is null then raise exception 'O atendimento ainda não pode ser avaliado';end if;
 if not exists(select 1 from public.profiles p where p.id=v_partner and p.role='technician')
 then raise exception 'O responsável não é um parceiro técnico';end if;
 insert into public.customer_service_ratings(ticket_id,user_id,partner_id,stars,comment)
 values(p_ticket,(select auth.uid()),v_partner,p_stars,btrim(p_comment))
 on conflict(ticket_id) do update
 set stars=excluded.stars,comment=excluded.comment,updated_at=now()
 where public.customer_service_ratings.user_id=excluded.user_id;
end; $$;
revoke all on function public.proxiti_customer_rate(uuid,integer,text) from public,anon;
grant execute on function public.proxiti_customer_rate(uuid,integer,text) to authenticated;

-- A listagem pública revela somente o perfil profissional aprovado.
create or replace function public.proxiti_customer_partner_directory()
returns jsonb language sql stable security definer set search_path='' as $$
 select case when public.proxiti_customer_verified() then
   coalesce(jsonb_agg(jsonb_build_object('id',p.user_id,
     'name',staff.display_name,'headline',p.headline,
     'specialties',p.specialties,'regions',p.regions,
     'remote',p.accepts_remote,'on_site',p.accepts_on_site)
     order by staff.display_name),'[]'::jsonb)
 else '[]'::jsonb end
 from public.partner_operational_profiles p
 join public.profiles staff on staff.id=p.user_id
 where p.approved_for_assignment and staff.status='active' and staff.role='technician';
$$;
revoke all on function public.proxiti_customer_partner_directory() from public,anon;
grant execute on function public.proxiti_customer_partner_directory() to authenticated;

create or replace function public.proxiti_customer_dashboard()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v jsonb;
begin
 if not public.proxiti_customer_verified() then
  raise exception 'Confirme seu e-mail para acessar sua área';end if;
 select jsonb_build_object(
  'account',(select to_jsonb(c)-'crm_client_id' from public.customer_accounts c
   where c.user_id=(select auth.uid())),
  'tickets',(select coalesce(jsonb_agg(jsonb_build_object(
    'id',t.id,'reference',t.reference,'subject',t.subject,'description',t.description,
    'status',t.status,'service_type',t.service_type,'created_at',t.created_at,
    'assigned_name',case when p.status='active' then p.display_name else null end)
    order by t.created_at desc),'[]'::jsonb)
    from public.customer_ticket_links l join public.support_tickets t on t.id=l.ticket_id
    left join public.profiles p on p.id=t.assigned_to where l.user_id=(select auth.uid())),
  'devices',(select coalesce(jsonb_agg(to_jsonb(d) order by d.created_at desc),'[]'::jsonb)
    from public.customer_devices d where d.user_id=(select auth.uid()) and not d.archived),
  'schedule',(select coalesce(jsonb_agg(jsonb_build_object(
    'id',r.id,'ticket_id',r.ticket_id,'preferred_at',r.preferred_at,
    'modality',r.modality,'note',r.note,'status',r.status,'created_at',r.created_at)
     order by r.created_at desc),'[]'::jsonb)
    from public.customer_schedule_requests r where r.user_id=(select auth.uid())),
  'preferences',(select coalesce(jsonb_agg(jsonb_build_object(
    'ticket_id',p.ticket_id,'partner_id',p.partner_id),'[]'::jsonb)
    from public.customer_partner_preferences p where p.user_id=(select auth.uid())),
  'ratings',(select coalesce(jsonb_agg(jsonb_build_object(
    'ticket_id',r.ticket_id,'partner_id',r.partner_id,'stars',r.stars,'comment',r.comment)
     order by r.created_at desc),'[]'::jsonb)
    from public.customer_service_ratings r where r.user_id=(select auth.uid())))
 into v;
 return v;
end; $$;
revoke all on function public.proxiti_customer_dashboard() from public,anon;
grant execute on function public.proxiti_customer_dashboard() to authenticated;

-- Cadastro interno continua controlado pelo administrador e não é inferido por e-mail.
create or replace function public.proxiti_customer_admin_link_crm(p_account uuid,p_client uuid)
returns void language plpgsql security definer set search_path='' as $$
declare v_email text;v_crm_email text;
begin
 if not public.proxiti_commercial_admin() then raise exception 'Administração com MFA obrigatória';end if;
 select lower(email) into v_email from auth.users where id=p_account and email_confirmed_at is not null;
 select lower(email) into v_crm_email from public.client_profiles where id=p_client and status='active';
 if v_email is null or v_crm_email is null or v_email<>v_crm_email
 then raise exception 'Confirme a identidade e o e-mail do cliente antes de vincular';end if;
 update public.customer_accounts set crm_client_id=p_client,updated_at=now()
 where user_id=p_account and status='active';
 if not found then raise exception 'Conta do cliente não encontrada';end if;
 update public.support_tickets set client_id=p_client,updated_at=now()
 where id in (select ticket_id from public.customer_ticket_links where user_id=p_account)
  and client_id is null;
end; $;
revoke all on function public.proxiti_customer_admin_link_crm(uuid,uuid) from public,anon;
grant execute on function public.proxiti_customer_admin_link_crm(uuid,uuid) to authenticated;


-- Abertura atômica: ticket, primeira mensagem e vínculo à conta na mesma transação.
-- Somente o servidor autenticado pode fornecer o hash de uma chave aleatória.
create or replace function public.proxiti_customer_open_ticket_server(
 p_user uuid,p_subject text,p_description text,p_modality text,p_access_hash text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.customer_accounts%rowtype;v_email text;v_id uuid;v_ref bigint;
begin
 if coalesce((select auth.role()),'')<>'service_role' then
  raise exception 'Operação de servidor';end if;
 select * into c from public.customer_accounts where user_id=p_user and status='active';
 select lower(email) into v_email from auth.users where id=p_user and email_confirmed_at is not null;
 if c.user_id is null or v_email is null then raise exception 'Cliente não confirmado';end if;
 if p_subject is null or length(btrim(p_subject)) not between 4 and 160
  or p_description is null or length(btrim(p_description)) not between 8 and 2000
  or p_modality not in ('remote','on_site')
  or p_access_hash is null or p_access_hash !~ '^[a-f0-9]{64}$'
 then raise exception 'Revise os dados do atendimento';end if;
 insert into public.support_tickets(customer_name,customer_email,customer_phone,
  subject,description,service_type,source,access_hash,client_id)
 values(c.display_name,v_email,nullif(c.phone,''),btrim(p_subject),btrim(p_description),
  p_modality,'form',p_access_hash,c.crm_client_id)
 returning id,reference into v_id,v_ref;
 insert into public.support_messages(ticket_id,sender_kind,body)
 values(v_id,'customer',btrim(p_description));
 insert into public.customer_ticket_links(ticket_id,user_id) values(v_id,p_user);
 return jsonb_build_object('id',v_id,'reference',v_ref,'status','new');
end; $$;
revoke all on function public.proxiti_customer_open_ticket_server(uuid,text,text,text,text)
 from public,anon,authenticated;
grant execute on function public.proxiti_customer_open_ticket_server(uuid,text,text,text,text)
 to service_role;


create or replace function public.proxiti_customer_admin_directory()
returns jsonb language sql stable security definer set search_path='' as $$
 select case when public.proxiti_is_admin() then
 coalesce(jsonb_agg(jsonb_build_object(
  'user_id',c.user_id,'display_name',c.display_name,
  'email',u.email,'phone',c.phone,'city',c.city,
  'crm_client_id',c.crm_client_id,'status',c.status,
  'tickets',(select count(*) from public.customer_ticket_links l where l.user_id=c.user_id))
  order by c.created_at desc),'[]'::jsonb)
 else '[]'::jsonb end
 from public.customer_accounts c join auth.users u on u.id=c.user_id;
$$;
revoke all on function public.proxiti_customer_admin_directory() from public,anon;
grant execute on function public.proxiti_customer_admin_directory() to authenticated;
