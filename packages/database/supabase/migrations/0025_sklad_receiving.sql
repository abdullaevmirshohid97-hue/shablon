-- Typing a delivery in by hand, and reading the chain back out.
--
-- Two halves. The first is receiving: the storekeeper works from a paper
-- invoice of a hundred and sixty lines and wants to type it the way it is
-- written, one cell at a time, inventing a colour or a yarn count as they go.
-- Doing that from the browser meant a request per lookup, per product card and
-- per batch — hundreds of round trips, any of which could fail halfway and
-- leave half an invoice in the database. It is one call and one transaction
-- now: either the whole delivery lands or none of it does.
--
-- The second half is reporting: where an order stands, what each shop has put
-- through it, which client has had how much, and what is left.
--
-- Re-runnable, same as 0014-0024.


-- ---------------------------------------------------------------------
-- Find-or-create for a dropdown value.
--
-- Typing a new colour has to create it, which sklad_lookups' RLS reserves for
-- admins — and the person receiving goods at seven in the morning is not one.
-- Hence SECURITY DEFINER, called only from sklad_receive_rows below, which
-- checks membership before it gets here.
-- ---------------------------------------------------------------------
create or replace function sklad_lookup_id(target_org_id uuid, p_kind text, p_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := nullif(btrim(coalesce(p_name, '')), '');
  v_id uuid;
begin
  if v_name is null then
    return null;
  end if;

  -- Case-insensitive match, so "Oq" typed today does not become a second
  -- value beside the "oq" typed last week.
  select id into v_id
  from sklad_lookups
  where org_id = target_org_id and kind = p_kind and lower(name) = lower(v_name)
  limit 1;

  if v_id is not null then
    return v_id;
  end if;

  insert into sklad_lookups (org_id, kind, name)
  values (target_org_id, p_kind, v_name)
  on conflict (org_id, kind, name) do nothing
  returning id into v_id;

  if v_id is null then
    select id into v_id
    from sklad_lookups
    where org_id = target_org_id and kind = p_kind and name = v_name;
  end if;

  return v_id;
end;
$$;


-- ---------------------------------------------------------------------
-- One delivery, one transaction.
--
-- Each element of p_rows is an invoice line as typed. Every text field is
-- matched against the existing lookups and created when it is new, the product
-- card is found by artikul (or by its attributes when there is no artikul) and
-- created when it is new, and the batch is inserted — which in turn writes its
-- own receipt movement through 0022.
--
-- SECURITY DEFINER with an explicit membership check, because the point is to
-- let a storekeeper create reference values they would otherwise need an admin
-- for. That makes the price gate below the load-bearing line in this file:
-- prices are written only when the caller is an admin, checked here, because
-- definer rights mean RLS will not check it for us.
-- ---------------------------------------------------------------------
create or replace function sklad_receive_rows(
  target_org_id uuid,
  p_rows jsonb,
  p_order_id uuid default null,
  p_received_at date default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  r jsonb;
  v_is_admin boolean;
  v_received date := coalesce(p_received_at, current_date);
  v_item uuid;
  v_batch uuid;
  v_artikul text;
  v_name text;
  v_type uuid;
  v_yarn uuid;
  v_size uuid;
  v_sort uuid;
  v_color uuid;
  v_pantone uuid;
  v_gsm numeric;
  v_count integer := 0;
begin
  if not is_org_member(target_org_id) then
    raise exception 'Ruxsat yo''q';
  end if;

  v_is_admin := is_org_admin(target_org_id);

  if p_order_id is not null and not exists (
    select 1 from sklad_orders where id = p_order_id and org_id = target_org_id
  ) then
    raise exception 'Buyurtma topilmadi';
  end if;

  for r in select * from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb))
  loop
    v_artikul := nullif(btrim(coalesce(r ->> 'artikul', '')), '');
    v_name := nullif(btrim(coalesce(r ->> 'name', '')), '');
    v_gsm := nullif(r ->> 'gsm', '')::numeric;

    v_type := sklad_lookup_id(target_org_id, 'mahsulot_turi', r ->> 'productType');
    v_yarn := sklad_lookup_id(target_org_id, 'ip_turi', r ->> 'yarnType');
    v_size := sklad_lookup_id(target_org_id, 'olcham', r ->> 'size');
    v_sort := sklad_lookup_id(target_org_id, 'sort', r ->> 'sort');
    v_color := sklad_lookup_id(target_org_id, 'rang', r ->> 'color');
    v_pantone := sklad_lookup_id(target_org_id, 'pantone', r ->> 'pantone');

    -- A row with nothing on it is a blank line in the grid, not an error.
    if v_name is null and v_artikul is null and v_type is null then
      continue;
    end if;

    -- The product name is what the client sees; when the storekeeper leaves it
    -- empty, the type and size they did type describe the goods well enough to
    -- be going on with.
    if v_name is null then
      v_name := btrim(
        coalesce((select name from sklad_lookups where id = v_type), '') || ' ' ||
        coalesce((select name from sklad_lookups where id = v_size), '')
      );
      if v_name = '' then v_name := coalesce(v_artikul, '—'); end if;
    end if;

    v_item := null;

    if v_artikul is not null then
      select id into v_item
      from sklad_items where org_id = target_org_id and artikul = v_artikul;
    else
      -- No artikul: a card is the same card when everything that describes the
      -- cloth matches. `is not distinct from` rather than `=` so that two rows
      -- both leaving colour blank still find each other.
      select id into v_item
      from sklad_items
      where org_id = target_org_id
        and lower(name) = lower(v_name)
        and product_type_id is not distinct from v_type
        and size_id is not distinct from v_size
        and color_id is not distinct from v_color
        and sort_id is not distinct from v_sort
        and gsm is not distinct from v_gsm
      limit 1;
    end if;

    if v_item is null then
      insert into sklad_items (
        org_id, artikul, kod, name, product_type_id, yarn_type_id, gsm,
        size_id, sort_id, color_id, pantone_id
      )
      values (
        target_org_id, v_artikul, nullif(btrim(coalesce(r ->> 'kod', '')), ''), v_name,
        v_type, v_yarn, v_gsm, v_size, v_sort, v_color, v_pantone
      )
      returning id into v_item;
    end if;

    insert into sklad_batches (
      org_id, item_id, order_id, brutto_kg, netto_kg, dona_soni, nabor_soni,
      pallet_soni, omborga_kirgan_sana, ishlab_chiqarilgan_sana, notes
    )
    values (
      target_org_id, v_item, p_order_id,
      nullif(r ->> 'brutto', '')::numeric,
      nullif(r ->> 'netto', '')::numeric,
      nullif(r ->> 'dona', '')::integer,
      nullif(r ->> 'nabor', '')::integer,
      nullif(r ->> 'pallet', '')::integer,
      v_received,
      nullif(r ->> 'producedAt', '')::date,
      nullif(btrim(coalesce(r ->> 'notes', '')), '')
    )
    returning id into v_batch;

    -- The gate. Definer rights bypass the RLS that normally makes
    -- sklad_batch_prices invisible to staff, so it is checked by hand.
    if v_is_admin and (
      r ? 'pricePerKg' or r ? 'pricePerPiece' or r ? 'pricePerSet' or r ? 'totalAmount'
    ) then
      insert into sklad_batch_prices (
        batch_id, org_id, price_per_kg, price_per_piece, price_per_set,
        total_amount, purchase_cost, profit_percent, profit_amount, currency
      )
      values (
        v_batch, target_org_id,
        nullif(r ->> 'pricePerKg', '')::numeric,
        nullif(r ->> 'pricePerPiece', '')::numeric,
        nullif(r ->> 'pricePerSet', '')::numeric,
        nullif(r ->> 'totalAmount', '')::numeric,
        nullif(r ->> 'purchaseCost', '')::numeric,
        nullif(r ->> 'profitPercent', '')::numeric,
        nullif(r ->> 'profitAmount', '')::numeric,
        coalesce(nullif(r ->> 'currency', ''), 'UZS')
      );
    end if;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;


