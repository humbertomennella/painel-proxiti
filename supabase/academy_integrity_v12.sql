-- PROXITI Central V12: Academia editorial rastreável e busca em português.
-- Migração aditiva: não substitui os dez procedimentos e não cria conteúdo fictício.
-- Versões antigas são privadas dos administradores. Técnicos veem só materiais publicados.

alter table public.training_materials
 add column if not exists search_index tsvector generated always as (
   to_tsvector('portuguese'::regconfig,
     coalesce(title,'') || ' ' || coalesce(description,'') || ' ' || coalesce(body,''))
 ) stored;
create index if not exists proxiti_training_search_gin_idx
 on public.training_materials using gin(search_index);

-- A data de revisão é uma confirmação editorial, não prova de formação do técnico.
alter table public.training_materials
 drop constraint if exists proxiti_training_publication_review_check;
alter table public.training_materials
 add constraint proxiti_training_publication_review_check
 check(not published or (reviewed_at is not null and
   ((kind='article' and length(btrim(body))>=100 and storage_path is null)
     or (kind='file' and storage_path is not null))));

create table if not exists public.training_material_versions(
 id bigint generated always as identity primary key,
 material_id uuid not null references public.training_materials(id) on delete restrict,
 previous_snapshot jsonb not null,
 changed_by uuid references public.profiles(id) on delete set null,
 recorded_at timestamptz not null default now()
);
create index if not exists proxiti_training_versions_material_idx
 on public.training_material_versions(material_id,recorded_at desc,id desc);
alter table public.training_material_versions enable row level security;
revoke all on public.training_material_versions from public,anon,authenticated;
grant select on public.training_material_versions to authenticated;
drop policy if exists training_versions_admin_read on public.training_material_versions;
create policy training_versions_admin_read on public.training_material_versions
 for select to authenticated using(public.proxiti_is_admin());

-- Sem exclusão definitiva pela API de usuários. Arquivar = published false;
-- versões e caminhos antigos permanecem para auditoria e restauração administrativa.
revoke delete on public.training_materials from authenticated;

create or replace function public.proxiti_training_before_update()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if old.content_key is not null and new.content_key is distinct from old.content_key then
   raise exception 'A chave editorial original não pode ser alterada';
 end if;
 if row(new.title,new.description,new.storage_path,new.published,new.kind,new.category,
        new.body,new.reference_url,new.reviewed_at,new.content_key)
    is distinct from
    row(old.title,old.description,old.storage_path,old.published,old.kind,old.category,
        old.body,old.reference_url,old.reviewed_at,old.content_key) then
   new.updated_at=clock_timestamp();
 else
   new.updated_at=old.updated_at;
 end if;
 return new;
end; $$;
revoke all on function public.proxiti_training_before_update() from public,anon,authenticated;
drop trigger if exists proxiti_training_before_update on public.training_materials;
create trigger proxiti_training_before_update
 before update on public.training_materials for each row
 execute function public.proxiti_training_before_update();

create or replace function public.proxiti_training_record_version()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if row(new.title,new.description,new.storage_path,new.published,new.kind,new.category,
        new.body,new.reference_url,new.reviewed_at,new.content_key)
    is distinct from
    row(old.title,old.description,old.storage_path,old.published,old.kind,old.category,
        old.body,old.reference_url,old.reviewed_at,old.content_key) then
   insert into public.training_material_versions(material_id,previous_snapshot,changed_by)
   values(old.id,to_jsonb(old)-(array['search_index']::text[]),(select auth.uid()));
 end if;
 return new;
end; $$;
revoke all on function public.proxiti_training_record_version() from public,anon,authenticated;
drop trigger if exists proxiti_training_record_version on public.training_materials;
create trigger proxiti_training_record_version
 after update on public.training_materials for each row
 execute function public.proxiti_training_record_version();

-- O bucket já é privado. Técnicos só podem assinar arquivos de materiais publicados.
-- Administradores mantêm acesso aos arquivos dos rascunhos e versões históricas.
drop policy if exists proxiti_training_files_read on storage.objects;
create policy proxiti_training_files_read on storage.objects
 for select to authenticated using(
   bucket_id='proxiti-training' and (
     public.proxiti_is_admin() or (
       public.proxiti_can('training') and exists(
         select 1 from public.training_materials m
         where m.storage_path=storage.objects.name and m.published
       )
     )
   )
 );
