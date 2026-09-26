-- PROXITI Central V10: integridade da agenda (migração aditiva).
-- Não modifica compromissos nem chamados existentes.
-- Confirmação é ação explícita de profissional autorizado após contato com o cliente.

alter table public.ticket_appointments
 add column if not exists confirmed_at timestamptz,
 add column if not exists confirmed_by uuid references public.profiles(id) on delete set null,
 add column if not exists confirmation_channel text
   check(confirmation_channel is null or confirmation_channel in
     ('chat','phone','whatsapp','email','in_person'));

alter table public.ticket_audit drop constraint if exists ticket_audit_action_check;
alter table public.ticket_audit add constraint ticket_audit_action_check check(action in
 ('created','claimed','assigned','unassigned','status_changed','staff_replied',
  'customer_replied','note_added','checklist_created','checklist_updated','attachment_added',
  'appointment_created','appointment_updated','appointment_rescheduled',
  'device_updated','report_saved'));

-- O chamado é bloqueado antes de inserir o compromisso para não agendar após encerramento.
create or replace function public.proxiti_schedule_appointment(
 p_ticket uuid,p_title text,p_starts_at timestamptz,p_duration integer,
 p_modality text,p_private_details text default '')
returns uuid language plpgsql security definer set search_path='' as $$
declare new_id uuid; current_status text;
begin
 select status into current_status from public.support_tickets where id=p_ticket for update;
 if current_status is null or not public.proxiti_ticket_access(p_ticket,true)
 then raise exception 'Atendimento não autorizado'; end if;
 if current_status in ('closed','resolved') then
   raise exception 'A situação do chamado não permite agendamento'; end if;
 if p_title is null or length(btrim(p_title)) not between 5 and 140
   or p_starts_at is null or p_starts_at<now()-interval '15 minutes'
   or p_starts_at>now()+interval '2 years'
   or p_duration not between 15 and 480
   or p_modality not in ('remote','on_site','phone')
   or p_private_details is null or length(p_private_details)>500
 then raise exception 'Revise as informações da agenda'; end if;

 insert into public.ticket_appointments(
   ticket_id,created_by,title,starts_at,duration_minutes,modality,private_details)
 values(p_ticket,(select auth.uid()),btrim(p_title),p_starts_at,
   p_duration,p_modality,btrim(p_private_details))
 returning id into new_id;
 insert into public.ticket_audit(ticket_id,actor_id,action)
 values(p_ticket,(select auth.uid()),'appointment_created');
 return new_id;
end; $$;
revoke all on function public.proxiti_schedule_appointment(
 uuid,text,timestamptz,integer,text,text) from public,anon;
grant execute on function public.proxiti_schedule_appointment(
 uuid,text,timestamptz,integer,text,text) to authenticated;

-- Não há confirmação automática; o operador informa o canal do contato realizado.
create or replace function public.proxiti_confirm_appointment(p_id uuid,p_channel text)
returns void language plpgsql security definer set search_path='' as $$
declare target uuid; current_status text; old_status text;
begin
 select ticket_id into target from public.ticket_appointments where id=p_id;
 if target is null then raise exception 'Compromisso inexistente'; end if;
 select status into current_status from public.support_tickets where id=target for update;
 if current_status is null or current_status in ('closed','resolved')
    or not public.proxiti_ticket_access(target,true)
 then raise exception 'Compromisso ou atendimento não autorizado'; end if;
 if p_channel is null or p_channel not in
   ('chat','phone','whatsapp','email','in_person')
 then raise exception 'Informe o canal da confirmação do cliente'; end if;
 select status into old_status from public.ticket_appointments where id=p_id for update;
 if old_status<>'planned' then
   raise exception 'Compromisso alterado por outro profissional. Atualize a agenda'; end if;
 update public.ticket_appointments
 set status='confirmed',confirmation_channel=p_channel,confirmed_at=now(),
     confirmed_by=(select auth.uid()),updated_at=now()
 where id=p_id;
 insert into public.ticket_audit(ticket_id,actor_id,action,previous_value,next_value)
 values(target,(select auth.uid()),'appointment_updated','planned','confirmed/'||p_channel);