-- ---------------------------------------------------------------------
-- Where each row of an order stands.
--
-- Ready is what the final stage has put out; shipped is what has left the
-- building; remaining is what the client is still owed. Invoker rights — these
-- read nothing a member cannot already read.
-- ---------------------------------------------------------------------
create or replace function sklad_order_progress(p_order_id uuid)
returns table (
  line_id uuid,
  line_position integer,
  description text,
  item_name text,
  artikul text,
  size_text text,
  color_text text,
  planned_dona integer,
  planned_kg numeric,
  ready_dona bigint,
  defect_dona bigint,
  shipped_dona bigint,
  shipped_kg numeric,
  remaining_dona integer
)
language sql
stable
set search_path = public
as $$
  select
    l.id,
    l.position,
    l.description,
    i.name,
    i.artikul,
    coalesce(l.size_text, sz.name),
    coalesce(l.color_text, cl.name),
    l.planned_dona,
    l.planned_kg,
    coalesce(ready.qty, 0),
    coalesce(defects.qty, 0),
    coalesce(shipped.dona, 0),
    coalesce(shipped.kg, 0),
    greatest(coalesce(l.planned_dona, 0) - coalesce(shipped.dona, 0), 0)::integer
  from sklad_order_lines l
  left join sklad_items i on i.id = l.item_id
  left join sklad_lookups sz on sz.id = i.size_id
  left join sklad_lookups cl on cl.id = i.color_id
  left join lateral (
    select sum(e.qty_out) as qty
    from sklad_stage_entries e
    join sklad_stages s on s.id = e.stage_id and s.is_final
    where e.order_line_id = l.id
  ) ready on true
  left join lateral (
    select sum(e.defect_qty) as qty
    from sklad_stage_entries e
    where e.order_line_id = l.id
  ) defects on true
  left join lateral (
    select sum(sl.dona) as dona, sum(sl.kg) as kg
    from sklad_shipment_lines sl
    where sl.order_line_id = l.id
  ) shipped on true
  where l.order_id = p_order_id
  order by l.position, l.created_at;
