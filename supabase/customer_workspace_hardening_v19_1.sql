-- PROXITI V19.1 | Suspensão interrompe também acesso direto a registros privados.
-- RPCs próprias já verificam a conta; RLS passa a aplicar a mesma regra a leituras PostgREST.
drop policy if exists customer_device_own_select on public.customer_devices;
create policy customer_device_own_select on public.customer_devices
 for select to authenticated using(
  (user_id=(select auth.uid()) and public.proxiti_customer_verified()) or public.proxiti_is_admin());

drop policy if exists customer_ticket_own_select on public.customer_ticket_links;
create policy customer_ticket_own_select on public.customer_ticket_links
 for select to authenticated using(
  (user_id=(select auth.uid()) and public.proxiti_customer_verified()) or public.proxiti_is_admin());

drop policy if exists customer_schedule_own_select on public.customer_schedule_requests;
create policy customer_schedule_own_select on public.customer_schedule_requests
 for select to authenticated using(
  (user_id=(select auth.uid()) and public.proxiti_customer_verified()) or public.proxiti_is_admin());

drop policy if exists customer_preference_own_select on public.customer_partner_preferences;
create policy customer_preference_own_select on public.customer_partner_preferences
 for select to authenticated using(
  (user_id=(select auth.uid()) and public.proxiti_customer_verified()) or public.proxiti_is_admin());

drop policy if exists customer_ratings_own_select on public.customer_service_ratings;
create policy customer_ratings_own_select on public.customer_service_ratings
 for select to authenticated using(
  (user_id=(select auth.uid()) and public.proxiti_customer_verified()) or public.proxiti_is_admin());

drop policy if exists partner_offer_own_or_admin on public.partner_opportunities;
create policy partner_offer_own_or_admin on public.partner_opportunities
 for select to authenticated using(
  (partner_id=(select auth.uid()) and public.proxiti_can('tickets_view')) or public.proxiti_is_admin());

-- Perfil técnico convidado continua criado pelo trigger, sem chamada pública ao gatilho.
revoke all on function public.proxiti_create_auth_profile() from public,anon,authenticated;
