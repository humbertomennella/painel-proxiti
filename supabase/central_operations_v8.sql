-- PROXITI V8: Academia editorial, agenda, equipamentos e relatórios.
-- Migração aditiva sem registros fictícios ou alterações em chamados existentes.
alter table public.training_materials
 add column if not exists kind text not null default 'file',
 add column if not exists category text not null default 'Geral',
 add column if not exists body text not null default '',
 add column if not exists reference_url text,
 add column if not exists reviewed_at date,
 add column if not exists updated_at timestamptz not null default now();
alter table public.training_materials drop constraint if exists proxiti_training_kind_check;
alter table public.training_materials add constraint proxiti_training_kind_check check(kind in ('file','article'));
alter table public.training_materials drop constraint if exists proxiti_training_category_check;
alter table public.training_materials add constraint proxiti_training_category_check check(length(btrim(category)) between 3 and 60);
alter table public.training_materials drop constraint if exists proxiti_training_body_check;
alter table public.training_materials add constraint proxiti_training_body_check
 check(length(body)<=16000 and (kind<>'article' or (length(btrim(body))>=100 and storage_path is null)));
alter table public.training_materials drop constraint if exists proxiti_training_reference_check;
alter table public.training_materials add constraint proxiti_training_reference_check
 check(reference_url is null or (length(reference_url)<=500 and reference_url ~ '^https://[a-zA-Z0-9.-]+/'));

alter table public.ticket_audit drop constraint if exists ticket_audit_action_check;
alter table public.ticket_audit add constraint ticket_audit_action_check
 check(action in ('created','claimed','assigned','unassigned','status_changed','staff_replied',
 'customer_replied','note_added','checklist_created','checklist_updated','attachment_added',
 'appointment_created','appointment_updated','device_updated','report_saved'));