$$;


-- ---------------------------------------------------------------------
-- The grid itself: every row of the order against every shop, whether that
-- shop has touched it yet or not. A cross join, because an empty cell is the
-- most important thing on this screen — it is the work not yet done.
-- ---------------------------------------------------------------------
create or replace function sklad_order_stage_matrix(p_order_id uuid)
returns table (
  line_id uuid,
  stage_id uuid,
  stage_name text,
  stage_position integer,
  is_final boolean,
  qty_in bigint,
  qty_out bigint,
  defect_qty bigint,
  kg numeric,
  entry_count bigint,
  last_occurred_at date
)
language sql
stable
set search_path = public
as $$
  select
    l.id,
    s.id,
    s.name,
    s.position,
    s.is_final,
    sum(e.qty_in),
    sum(e.qty_out),
    sum(e.defect_qty),
    sum(e.kg),
    count(e.id),
    max(e.occurred_at)
  from sklad_order_lines l
  join sklad_stages s on s.org_id = l.org_id
  left join sklad_stage_entries e on e.order_line_id = l.id and e.stage_id = s.id
  where l.order_id = p_order_id
  group by l.id, s.id, s.name, s.position, s.is_final
  order by s.position;
$$;


-- ---------------------------------------------------------------------
-- Which client got how much of this order — the loading-bay question.
-- ---------------------------------------------------------------------
create or replace function sklad_order_clients(p_order_id uuid)
returns table (
  counterparty_id uuid,
  counterparty_name text,
  shipment_count bigint,
  shipped_dona bigint,
  shipped_kg numeric,
  last_shipped_at date
)
language sql
stable
set search_path = public
as $$
  select
    c.id,
    coalesce(c.name, '—'),
    count(distinct sh.id),
    coalesce(sum(sl.dona), 0),
    coalesce(sum(sl.kg), 0),
    max(sh.shipped_at)
  from sklad_shipments sh
  join sklad_shipment_lines sl on sl.shipment_id = sh.id
  left join counterparties c on c.id = sh.counterparty_id
  where sh.order_id = p_order_id
  group by c.id, c.name
  order by 4 desc;
$$;


