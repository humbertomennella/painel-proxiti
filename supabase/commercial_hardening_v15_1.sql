-- V15.1: evita lançamentos repetidos e preserva alterações do catálogo.
-- Sem mudanças em chamados, notas, pagamentos ou certificados anteriores.
create unique index if not exists commercial_payment_receipt_unique
 on public.commercial_payments(quote_id,kind,method,(lower(btrim(reference))));

create table if not exists public.commercial_service_audit(
 id bigint generated always as identity primary key,
 service_id uuid not null references public.commercial_services(id) on delete restrict,
 actor_id uuid references public.profiles(id) on delete set null,
 action text not null check(action in ('created','updated')),
 before_snapshot jsonb,
 after_snapshot jsonb not null,
 created_at timestamptz not null default now()
);
create index if not exists commercial_service_audit_lookup
 on public.commercial_service_audit(service_id,id desc);
alter table public.commercial_service_audit enable row level security;
revoke all on public.commercial_service_audit from public,anon,authenticated;
grant select on public.commercial_service_audit to authenticated;
create policy commercial_service_audit_admin_read on public.commercial_service_audit
 for select to authenticated using(public.proxiti_is_admin());

create or replace function public.proxiti_commercial_log_service_change()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='INSERT' then
  insert into public.commercial_service_audit(service_id,actor_id,action,before_snapshot,after_snapshot)
   values(new.id,(select auth.uid()),'created',null,to_jsonb(new));
 elsif to_jsonb(old) is distinct from to_jsonb(new) then
  insert into public.commercial_service_audit(service_id,actor_id,action,before_snapshot,after_snapshot)
   values(new.id,(select auth.uid()),'updated',to_jsonb(old),to_jsonb(new));
 end if;
 return new;
end;$$;
revoke all on function public.proxiti_commercial_log_service_change() from public,anon;
drop trigger if exists proxiti_commercial_service_audit_trigger on public.commercial_services;
create trigger proxiti_commercial_service_audit_trigger
 after insert or update on public.commercial_services
 for each row execute function public.proxiti_commercial_log_service_change();
