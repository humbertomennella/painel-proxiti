-- PROXITI: atendimento técnico integrado (migração aditiva).
-- Nenhum chamado, mensagem ou arquivo existente é alterado.
-- Privacidade: notas internas e anexos nunca são expostos ao visitante.

create or replace function public.proxiti_ticket_access(p_ticket uuid,p_write boolean default false)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(
    select 1 from public.support_tickets t
    join public.profiles p on p.id=(select auth.uid())
    where t.id=p_ticket and p.status='active'
      and (
        (p.role='administrator' and public.proxiti_is_admin())
        or (p.role='technician' and public.proxiti_can('tickets_view')
          and (t.assigned_to=(select auth.uid()) or
               (not coalesce(p_write,false) and t.assigned_to is null)))
      )
  );
$$;
revoke all on function public.proxiti_ticket_access(uuid,boolean) from public,anon;
grant execute on function public.proxiti_ticket_access(uuid,boolean) to authenticated;

alter table public.ticket_audit drop constraint if exists ticket_audit_action_check;
alter table public.ticket_audit add constraint ticket_audit_action_check
check(action in ('created','claimed','assigned','unassigned','status_changed',
 'staff_replied','customer_replied','note_added','checklist_created','checklist_updated','attachment_added'));

create table if not exists public.ticket_internal_notes(
 id uuid primary key default gen_random_uuid(),
 ticket_id uuid not null references public.support_tickets(id) on delete cascade,
 author_id uuid not null references public.profiles(id),
 body text not null check(length(btrim(body)) between 3 and 3000),
 created_at timestamptz not null default now()
);
create index if not exists proxiti_ticket_notes_idx on public.ticket_internal_notes(ticket_id,created_at desc);
alter table public.ticket_internal_notes enable row level security;
revoke all on public.ticket_internal_notes from public,anon,authenticated;
grant select on public.ticket_internal_notes to authenticated;
drop policy if exists ticket_notes_staff_select on public.ticket_internal_notes;
create policy ticket_notes_staff_select on public.ticket_internal_notes for select to authenticated
 using(public.proxiti_ticket_access(ticket_id,false));

create or replace function public.proxiti_add_ticket_note(p_ticket uuid,p_body text)
returns uuid language plpgsql security definer set search_path='' as $$
declare created uuid;
begin
 if not public.proxiti_ticket_access(p_ticket,true) then raise exception 'Acesso não autorizado'; end if;
 if not exists(select 1 from public.support_tickets where id=p_ticket and status<>'closed')
 then raise exception 'O chamado está encerrado'; end if;
 if p_body is null or length(btrim(p_body)) not between 3 and 3000
 then raise exception 'Nota deve conter entre 3 e 3000 caracteres'; end if;
 insert into public.ticket_internal_notes(ticket_id,author_id,body)
 values(p_ticket,(select auth.uid()),btrim(p_body)) returning id into created;
 insert into public.ticket_audit(ticket_id,actor_id,action)
 values(p_ticket,(select auth.uid()),'note_added');
 return created;
end; $$;
revoke all on function public.proxiti_add_ticket_note(uuid,text) from public,anon;
grant execute on function public.proxiti_add_ticket_note(uuid,text) to authenticated;

create table if not exists public.ticket_tasks(
 id uuid primary key default gen_random_uuid(),
 ticket_id uuid not null references public.support_tickets(id) on delete cascade,
 title text not null check(length(btrim(title)) between 3 and 160),
 position integer not null check(position between 1 and 30),
 state text not null default 'pending' check(state in ('pending','done','skipped')),
 note text not null default '' check(length(note)<=400),
 updated_by uuid references public.profiles(id) on delete set null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(ticket_id,position)
);
create index if not exists proxiti_ticket_tasks_idx on public.ticket_tasks(ticket_id,position);
alter table public.ticket_tasks enable row level security;
revoke all on public.ticket_tasks from public,anon,authenticated;
grant select on public.ticket_tasks to authenticated;
drop policy if exists ticket_tasks_staff_select on public.ticket_tasks;
create policy ticket_tasks_staff_select on public.ticket_tasks for select to authenticated
 using(public.proxiti_ticket_access(ticket_id,false));

