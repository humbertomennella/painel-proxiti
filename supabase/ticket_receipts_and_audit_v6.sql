-- PROXITI V6: leitura entre dispositivos e trilha operacional, sem acesso direto de escrita pelo navegador.
create table if not exists public.ticket_read_receipts (
  staff_id uuid not null references public.profiles(id) on delete cascade,
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  first_seen_at timestamptz not null default now(),
  last_read_customer_at timestamptz,
  primary key (staff_id,ticket_id)
);
create index if not exists proxiti_read_receipts_ticket_idx on public.ticket_read_receipts(ticket_id);
alter table public.ticket_read_receipts enable row level security;
revoke all on public.ticket_read_receipts from public,anon,authenticated;
grant select on public.ticket_read_receipts to authenticated;
drop policy if exists ticket_read_receipts_self_select on public.ticket_read_receipts;
create policy ticket_read_receipts_self_select on public.ticket_read_receipts
for select to authenticated using (staff_id=(select auth.uid()));

create or replace function public.proxiti_mark_ticket_read(p_ticket uuid)
returns void language plpgsql security definer set search_path='' as $$
declare newest timestamptz;
begin
 if not (public.proxiti_is_admin() or public.proxiti_can('tickets_view')) then
   raise exception 'Acesso não autorizado';
 end if;
 if not exists (
   select 1 from public.support_tickets t where t.id=p_ticket
     and (public.proxiti_is_admin() or
       (public.proxiti_can('tickets_view') and
         (t.assigned_to=(select auth.uid()) or t.assigned_to is null)))
 ) then raise exception 'Chamado não autorizado'; end if;
 select max(m.created_at) into newest from public.support_messages m
   where m.ticket_id=p_ticket and m.sender_kind='customer';
 insert into public.ticket_read_receipts(staff_id,ticket_id,last_read_customer_at)
 values ((select auth.uid()),p_ticket,newest)
 on conflict(staff_id,ticket_id) do update
 set last_read_customer_at =
   case when excluded.last_read_customer_at is null then public.ticket_read_receipts.last_read_customer_at
        when public.ticket_read_receipts.last_read_customer_at is null then excluded.last_read_customer_at
        else greatest(public.ticket_read_receipts.last_read_customer_at,excluded.last_read_customer_at) end;
end; $$;
revoke all on function public.proxiti_mark_ticket_read(uuid) from public,anon;
grant execute on function public.proxiti_mark_ticket_read(uuid) to authenticated;

create table if not exists public.ticket_audit (
 id bigint generated always as identity primary key,
 ticket_id uuid not null references public.support_tickets(id) on delete cascade,
 actor_id uuid references public.profiles(id) on delete set null,
 action text not null check (action in ('created','claimed','assigned','unassigned','status_changed','staff_replied','customer_replied')),
 previous_value text check (previous_value is null or length(previous_value)<=80),
 next_value text check (next_value is null or length(next_value)<=80),
 created_at timestamptz not null default now()
);
create index if not exists proxiti_ticket_audit_idx on public.ticket_audit(ticket_id,created_at desc);
alter table public.ticket_audit enable row level security;
revoke all on public.ticket_audit from public,anon,authenticated;
grant select on public.ticket_audit to authenticated;
drop policy if exists ticket_audit_staff_read on public.ticket_audit;
create policy ticket_audit_staff_read on public.ticket_audit
for select to authenticated using (
  public.proxiti_is_admin() or
  (public.proxiti_can('tickets_view') and exists (
    select 1 from public.support_tickets t where t.id=ticket_id
      and (t.assigned_to=(select auth.uid()) or t.assigned_to is null)))
);

create or replace function public.proxiti_audit_ticket_change()
returns trigger language plpgsql security definer set search_path='' as $$
declare who uuid;
begin
 who=(select auth.uid());
 if tg_op='INSERT' then
   insert into public.ticket_audit(ticket_id,actor_id,action,next_value)
   values(new.id,who,'created',new.source);
 elsif tg_op='UPDATE' then
   if old.assigned_to is distinct from new.assigned_to then
     insert into public.ticket_audit(ticket_id,actor_id,action,previous_value,next_value)
     values(new.id,who,
       case when new.assigned_to is null then 'unassigned'
            when old.assigned_to is null and new.assigned_to=who then 'claimed'
            else 'assigned' end,
       old.assigned_to::text,new.assigned_to::text);
   end if;
   if old.status is distinct from new.status then
     insert into public.ticket_audit(ticket_id,actor_id,action,previous_value,next_value)
     values(new.id,who,'status_changed',old.status,new.status);
   end if;
 end if;
 return new;
end; $$;
revoke all on function public.proxiti_audit_ticket_change() from public,anon,authenticated;
drop trigger if exists proxiti_ticket_audit_log on public.support_tickets;
create trigger proxiti_ticket_audit_log
after insert or update of assigned_to,status on public.support_tickets
for each row execute function public.proxiti_audit_ticket_change();

create or replace function public.proxiti_audit_message()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.ticket_audit(ticket_id,actor_id,action)
 values(new.ticket_id,new.sender_id,
   case when new.sender_kind='staff' then 'staff_replied' else 'customer_replied' end);
 return new;
end; $$;
revoke all on function public.proxiti_audit_message() from public,anon,authenticated;
drop trigger if exists proxiti_message_audit_log on public.support_messages;
create trigger proxiti_message_audit_log after insert on public.support_messages
for each row execute function public.proxiti_audit_message();
