-- PROXITI V19: convites por oportunidade, aceite/recusa e carteira restrita ao parceiro.
-- O parceiro só recebe dados completos depois de aceitar um chamado autorizado.
create table if not exists public.partner_opportunities(
 id uuid primary key default gen_random_uuid(),
 ticket_id uuid not null references public.support_tickets(id) on delete restrict,
 quote_id uuid not null references public.commercial_quotes(id) on delete restrict,
 partner_id uuid not null references public.profiles(id) on delete restrict,
 offered_by uuid not null references public.profiles(id) on delete restrict,
 scope text not null check(length(btrim(scope)) between 15 and 1200),
 modality text not null check(modality in ('remote','on_site')),
 agreed_cents bigint not null check(agreed_cents between 1 and 1000000000),
 agreement_reference text not null check(length(btrim(agreement_reference)) between 10 and 400),
 status text not null default 'offered'
  check(status in ('offered','accepted','declined','cancelled')),
 expires_at timestamptz not null,
 decided_at timestamptz,
 created_at timestamptz not null default now()
);
create unique index if not exists partner_active_offer_ticket_idx
 on public.partner_opportunities(ticket_id) where status in ('offered','accepted');
create index if not exists partner_offer_assignee_idx
 on public.partner_opportunities(partner_id,status,created_at desc);
alter table public.partner_opportunities enable row level security;
revoke all on public.partner_opportunities from public,anon,authenticated;
grant select on public.partner_opportunities to authenticated;
create policy partner_offer_own_or_admin on public.partner_opportunities
 for select to authenticated using(
  partner_id=(select auth.uid()) or public.proxiti_is_admin());

create or replace function public.proxiti_partner_offer(
 p_ticket uuid,p_quote uuid,p_partner uuid,p_scope text,p_modality text,
 p_agreed_cents bigint,p_agreement text,p_expiry timestamptz)
returns uuid language plpgsql security definer set search_path='' as $$
declare t public.support_tickets%rowtype;v_id uuid;
begin
 if not public.proxiti_commercial_admin() then
   raise exception 'Administrador com MFA obrigatório';end if;
 select * into t from public.support_tickets where id=p_ticket for update;
 if t.id is null or t.assigned_to is not null or t.status in ('closed','resolved')
 then raise exception 'Chamado indisponível para oferta';end if;
 if not exists(select 1 from public.commercial_quotes
  where id=p_quote and ticket_id=p_ticket and status='accepted')
 then raise exception 'Orçamento aprovado para este chamado não encontrado';end if;
 if not exists(select 1 from public.partner_operational_profiles p
  join public.profiles staff on staff.id=p.user_id
  where p.user_id=p_partner and p.approved_for_assignment
    and staff.role='technician' and staff.status='active'
    and coalesce((staff.permissions->>'tickets_claim')::boolean,false)
    and (case when p_modality='remote' then p.accepts_remote
              when p_modality='on_site' then p.accepts_on_site else false end))
 then raise exception 'Parceiro não habilitado para esta modalidade';end if;
 if p_scope is null or length(btrim(p_scope)) not between 15 and 1200
  or p_agreed_cents is null or p_agreed_cents not between 1 and 1000000000
  or p_agreement is null or length(btrim(p_agreement)) not between 10 and 400
  or p_expiry is null or p_expiry<now()+interval '1 hour'
  or p_expiry>now()+interval '14 days'
 then raise exception 'Revise escopo, acordo, prazo e remuneração';end if;
 insert into public.partner_opportunities(ticket_id,quote_id,partner_id,offered_by,
   scope,modality,agreed_cents,agreement_reference,expires_at)
 values(p_ticket,p_quote,p_partner,(select auth.uid()),btrim(p_scope),p_modality,
   p_agreed_cents,btrim(p_agreement),p_expiry) returning id into v_id;
 return v_id;
end; $$;
revoke all on function public.proxiti_partner_offer(uuid,uuid,uuid,text,text,bigint,text,timestamptz)
 from public,anon;
grant execute on function public.proxiti_partner_offer(uuid,uuid,uuid,text,text,bigint,text,timestamptz)
 to authenticated;