create table if not exists public.ticket_appointments(
 id uuid primary key default gen_random_uuid(),
 ticket_id uuid not null references public.support_tickets(id) on delete cascade,
 created_by uuid not null references public.profiles(id),
 title text not null check(length(btrim(title)) between 5 and 140),
 starts_at timestamptz not null,
 duration_minutes integer not null default 60 check(duration_minutes between 15 and 480),
 modality text not null check(modality in ('remote','on_site','phone')),
 status text not null default 'planned' check(status in ('planned','confirmed','done','cancelled')),
 private_details text not null default '' check(length(private_details)<=500),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create index if not exists proxiti_ticket_appointments_idx on public.ticket_appointments(ticket_id,starts_at);
create index if not exists proxiti_appointments_agenda_idx on public.ticket_appointments(starts_at,status);
alter table public.ticket_appointments enable row level security;
revoke all on public.ticket_appointments from public,anon,authenticated;
grant select on public.ticket_appointments to authenticated;
drop policy if exists ticket_appointments_staff_read on public.ticket_appointments;
create policy ticket_appointments_staff_read on public.ticket_appointments
 for select to authenticated using(public.proxiti_ticket_access(ticket_id,false));

create or replace function public.proxiti_schedule_appointment(
 p_ticket uuid,p_title text,p_starts_at timestamptz,p_duration integer,p_modality text,p_private_details text default '')
returns uuid language plpgsql security definer set search_path='' as $$
declare new_id uuid;
begin
 if not public.proxiti_ticket_access(p_ticket,true) then raise exception 'Atendimento não autorizado'; end if;
 if not exists(select 1 from public.support_tickets where id=p_ticket and status not in ('closed','resolved'))
 then raise exception 'A situação do chamado não permite agendamento'; end if;
 if p_title is null or length(btrim(p_title)) not between 5 and 140 or p_starts_at is null
 or p_starts_at<now()-interval '15 minutes' or p_starts_at>now()+interval '2 years'
 or p_duration not between 15 and 480 or p_modality not in ('remote','on_site','phone')
 or p_private_details is null or length(p_private_details)>500
 then raise exception 'Revise as informações da agenda'; end if;
 insert into public.ticket_appointments(ticket_id,created_by,title,starts_at,duration_minutes,modality,private_details)
 values(p_ticket,(select auth.uid()),btrim(p_title),p_starts_at,p_duration,p_modality,btrim(p_private_details))
 returning id into new_id;
 insert into public.ticket_audit(ticket_id,actor_id,action)
 values(p_ticket,(select auth.uid()),'appointment_created');
 return new_id;
end; $$;
revoke all on function public.proxiti_schedule_appointment(uuid,text,timestamptz,integer,text,text) from public,anon;
grant execute on function public.proxiti_schedule_appointment(uuid,text,timestamptz,integer,text,text) to authenticated;

create or replace function public.proxiti_update_appointment(p_id uuid,p_status text)
returns void language plpgsql security definer set search_path='' as $$
declare target uuid;old_status text;
begin
 select ticket_id,status into target,old_status from public.ticket_appointments where id=p_id for update;
 if target is null or not public.proxiti_ticket_access(target,true)
 then raise exception 'Agendamento não autorizado'; end if;
 if p_status not in ('planned','confirmed','done','cancelled') then raise exception 'Situação inválida'; end if;
 if old_status in ('done','cancelled') and p_status<>old_status then raise exception 'Agendamento finalizado'; end if;
 if not exists(select 1 from public.support_tickets where id=target and status<>'closed')
 then raise exception 'Chamado encerrado'; end if;
 if p_status='done' and old_status='planned' then raise exception 'Confirme antes de concluir'; end if;
 update public.ticket_appointments set status=p_status,updated_at=now() where id=p_id;
 if p_status<>old_status then
  insert into public.ticket_audit(ticket_id,actor_id,action,previous_value,next_value)
  values(target,(select auth.uid()),'appointment_updated',old_status,p_status);
 end if;
end; $$;
revoke all on function public.proxiti_update_appointment(uuid,text) from public,anon;
grant execute on function public.proxiti_update_appointment(uuid,text) to authenticated;

create table if not exists public.ticket_devices(
 ticket_id uuid primary key references public.support_tickets(id) on delete cascade,
 category text not null check(category in ('desktop','notebook','router','network','printer','server','other')),
 brand text not null default '' check(length(brand)<=90),model text not null default '' check(length(model)<=110),
 operating_system text not null default '' check(length(operating_system)<=110),
 asset_reference text not null default '' check(length(asset_reference)<=80),
 observations text not null default '' check(length(observations)<=1000),
 updated_by uuid references public.profiles(id) on delete set null,updated_at timestamptz not null default now()
);
alter table public.ticket_devices enable row level security;
revoke all on public.ticket_devices from public,anon,authenticated;
grant select on public.ticket_devices to authenticated;
drop policy if exists ticket_devices_staff_read on public.ticket_devices;
create policy ticket_devices_staff_read on public.ticket_devices
 for select to authenticated using(public.proxiti_ticket_access(ticket_id,false));

create or replace function public.proxiti_save_ticket_device(
 p_ticket uuid,p_category text,p_brand text,p_model text,p_os text,p_ref text,p_observations text)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.proxiti_ticket_access(p_ticket,true) then raise exception 'Chamado não autorizado'; end if;
 if not exists(select 1 from public.support_tickets where id=p_ticket and status<>'closed')
 then raise exception 'Chamado encerrado'; end if;
 if p_category not in ('desktop','notebook','router','network','printer','server','other')
 or p_brand is null or length(p_brand)>90 or p_model is null or length(p_model)>110
 or p_os is null or length(p_os)>110 or p_ref is null or length(p_ref)>80
 or p_observations is null or length(p_observations)>1000 then raise exception 'Dados do equipamento inválidos'; end if;
 insert into public.ticket_devices(ticket_id,category,brand,model,operating_system,asset_reference,observations,updated_by)
 values(p_ticket,p_category,btrim(p_brand),btrim(p_model),btrim(p_os),btrim(p_ref),
 btrim(p_observations),(select auth.uid()))
 on conflict(ticket_id) do update set category=excluded.category,brand=excluded.brand,
 model=excluded.model,operating_system=excluded.operating_system,asset_reference=excluded.asset_reference,
 observations=excluded.observations,updated_by=excluded.updated_by,updated_at=now();
 insert into public.ticket_audit(ticket_id,actor_id,action)
 values(p_ticket,(select auth.uid()),'device_updated');
end; $$;
revoke all on function public.proxiti_save_ticket_device(uuid,text,text,text,text,text,text) from public,anon;
grant execute on function public.proxiti_save_ticket_device(uuid,text,text,text,text,text,text) to authenticated;

create table if not exists public.ticket_reports(
 id uuid primary key default gen_random_uuid(),
 ticket_id uuid not null references public.support_tickets(id) on delete cascade,
 version integer not null check(version>=1),
 author_id uuid not null references public.profiles(id),
 diagnosis text not null check(length(btrim(diagnosis)) between 5 and 3000),
 work_performed text not null check(length(btrim(work_performed)) between 5 and 3000),
 recommendations text not null default '' check(length(recommendations)<=3000),
 finalized boolean not null default false,created_at timestamptz not null default now(),
 unique(ticket_id,version)
);
create index if not exists proxiti_ticket_reports_idx on public.ticket_reports(ticket_id,version desc);
alter table public.ticket_reports enable row level security;
revoke all on public.ticket_reports from public,anon,authenticated;
grant select on public.ticket_reports to authenticated;
drop policy if exists ticket_reports_staff_read on public.ticket_reports;
create policy ticket_reports_staff_read on public.ticket_reports for select to authenticated
 using(public.proxiti_ticket_access(ticket_id,false));

create or replace function public.proxiti_save_ticket_report(
 p_ticket uuid,p_diagnosis text,p_work text,p_recommendations text,p_finalized boolean default false)
returns integer language plpgsql security definer set search_path='' as $$
declare new_version integer;
begin
 if not public.proxiti_ticket_access(p_ticket,true) then raise exception 'Chamado não autorizado'; end if;
 perform 1 from public.support_tickets where id=p_ticket and status<>'closed' for update;
 if not found then raise exception 'Chamado encerrado'; end if;
 if p_diagnosis is null or length(btrim(p_diagnosis)) not between 5 and 3000
 or p_work is null or length(btrim(p_work)) not between 5 and 3000
 or p_recommendations is null or length(p_recommendations)>3000 or p_finalized is null
 then raise exception 'Relatório incompleto'; end if;
 select coalesce(max(version),0)+1 into new_version from public.ticket_reports where ticket_id=p_ticket;
 insert into public.ticket_reports(ticket_id,version,author_id,diagnosis,work_performed,recommendations,finalized)
 values(p_ticket,new_version,(select auth.uid()),btrim(p_diagnosis),btrim(p_work),btrim(p_recommendations),p_finalized);
 insert into public.ticket_audit(ticket_id,actor_id,action,next_value)
 values(p_ticket,(select auth.uid()),'report_saved',case when p_finalized then 'final' else 'draft' end);
 return new_version;
end; $$;
revoke all on function public.proxiti_save_ticket_report(uuid,text,text,text,boolean) from public,anon;
grant execute on function public.proxiti_save_ticket_report(uuid,text,text,text,boolean) to authenticated;
