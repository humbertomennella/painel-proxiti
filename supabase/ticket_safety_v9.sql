-- PROXITI: regras de transição e assunção dos chamados.
-- Migração aditiva: substitui apenas as duas RPCs existentes. Não toca em registros.
-- Chamados encerrados são históricos imutáveis; reabertura requer novo chamado
-- ou procedimento administrativo futuro explícito.

create or replace function public.proxiti_claim_ticket(p_ticket uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare changed integer;
begin
  if (select auth.uid()) is null
    or not public.proxiti_can('tickets_claim')
    or not public.proxiti_can('tickets_view')
  then raise exception 'Sem permissão para assumir chamados'; end if;

  update public.support_tickets
  set assigned_to=(select auth.uid()),
      status=case when status='new' then 'triage' else status end,
      updated_at=now()
  where id=p_ticket and assigned_to is null
    and status in ('new','triage','in_progress','waiting_customer');
  get diagnostics changed=row_count;
  return changed=1;
end; $$;
revoke all on function public.proxiti_claim_ticket(uuid) from public,anon;
grant execute on function public.proxiti_claim_ticket(uuid) to authenticated;

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

  -- O bloqueio impede alterações simultâneas e impede reabrir um histórico.
  select status into previous_status
    from public.support_tickets
    where id=p_ticket and
      (public.proxiti_is_admin() or assigned_to=(select auth.uid()))
    for update;
  if not found then raise exception 'Chamado não autorizado ou inexistente'; end if;
  if previous_status='closed' then
    raise exception 'Chamado encerrado. O histórico não pode ser reaberto por esta ação';
  end if;
  if previous_status=p_status then return; end if;

  update public.support_tickets
    set status=p_status,updated_at=now()
    where id=p_ticket;
  -- O gatilho já registra status_changed, sem gravação duplicada.
end; $$;
revoke all on function public.proxiti_change_ticket_status(uuid,text) from public,anon;
grant execute on function public.proxiti_change_ticket_status(uuid,text) to authenticated;
