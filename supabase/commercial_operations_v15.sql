-- PROXITI V15 | Módulo comercial interno. Migração aditiva, sem preços fictícios.
-- Valores expressos em centavos de BRL. Sem emissão fiscal, checkout ou conciliação bancária.
-- Alterações de valores e estados passam por RPCs com autenticação de administrador em AAL2.

create or replace function public.proxiti_commercial_admin()
returns boolean language sql stable security definer set search_path='' as $$
  select public.proxiti_is_admin() and coalesce((select auth.jwt())->>'aal','')='aal2'
$$;
revoke all on function public.proxiti_commercial_admin() from public,anon;
grant execute on function public.proxiti_commercial_admin() to authenticated;

create table if not exists public.commercial_services(
 id uuid primary key default gen_random_uuid(),
 code text not null unique check(code ~ '^[A-Z0-9][A-Z0-9_-]{2,31}$'),
 title text not null check(length(btrim(title)) between 4 and 120),
 description text not null default '' check(length(description)<=1500),
 unit_label text not null default 'serviço' check(length(btrim(unit_label)) between 2 and 28),
 price_cents bigint not null check(price_cents between 0 and 1000000000),
 internal_cost_cents bigint not null default 0 check(internal_cost_cents between 0 and 1000000000),
 partner_cost_cents bigint not null default 0 check(partner_cost_cents between 0 and 1000000000),
 estimated_minutes integer check(estimated_minutes between 1 and 10080),
 active boolean not null default true,
 created_by uuid references public.profiles(id) on delete set null,
 updated_at timestamptz not null default now()
);
create table if not exists public.commercial_quotes(
 id uuid primary key default gen_random_uuid(),
 reference bigint generated always as identity unique,
 ticket_id uuid not null references public.support_tickets(id) on delete restrict,
 parent_quote_id uuid references public.commercial_quotes(id) on delete restrict,
 status text not null default 'draft'
  check(status in ('draft','issued','accepted','declined','cancelled')),
 valid_until date not null default (current_date+7),
 client_notes text not null default '' check(length(client_notes)<=2500),
 internal_notes text not null default '' check(length(internal_notes)<=1800),
 created_by uuid not null references public.profiles(id) on delete restrict,
 issued_at timestamptz,
 accepted_at timestamptz,
 confirmation_channel text check(confirmation_channel is null or confirmation_channel
  in ('email','whatsapp','phone','in_person','other')),
 confirmation_reference text check(confirmation_reference is null or length(confirmation_reference)<=500),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists commercial_quotes_ticket_idx on public.commercial_quotes(ticket_id,created_at desc);
create index if not exists commercial_quotes_status_idx on public.commercial_quotes(status,created_at desc);

create table if not exists public.commercial_quote_items(
 id uuid primary key default gen_random_uuid(),
 quote_id uuid not null references public.commercial_quotes(id) on delete restrict,
 service_id uuid references public.commercial_services(id) on delete set null,
 position integer not null check(position between 1 and 999),
 code_snapshot text not null,
 title_snapshot text not null check(length(btrim(title_snapshot)) between 4 and 120),
 scope_snapshot text not null default '' check(length(scope_snapshot)<=1500),
 unit_snapshot text not null check(length(unit_snapshot)<=28),
 quantity integer not null check(quantity between 1 and 1000),
 unit_price_cents bigint not null check(unit_price_cents between 0 and 1000000000),
 unit_internal_cost_cents bigint not null check(unit_internal_cost_cents between 0 and 1000000000),
 unit_partner_cost_cents bigint not null check(unit_partner_cost_cents between 0 and 1000000000),
 override_reason text check(override_reason is null or length(btrim(override_reason)) between 10 and 300),
 created_at timestamptz not null default now(),
 unique(quote_id,position)
);
create table if not exists public.commercial_quote_events(
 id bigint generated always as identity primary key,
 quote_id uuid not null references public.commercial_quotes(id) on delete restrict,
 actor_id uuid references public.profiles(id) on delete set null,
 action text not null check(length(action) between 3 and 40),
 detail jsonb not null default '{}'::jsonb check(jsonb_typeof(detail)='object'),
 created_at timestamptz not null default now()
);
create index if not exists commercial_quote_events_idx on public.commercial_quote_events(quote_id,id desc);

create table if not exists public.commercial_payments(
 id uuid primary key default gen_random_uuid(),
 quote_id uuid not null references public.commercial_quotes(id) on delete restrict,
 kind text not null check(kind in ('received','refunded')),
 amount_cents bigint not null check(amount_cents between 1 and 1000000000),
 method text not null check(method in ('pix','card','bank_transfer','cash','other')),
 reference text not null check(length(btrim(reference)) between 6 and 200),
 occurred_at timestamptz not null default now(),
 recorded_by uuid not null references public.profiles(id) on delete restrict,
 created_at timestamptz not null default now()
);
create index if not exists commercial_payments_quote_idx on public.commercial_payments(quote_id,created_at desc);

create table if not exists public.commercial_partner_payouts(
 id uuid primary key default gen_random_uuid(),
 quote_id uuid not null references public.commercial_quotes(id) on delete restrict,
 partner_id uuid not null references public.profiles(id) on delete restrict,
 agreed_cents bigint not null check(agreed_cents between 1 and 1000000000),
 agreement_reference text not null check(length(btrim(agreement_reference)) between 10 and 400),
 status text not null default 'planned' check(status in ('planned','paid')),
 paid_reference text check(paid_reference is null or length(btrim(paid_reference)) between 6 and 200),
 paid_at timestamptz,
 recorded_by uuid not null references public.profiles(id) on delete restrict,
 created_at timestamptz not null default now(),
 unique(quote_id,partner_id)
);

do $$
declare tab text;
begin
 foreach tab in array array[
  'commercial_services','commercial_quotes','commercial_quote_items',
  'commercial_quote_events','commercial_payments','commercial_partner_payouts'
 ] loop
  execute format('alter table public.%I enable row level security',tab);
  execute format('revoke all on public.%I from public,anon,authenticated',tab);
  execute format('grant select on public.%I to authenticated',tab);
  execute format('create policy %I on public.%I for select to authenticated using (public.proxiti_is_admin())',
    tab||'_admin_select',tab);
 end loop;
end $$;

create or replace function public.proxiti_commercial_save_service(
 p_id uuid,p_code text,p_title text,p_description text,p_unit text,
 p_price bigint,p_internal_cost bigint,p_partner_cost bigint,p_minutes integer,p_active boolean)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
 if not public.proxiti_commercial_admin() then raise exception 'Administração com MFA necessário';end if;
 if p_code is null or upper(btrim(p_code)) !~ '^[A-Z0-9][A-Z0-9_-]{2,31}$'
 or p_title is null or length(btrim(p_title)) not between 4 and 120
 or p_description is null or length(p_description)>1500
 or p_unit is null or length(btrim(p_unit)) not between 2 and 28
 or p_price is null or p_price not between 0 and 1000000000
 or p_internal_cost is null or p_internal_cost not between 0 and 1000000000
 or p_partner_cost is null or p_partner_cost not between 0 and 1000000000
 or (p_minutes is not null and p_minutes not between 1 and 10080)
 or p_active is null then raise exception 'Revise os dados e valores do serviço';end if;
 if p_id is null then
  insert into public.commercial_services(code,title,description,unit_label,price_cents,
   internal_cost_cents,partner_cost_cents,estimated_minutes,active,created_by)
  values(upper(btrim(p_code)),btrim(p_title),btrim(p_description),btrim(p_unit),
   p_price,p_internal_cost,p_partner_cost,p_minutes,p_active,(select auth.uid()))
  returning id into v_id;
 else
  update public.commercial_services set code=upper(btrim(p_code)),title=btrim(p_title),
   description=btrim(p_description),unit_label=btrim(p_unit),price_cents=p_price,
   internal_cost_cents=p_internal_cost,partner_cost_cents=p_partner_cost,
   estimated_minutes=p_minutes,active=p_active,updated_at=now()
   where id=p_id returning id into v_id;
  if v_id is null then raise exception 'Serviço não encontrado';end if;
 end if;
 return v_id;
end;$$;
revoke all on function public.proxiti_commercial_save_service(uuid,text,text,text,text,bigint,bigint,bigint,integer,boolean) from public,anon;
grant execute on function public.proxiti_commercial_save_service(uuid,text,text,text,text,bigint,bigint,bigint,integer,boolean) to authenticated;

create or replace function public.proxiti_commercial_create_quote(
 p_ticket uuid,p_valid_until date,p_client_notes text default '',p_internal_notes text default '',
 p_parent uuid default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;v_state text;v_ticket uuid;
begin
 if not public.proxiti_commercial_admin() then raise exception 'Administração com MFA necessário';end if;
 select status into v_state from public.support_tickets where id=p_ticket;
 if v_state is null or v_state='closed' then raise exception 'Chamado ausente ou encerrado';end if;
 if p_valid_until is null or p_valid_until<current_date or p_valid_until>current_date+365
 or coalesce(length(p_client_notes),99999)>2500
 or coalesce(length(p_internal_notes),99999)>1800
 then raise exception 'Revise validade e observações';end if;
 if p_parent is not null then
  select ticket_id into v_ticket from public.commercial_quotes
   where id=p_parent and status='accepted';
  if v_ticket is distinct from p_ticket then raise exception 'Aditivo exige orçamento aceito do mesmo chamado';end if;
 end if;
 insert into public.commercial_quotes(ticket_id,parent_quote_id,valid_until,client_notes,internal_notes,created_by)
 values(p_ticket,p_parent,p_valid_until,btrim(p_client_notes),btrim(p_internal_notes),(select auth.uid()))
 returning id into v_id;
 insert into public.commercial_quote_events(quote_id,actor_id,action,detail)
 values(v_id,(select auth.uid()),'created',jsonb_build_object('parent',p_parent));
 return v_id;
end;$$;
revoke all on function public.proxiti_commercial_create_quote(uuid,date,text,text,uuid) from public,anon;
grant execute on function public.proxiti_commercial_create_quote(uuid,date,text,text,uuid) to authenticated;

create or replace function public.proxiti_commercial_add_item(
 p_quote uuid,p_service uuid,p_quantity integer,p_price_override bigint default null,
 p_override_reason text default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare q public.commercial_quotes%rowtype;s public.commercial_services%rowtype;
 v_position integer;v_item uuid;
begin
 if not public.proxiti_commercial_admin() then raise exception 'Administração com MFA necessário';end if;
 select * into q from public.commercial_quotes where id=p_quote for update;
 if q.id is null or q.status<>'draft' then raise exception 'Somente rascunhos aceitam alterações';end if;
 select * into s from public.commercial_services where id=p_service and active;
 if s.id is null then raise exception 'Serviço inativo ou inexistente';end if;
 if p_quantity is null or p_quantity not between 1 and 1000 then raise exception 'Quantidade inválida';end if;
 if p_price_override is not null and
   (p_price_override not between 0 and 1000000000 or
    p_override_reason is null or length(btrim(p_override_reason)) not between 10 and 300)
 then raise exception 'Preço manual exige justificativa de 10 a 300 caracteres';end if;
 select coalesce(max(position),0)+1 into v_position from public.commercial_quote_items
  where quote_id=p_quote;
 if v_position>999 then raise exception 'Limite de itens atingido';end if;
 insert into public.commercial_quote_items(quote_id,service_id,position,code_snapshot,
  title_snapshot,scope_snapshot,unit_snapshot,quantity,unit_price_cents,
  unit_internal_cost_cents,unit_partner_cost_cents,override_reason)
 values(p_quote,s.id,v_position,s.code,s.title,s.description,s.unit_label,p_quantity,
  coalesce(p_price_override,s.price_cents),s.internal_cost_cents,s.partner_cost_cents,
  case when p_price_override is not null then btrim(p_override_reason) else null end)
 returning id into v_item;
 update public.commercial_quotes set updated_at=now() where id=p_quote;
 insert into public.commercial_quote_events(quote_id,actor_id,action,detail)
 values(p_quote,(select auth.uid()),'item_added',
  jsonb_build_object('item',v_item,'service_code',s.code,'quantity',p_quantity,
   'price_cents',coalesce(p_price_override,s.price_cents),'overridden',p_price_override is not null));
 return v_item;
end;$$;
revoke all on function public.proxiti_commercial_add_item(uuid,uuid,integer,bigint,text) from public,anon;
grant execute on function public.proxiti_commercial_add_item(uuid,uuid,integer,bigint,text) to authenticated;

create or replace function public.proxiti_commercial_remove_item(p_item uuid)
returns void language plpgsql security definer set search_path='' as $$
declare v_quote uuid;v_code text;v_status text;
begin
 if not public.proxiti_commercial_admin() then raise exception 'Administração com MFA necessário';end if;
 select i.quote_id,i.code_snapshot into v_quote,v_code from public.commercial_quote_items i
  where i.id=p_item;
 if v_quote is null then raise exception 'Item não encontrado';end if;
 select status into v_status from public.commercial_quotes where id=v_quote for update;
 if v_status<>'draft' then raise exception 'Orçamento emitido é imutável';end if;
 delete from public.commercial_quote_items where id=p_item;
 update public.commercial_quotes set updated_at=now() where id=v_quote;
 insert into public.commercial_quote_events(quote_id,actor_id,action,detail)
 values(v_quote,(select auth.uid()),'item_removed',
  jsonb_build_object('item',p_item,'service_code',v_code));
end;$$;
revoke all on function public.proxiti_commercial_remove_item(uuid) from public,anon;
grant execute on function public.proxiti_commercial_remove_item(uuid) to authenticated;

create or replace function public.proxiti_commercial_transition_quote(
 p_quote uuid,p_next text,p_channel text,p_evidence text)
returns void language plpgsql security definer set search_path='' as $$
declare q public.commercial_quotes%rowtype;v_count integer;v_total bigint;
begin
 if not public.proxiti_commercial_admin() then raise exception 'Administração com MFA necessário';end if;
 select * into q from public.commercial_quotes where id=p_quote for update;
 if q.id is null then raise exception 'Orçamento não encontrado';end if;
 if not ((q.status='draft' and p_next in ('issued','cancelled'))
  or (q.status='issued' and p_next in ('accepted','declined','cancelled')))
 then raise exception 'Transição não autorizada; emita um aditivo para serviços adicionais';end if;
 if p_channel is null or p_channel not in ('email','whatsapp','phone','in_person','other')
 or p_evidence is null or length(btrim(p_evidence)) not between 10 and 500
 then raise exception 'Registre canal e referência da confirmação (10 a 500 caracteres)';end if;
 if p_next='issued' then
  select count(*),coalesce(sum(quantity::bigint*unit_price_cents),0)
   into v_count,v_total from public.commercial_quote_items where quote_id=p_quote;
  if v_count=0 or v_total<=0 then raise exception 'Orçamento deve conter itens com valor total positivo';end if;
  if q.valid_until<current_date then raise exception 'Validade expirada; prepare novo orçamento';end if;
 end if;
 if p_next='accepted' and q.valid_until<current_date
 then raise exception 'Orçamento vencido; prepare uma nova proposta';end if;
 update public.commercial_quotes set status=p_next,updated_at=now(),
  issued_at=case when p_next='issued' then now() else issued_at end,
  accepted_at=case when p_next='accepted' then now() else accepted_at end,
  confirmation_channel=p_channel,confirmation_reference=btrim(p_evidence)
 where id=p_quote;
 insert into public.commercial_quote_events(quote_id,actor_id,action,detail)
 values(p_quote,(select auth.uid()),p_next,
  jsonb_build_object('channel',p_channel,'reference',btrim(p_evidence)));
end;$$;
revoke all on function public.proxiti_commercial_transition_quote(uuid,text,text,text) from public,anon;
grant execute on function public.proxiti_commercial_transition_quote(uuid,text,text,text) to authenticated;

create or replace function public.proxiti_commercial_record_payment(
 p_quote uuid,p_kind text,p_amount bigint,p_method text,p_reference text)
returns uuid language plpgsql security definer set search_path='' as $$
declare q public.commercial_quotes%rowtype;v_total bigint;v_received bigint;v_id uuid;
begin
 if not public.proxiti_commercial_admin() then raise exception 'Administração com MFA necessário';end if;
 select * into q from public.commercial_quotes where id=p_quote for update;
 if q.id is null or q.status<>'accepted' then raise exception 'Pagamento exige orçamento aceito';end if;
 if p_kind is null or p_kind not in ('received','refunded')
 or p_method is null or p_method not in ('pix','card','bank_transfer','cash','other')
 or p_amount is null or p_amount not between 1 and 1000000000
 or p_reference is null or length(btrim(p_reference)) not between 6 and 200
 then raise exception 'Registro de recebimento inválido';end if;
 select coalesce(sum(quantity::bigint*unit_price_cents),0) into v_total
  from public.commercial_quote_items where quote_id=p_quote;
 select coalesce(sum(case when kind='received' then amount_cents else -amount_cents end),0)
  into v_received from public.commercial_payments where quote_id=p_quote;
 if p_kind='received' and v_received+p_amount>v_total then
   raise exception 'Recebimento acima do total aprovado';end if;
 if p_kind='refunded' and v_received-p_amount<0 then
   raise exception 'Estorno acima do recebido';end if;
 insert into public.commercial_payments(quote_id,kind,amount_cents,method,reference,recorded_by)
 values(p_quote,p_kind,p_amount,p_method,btrim(p_reference),(select auth.uid()))
 returning id into v_id;
 insert into public.commercial_quote_events(quote_id,actor_id,action,detail)
 values(p_quote,(select auth.uid()),case when p_kind='received' then 'receipt_recorded' else 'refund_recorded' end,
  jsonb_build_object('payment',v_id,'amount_cents',p_amount,'method',p_method));
 return v_id;
end;$$;
revoke all on function public.proxiti_commercial_record_payment(uuid,text,bigint,text,text) from public,anon;
grant execute on function public.proxiti_commercial_record_payment(uuid,text,bigint,text,text) to authenticated;

create or replace function public.proxiti_commercial_plan_payout(
 p_quote uuid,p_partner uuid,p_amount bigint,p_agreement text)
returns uuid language plpgsql security definer set search_path='' as $$
declare q public.commercial_quotes%rowtype;v_assigned uuid;v_id uuid;v_old bigint;
begin
 if not public.proxiti_commercial_admin() then raise exception 'Administração com MFA necessário';end if;
 select * into q from public.commercial_quotes where id=p_quote for update;
 if q.id is null or q.status<>'accepted' then raise exception 'Repasse exige orçamento aceito';end if;
 select assigned_to into v_assigned from public.support_tickets where id=q.ticket_id;
 if p_partner is null or p_partner is distinct from v_assigned or not exists(
   select 1 from public.profiles where id=p_partner and role='technician' and status='active')
 then raise exception 'Parceiro precisa estar ativo e atribuído ao chamado';end if;
 if p_amount is null or p_amount not between 1 and 1000000000
 or p_agreement is null or length(btrim(p_agreement)) not between 10 and 400
 then raise exception 'Valor e referência do acordo do parceiro são obrigatórios';end if;
 select id,agreed_cents into v_id,v_old from public.commercial_partner_payouts
  where quote_id=p_quote and partner_id=p_partner for update;
 if v_id is null then
  insert into public.commercial_partner_payouts(
   quote_id,partner_id,agreed_cents,agreement_reference,recorded_by)
  values(p_quote,p_partner,p_amount,btrim(p_agreement),(select auth.uid())) returning id into v_id;
 else
  if exists(select 1 from public.commercial_partner_payouts where id=v_id and status='paid')
    then raise exception 'Repasse pago não pode ser alterado';end if;
  update public.commercial_partner_payouts set agreed_cents=p_amount,
    agreement_reference=btrim(p_agreement) where id=v_id;
 end if;
 insert into public.commercial_quote_events(quote_id,actor_id,action,detail)
 values(p_quote,(select auth.uid()),'payout_planned',
  jsonb_build_object('payout',v_id,'amount_cents',p_amount,'previous_amount_cents',v_old));
 return v_id;
end;$$;
revoke all on function public.proxiti_commercial_plan_payout(uuid,uuid,bigint,text) from public,anon;
grant execute on function public.proxiti_commercial_plan_payout(uuid,uuid,bigint,text) to authenticated;

create or replace function public.proxiti_commercial_mark_payout(
 p_payout uuid,p_reference text)
returns void language plpgsql security definer set search_path='' as $$
declare v_payout public.commercial_partner_payouts%rowtype;
begin
 if not public.proxiti_commercial_admin() then raise exception 'Administração com MFA necessário';end if;
 select * into v_payout from public.commercial_partner_payouts where id=p_payout for update;
 if v_payout.id is null or v_payout.status<>'planned' then
  raise exception 'Repasse não encontrado ou já pago';end if;
 if p_reference is null or length(btrim(p_reference)) not between 6 and 200
 then raise exception 'Informe a referência comprovável do repasse';end if;
 update public.commercial_partner_payouts set status='paid',paid_at=now(),
  paid_reference=btrim(p_reference) where id=p_payout;
 insert into public.commercial_quote_events(quote_id,actor_id,action,detail)
 values(v_payout.quote_id,(select auth.uid()),'payout_recorded',
  jsonb_build_object('payout',p_payout,'amount_cents',v_payout.agreed_cents));
end;$$;
revoke all on function public.proxiti_commercial_mark_payout(uuid,text) from public,anon;
grant execute on function public.proxiti_commercial_mark_payout(uuid,text) to authenticated;

create or replace function public.proxiti_commercial_quote_detail(p_quote uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare q public.commercial_quotes%rowtype;v_ticket jsonb;v_lines jsonb;
 v_payments jsonb;v_payouts jsonb;v_events jsonb;v_total bigint;v_internal bigint;v_partner bigint;
begin
 if not public.proxiti_is_admin() then raise exception 'Acesso restrito à administração';end if;
 select * into q from public.commercial_quotes where id=p_quote;
 if q.id is null then raise exception 'Orçamento não encontrado';end if;
 select jsonb_build_object('reference',reference,'subject',subject,'customer_name',customer_name,
   'status',status,'assigned_to',assigned_to,'ticket_id',id)
 into v_ticket from public.support_tickets where id=q.ticket_id;
 select coalesce(jsonb_agg(to_jsonb(i) order by i.position),'[]'::jsonb),
  coalesce(sum(i.quantity::bigint*i.unit_price_cents),0),
  coalesce(sum(i.quantity::bigint*i.unit_internal_cost_cents),0),
  coalesce(sum(i.quantity::bigint*i.unit_partner_cost_cents),0)
 into v_lines,v_total,v_internal,v_partner from public.commercial_quote_items i where i.quote_id=p_quote;
 select coalesce(jsonb_agg(to_jsonb(p) order by p.created_at desc),'[]'::jsonb)
  into v_payments from public.commercial_payments p where p.quote_id=p_quote;
 select coalesce(jsonb_agg(to_jsonb(p) order by p.created_at desc),'[]'::jsonb)
  into v_payouts from public.commercial_partner_payouts p where p.quote_id=p_quote;
 select coalesce(jsonb_agg(to_jsonb(e) order by e.id desc),'[]'::jsonb)
  into v_events from public.commercial_quote_events e where e.quote_id=p_quote;
 return jsonb_build_object('quote',to_jsonb(q),'ticket',v_ticket,'items',v_lines,
  'total_cents',v_total,'internal_cost_cents',v_internal,'partner_estimate_cents',v_partner,
  'payments',v_payments,'payouts',v_payouts,'events',v_events);
end;$$;
revoke all on function public.proxiti_commercial_quote_detail(uuid) from public,anon;
grant execute on function public.proxiti_commercial_quote_detail(uuid) to authenticated;

create or replace function public.proxiti_commercial_summary()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_quotes integer;v_accepted bigint;v_received bigint;v_refunded bigint;
 v_planned bigint;v_paid bigint;
begin
 if not public.proxiti_is_admin() then raise exception 'Acesso restrito à administração';end if;
 select count(*) into v_quotes from public.commercial_quotes;
 select coalesce(sum(i.quantity::bigint*i.unit_price_cents),0) into v_accepted
 from public.commercial_quote_items i join public.commercial_quotes q on q.id=i.quote_id
 where q.status='accepted';
 select coalesce(sum(amount_cents) filter(where kind='received'),0),
  coalesce(sum(amount_cents) filter(where kind='refunded'),0)
  into v_received,v_refunded from public.commercial_payments;
 select coalesce(sum(agreed_cents) filter(where status='planned'),0),
  coalesce(sum(agreed_cents) filter(where status='paid'),0)
 into v_planned,v_paid from public.commercial_partner_payouts;
 return jsonb_build_object('quotes',v_quotes,'accepted_cents',v_accepted,
  'received_cents',v_received-v_refunded,'payout_planned_cents',v_planned,
  'payout_recorded_cents',v_paid,'reconciled',false);
end;$$;
revoke all on function public.proxiti_commercial_summary() from public,anon;
grant execute on function public.proxiti_commercial_summary() to authenticated;
