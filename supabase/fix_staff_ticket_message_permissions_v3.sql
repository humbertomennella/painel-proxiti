drop policy if exists messages_staff_read on public.support_messages;
create policy messages_staff_read on public.support_messages
for select to authenticated
using (
  public.proxiti_is_admin() or
  (public.proxiti_can('chat') and public.proxiti_can('tickets_view') and
    exists (select 1 from public.support_tickets t
      where t.id = ticket_id and (t.assigned_to = (select auth.uid()) or t.assigned_to is null)))
);
create or replace function public.proxiti_staff_reply(p_ticket uuid,p_body text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare new_id uuid;
begin
 if p_body is null or length(btrim(p_body)) not between 1 and 2000 then raise exception 'Mensagem inválida'; end if;
 if not public.proxiti_is_admin() and
    (not public.proxiti_can('chat') or not public.proxiti_can('tickets_view')) then raise exception 'Acesso negado'; end if;
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
create or replace function public.proxiti_claim_ticket(p_ticket uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare changed integer;
begin
 if not public.proxiti_can('tickets_claim') or not public.proxiti_can('tickets_view') then
 raise exception 'Sem permissão para aceitar chamados'; end if;
 update public.support_tickets
 set assigned_to=(select auth.uid()),status='triage',updated_at=now()
 where id=p_ticket and assigned_to is null and status not in ('closed','resolved');
 get diagnostics changed=row_count;
 return changed=1;
end; $$;
revoke all on function public.proxiti_claim_ticket(uuid) from public,anon;
grant execute on function public.proxiti_claim_ticket(uuid) to authenticated;