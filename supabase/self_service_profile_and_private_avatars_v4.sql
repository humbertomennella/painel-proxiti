-- Central Técnica PROXITI: perfil editável pelo titular sem editar papel/permissões.
alter table public.profiles add column if not exists avatar_path text
  check (avatar_path is null or length(avatar_path) between 40 and 256);

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('proxiti-avatars','proxiti-avatars',false,2097152,
  array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

drop policy if exists proxiti_avatars_select_own on storage.objects;
create policy proxiti_avatars_select_own on storage.objects
for select to authenticated
using (bucket_id='proxiti-avatars' and (storage.foldername(name))[1]=(select auth.uid())::text);

drop policy if exists proxiti_avatars_insert_own on storage.objects;
create policy proxiti_avatars_insert_own on storage.objects
for insert to authenticated
with check (bucket_id='proxiti-avatars' and (storage.foldername(name))[1]=(select auth.uid())::text
  and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$');

drop policy if exists proxiti_avatars_delete_own on storage.objects;
create policy proxiti_avatars_delete_own on storage.objects
for delete to authenticated
using (bucket_id='proxiti-avatars' and (storage.foldername(name))[1]=(select auth.uid())::text);

create or replace function public.proxiti_update_my_name(p_name text)
returns text language plpgsql security definer set search_path=''
as $$
declare clean_name text;
begin
  clean_name=btrim(coalesce(p_name,''));
  if length(clean_name) not between 2 and 120 then
    raise exception 'O nome deve ter entre 2 e 120 caracteres';
  end if;
  update public.profiles set display_name=clean_name
    where id=(select auth.uid()) and status='active';
  if not found then raise exception 'Perfil ativo não encontrado'; end if;
  return clean_name;
end;
$$;
revoke all on function public.proxiti_update_my_name(text) from public,anon;
grant execute on function public.proxiti_update_my_name(text) to authenticated;

create or replace function public.proxiti_set_my_avatar(p_path text)
returns text language plpgsql security definer set search_path=''
as $$
declare me uuid;
begin
 me=(select auth.uid());
 if me is null then raise exception 'Sessão não autorizada'; end if;
 if p_path is not null then
   if length(p_path)>256 or p_path !~ ('^'||me::text||'/[0-9a-f-]{36}\.(jpg|png|webp)$') then
     raise exception 'Caminho da imagem inválido';
   end if;
   if not exists(select 1 from storage.objects
     where bucket_id='proxiti-avatars' and name=p_path and owner_id=me::text) then
     raise exception 'Imagem própria não localizada';
   end if;
 end if;
 update public.profiles set avatar_path=p_path
   where id=me and status='active';
 if not found then raise exception 'Perfil ativo não encontrado'; end if;
 return p_path;
end;
$$;
revoke all on function public.proxiti_set_my_avatar(text) from public,anon;
grant execute on function public.proxiti_set_my_avatar(text) to authenticated;