end; $$;
revoke all on function public.proxiti_confirm_appointment(uuid,text) from public,anon;
grant execute on function public.proxiti_confirm_appointment(uuid,text) to authenticated;

-- Transições terminais somente: planejado/confirmado -> cancelado,
-- confirmado -> concluído. Não se desfaz conclusão ou cancelamento.
create or replace function public.proxiti_update_appointment(p_id uuid,p_status text)
returns void language plpgsql security definer set search_path='' as $$
declare target uuid; current_status text; old_status text;
begin
 select ticket_id into target from public.ticket_appointments where id=p_id;
 if target is null then raise exception 'Compromisso inexistente'; end if;
 select status into current_status from public.support_tickets where id=target for update;
 if current_status is null or current_status in ('closed','resolved')
   or not public.proxiti_ticket_access(target,true)
 then raise exception 'Compromisso ou atendimento não autorizado'; end if;
 if p_status not in ('done','cancelled') or p_status is null then
   raise exception 'Use a confirmação explícita ou o reagendamento para alterar esta situação';
 end if;
 select status into old_status from public.ticket_appointments where id=p_id for update;
 if old_status in ('done','cancelled') then
   raise exception 'Compromisso finalizado. Atualize a agenda'; end if;
 if p_status='done' and old_status<>'confirmed' then
   raise exception 'É necessário confirmar com o cliente antes de concluir'; end if;
 update public.ticket_appointments set status=p_status,updated_at=now() where id=p_id;
 insert into public.ticket_audit(ticket_id,actor_id,action,previous_value,next_value)
 values(target,(select auth.uid()),'appointment_updated',old_status,p_status);
end; $$;
revoke all on function public.proxiti_update_appointment(uuid,text) from public,anon;
grant execute on function public.proxiti_update_appointment(uuid,text) to authenticated;

-- Reagendar mantém histórico de horário anterior e invalida a confirmação antiga.
create or replace function public.proxiti_reschedule_appointment(
 p_id uuid,p_starts_at timestamptz,p_duration integer,p_modality text,p_reason text)
returns void language plpgsql security definer set search_path='' as $$
declare target uuid; current_status text; old_status text; previous_start timestamptz;
begin
 select ticket_id into target from public.ticket_appointments where id=p_id;
 if target is null then raise exception 'Compromisso inexistente'; end if;
 select status into current_status from public.support_tickets where id=target for update;
 if current_status is null or current_status in ('closed','resolved')
   or not public.proxiti_ticket_access(target,true)
 then raise exception 'Compromisso ou atendimento não autorizado'; end if;
 if p_starts_at is null or p_starts_at<now()-interval '15 minutes'
   or p_starts_at>now()+interval '2 years'
   or p_duration not between 15 and 480
   or p_modality not in ('remote','on_site','phone')
   or p_reason is null or length(btrim(p_reason)) not between 5 and 400
 then raise exception 'Revise horário, duração, modalidade e motivo do reagendamento'; end if;
 select status,starts_at into old_status,previous_start
 from public.ticket_appointments where id=p_id for update;
 if old_status not in ('planned','confirmed') then
   raise exception 'Compromisso finalizado. Atualize a agenda'; end if;
 if previous_start=p_starts_at and
   (select duration_minutes=p_duration and modality=p_modality
    from public.ticket_appointments where id=p_id) then
   raise exception 'O novo horário e os detalhes são iguais aos anteriores'; end if;
 update public.ticket_appointments
 set starts_at=p_starts_at,duration_minutes=p_duration,modality=p_modality,
     status='planned',confirmed_at=null,confirmed_by=null,confirmation_channel=null,
     updated_at=now() where id=p_id;
 insert into public.ticket_audit(ticket_id,actor_id,action,previous_value,next_value)
 values(target,(select auth.uid()),'appointment_rescheduled',
   to_char(previous_start at time zone 'UTC','YYYY-MM-DD"T"HH24:MI"Z"'),
   to_char(p_starts_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI"Z"'));
 return;
end; $$;
revoke all on function public.proxiti_reschedule_appointment(
 uuid,timestamptz,integer,text,text) from public,anon;
grant execute on function public.proxiti_reschedule_appointment(
 uuid,timestamptz,integer,text,text) to authenticated;
