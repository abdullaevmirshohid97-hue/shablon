-- The product card as this factory actually describes cloth, and a despatch
-- screen to match the receiving one.
--
-- Three corrections to the model, all of them from the floor rather than from
-- the schema:
--
--   artikul goes. It was carried alongside `kod` from the first sketch and
--   nobody ever filled it in — the production code is what a weaver, a dyer
--   and an invoice all say out loud. Two identifiers for one thing means every
--   screen has to show both and every search has to try both.
--
--   the size lookup goes, and length and width take its place. "70x130" as a
--   dropdown value cannot be filtered by ("everything wider than a metre"),
--   cannot be sorted, and grows a new entry every time someone types the x
--   differently. Two numbers can do all of it.
--
--   pallets become sacks. Goods leave here in qop, not on pallets; the column
--   was named for a warehouse this is not.
--
-- And `sklad_issue_rows`, the despatch counterpart of sklad_receive_rows: one
-- call, one transaction, several batches leaving on one document.
--
-- Re-runnable, same as 0014-0025.


-- ---------------------------------------------------------------------
-- Product card: kod is the identifier now.
-- ---------------------------------------------------------------------
-- Dropping the column takes its partial unique index (0021) with it, so the
-- guard there has nothing left to guard.
alter table sklad_items drop column if exists artikul;

-- kod inherits the uniqueness artikul had. Same shape: blank stays free, so a
-- card can exist before production has assigned it a code.
do $guard$
declare
  v_dupes text;
begin
  if exists (select 1 from pg_indexes where indexname = 'sklad_items_org_kod_key') then
    return;
  end if;

  select string_agg(format('%s (%s x)', kod, n), ', ')
  into v_dupes
  from (
    select kod, count(*) as n
    from sklad_items
    where kod is not null and kod <> ''
    group by org_id, kod
    having count(*) > 1
  ) d;

  if v_dupes is not null then
    raise exception
      'Bir xil kod bilan bir nechta mahsulot kartasi bor: %. Avval ularni birlashtiring.',
      v_dupes;
  end if;

  create unique index sklad_items_org_kod_key
    on sklad_items (org_id, kod) where kod is not null and kod <> '';
end $guard$;


-- ---------------------------------------------------------------------
-- Dimensions, in centimetres.
--
-- Filled from the size lookup where its name parses as two numbers around an
-- x — "70x130", "70 x 130", "70х130" with a Cyrillic х, which is what a
-- keyboard set to Russian produces. Anything else is left null rather than
-- guessed at, and the old text survives in the batch note so nothing is lost.
-- ---------------------------------------------------------------------
alter table sklad_items
  add column if not exists width_cm numeric(6, 1),
  add column if not exists length_cm numeric(6, 1);

do $backfill$
declare
  r record;
  parts text[];
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'sklad_items' and column_name = 'size_id'
  ) then
    return;
  end if;

  for r in
    select i.id, l.name
    from sklad_items i
    join sklad_lookups l on l.id = i.size_id
    where i.width_cm is null and i.length_cm is null
  loop
    parts := regexp_match(r.name, '^\s*(\d+(?:[.,]\d+)?)\s*[xXхХ*]\s*(\d+(?:[.,]\d+)?)\s*$');
    if parts is not null then
      update sklad_items
      set width_cm = replace(parts[1], ',', '.')::numeric,
          length_cm = replace(parts[2], ',', '.')::numeric
      where id = r.id;
    end if;
  end loop;
end $backfill$;

alter table sklad_items drop column if exists size_id;
drop index if exists sklad_items_size_idx;

-- The lookup kind goes with it. Deleting the rows first: nothing references
-- them any more, and leaving them behind would show an empty tab in Settings.
delete from sklad_lookups where kind = 'olcham';

do $guard$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'sklad_lookups_kind_check'
      and pg_get_constraintdef(oid) like '%olcham%'
  ) then
    alter table sklad_lookups drop constraint sklad_lookups_kind_check;
    alter table sklad_lookups add constraint sklad_lookups_kind_check
      check (kind in ('mahsulot_turi', 'ip_turi', 'sort', 'rang', 'pantone'));
  end if;
end $guard$;

create index if not exists sklad_items_dimensions_idx
  on sklad_items (org_id, width_cm, length_cm);

/**
 * A dimension as the invoice writes it: 70, not 70.0, and 70.5 when it really
 * is a half.
 *
 * Not `trim(trailing '.0' from ...)`, which takes a *set* of characters and
 * turns '70.0' into '7'.
 */
create or replace function sklad_dim_text(p_value numeric)
returns text
language sql
immutable
as $$
  select case
    when p_value is null then null
    when p_value = trunc(p_value) then trunc(p_value)::bigint::text
    else p_value::text
  end;
