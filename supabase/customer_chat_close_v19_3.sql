-- PROXITI: encerramento de chamado pelo titular da chave do chat.
-- A Edge Function valida a chave aleatória e passa somente o hash SHA-256.
-- A RPC é service_role-only e confirma vínculo + estado sob bloqueio de linha.
-- Histórico e chave continuam preservados para consulta posterior.
create or replace function public.proxiti_customer_close_chat_ticket(
 p_ticket uuid, p_access_hash text
) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_status text; v_hash text;
begin
 if p_ticket is null or p_access_hash is null or
    length(p_access_hash)<>64 or p_access_hash !~ '^[a-f0-9]{64}$'
 then
   return jsonb_build_object('result','not_found');
 end if;
 select status,access_hash into v_status,v_hash
 from public.support_tickets where id=p_ticket for update;
 if not found or v_hash is distinct from p_access_hash then
   return jsonb_build_object('result','not_found');
 end if;
 if v_status='closed' then
   return jsonb_build_object('result','already_closed');
 end if;
 -- Um cliente não deve encerrar unilateralmente um serviço contratado,
 -- orçamento pendente ou visita confirmada a partir do chat público.
 if exists(select 1 from public.ticket_appointments
   where ticket_id=p_ticket and status in ('planned','confirmed')) then
   return jsonb_build_object('result','blocked','reason','appointment');
 end if;
 if exists(select 1 from public.commercial_quotes
   where ticket_id=p_ticket and status in ('issued','accepted')) then
   return jsonb_build_object('result','blocked','reason','quote');
 end if;
 update public.support_tickets
 set status='closed',updated_at=now()
 where id=p_ticket;
 -- O gatilho proxiti_ticket_audit_log registra status_changed.
 return jsonb_build_object('result','closed');
end; $$;
revoke all on function public.proxiti_customer_close_chat_ticket(uuid,text)
 from public,anon,authenticated;
grant execute on function public.proxiti_customer_close_chat_ticket(uuid,text)
 to service_role;
comment on function public.proxiti_customer_close_chat_ticket(uuid,text)
 is 'Encerra somente o próprio chamado do chat, mediante hash válido e sem compromissos comerciais/agendamentos ativos.';