create or replace function public.proxiti_partner_offer_decide(p_id uuid,p_accept boolean)
returns text language plpgsql security definer set search_path='' as $$
declare offer public.partner_opportunities%rowtype;ticket public.support_tickets%rowtype;
begin
 if not public.proxiti_can('tickets_claim') or p_accept is null then
   raise exception 'Parceiro não autorizado';end if;
 select * into offer from public.partner_opportunities
  where id=p_id and partner_id=(select auth.uid()) for update;
 if offer.id is null then raise exception 'Oportunidade não encontrada';end if;
 if offer.status in ('accepted','declined') then
   if (offer.status='accepted')=p_accept then return offer.status;end if;
   raise exception 'Oportunidade já respondida';end if;
 if offer.status<>'offered' or offer.expires_at<=now()
 then raise exception 'Oportunidade expirada ou cancelada';end if;
 if not exists(select 1 from public.partner_operational_profiles p
  join public.profiles staff on staff.id=p.user_id
  where p.user_id=(select auth.uid()) and p.approved_for_assignment
   and staff.role='technician' and staff.status='active')
 then raise exception 'Qualificação operacional indisponível';end if;
 select * into ticket from public.support_tickets where id=offer.ticket_id for update;
 if ticket.id is null or ticket.assigned_to is not null
   or ticket.status in ('closed','resolved') or not exists(
   select 1 from public.commercial_quotes q
   where q.id=offer.quote_id and q.ticket_id=ticket.id and q.status='accepted')
 then raise exception 'O atendimento não está mais disponível';end if;
 if p_accept then
   update public.support_tickets set assigned_to=(select auth.uid()),
     status='triage',updated_at=now() where id=ticket.id;
   insert into public.ticket_audit(ticket_id,actor_id,action,previous_value,next_value)
   values(ticket.id,(select auth.uid()),'claimed',null,(select auth.uid())::text);
 end if;
 update public.partner_opportunities set status=case when p_accept then 'accepted' else 'declined' end,
  decided_at=now() where id=offer.id;
 return case when p_accept then 'accepted' else 'declined' end;
end; $$;
revoke all on function public.proxiti_partner_offer_decide(uuid,boolean) from public,anon;
grant execute on function public.proxiti_partner_offer_decide(uuid,boolean) to authenticated;

