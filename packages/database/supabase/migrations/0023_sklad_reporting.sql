-- The warehouse list stops being assembled in the browser.
--
-- useSkladBatches fetched every batch the org had ever recorded, with a
-- four-level embed, and then applied all eleven filters in JavaScript. That is
-- the same mistake 0018/0019 fixed for the ledger, and it fails the same way:
-- fine at two hundred rows, unusable at fifty thousand. A single invoice in
-- this business runs to a hundred and sixty lines.
--
-- Deliberately SECURITY INVOKER — the default, and load-bearing here. These
-- functions read sklad_batch_prices, which is admin-only by virtue of having
-- no member SELECT policy at all (0011). Under invoker rights that protection
-- applies inside the function exactly as it does outside: staff get null price
-- columns without a single line of code deciding that. A SECURITY DEFINER
-- version of this file would hand every storekeeper the margin on every batch.
--
-- Re-runnable, same as 0014-0022.

-- ---------------------------------------------------------------------
-- One page of the warehouse, with the totals for the whole filtered set.
--
-- The totals ride along as window aggregates rather than coming from a second
-- function: window functions are evaluated before LIMIT, so `sum(...) over ()`
-- covers every matching batch while the rows returned are just this page. It
-- also keeps the filter predicate written once — the version of this that had
-- a separate totals function had the same fifteen-line WHERE clause twice, and
-- the two would have drifted the first time a filter was added.
-- ---------------------------------------------------------------------
create or replace function sklad_batch_page(
  target_org_id uuid,
  p_search text default null,
  p_product_type_id uuid default null,
  p_color_id uuid default null,
  p_pantone_id uuid default null,
  p_size_id uuid default null,
  p_sort_id uuid default null,
  p_gsm numeric default null,
  p_order_id uuid default null,
  p_counterparty_id uuid default null,
  -- text rather than the enum, for the reason given on record_sklad_movement.
  p_status text default null,
  p_from date default null,
  p_to date default null,
  p_in_stock_only boolean default false,
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  id uuid,
  item_id uuid,
  order_id uuid,
  artikul text,
  kod text,
  item_name text,
  product_type text,
  yarn_type text,
  size_name text,
  sort_name text,
  color_name text,
  pantone_code text,
  gsm numeric,
  brutto_kg numeric,
  netto_kg numeric,
  tara_kg numeric,
  piece_weight_kg numeric,
  dona_soni integer,
  nabor_soni integer,
  pallet_soni integer,
  qoldiq_dona integer,
  qoldiq_kg numeric,
  ishlab_chiqarilgan_sana date,
  omborga_kirgan_sana date,
  status sklad_batch_status,
  order_no text,
  order_name text,
  counterparty_name text,
  defect_type text,
  defect_qty integer,
  notes text,
  location_sector text,
  location_row text,
  location_rack text,
  location_shelf text,
  created_at timestamptz,
  price_per_kg numeric,
  price_per_piece numeric,
  price_per_set numeric,
  total_amount numeric,
  purchase_cost numeric,
  profit_percent numeric,
  profit_amount numeric,
  currency text,
  total_count bigint,
  sum_netto_kg numeric,
  sum_qoldiq_dona bigint,
  sum_qoldiq_kg numeric,
  sum_total_amount numeric,
  sum_currency text
)
language sql
stable
set search_path = public
as $$
  with filtered as (
    select
      b.*,
      i.artikul,
      i.kod,
      i.name as item_name,
      i.gsm,
      pt.name as product_type,
      yt.name as yarn_type,
      sz.name as size_name,
      st.name as sort_name,
      cl.name as color_name,
      pn.name as pantone_code,
      o.order_no,
      o.order_name,
      cp.name as counterparty_name,
      pr.price_per_kg,
      pr.price_per_piece,
      pr.price_per_set,
      pr.total_amount,
      pr.purchase_cost,
      pr.profit_percent,
      pr.profit_amount,
      pr.currency,
      -- Remaining weight is derived, never stored: netto_kg is the batch as it
      -- was weighed on arrival, and tara_kg / piece_weight_kg are generated
      -- from it (0011). A batch booked in kg with no piece count keeps its full
      -- weight until it is emptied.
      case
        when b.piece_weight_kg is not null
          then round(b.piece_weight_kg * coalesce(b.qoldiq_dona, 0), 3)
        when coalesce(b.qoldiq_dona, 0) > 0 then b.netto_kg
        else 0
      end as qoldiq_kg
    from sklad_batches b
    join sklad_items i on i.id = b.item_id
    left join sklad_lookups pt on pt.id = i.product_type_id
    left join sklad_lookups yt on yt.id = i.yarn_type_id
    left join sklad_lookups sz on sz.id = i.size_id
    left join sklad_lookups st on st.id = i.sort_id
    left join sklad_lookups cl on cl.id = i.color_id
    left join sklad_lookups pn on pn.id = i.pantone_id
    left join sklad_orders o on o.id = b.order_id
    left join counterparties cp on cp.id = o.counterparty_id
    left join sklad_batch_prices pr on pr.batch_id = b.id
    where b.org_id = target_org_id
      and (p_product_type_id is null or i.product_type_id = p_product_type_id)
      and (p_color_id is null or i.color_id = p_color_id)
      and (p_pantone_id is null or i.pantone_id = p_pantone_id)
      and (p_size_id is null or i.size_id = p_size_id)
      and (p_sort_id is null or i.sort_id = p_sort_id)
      and (p_gsm is null or i.gsm = p_gsm)
      and (p_order_id is null or b.order_id = p_order_id)
      and (p_counterparty_id is null or o.counterparty_id = p_counterparty_id)
      and (p_status is null or p_status = '' or b.status = p_status::sklad_batch_status)
      and (p_from is null or b.omborga_kirgan_sana >= p_from)
      and (p_to is null or b.omborga_kirgan_sana <= p_to)
      and (not coalesce(p_in_stock_only, false) or coalesce(b.qoldiq_dona, 0) > 0)
      and (
        p_search is null or p_search = '' or
        i.name ilike '%' || p_search || '%' or
        i.artikul ilike '%' || p_search || '%' or
        i.kod ilike '%' || p_search || '%' or
        o.order_no ilike '%' || p_search || '%' or
        o.order_name ilike '%' || p_search || '%'
      )
  )
  select
    f.id, f.item_id, f.order_id,
    f.artikul, f.kod, f.item_name,
    f.product_type, f.yarn_type, f.size_name, f.sort_name, f.color_name, f.pantone_code, f.gsm,
    f.brutto_kg, f.netto_kg, f.tara_kg, f.piece_weight_kg,
    f.dona_soni, f.nabor_soni, f.pallet_soni, f.qoldiq_dona, f.qoldiq_kg,
    f.ishlab_chiqarilgan_sana, f.omborga_kirgan_sana, f.status,
    f.order_no, f.order_name, f.counterparty_name,
    f.defect_type, f.defect_qty, f.notes,
    f.location_sector, f.location_row, f.location_rack, f.location_shelf,
    f.created_at,
    f.price_per_kg, f.price_per_piece, f.price_per_set, f.total_amount,
    f.purchase_cost, f.profit_percent, f.profit_amount, f.currency,
    count(*) over () as total_count,
    sum(f.netto_kg) over () as sum_netto_kg,
    sum(f.qoldiq_dona) over () as sum_qoldiq_dona,
    sum(f.qoldiq_kg) over () as sum_qoldiq_kg,
    -- Null for staff, because the price row itself was never visible to them.
    sum(f.total_amount) over () as sum_total_amount,
    -- Which currency that sum is in — and null when the filtered set mixes
    -- several, because adding dollars to so'm produces a number that means
    -- nothing. The caller shows the figure only when this says what it is.
    -- min/max rather than count(distinct): Postgres has no DISTINCT in a
    -- window function, and two aggregates agreeing is the same test. Rows with
    -- no price at all are ignored by both, which is right — they contribute
    -- nothing to the sum either.
    case
      when min(f.currency) over () = max(f.currency) over () then min(f.currency) over ()
    end as sum_currency
  from filtered f
  order by f.omborga_kirgan_sana desc, f.created_at desc
  limit least(coalesce(p_limit, 50), 500)
  offset greatest(coalesce(p_offset, 0), 0);
