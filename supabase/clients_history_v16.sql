-- PROXITI V16 | Diretório e histórico de contatos, somente leitura.
-- Não cria registros duplicados de clientes nem associa pessoas por nome.
-- O agrupamento é por e-mail do chamado: um endereço compartilhado pode representar várias pessoas.

create or replace function public.proxiti_clients_directory(
 p_search text default '',p_limit integer default 24,p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_rows jsonb;v_more boolean;v_search text;
begin
 if (select auth.uid()) is null or not public.proxiti_can('tickets_view')
 then raise exception 'Consulta de contatos não autorizada';end if;
 if p_search is null or length(btrim(p_search))>120
 or p_limit is null or p_limit not between 1 and 48
 or p_offset is null or p_offset not between 0 and 20000
 then raise exception 'Parâmetros de pesquisa inválidos';end if;
 v_search:=lower(btrim(p_search));
 with accessible as (
  select lower(btrim(t.customer_email)) email,t.customer_name,t.customer_phone,
   t.updated_at,t.id,t.status
  from public.support_tickets t
  where public.proxiti_ticket_access(t.id,false)
 ), grouped as (
  select email,
   (array_agg(customer_name order by updated_at desc,id desc))[1] as name,
   (array_agg(customer_phone order by updated_at desc,id desc))[1] as phone,
   count(*)::integer as tickets_count,
   count(*) filter(where status not in ('closed','resolved'))::integer as active_count,
   max(updated_at) as last_at
  from accessible group by email
 ), ranked as (
  select email,name,phone,tickets_count,active_count,last_at
  from grouped
  where v_search='' or position(v_search in lower(
    coalesce(name,'')||' '||coalesce(email,'')||' '||coalesce(phone,'')))>0
  order by last_at desc,email asc
  limit p_limit+1 offset p_offset
 )
 select coalesce(jsonb_agg(to_jsonb(r) order by last_at desc,email asc),'[]'::jsonb)
  into v_rows from ranked r;
 v_more:=jsonb_array_length(v_rows)>p_limit;
 if v_more then v_rows:=v_rows-p_limit;end if;
 return jsonb_build_object('items',v_rows,'has_more',v_more,
  'next_offset',p_offset+jsonb_array_length(v_rows));
end;$$;
revoke all on function public.proxiti_clients_directory(text,integer,integer) from public,anon;
grant execute on function public.proxiti_clients_directory(text,integer,integer) to authenticated;

create or replace function public.proxiti_clients_contact_history(
 p_email text,p_limit integer default 25,p_before_reference bigint default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_rows jsonb;v_more boolean;
begin
 if (select auth.uid()) is null or not public.proxiti_can('tickets_view')
 then raise exception 'Histórico não autorizado';end if;
 if p_email is null or length(btrim(p_email)) not between 6 and 254
 or p_limit is null or p_limit not between 1 and 40
 or (p_before_reference is not null and p_before_reference<=0)
 then raise exception 'Parâmetros de histórico inválidos';end if;
 with allowed as (
  select t.id,t.reference,t.customer_name,t.subject,t.service_type,t.status,
    t.created_at,t.updated_at,
    case when d.ticket_id is not null then
      jsonb_build_object('category',d.category,'brand',d.brand,'model',d.model,
        'operating_system',d.operating_system)
    else null end as equipment
  from public.support_tickets t
  left join public.ticket_devices d on d.ticket_id=t.id
  where lower(btrim(t.customer_email))=lower(btrim(p_email))
   and (p_before_reference is null or t.reference<p_before_reference)
   and public.proxiti_ticket_access(t.id,false)
 ), page as (
  select * from allowed order by reference desc limit p_limit+1
 )
 select coalesce(jsonb_agg(to_jsonb(p) order by reference desc),'[]'::jsonb)
  into v_rows from page p;
 v_more:=jsonb_array_length(v_rows)>p_limit;
 if v_more then v_rows:=v_rows-p_limit;end if;
 return jsonb_build_object('items',v_rows,'has_more',v_more,
   'next_before_reference',case when jsonb_array_length(v_rows)>0
     then (v_rows->(jsonb_array_length(v_rows)-1)->>'reference')::bigint
     else null end);
end;$$;
revoke all on function public.proxiti_clients_contact_history(text,integer,bigint) from public,anon;
grant execute on function public.proxiti_clients_contact_history(text,integer,bigint) to authenticated;