create or replace function public.proxiti_partner_cancel_offer(p_id uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.proxiti_commercial_admin() then raise exception 'Administrador com MFA obrigatório';end if;
 update public.partner_opportunities set status='cancelled',decided_at=now()
 where id=p_id and status='offered';
 if not found then raise exception 'Apenas oportunidades pendentes podem ser canceladas';end if;
end; $$;
revoke all on function public.proxiti_partner_cancel_offer(uuid) from public,anon;
grant execute on function public.proxiti_partner_cancel_offer(uuid) to authenticated;

create or replace function public.proxiti_partner_my_portfolio()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v jsonb;
begin
 if not public.proxiti_can('tickets_view') then raise exception 'Conta técnica não autorizada';end if;
 select jsonb_build_object(
  'opportunities',(select coalesce(jsonb_agg(jsonb_build_object(
    'id',o.id,'ticket_reference',t.reference,'subject',t.subject,
    'scope',o.scope,'modality',o.modality,'agreed_cents',o.agreed_cents,
    'agreement_reference',o.agreement_reference,'status',o.status,
    'expires_at',o.expires_at,'created_at',o.created_at)
   order by o.created_at desc),'[]'::jsonb)
    from public.partner_opportunities o join public.support_tickets t on t.id=o.ticket_id
    where o.partner_id=(select auth.uid())),
  'tickets',(select coalesce(jsonb_agg(jsonb_build_object(
    'id',t.id,'reference',t.reference,'subject',t.subject,
    'customer_name',t.customer_name,'status',t.status,'service_type',t.service_type,
    'created_at',t.created_at,'updated_at',t.updated_at)
   order by t.updated_at desc),'[]'::jsonb)
    from public.support_tickets t where t.assigned_to=(select auth.uid())),
  'ratings',(select jsonb_build_object(
    'count',count(*),'average',round(avg(r.stars)::numeric,1))
    from public.customer_service_ratings r where r.partner_id=(select auth.uid())))
 into v;return v;
end; $$;
revoke all on function public.proxiti_partner_my_portfolio() from public,anon;
grant execute on function public.proxiti_partner_my_portfolio() to authenticated;

-- Administração recebe solicitações e preferências sem permitir acesso público.
create or replace function public.proxiti_customer_admin_queue()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v jsonb;
begin
 if not public.proxiti_is_admin() then raise exception 'Área administrativa';end if;
 select jsonb_build_object(
  'requests',(select coalesce(jsonb_agg(jsonb_build_object(
    'id',r.id,'ticket_id',r.ticket_id,'ticket_reference',t.reference,
    'preferred_at',r.preferred_at,'modality',r.modality,'note',r.note,
    'status',r.status,'created_at',r.created_at)
    order by r.created_at desc),'[]'::jsonb)
    from public.customer_schedule_requests r join public.support_tickets t on t.id=r.ticket_id
    where r.status='pending'),
  'preferences',(select coalesce(jsonb_agg(jsonb_build_object(
    'ticket_id',p.ticket_id,'ticket_reference',t.reference,'partner_id',p.partner_id,
    'partner_name',staff.display_name)
    order by p.created_at desc),'[]'::jsonb)
    from public.customer_partner_preferences p
     join public.support_tickets t on t.id=p.ticket_id
     join public.profiles staff on staff.id=p.partner_id
    where t.status not in ('closed','resolved')),
  'offers',(select coalesce(jsonb_agg(jsonb_build_object(
    'id',o.id,'ticket_id',o.ticket_id,'ticket_reference',t.reference,
    'quote_id',o.quote_id,'partner_id',o.partner_id,'status',o.status,
    'expires_at',o.expires_at,'created_at',o.created_at)
    order by o.created_at desc),'[]'::jsonb)
    from public.partner_opportunities o join public.support_tickets t on t.id=o.ticket_id
    where o.status='offered'))
 into v;return v;
end; $$;
revoke all on function public.proxiti_customer_admin_queue() from public,anon;
grant execute on function public.proxiti_customer_admin_queue() to authenticated;


-- Registro operacional factual e privado; não cria nota pública nem bloqueio automático.
create table if not exists public.partner_client_feedback(
 ticket_id uuid primary key references public.support_tickets(id) on delete restrict,
 partner_id uuid not null references public.profiles(id) on delete restrict,
 readiness text not null check(readiness in ('ready','not_ready','rescheduled')),
 communication text not null check(communication in ('clear','followup_needed')),
 note text not null default '' check(length(note)<=400),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.partner_client_feedback enable row level security;
revoke all on public.partner_client_feedback from public,anon,authenticated;
grant select on public.partner_client_feedback to authenticated;
create policy partner_feedback_own_or_admin on public.partner_client_feedback
 for select to authenticated using(partner_id=(select auth.uid()) or public.proxiti_is_admin());

create or replace function public.proxiti_partner_client_feedback(
 p_ticket uuid,p_readiness text,p_communication text,p_note text)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.proxiti_can('tickets_view') or p_readiness not in
  ('ready','not_ready','rescheduled') or p_communication not in
  ('clear','followup_needed') or p_note is null or length(p_note)>400
 then raise exception 'Registro operacional inválido';end if;
 if not exists(select 1 from public.support_tickets
  where id=p_ticket and assigned_to=(select auth.uid()) and status in ('resolved','closed'))
 then raise exception 'Registre apenas atendimentos concluídos sob sua responsabilidade';end if;
 insert into public.partner_client_feedback(ticket_id,partner_id,readiness,communication,note)
 values(p_ticket,(select auth.uid()),p_readiness,p_communication,btrim(p_note))
 on conflict(ticket_id) do update set readiness=excluded.readiness,
  communication=excluded.communication,note=excluded.note,updated_at=now()
 where public.partner_client_feedback.partner_id=excluded.partner_id;
end; $$;
revoke all on function public.proxiti_partner_client_feedback(uuid,text,text,text)
 from public,anon;
grant execute on function public.proxiti_partner_client_feedback(uuid,text,text,text) to authenticated;