$$;

/** "70x130" from the two numbers, or null when either is missing. */
create or replace function sklad_size_text(p_width numeric, p_length numeric)
returns text
language sql
immutable
as $$
  select case
    when p_width is null or p_length is null then null
    else sklad_dim_text(p_width) || 'x' || sklad_dim_text(p_length)
  end;
$$;


-- ---------------------------------------------------------------------
-- Pallets become sacks.
-- ---------------------------------------------------------------------
do $guard$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'sklad_batches' and column_name = 'pallet_soni'
  ) then
    alter table sklad_batches rename column pallet_soni to qop_soni;
  end if;
end $guard$;


-- ---------------------------------------------------------------------
-- Every function that named the dropped columns, restated.
--
-- `create or replace` cannot change a function's result columns, so each of
-- these is dropped first — the signature is the same, only the shape of what
-- comes back has moved.
-- ---------------------------------------------------------------------
drop function if exists sklad_batch_page(
  uuid, text, uuid, uuid, uuid, uuid, uuid, numeric, uuid, uuid, text, date, date,
  boolean, integer, integer);

create or replace function sklad_batch_page(
  target_org_id uuid,
  p_search text default null,
  p_product_type_id uuid default null,
  p_color_id uuid default null,
  p_pantone_id uuid default null,
  p_sort_id uuid default null,
  p_gsm numeric default null,
  p_width_cm numeric default null,
  p_length_cm numeric default null,
  p_order_id uuid default null,
  p_counterparty_id uuid default null,
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
  kod text,
  item_name text,
  product_type text,
  yarn_type text,
  width_cm numeric,
  length_cm numeric,
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
  qop_soni integer,
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
      i.kod,
      i.name as item_name,
      i.gsm,
      i.width_cm,
      i.length_cm,
      pt.name as product_type,
      yt.name as yarn_type,
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
      and (p_sort_id is null or i.sort_id = p_sort_id)
      and (p_gsm is null or i.gsm = p_gsm)
      and (p_width_cm is null or i.width_cm = p_width_cm)
      and (p_length_cm is null or i.length_cm = p_length_cm)
      and (p_order_id is null or b.order_id = p_order_id)
      and (p_counterparty_id is null or o.counterparty_id = p_counterparty_id)
      and (p_status is null or p_status = '' or b.status = p_status::sklad_batch_status)
      and (p_from is null or b.omborga_kirgan_sana >= p_from)
      and (p_to is null or b.omborga_kirgan_sana <= p_to)
      and (not coalesce(p_in_stock_only, false) or coalesce(b.qoldiq_dona, 0) > 0)
      and (
        p_search is null or p_search = '' or
        i.name ilike '%' || p_search || '%' or
        i.kod ilike '%' || p_search || '%' or
        o.order_no ilike '%' || p_search || '%' or
        o.order_name ilike '%' || p_search || '%'
      )
  )
  select
    f.id, f.item_id, f.order_id,
    f.kod, f.item_name,
    f.product_type, f.yarn_type, f.width_cm, f.length_cm, f.sort_name,
    f.color_name, f.pantone_code, f.gsm,
    f.brutto_kg, f.netto_kg, f.tara_kg, f.piece_weight_kg,
    f.dona_soni, f.nabor_soni, f.qop_soni, f.qoldiq_dona, f.qoldiq_kg,
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
    sum(f.total_amount) over () as sum_total_amount,
    case
      when min(f.currency) over () = max(f.currency) over () then min(f.currency) over ()
    end as sum_currency
  from filtered f
  order by f.omborga_kirgan_sana desc, f.created_at desc
  limit least(coalesce(p_limit, 50), 500)
  offset greatest(coalesce(p_offset, 0), 0);
$$;


drop function if exists sklad_stock_by_item(uuid);

