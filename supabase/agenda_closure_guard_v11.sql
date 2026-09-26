-- PROXITI V11: não tornar compromissos ativos irrecuperáveis ao resolver/encerrar um chamado.
-- Complementa a migração aditiva de Agenda V10. Não altera registros existentes.
create or replace function public.proxiti_change_ticket_status(p_ticket uuid,p_status text)
returns void language plpgsql security definer set search_path='' as $$
declare previous_status text;
begin
 if p_status is null or p_status not in
   ('new','triage','in_progress','waiting_customer','resolved','closed')
 then raise exception 'Situação inválida'; end if;
 if (select auth.uid()) is null
   or not (public.proxiti_is_admin() or public.proxiti_can('tickets_view'))
 then raise exception 'Acesso não autorizado'; end if;

 -- Ordem de bloqueio consistente: chamado antes de seus compromissos.
 select status into previous_status from public.support_tickets
 where id=p_ticket and
   (public.proxiti_is_admin() or assigned_to=(select auth.uid()))
 for update;
 if not found then raise exception 'Chamado não autorizado ou inexistente'; end if;
 if previous_status='closed' then
   raise exception 'Chamado encerrado. O histórico não pode ser reaberto por esta ação';
 end if;
 if previous_status=p_status then return; end if;

 -- Uma visita planejada ou confirmada não pode ficar presa num chamado finalizado.
 if p_status in ('resolved','closed') and exists(
   select 1 from public.ticket_appointments
   where ticket_id=p_ticket and status in ('planned','confirmed')
 ) then
   raise exception 'Finalize ou cancele os compromissos pendentes antes de resolver ou encerrar o chamado';
 end if;

 update public.support_tickets set status=p_status,updated_at=now() where id=p_ticket;
 -- O gatilho existente registra o evento status_changed uma única vez.
end; $$;
revoke all on function public.proxiti_change_ticket_status(uuid,text) from public,anon;
grant execute on function public.proxiti_change_ticket_status(uuid,text) to authenticated;