-- ---------------------------------------------------------------------
-- The order list behind the analytics screen.
--
-- SECURITY DEFINER only to resolve the manager through auth.users / profiles,
-- so membership is checked here by hand, as everywhere else that does this.
-- ---------------------------------------------------------------------
create or replace function sklad_order_summary(
  target_org_id uuid,
  p_status text default null,
  p_counterparty_id uuid default null,
  p_manager_id uuid default null,
  p_limit integer default 100
)
returns table (
  order_id uuid,
  order_no text,
  order_name text,
  status sklad_order_status,
  deadline date,
  counterparty_id uuid,
  counterparty_name text,
  manager_name text,
  line_count bigint,
  planned_dona bigint,
  ready_dona bigint,
  shipped_dona bigint,
  remaining_dona bigint,
  current_stage text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  select
    o.id,
    o.order_no,
    o.order_name,
    o.status,
    o.deadline,
    o.counterparty_id,
    c.name,
    coalesce(p.full_name, u.email),
    coalesce(agg.line_count, 0),
    coalesce(agg.planned_dona, 0),
    coalesce(ready.qty, 0),
    coalesce(shipped.dona, 0),
    greatest(coalesce(agg.planned_dona, 0) - coalesce(shipped.dona, 0), 0),
    stage.name,
    o.created_at
  from sklad_orders o
  left join counterparties c on c.id = o.counterparty_id
  left join auth.users u on u.id = o.manager_id
  left join profiles p on p.id = o.manager_id
  left join lateral (
    select count(*) as line_count, sum(l.planned_dona) as planned_dona
    from sklad_order_lines l where l.order_id = o.id
  ) agg on true
  left join lateral (
    select sum(e.qty_out) as qty
    from sklad_stage_entries e
    join sklad_order_lines l on l.id = e.order_line_id and l.order_id = o.id
    join sklad_stages s on s.id = e.stage_id and s.is_final
  ) ready on true
  left join lateral (
    select sum(sl.dona) as dona
    from sklad_shipment_lines sl
    join sklad_shipments sh on sh.id = sl.shipment_id and sh.order_id = o.id
  ) shipped on true
  -- The furthest shop that has reported anything: as close to "where is it" as
  -- a single word gets.
  left join lateral (
    select s.name
    from sklad_stage_entries e
    join sklad_order_lines l on l.id = e.order_line_id and l.order_id = o.id
    join sklad_stages s on s.id = e.stage_id
    where coalesce(e.qty_out, 0) > 0
    order by s.position desc
    limit 1
  ) stage on true
  where o.org_id = target_org_id
    and is_org_member(target_org_id)
    and (p_status is null or p_status = '' or o.status = p_status::sklad_order_status)
    and (p_counterparty_id is null or o.counterparty_id = p_counterparty_id)
    and (p_manager_id is null or o.manager_id = p_manager_id)
  order by o.created_at desc
  limit least(coalesce(p_limit, 100), 500);
$$;


-- ---------------------------------------------------------------------
-- Throughput per shop, for the analytics screen: how much each stage put out
-- in a window, and how much of it came back as defect.
-- ---------------------------------------------------------------------
create or replace function sklad_stage_load(
  target_org_id uuid,
  p_from date default null,
  p_to date default null
)
returns table (
  stage_id uuid,
  stage_name text,
  stage_position integer,
  entry_count bigint,
  qty_out bigint,
  defect_qty bigint,
  kg numeric
)
language sql
stable
set search_path = public
as $$
  select
    s.id,
    s.name,
    s.position,
    count(e.id),
    coalesce(sum(e.qty_out), 0),
    coalesce(sum(e.defect_qty), 0),
    coalesce(sum(e.kg), 0)
  from sklad_stages s
  left join sklad_stage_entries e
    on e.stage_id = s.id
   and (p_from is null or e.occurred_at >= p_from)
   and (p_to is null or e.occurred_at <= p_to)
  where s.org_id = target_org_id
  group by s.id, s.name, s.position
  order by s.position;
$$;


-- ---------------------------------------------------------------------
-- One stage's entries for one row, with the actor resolved. Definer for the
-- name lookup, membership checked explicitly.
-- ---------------------------------------------------------------------
create or replace function list_sklad_stage_entries(p_order_line_id uuid, p_stage_id uuid)
returns table (
  id uuid,
  qty_in integer,
  qty_out integer,
  defect_qty integer,
  kg numeric,
  executor_name text,
  occurred_at date,
  note text,
  created_by_name text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  select
    e.id, e.qty_in, e.qty_out, e.defect_qty, e.kg,
    coalesce(e.executor_name, ep.full_name, eu.email),
    e.occurred_at, e.note,
    coalesce(p.full_name, u.email),
    e.created_at
  from sklad_stage_entries e
  left join auth.users eu on eu.id = e.executor_id
  left join profiles ep on ep.id = e.executor_id
  left join auth.users u on u.id = e.created_by
  left join profiles p on p.id = e.created_by
  where e.order_line_id = p_order_line_id
    and e.stage_id = p_stage_id
    and is_org_member(e.org_id)
  order by e.occurred_at desc, e.created_at desc;
$$;