create or replace function public.proxiti_prepare_ticket_checklist(p_ticket uuid,p_template text default 'general')
returns integer language plpgsql security definer set search_path='' as $$
declare steps text[]; added integer;
begin
 if not public.proxiti_ticket_access(p_ticket,true) then raise exception 'Acesso não autorizado'; end if;
 perform 1 from public.support_tickets where id=p_ticket and status<>'closed' for update;
 if not found then raise exception 'O chamado está encerrado'; end if;
 if exists(select 1 from public.ticket_tasks where ticket_id=p_ticket) then return 0; end if;
 case p_template
 when 'computer' then steps:=array[
  'Confirmar o problema e a autorização do cliente',
  'Verificar o estado do equipamento e preservar dados',
  'Avaliar armazenamento, memória e inicialização',
  'Registrar os resultados do diagnóstico',
  'Apresentar o escopo antes de executar',
  'Testar o equipamento e orientar o cliente'];
 when 'network' then steps:=array[
  'Confirmar o impacto e o ambiente autorizado',
  'Registrar a topologia e as configurações relevantes',
  'Verificar conectividade, sinal e interferência',
  'Registrar os resultados e o escopo proposto',
  'Aplicar apenas as alterações autorizadas',
  'Testar conectividade e documentar orientações'];
 when 'backup' then steps:=array[
  'Identificar os dados e a autorização do responsável',
  'Verificar integridade, destino e espaço disponível',
  'Planejar o procedimento e os riscos de perda',
  'Executar o procedimento autorizado',
  'Validar os resultados sem expor dados',
  'Entregar orientações de recuperação'];
 when 'security' then steps:=array[
  'Delimitar escopo e obter autorização explícita',
  'Registrar o estado inicial sem coletar segredos',
  'Revisar atualizações, acessos e configurações',
  'Propor ações preventivas compatíveis com o escopo',
  'Aplicar e testar as mudanças autorizadas',
  'Documentar recomendações e limites'];
 when 'general' then steps:=array[
  'Confirmar contexto e autorização',
  'Realizar diagnóstico inicial',
  'Registrar evidências técnicas necessárias',
  'Apresentar o escopo proposto',
  'Executar apenas o serviço autorizado',
  'Testar o resultado e orientar o cliente'];
 else raise exception 'Roteiro desconhecido';
 end case;
 insert into public.ticket_tasks(ticket_id,title,position)
 select p_ticket,item,ord::integer from unnest(steps) with ordinality as s(item,ord);
 get diagnostics added=row_count;
 insert into public.ticket_audit(ticket_id,actor_id,action,next_value)
 values(p_ticket,(select auth.uid()),'checklist_created',p_template);
 return added;
end; $$;
revoke all on function public.proxiti_prepare_ticket_checklist(uuid,text) from public,anon;
grant execute on function public.proxiti_prepare_ticket_checklist(uuid,text) to authenticated;

create or replace function public.proxiti_update_ticket_task(p_task uuid,p_state text,p_note text default '')
returns void language plpgsql security definer set search_path='' as $$
declare current_ticket uuid; previous_state text;
begin
 select ticket_id,state into current_ticket,previous_state from public.ticket_tasks where id=p_task for update;
 if current_ticket is null or not public.proxiti_ticket_access(current_ticket,true)
 then raise exception 'Checklist não autorizado'; end if;
 if not exists(select 1 from public.support_tickets where id=current_ticket and status<>'closed')
 then raise exception 'O chamado está encerrado'; end if;
 if p_state not in ('pending','done','skipped') or p_note is null or length(p_note)>400
 then raise exception 'Etapa inválida'; end if;
 if p_state='skipped' and length(btrim(p_note))<3
 then raise exception 'Explique por que a etapa não se aplica'; end if;
 update public.ticket_tasks set state=p_state,note=btrim(p_note),updated_by=(select auth.uid()),
 updated_at=now() where id=p_task;
 insert into public.ticket_audit(ticket_id,actor_id,action,previous_value,next_value)
 values(current_ticket,(select auth.uid()),'checklist_updated',previous_state,p_state);
end; $$;
revoke all on function public.proxiti_update_ticket_task(uuid,text,text) from public,anon;
grant execute on function public.proxiti_update_ticket_task(uuid,text,text) to authenticated;

-- Documentos privados: objeto armazenado somente em bucket não público.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('proxiti-ticket-files','proxiti-ticket-files',false,5242880,
 array['application/pdf','image/png','image/jpeg','image/webp'])