$$;


-- ---------------------------------------------------------------------
-- A batch's stock history.
--
-- SECURITY DEFINER only because it resolves the actor through auth.users /
-- profiles, which a member cannot read directly — hence the explicit
-- membership check, the same shape list_transaction_audit uses. The movements
-- themselves are member-readable either way.
-- ---------------------------------------------------------------------
create or replace function list_sklad_movements(p_batch_id uuid, p_limit integer default 100)
returns table (
  id uuid,
  kind sklad_movement_kind,
  dona integer,
  kg numeric,
  occurred_at date,
  counterparty_name text,
  order_no text,
  note text,
  is_initial boolean,
  created_by_name text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  select
    m.id, m.kind, m.dona, m.kg, m.occurred_at,
    cp.name, o.order_no, m.note, m.is_initial,
    coalesce(p.full_name, u.email),
    m.created_at
  from sklad_movements m
  left join counterparties cp on cp.id = m.counterparty_id
  left join sklad_orders o on o.id = m.order_id
  left join auth.users u on u.id = m.created_by
  left join profiles p on p.id = m.created_by
  where m.batch_id = p_batch_id
    and is_org_member(m.org_id)
  order by m.occurred_at desc, m.created_at desc
  limit least(coalesce(p_limit, 100), 500);
$$;


-- ---------------------------------------------------------------------
-- What is actually in the warehouse right now, by product.
--
-- The batch list answers "where did this lot go"; this answers the question a
-- manager asks first — how much of each product do we have. Invoker rights
-- again, so the value column is null for anyone who cannot see prices.
-- ---------------------------------------------------------------------
create or replace function sklad_stock_by_item(target_org_id uuid)
returns table (
  item_id uuid,
  artikul text,
  item_name text,
  product_type text,
  size_name text,
  color_name text,
  batch_count bigint,
  total_dona bigint,
  total_kg numeric,
  stock_value numeric
)
language sql
stable
set search_path = public
as $$
  select
    i.id,
    i.artikul,
    i.name,
    pt.name,
    sz.name,
    cl.name,
    count(b.id),
    coalesce(sum(b.qoldiq_dona), 0),
    coalesce(sum(
      case
        when b.piece_weight_kg is not null
          then round(b.piece_weight_kg * coalesce(b.qoldiq_dona, 0), 3)
        when coalesce(b.qoldiq_dona, 0) > 0 then b.netto_kg
        else 0
      end
    ), 0),
    sum(coalesce(pr.price_per_piece, 0) * coalesce(b.qoldiq_dona, 0))
  from sklad_items i
  join sklad_batches b on b.item_id = i.id and coalesce(b.qoldiq_dona, 0) > 0
  left join sklad_lookups pt on pt.id = i.product_type_id
  left join sklad_lookups sz on sz.id = i.size_id
  left join sklad_lookups cl on cl.id = i.color_id
  left join sklad_batch_prices pr on pr.batch_id = b.id
  where i.org_id = target_org_id
  group by i.id, i.artikul, i.name, pt.name, sz.name, cl.name
  order by 8 desc;
$$;