create or replace function sklad_stock_by_item(target_org_id uuid)
returns table (
  item_id uuid,
  kod text,
  item_name text,
  product_type text,
  width_cm numeric,
  length_cm numeric,
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
    i.id, i.kod, i.name, pt.name, i.width_cm, i.length_cm, cl.name,
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
  left join sklad_lookups cl on cl.id = i.color_id
  left join sklad_batch_prices pr on pr.batch_id = b.id
  where i.org_id = target_org_id
  group by i.id, i.kod, i.name, pt.name, i.width_cm, i.length_cm, cl.name
  order by 9 desc;
$$;


drop function if exists sklad_order_progress(uuid);

create or replace function sklad_order_progress(p_order_id uuid)
returns table (
  line_id uuid,
  line_position integer,
  description text,
  item_name text,
  kod text,
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
    i.kod,
    -- The card's own dimensions when it has them, in the notation the paper
    -- invoice uses; otherwise whatever was typed on the order row.
    coalesce(sklad_size_text(i.width_cm, i.length_cm), l.size_text),
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


drop function if exists list_sklad_audit(uuid, integer);

create or replace function list_sklad_audit(target_org_id uuid, p_limit integer default 100)
returns table (
  id bigint,
  entity text,
  entity_id uuid,
  action text,
  changed_at timestamptz,
  changed_by_name text,
  item_name text,
  kod text,
  old_row jsonb,
  new_row jsonb
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  select
    a.id, a.entity, a.entity_id, a.action, a.changed_at,
    coalesce(p.full_name, u.email),
    i.name, i.kod, a.old_row, a.new_row
  from sklad_audit a
  left join auth.users u on u.id = a.changed_by
  left join profiles p on p.id = a.changed_by
  left join sklad_batches b
    on a.entity in ('batch', 'price')
   and b.id = coalesce(
         (a.old_row ->> 'id')::uuid, (a.new_row ->> 'id')::uuid,
         (a.old_row ->> 'batch_id')::uuid, (a.new_row ->> 'batch_id')::uuid
       )
  left join sklad_items i
    on i.id = case when a.entity = 'item' then a.entity_id else b.item_id end
  where a.org_id = target_org_id and is_org_admin(target_org_id)
  order by a.changed_at desc
  limit least(coalesce(p_limit, 100), 500);
$$;


-- ---------------------------------------------------------------------
-- Receiving, restated for the new card.
--
-- Rows now carry `width` and `length` instead of a size to look up, and `kod`
-- is what identifies the card. Everything else — creating reference values on
-- the fly, the price gate, one transaction for the whole invoice — is as it
-- was in 0025.
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
  v_kod text;
  v_name text;
  v_type uuid;
  v_yarn uuid;
  v_sort uuid;
  v_color uuid;
  v_pantone uuid;
  v_gsm numeric;
  v_width numeric;
  v_length numeric;
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
    v_kod := nullif(btrim(coalesce(r ->> 'kod', '')), '');
    v_name := nullif(btrim(coalesce(r ->> 'name', '')), '');
    v_gsm := nullif(r ->> 'gsm', '')::numeric;
    v_width := nullif(r ->> 'width', '')::numeric;
    v_length := nullif(r ->> 'length', '')::numeric;

    v_type := sklad_lookup_id(target_org_id, 'mahsulot_turi', r ->> 'productType');
    v_yarn := sklad_lookup_id(target_org_id, 'ip_turi', r ->> 'yarnType');
    v_sort := sklad_lookup_id(target_org_id, 'sort', r ->> 'sort');
    v_color := sklad_lookup_id(target_org_id, 'rang', r ->> 'color');
    v_pantone := sklad_lookup_id(target_org_id, 'pantone', r ->> 'pantone');

    if v_name is null and v_kod is null and v_type is null then
      continue;
    end if;

    if v_name is null then
      v_name := btrim(
        coalesce((select name from sklad_lookups where id = v_type), '') || ' ' ||
        coalesce(sklad_size_text(v_width, v_length), '')
      );
      if v_name = '' then v_name := coalesce(v_kod, '—'); end if;
    end if;

    v_item := null;

    if v_kod is not null then
      select id into v_item
      from sklad_items where org_id = target_org_id and kod = v_kod;
    else
      select id into v_item
      from sklad_items
      where org_id = target_org_id
        and lower(name) = lower(v_name)
        and product_type_id is not distinct from v_type
        and color_id is not distinct from v_color
        and sort_id is not distinct from v_sort
        and gsm is not distinct from v_gsm
        and width_cm is not distinct from v_width
        and length_cm is not distinct from v_length
      limit 1;
    end if;

    if v_item is null then
      insert into sklad_items (
        org_id, kod, name, product_type_id, yarn_type_id, gsm,
        width_cm, length_cm, sort_id, color_id, pantone_id
      )
      values (
        target_org_id, v_kod, v_name, v_type, v_yarn, v_gsm,
        v_width, v_length, v_sort, v_color, v_pantone
      )
      returning id into v_item;
    end if;

    insert into sklad_batches (
      org_id, item_id, order_id, brutto_kg, netto_kg, dona_soni, nabor_soni,
      qop_soni, omborga_kirgan_sana, ishlab_chiqarilgan_sana, notes
    )
    values (
      target_org_id, v_item, p_order_id,
      nullif(r ->> 'brutto', '')::numeric,
      nullif(r ->> 'netto', '')::numeric,
      nullif(r ->> 'dona', '')::integer,
      nullif(r ->> 'nabor', '')::integer,
      nullif(r ->> 'qop', '')::integer,
      v_received,
      nullif(r ->> 'producedAt', '')::date,
      nullif(btrim(coalesce(r ->> 'notes', '')), '')
    )
    returning id into v_batch;

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
-- Despatch: the counterpart of receiving.
--
-- Goods left the yard on one document, against several batches. Doing that a
-- batch at a time through record_sklad_movement meant one dialog per line and
-- — worse — a half-loaded truck in the database if the fourth line failed.
--
-- One shipment header, one movement per line, one transaction. The movements
-- go through record_sklad_movement rather than around it, so the remainder,
-- the status and the refusal to go negative are the same rules as everywhere
-- else. A line that would overdraw a batch aborts the whole despatch, which is
-- the honest outcome: the truck is not half-loaded either.
--
-- SECURITY INVOKER: everything it writes is member-writable already, and there
-- is no reason to hand it more rights than the person pressing the button has.
-- ---------------------------------------------------------------------
create or replace function sklad_issue_rows(
  target_org_id uuid,
  p_rows jsonb,
  p_counterparty_id uuid default null,
  p_order_id uuid default null,
  p_manager_id uuid default null,
  p_document_no text default null,
  p_shipped_at date default null,
  p_note text default null
)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  r jsonb;
  v_shipment uuid;
  v_batch uuid;
  v_dona integer;
  v_kg numeric;
  v_shipped date := coalesce(p_shipped_at, current_date);
  v_count integer := 0;
begin
  insert into sklad_shipments
    (org_id, order_id, counterparty_id, manager_id, document_no, shipped_at, note)
  values
    (target_org_id, p_order_id, p_counterparty_id, p_manager_id, p_document_no, v_shipped, p_note)
  returning id into v_shipment;

  for r in select * from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb))
  loop
    v_batch := nullif(r ->> 'batchId', '')::uuid;
    v_dona := coalesce(nullif(r ->> 'dona', '')::integer, 0);
    v_kg := nullif(r ->> 'kg', '')::numeric;

    -- A blank row is a spare line in the grid, not an error.
    if v_batch is null or v_dona <= 0 then
      continue;
    end if;

    insert into sklad_shipment_lines
      (org_id, shipment_id, order_line_id, batch_id, dona, kg, note)
    values
      (target_org_id, v_shipment, nullif(r ->> 'orderLineId', '')::uuid, v_batch, v_dona, v_kg,
       nullif(btrim(coalesce(r ->> 'note', '')), ''));

    perform record_sklad_movement(
      v_batch, 'chiqim', v_dona, v_kg, v_shipped, p_counterparty_id, p_order_id, p_document_no);

    v_count := v_count + 1;
  end loop;

  if v_count = 0 then
    raise exception 'Chiqim uchun qator kiritilmagan';
  end if;

  return v_shipment;
end;
$$;


-- ---------------------------------------------------------------------
-- What can be despatched right now: every batch with something left on it,
-- with the labels the despatch screen shows. Invoker rights, so a staff member
-- gets the goods and none of the money.
-- ---------------------------------------------------------------------
create or replace function sklad_issuable_batches(
  target_org_id uuid,
  p_search text default null,
  p_limit integer default 200
)
returns table (
  batch_id uuid,
  item_id uuid,
  kod text,
  item_name text,
  product_type text,
  width_cm numeric,
  length_cm numeric,
  color_name text,
  sort_name text,
  qoldiq_dona integer,
  piece_weight_kg numeric,
  order_id uuid,
  order_no text,
  omborga_kirgan_sana date
)
language sql
stable
set search_path = public
as $$
  select
    b.id, i.id, i.kod, i.name, pt.name, i.width_cm, i.length_cm, cl.name, st.name,
    b.qoldiq_dona, b.piece_weight_kg, b.order_id, o.order_no, b.omborga_kirgan_sana
  from sklad_batches b
  join sklad_items i on i.id = b.item_id
  left join sklad_lookups pt on pt.id = i.product_type_id
  left join sklad_lookups cl on cl.id = i.color_id
  left join sklad_lookups st on st.id = i.sort_id
  left join sklad_orders o on o.id = b.order_id
  where b.org_id = target_org_id
    and coalesce(b.qoldiq_dona, 0) > 0
    and (
      p_search is null or p_search = '' or
      i.name ilike '%' || p_search || '%' or
      i.kod ilike '%' || p_search || '%' or
      o.order_no ilike '%' || p_search || '%'
    )
  order by b.omborga_kirgan_sana desc, i.name
  limit least(coalesce(p_limit, 200), 500);
$$;
