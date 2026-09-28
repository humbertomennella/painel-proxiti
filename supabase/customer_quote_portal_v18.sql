-- PROXITI V18 | Resposta direta do cliente ao orçamento pelo acesso privado do chamado.
-- Aditiva; não altera orçamento emitido, preço, cliente, recebimento ou repasse.
-- O acesso público nunca recebe SELECT nas tabelas comerciais.
create or replace function public.proxiti_customer_quote_list(
 p_ticket uuid,p_access_hash text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_list jsonb;
begin
 if coalesce((select auth.role()),'') <> 'service_role' then
  raise exception 'Acesso restrito ao serviço';end if;
 if p_access_hash is null or p_access_hash !~ '^[a-f0-9]{64}$'
    or not exists(select 1 from public.support_tickets t
      where t.id=p_ticket and t.access_hash=p_access_hash) then
  raise exception 'Acesso ao chamado não confirmado';end if;
 select coalesce(jsonb_agg(jsonb_build_object(
  'id',q.id,'reference',q.reference,'status',q.status,
  'valid_until',q.valid_until,'issued_at',q.issued_at,
  'accepted_at',q.accepted_at,'parent_reference',
    (select p.reference from public.commercial_quotes p where p.id=q.parent_quote_id),
  'client_notes',q.client_notes,
  'total_cents',(select coalesce(sum(i.quantity::bigint*i.unit_price_cents),0)
     from public.commercial_quote_items i where i.quote_id=q.id),
  'items',(select coalesce(jsonb_agg(jsonb_build_object(
     'title',i.title_snapshot,'scope',i.scope_snapshot,'unit',i.unit_snapshot,
     'quantity',i.quantity,'unit_price_cents',i.unit_price_cents,
     'subtotal_cents',i.quantity::bigint*i.unit_price_cents
   ) order by i.position),'[]'::jsonb)
     from public.commercial_quote_items i where i.quote_id=q.id)
  ) order by q.issued_at desc,q.reference desc),'[]'::jsonb)
 into v_list from public.commercial_quotes q
 where q.ticket_id=p_ticket and q.issued_at is not null
   and q.status in ('issued','accepted','declined','cancelled');
 return v_list;
end;$$;
revoke all on function public.proxiti_customer_quote_list(uuid,text)
 from public,anon,authenticated;
grant execute on function public.proxiti_customer_quote_list(uuid,text) to service_role;

create or replace function public.proxiti_customer_quote_decide(
 p_ticket uuid,p_access_hash text,p_quote uuid,p_decision text,p_confirm boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare q public.commercial_quotes%rowtype;v_count integer;v_total bigint;
 v_action text;v_at timestamptz;v_reference text;v_ticket_ref bigint;v_ticket_status text;
begin
 if coalesce((select auth.role()),'') <> 'service_role' then
  raise exception 'Acesso restrito ao serviço';end if;
 if p_access_hash is null or p_access_hash !~ '^[a-f0-9]{64}$'
   or not exists(select 1 from public.support_tickets t
      where t.id=p_ticket and t.access_hash=p_access_hash) then
  raise exception 'Acesso ao chamado não confirmado';end if;
 if p_decision is null or p_decision not in ('accepted','declined') or p_confirm is distinct from true then
  raise exception 'A confirmação explícita é obrigatória';end if;
 select * into q from public.commercial_quotes
  where id=p_quote and ticket_id=p_ticket and issued_at is not null for update;
 if q.id is null then raise exception 'Proposta não encontrada';end if;
 v_action=case when p_decision='accepted' then 'customer_accepted'
  else 'customer_declined' end;
 if q.status in ('accepted','declined') then
  if q.status=p_decision and exists(
    select 1 from public.commercial_quote_events e
     where e.quote_id=p_quote and e.action=v_action)
  then return jsonb_build_object('status',q.status,'reference',q.reference,
    'already_recorded',true);
  end if;
  raise exception 'Esta proposta já foi respondida';end if;
 if q.status<>'issued' then raise exception 'Proposta indisponível para resposta';end if;
 if q.valid_until<current_date then raise exception 'Validade encerrada. Solicite uma nova proposta';end if;
 select count(*),coalesce(sum(quantity::bigint*unit_price_cents),0)
 into v_count,v_total from public.commercial_quote_items where quote_id=p_quote;
 if v_count=0 or v_total<=0 then raise exception 'Proposta sem itens válidos';end if;
 select reference,status into v_ticket_ref,v_ticket_status from public.support_tickets
  where id=p_ticket and access_hash=p_access_hash;
 if v_ticket_status='closed' then raise exception 'Chamado encerrado';end if;
 v_at=now();
 v_reference='Decisão pelo portal privado do chamado #'||v_ticket_ref||
  '; confirmação operacional pelo titular do acesso.';
 update public.commercial_quotes set status=p_decision,updated_at=v_at,
  accepted_at=case when p_decision='accepted' then v_at else null end,
  confirmation_channel='other',confirmation_reference=v_reference
 where id=p_quote;
 insert into public.commercial_quote_events(quote_id,actor_id,action,detail,created_at)
 values(p_quote,null,v_action,
  jsonb_build_object('channel','customer_portal',
    'reference','Decisão pelo acesso privado do chamado','result',p_decision),v_at);
 return jsonb_build_object('status',p_decision,'reference',q.reference,
  'already_recorded',false,'decided_at',v_at);
end;$$;
revoke all on function public.proxiti_customer_quote_decide(uuid,text,uuid,text,boolean)
 from public,anon,authenticated;
grant execute on function public.proxiti_customer_quote_decide(uuid,text,uuid,text,boolean)
 to service_role;
