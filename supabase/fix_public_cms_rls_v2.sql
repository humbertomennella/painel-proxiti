-- O papel anon deve avaliar somente colunas públicas; nunca executar is_admin().
drop policy if exists cms_public_read on public.site_content;
create policy cms_public_read on public.site_content for select to anon
using (is_published = true);
drop policy if exists cms_authenticated_read on public.site_content;
create policy cms_authenticated_read on public.site_content for select to authenticated
using (is_published = true or public.proxiti_is_admin());