on conflict(id) do update set public=false,file_size_limit=5242880,
 allowed_mime_types=excluded.allowed_mime_types;

-- CASE evita converter em UUID caminhos que não têm o formato esperado.
drop policy if exists proxiti_ticket_files_read on storage.objects;
create policy proxiti_ticket_files_read on storage.objects for select to authenticated
using(bucket_id='proxiti-ticket-files' and
 case when (storage.foldername(name))[1] ~
 '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
 then public.proxiti_ticket_access(((storage.foldername(name))[1])::uuid,false)
 else false end);

drop policy if exists proxiti_ticket_files_insert on storage.objects;
create policy proxiti_ticket_files_insert on storage.objects for insert to authenticated
with check(bucket_id='proxiti-ticket-files' and owner_id=(select auth.uid())::text and
 name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}[.](pdf|png|jpg|jpeg|webp)$' and
 case when (storage.foldername(name))[1] ~
 '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
 then public.proxiti_ticket_access(((storage.foldername(name))[1])::uuid,true)
 else false end);

drop policy if exists proxiti_ticket_files_cleanup on storage.objects;
create policy proxiti_ticket_files_cleanup on storage.objects for delete to authenticated
using(bucket_id='proxiti-ticket-files' and owner_id=(select auth.uid())::text and
 case when (storage.foldername(name))[1] ~
 '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
 then public.proxiti_ticket_access(((storage.foldername(name))[1])::uuid,true)
 else false end);

create table if not exists public.ticket_attachments(
 id uuid primary key default gen_random_uuid(),
 ticket_id uuid not null references public.support_tickets(id) on delete cascade,
 uploaded_by uuid not null references public.profiles(id),
 storage_path text not null unique check(length(storage_path)<=180),
 file_name text not null check(length(btrim(file_name)) between 1 and 160),
 mime_type text not null check(mime_type in ('application/pdf','image/png','image/jpeg','image/webp')),
 byte_size bigint not null check(byte_size between 1 and 5242880),
 created_at timestamptz not null default now()
);
create index if not exists proxiti_ticket_attachments_idx on public.ticket_attachments(ticket_id,created_at desc);
alter table public.ticket_attachments enable row level security;
revoke all on public.ticket_attachments from public,anon,authenticated;
grant select on public.ticket_attachments to authenticated;
drop policy if exists ticket_attachments_staff_select on public.ticket_attachments;
create policy ticket_attachments_staff_select on public.ticket_attachments for select to authenticated
 using(public.proxiti_ticket_access(ticket_id,false));

create or replace function public.proxiti_attach_ticket_file(
 p_ticket uuid,p_path text,p_name text,p_mime text,p_size bigint)
returns uuid language plpgsql security definer set search_path='' as $$
declare created uuid;
begin
 if not public.proxiti_ticket_access(p_ticket,true) then raise exception 'Acesso não autorizado'; end if;
 if not exists(select 1 from public.support_tickets where id=p_ticket and status<>'closed')
 then raise exception 'O chamado está encerrado'; end if;
 if p_path is null or p_path !~ ('^'||p_ticket::text||'/[0-9a-f-]{36}[.](pdf|png|jpg|jpeg|webp)$')
 or p_name is null or length(btrim(p_name)) not between 1 and 160
 or p_mime not in ('application/pdf','image/png','image/jpeg','image/webp')
 or p_size not between 1 and 5242880
 then raise exception 'Arquivo não permitido'; end if;
 if not exists(select 1 from storage.objects o where o.bucket_id='proxiti-ticket-files'
  and o.name=p_path and o.owner_id=(select auth.uid())::text)
 then raise exception 'Arquivo privado não encontrado'; end if;
 insert into public.ticket_attachments(ticket_id,uploaded_by,storage_path,file_name,mime_type,byte_size)
 values(p_ticket,(select auth.uid()),p_path,btrim(p_name),p_mime,p_size)
 returning id into created;
 insert into public.ticket_audit(ticket_id,actor_id,action)
 values(p_ticket,(select auth.uid()),'attachment_added');
 return created;
end; $$;
revoke all on function public.proxiti_attach_ticket_file(uuid,text,text,text,bigint) from public,anon;
grant execute on function public.proxiti_attach_ticket_file(uuid,text,text,text,bigint) to authenticated;
