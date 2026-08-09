-- Sotuv bo'limi: the sack, and the two codes that make it countable.
--
-- The warehouse could already say "this lot holds 1000 pieces". It could not
-- say "this sack, the one in your hand, holds 50 of the red rose and 20 of the
-- yellow" — and that is the only sentence that matters when goods are being
-- loaded. `qop_soni` was an integer on the batch: a count of sacks, with
-- nothing inside any of them.
--
-- So a sack becomes a row, and the codes get a rule each:
--
--   THE BARCODE IDENTIFIES THE PRODUCT.
--   Every product card carries one 13-digit numeric barcode, assigned once and
--   never changed. Scanning it answers "which model, which cloth, which
--   colour, which size" — the distinction between a red rose and a yellow one
--   that a person cannot make reliably at seven in the morning with forty
--   identical sacks in front of them. Two rows in sklad_items are two
--   products, therefore two barcodes; the same product in a different lot is
--   still that product, and keeps its barcode.
--
--   THE QR CODE IDENTIFIES THE SACK AND CARRIES ITS CONTENTS.
--   Every sack carries one QR, generated when it is packed. A uniform sack is
--   one line (50 of one model). A mixed sack is as many lines as it holds. A
--   thousand pieces packed fifty to a sack is twenty sacks and twenty QR
--   codes, each of which resolves to what is actually inside that one.
--
-- Neither code moves stock. Packing rearranges goods, it does not consume
-- them: the write-off happens when the sack leaves, against the batch each
-- line came from, so a sack sitting on the floor is still stock and a sack on
-- the lorry is not. That is the only ordering that keeps the remainder honest.
--
-- Re-runnable, same as 0014-0032.

-- ---------------------------------------------------------------------
-- Numbering. Each family of codes gets its own leading digit, so a scan can
-- be classified before a single table is touched, and so the three sequences
-- can never collide:
--
--   0…  invoice   (0027, unchanged)
--   2…  product
--   3…  sack
-- ---------------------------------------------------------------------
create sequence if not exists sklad_item_barcode_seq start 1;
create sequence if not exists sklad_package_barcode_seq start 1;


-- ---------------------------------------------------------------------
-- Rule 1: the product barcode.
-- ---------------------------------------------------------------------
alter table sklad_items add column if not exists barcode text;

do $guard$
begin
  if not exists (
    select 1 from pg_indexes where indexname = 'sklad_items_barcode_key'
  ) then
    create unique index sklad_items_barcode_key on sklad_items (barcode)
      where barcode is not null;
  end if;
end $guard$;

create or replace function assign_sklad_item_barcode()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.barcode is null or btrim(new.barcode) = '' then
    new.barcode := '2' || lpad(nextval('sklad_item_barcode_seq')::text, 12, '0');
  end if;
  return new;
end;
$$;

drop trigger if exists sklad_items_assign_barcode on sklad_items;
create trigger sklad_items_assign_barcode
  before insert on sklad_items
  for each row execute function assign_sklad_item_barcode();

-- Cards that existed before the rule get one now. Ordered by creation so the
-- numbers follow the order the products were introduced.
do $backfill$
declare
  r record;
begin
  for r in
    select id from sklad_items where barcode is null or btrim(barcode) = ''
    order by created_at, id
  loop
    update sklad_items
    set barcode = '2' || lpad(nextval('sklad_item_barcode_seq')::text, 12, '0')
    where id = r.id;
  end loop;
end $backfill$;


-- ---------------------------------------------------------------------
-- Rule 2: the sack.
--
-- `invoice_id` is which sale the sack is spoken for, set when it is packed to
-- order or when it is scanned onto a despatch. `shipment_id` is the despatch
-- that took it, and is what makes 'jonatilgan' a fact rather than a flag —
-- a sack cannot be shipped twice because the second attempt sees it filled.
-- ---------------------------------------------------------------------
do $guard$
begin
  if not exists (select 1 from pg_type where typname = 'sklad_package_status') then
    create type sklad_package_status as enum ('tayyor', 'jonatilgan', 'bekor');
  end if;
end $guard$;

create table if not exists sklad_packages (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  code text,
  barcode text unique,
  invoice_id uuid references sklad_invoices (id) on delete set null,
  shipment_id uuid references sklad_shipments (id) on delete set null,
  status sklad_package_status not null default 'tayyor',
  packed_at date not null default current_date,
  packed_by uuid references auth.users (id) default auth.uid(),
  gross_kg numeric(12, 3),
  note text,
  created_at timestamptz not null default now(),
  unique (org_id, code)
);

create index if not exists sklad_packages_org_idx
  on sklad_packages (org_id, packed_at desc, created_at desc);
create index if not exists sklad_packages_invoice_idx
  on sklad_packages (invoice_id) where invoice_id is not null;
create index if not exists sklad_packages_shipment_idx
  on sklad_packages (shipment_id) where shipment_id is not null;
create index if not exists sklad_packages_status_idx on sklad_packages (org_id, status);

alter table sklad_packages enable row level security;
drop policy if exists sklad_packages_select on sklad_packages;
create policy sklad_packages_select on sklad_packages
  for select using (is_org_member(org_id));
drop policy if exists sklad_packages_insert on sklad_packages;
create policy sklad_packages_insert on sklad_packages
  for insert with check (is_org_member(org_id));
drop policy if exists sklad_packages_update on sklad_packages;
create policy sklad_packages_update on sklad_packages
  for update using (is_org_member(org_id));
drop policy if exists sklad_packages_delete on sklad_packages;
create policy sklad_packages_delete on sklad_packages
  for delete using (is_org_member(org_id));

-- What is inside. `batch_id` is not optional: a line that cannot name the lot
-- it came from cannot be written off it either, and a sack whose contents
-- cannot be written off is a hole in the remainder.
create table if not exists sklad_package_lines (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  package_id uuid not null references sklad_packages (id) on delete cascade,
  item_id uuid not null references sklad_items (id),
  batch_id uuid not null references sklad_batches (id),
  dona integer not null check (dona > 0),
  kg numeric(12, 3),
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists sklad_package_lines_package_idx
  on sklad_package_lines (package_id, position);
create index if not exists sklad_package_lines_batch_idx on sklad_package_lines (batch_id);
create index if not exists sklad_package_lines_item_idx on sklad_package_lines (item_id);

alter table sklad_package_lines enable row level security;
drop policy if exists sklad_package_lines_select on sklad_package_lines;
create policy sklad_package_lines_select on sklad_package_lines
  for select using (is_org_member(org_id));
drop policy if exists sklad_package_lines_insert on sklad_package_lines;
create policy sklad_package_lines_insert on sklad_package_lines
  for insert with check (is_org_member(org_id));
drop policy if exists sklad_package_lines_update on sklad_package_lines;
create policy sklad_package_lines_update on sklad_package_lines
  for update using (is_org_member(org_id));
drop policy if exists sklad_package_lines_delete on sklad_package_lines;
create policy sklad_package_lines_delete on sklad_package_lines
  for delete using (is_org_member(org_id));


-- Sack numbering, per org and per year, in the shape the office already writes.
create table if not exists org_package_counters (
  org_id uuid not null references organizations (id) on delete cascade,
  year integer not null,
  next_no bigint not null default 1,
  primary key (org_id, year)
);

alter table org_package_counters enable row level security;
drop policy if exists org_package_counters_select on org_package_counters;
create policy org_package_counters_select on org_package_counters
  for select using (is_org_member(org_id));

create or replace function assign_sklad_package_code()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_year integer := extract(year from new.packed_at)::integer;
  v_seq bigint;
begin
  if new.code is null then
    insert into org_package_counters (org_id, year, next_no)
    values (new.org_id, v_year, 2)
    on conflict (org_id, year)
      do update set next_no = org_package_counters.next_no + 1
    returning next_no - 1 into v_seq;

    new.code := 'QOP-' || v_year || '-' || lpad(v_seq::text, 4, '0');
  end if;

  if new.barcode is null then
    new.barcode := '3' || lpad(nextval('sklad_package_barcode_seq')::text, 12, '0');
  end if;

  return new;
end;
$$;

drop trigger if exists sklad_packages_assign_code on sklad_packages;
create trigger sklad_packages_assign_code
  before insert on sklad_packages
  for each row execute function assign_sklad_package_code();


-- ---------------------------------------------------------------------
-- Delivery. The sale is not finished when the paper is signed, it is finished
-- when somebody carried it — so the despatch records who, and under what
-- number, and when it arrived.
-- ---------------------------------------------------------------------
alter table sklad_shipments add column if not exists carrier text;
alter table sklad_shipments add column if not exists tracking_no text;
alter table sklad_shipments add column if not exists delivered_at date;


-- ---------------------------------------------------------------------
-- Which lot to take an item from, when the packer scanned a product barcode
-- and did not name one. Oldest stock first — cloth does not improve on a
-- shelf, and FIFO is what the remainder report already assumes.
-- ---------------------------------------------------------------------
create or replace function sklad_pick_batch_for_item(
  target_org_id uuid,
  p_item_id uuid,
  p_dona integer default 1
)
returns uuid
language sql
stable
set search_path = public
as $$
  select b.id
  from sklad_batches b
  where b.org_id = target_org_id
    and b.item_id = p_item_id
    and b.status <> 'brak'
  order by
    -- A lot that can cover the whole line beats one that cannot, then oldest.
    (coalesce(b.qoldiq_dona, 0) >= greatest(coalesce(p_dona, 1), 1)) desc,
    coalesce(b.qoldiq_dona, 0) > 0 desc,
    b.omborga_kirgan_sana asc,
    b.created_at asc
  limit 1;
$$;


-- ---------------------------------------------------------------------
-- Packing a lot into uniform sacks: the twenty-QR case.
--
-- 1000 pieces, 50 to a sack, is twenty sacks — and the remainder, if the
-- division is not clean, is a twenty-first sack holding what is left rather
-- than a rounding error nobody sees.
-- ---------------------------------------------------------------------
create or replace function sklad_pack_batch(
  target_org_id uuid,
  p_batch_id uuid,
  p_per_qop integer,
  p_total_dona integer default null,
  p_invoice_id uuid default null,
  p_kg_per_qop numeric default null,
  p_packed_at date default null
)
returns integer
language plpgsql
set search_path = public
as $$
declare
  v_item uuid;
  v_org uuid;
  v_available integer;
  v_total integer;
  v_left integer;
  v_take integer;
  v_package uuid;
  v_made integer := 0;
begin
  if coalesce(p_per_qop, 0) <= 0 then
    raise exception 'Bitta qopdagi dona sonini kiriting';
  end if;

  select b.org_id, b.item_id, coalesce(b.qoldiq_dona, b.dona_soni, 0)
  into v_org, v_item, v_available
  from sklad_batches b
  where b.id = p_batch_id;

  if v_org is null or v_org <> target_org_id then
    raise exception 'Partiya topilmadi';
  end if;

  v_total := coalesce(nullif(p_total_dona, 0), v_available);
  if v_total <= 0 then
    raise exception 'Qoplashga mahsulot yo''q';
  end if;

  v_left := v_total;
  while v_left > 0 loop
    v_take := least(p_per_qop, v_left);

    insert into sklad_packages (org_id, invoice_id, packed_at)
    values (target_org_id, p_invoice_id, coalesce(p_packed_at, current_date))
    returning id into v_package;

    insert into sklad_package_lines (org_id, package_id, item_id, batch_id, dona, kg, position)
    values (target_org_id, v_package, v_item, p_batch_id, v_take, p_kg_per_qop, 1);

    v_left := v_left - v_take;
    v_made := v_made + 1;

    -- A typo in "per sack" must not spend the afternoon inserting rows.
    if v_made > 2000 then
      raise exception 'Juda ko''p qop: sonini tekshiring';
    end if;
  end loop;

  return v_made;
end;
$$;


-- ---------------------------------------------------------------------
-- A mixed sack, created or corrected. Five models in one sack is normal; what
-- is not normal is discovering at the gate that nobody wrote down which five.
--
-- Editing is allowed right up until the sack ships, and refused afterwards:
-- the contents are by then a stock movement that has already happened.
-- ---------------------------------------------------------------------
create or replace function sklad_save_package(
  target_org_id uuid,
  p_rows jsonb,
  p_package_id uuid default null,
  p_invoice_id uuid default null,
  p_gross_kg numeric default null,
  p_note text default null,
  p_packed_at date default null
)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  r jsonb;
  v_package uuid := p_package_id;
  v_status sklad_package_status;
  v_item uuid;
  v_batch uuid;
  v_dona integer;
  v_position integer := 0;
begin
  if v_package is null then
    insert into sklad_packages (org_id, invoice_id, packed_at, gross_kg, note)
    values (
      target_org_id, p_invoice_id, coalesce(p_packed_at, current_date), p_gross_kg,
      nullif(btrim(coalesce(p_note, '')), '')
    )
    returning id into v_package;
  else
    select status into v_status
    from sklad_packages
    where id = v_package and org_id = target_org_id;

    if v_status is null then
      raise exception 'Qop topilmadi';
    end if;
    if v_status = 'jonatilgan' then
      raise exception 'Jo''natilgan qopni o''zgartirib bo''lmaydi';
    end if;

    update sklad_packages
    set invoice_id = p_invoice_id,
        gross_kg = p_gross_kg,
        note = nullif(btrim(coalesce(p_note, '')), ''),
        packed_at = coalesce(p_packed_at, packed_at)
    where id = v_package;

    delete from sklad_package_lines where package_id = v_package;
  end if;

  for r in select * from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb))
  loop
    v_dona := coalesce(nullif(r ->> 'dona', '')::integer, 0);
    v_item := nullif(r ->> 'itemId', '')::uuid;
    if v_dona <= 0 or v_item is null then
      continue;
    end if;

    v_batch := nullif(r ->> 'batchId', '')::uuid;
    if v_batch is null then
      v_batch := sklad_pick_batch_for_item(target_org_id, v_item, v_dona);
    end if;
    if v_batch is null then
      raise exception 'Bu mahsulot uchun omborda partiya topilmadi';
    end if;

    v_position := v_position + 1;
    insert into sklad_package_lines
      (org_id, package_id, item_id, batch_id, dona, kg, position)
    values (
      target_org_id, v_package, v_item, v_batch, v_dona,
      nullif(r ->> 'kg', '')::numeric, v_position
    );
  end loop;

  if v_position = 0 then
    -- An empty sack is a mistake, not a state. A new one is removed outright;
    -- an existing one keeps whatever it had by refusing the change.
    if p_package_id is null then
      delete from sklad_packages where id = v_package;
    end if;
    raise exception 'Qopga hech narsa solinmadi';
  end if;

  return v_package;
end;
$$;


create or replace function sklad_delete_package(target_org_id uuid, p_package_id uuid)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_status sklad_package_status;
begin
  select status into v_status
  from sklad_packages where id = p_package_id and org_id = target_org_id;

  if v_status is null then
    raise exception 'Qop topilmadi';
  end if;
  if v_status = 'jonatilgan' then
    raise exception 'Jo''natilgan qopni o''chirib bo''lmaydi';
  end if;

  delete from sklad_packages where id = p_package_id;
end;
$$;


-- ---------------------------------------------------------------------
-- One sack, in full: what the QR opens.
-- ---------------------------------------------------------------------
create or replace function sklad_package_detail(target_org_id uuid, p_code text)
returns table (
  package_id uuid,
  code text,
  barcode text,
  status sklad_package_status,
  packed_at date,
  gross_kg numeric,
  note text,
  invoice_id uuid,
  invoice_no text,
  counterparty_id uuid,
  counterparty_name text,
  shipment_id uuid,
  packed_by_name text,
  line_id uuid,
  item_id uuid,
  batch_id uuid,
  item_barcode text,
  kod text,
  item_name text,
  width_cm numeric,
  length_cm numeric,
  color_name text,
  dona integer,
  kg numeric,
  batch_qoldiq_dona integer
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  with target as (
    select p.*
    from sklad_packages p
    where p.org_id = target_org_id
      and is_org_member(target_org_id)
      and (
        p.barcode = btrim(p_code)
        or upper(p.code) = upper(btrim(p_code))
        or p.id::text = btrim(p_code)
      )
    limit 1
  )
  select
    t.id, t.code, t.barcode, t.status, t.packed_at, t.gross_kg, t.note,
    t.invoice_id, inv.invoice_no, inv.counterparty_id, c.name, t.shipment_id,
    coalesce(pr.full_name, u.email),
    l.id, l.item_id, l.batch_id,
    it.barcode, it.kod, it.name, it.width_cm, it.length_cm, cl.name,
    l.dona, l.kg, b.qoldiq_dona
  from target t
  left join sklad_invoices inv on inv.id = t.invoice_id
  left join counterparties c on c.id = inv.counterparty_id
  left join auth.users u on u.id = t.packed_by
  left join profiles pr on pr.id = t.packed_by
  left join sklad_package_lines l on l.package_id = t.id
  left join sklad_items it on it.id = l.item_id
  left join sklad_batches b on b.id = l.batch_id
  left join sklad_lookups cl on cl.id = it.color_id
  order by l.position, l.created_at;
$$;


-- ---------------------------------------------------------------------
-- The sacks standing against one invoice, each with a one-line summary of
-- what is in it — enough to print a sheet of labels without opening twenty
-- pages.
-- ---------------------------------------------------------------------
create or replace function sklad_invoice_packages(target_org_id uuid, p_invoice_id uuid)
returns table (
  package_id uuid,
  code text,
  barcode text,
  status sklad_package_status,
  packed_at date,
  gross_kg numeric,
  note text,
  shipment_id uuid,
  total_dona bigint,
  total_kg numeric,
  line_count bigint,
  contents text
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  select
    p.id, p.code, p.barcode, p.status, p.packed_at, p.gross_kg, p.note, p.shipment_id,
    coalesce(agg.total_dona, 0),
    agg.total_kg,
    coalesce(agg.line_count, 0),
    agg.contents
  from sklad_packages p
  left join lateral (
    select
      sum(l.dona) as total_dona,
      sum(l.kg) as total_kg,
      count(*) as line_count,
      string_agg(
        coalesce(it.name, it.kod, '?')
          || coalesce(' / ' || cl.name, '')
          || ' × ' || l.dona,
        ', ' order by l.position, l.created_at
      ) as contents
    from sklad_package_lines l
    left join sklad_items it on it.id = l.item_id
    left join sklad_lookups cl on cl.id = it.color_id
    where l.package_id = p.id
  ) agg on true
  where p.org_id = target_org_id
    and is_org_member(target_org_id)
    and p.invoice_id = p_invoice_id
  order by p.created_at;
$$;


-- ---------------------------------------------------------------------
-- Rule 3: one input, one answer.
--
-- The person at the desk has a scanner that types digits into whatever has
-- focus. They do not know — and must not have to know — whether what they just
-- scanned was an invoice, a sack or a product. This says which it was, and
-- gives the screen enough to go somewhere useful.
-- ---------------------------------------------------------------------
create or replace function sklad_scan(target_org_id uuid, p_code text)
returns table (
  kind text,
  id uuid,
  code text,
  label text,
  detail text,
  invoice_id uuid,
  counterparty_id uuid,
  counterparty_name text,
  item_id uuid,
  batch_id uuid,
  available_dona integer,
  status text
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  with needle as (select btrim(coalesce(p_code, '')) as code),
  hit_invoice as (
    select
      'faktura'::text as kind, i.id, i.invoice_no as code,
      c.name as label,
      coalesce(i.invoice_no, '') as detail,
      i.id as invoice_id, i.counterparty_id, c.name as counterparty_name,
      null::uuid as item_id, null::uuid as batch_id, null::integer as available_dona,
      i.status::text as status, 1 as hit_rank
    from sklad_invoices i
    join counterparties c on c.id = i.counterparty_id
    cross join needle n
    where i.org_id = target_org_id
      and (i.barcode = n.code or lower(i.invoice_no) = lower(n.code) or i.id::text = n.code)
  ),
  hit_package as (
    select
      'qop'::text, p.id, p.code,
      coalesce(c.name, ''),
      coalesce(agg.contents, ''),
      p.invoice_id, inv.counterparty_id, c.name,
      null::uuid, null::uuid, coalesce(agg.total_dona, 0)::integer,
      p.status::text, 2
    from sklad_packages p
    cross join needle n
    left join sklad_invoices inv on inv.id = p.invoice_id
    left join counterparties c on c.id = inv.counterparty_id
    left join lateral (
      select
        sum(l.dona)::bigint as total_dona,
        string_agg(
          coalesce(it.name, it.kod, '?') || coalesce(' / ' || cl.name, '') || ' × ' || l.dona,
          ', ' order by l.position, l.created_at
        ) as contents
      from sklad_package_lines l
      left join sklad_items it on it.id = l.item_id
      left join sklad_lookups cl on cl.id = it.color_id
      where l.package_id = p.id
    ) agg on true
    where p.org_id = target_org_id
      and (p.barcode = n.code or upper(p.code) = upper(n.code) or p.id::text = n.code)
  ),
  hit_item as (
    -- A product scan answers "which model", and then "who is waiting for it":
    -- the open invoice that has this product on it, oldest first, which is the
    -- invoice the person at the desk is almost certainly working on.
    select
      'mahsulot'::text, it.id, it.barcode,
      it.name,
      coalesce(cl.name, ''),
      open_inv.invoice_id, open_inv.counterparty_id, open_inv.counterparty_name,
      it.id, sklad_pick_batch_for_item(target_org_id, it.id, 1),
      coalesce(stock.qoldiq, 0)::integer,
      null::text, 3
    from sklad_items it
    cross join needle n
    left join sklad_lookups cl on cl.id = it.color_id
    left join lateral (
      select sum(coalesce(b.qoldiq_dona, 0))::bigint as qoldiq
      from sklad_batches b where b.item_id = it.id and b.org_id = target_org_id
    ) stock on true
    left join lateral (
      select i.id as invoice_id, i.counterparty_id, c.name as counterparty_name
      from sklad_invoice_lines l
      join sklad_invoices i on i.id = l.invoice_id
      join counterparties c on c.id = i.counterparty_id
      where l.item_id = it.id
        and i.org_id = target_org_id
        and i.status in ('yangi', 'qisman')
      order by i.issued_at, i.created_at
      limit 1
    ) open_inv on true
    where it.org_id = target_org_id
      and (it.barcode = n.code or lower(it.kod) = lower(n.code) or it.id::text = n.code)
  )
  select kind, id, code, label, detail, invoice_id, counterparty_id, counterparty_name,
         item_id, batch_id, available_dona, status
  from (
    select * from hit_invoice
    union all select * from hit_package
    union all select * from hit_item
  ) hits
  where is_org_member(target_org_id)
  order by hit_rank
  limit 1;
$$;


-- ---------------------------------------------------------------------
-- Confirming the sale from the sacks that were scanned.
--
-- One call: the despatch, its lines, the stock movements, the sacks marked
-- gone and the invoice's status recomputed. All of it or none of it — a
-- shipment whose stock did not move is worse than no shipment at all.
-- ---------------------------------------------------------------------
create or replace function sklad_issue_packages(
  target_org_id uuid,
  p_package_ids uuid[],
  p_invoice_id uuid default null,
  p_carrier text default null,
  p_tracking_no text default null,
  p_shipped_at date default null,
  p_note text default null,
  p_manager_id uuid default null
)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_shipment uuid;
  v_invoice uuid := p_invoice_id;
  v_counterparty uuid;
  v_order uuid;
  v_document text;
  v_shipped date := coalesce(p_shipped_at, current_date);
  v_count integer := 0;
  r record;
begin
  if p_package_ids is null or array_length(p_package_ids, 1) is null then
    raise exception 'Qop tanlanmagan';
  end if;

  -- Every sack must be this org's, unshipped, and — if the despatch names an
  -- invoice — either free or already spoken for by that same invoice. Catching
  -- it here means the lorry is not loaded against the wrong sale.
  if exists (
    select 1 from sklad_packages p
    where p.id = any (p_package_ids)
      and (p.org_id <> target_org_id or p.status <> 'tayyor')
  ) then
    raise exception 'Tanlangan qoplardan biri jo''natilgan yoki boshqa tashkilotniki';
  end if;

  if v_invoice is null then
    select p.invoice_id into v_invoice
    from sklad_packages p
    where p.id = any (p_package_ids) and p.invoice_id is not null
    limit 1;
  end if;

  if exists (
    select 1 from sklad_packages p
    where p.id = any (p_package_ids)
      and p.invoice_id is not null
      and v_invoice is not null
      and p.invoice_id <> v_invoice
  ) then
    raise exception 'Qoplar turli fakturalarga tegishli';
  end if;

  if v_invoice is not null then
    select i.counterparty_id, i.order_id, i.invoice_no
    into v_counterparty, v_order, v_document
    from sklad_invoices i
    where i.id = v_invoice and i.org_id = target_org_id;

    if v_counterparty is null then
      raise exception 'Faktura topilmadi';
    end if;
  end if;

  insert into sklad_shipments
    (org_id, order_id, counterparty_id, manager_id, document_no, shipped_at, note,
     invoice_id, carrier, tracking_no)
  values
    (target_org_id, v_order, v_counterparty, coalesce(p_manager_id, auth.uid()), v_document,
     v_shipped, nullif(btrim(coalesce(p_note, '')), ''), v_invoice,
     nullif(btrim(coalesce(p_carrier, '')), ''), nullif(btrim(coalesce(p_tracking_no, '')), ''))
  returning id into v_shipment;

  -- One despatch line per sack line, so the note that travels says which sack
  -- each figure came out of rather than one merged total per product.
  for r in
    select l.batch_id, l.dona, l.kg, p.code
    from sklad_package_lines l
    join sklad_packages p on p.id = l.package_id
    where l.package_id = any (p_package_ids)
    order by p.created_at, l.position
  loop
    insert into sklad_shipment_lines (org_id, shipment_id, batch_id, dona, kg, note)
    values (target_org_id, v_shipment, r.batch_id, r.dona, r.kg, r.code);

    perform record_sklad_movement(
      r.batch_id, 'chiqim', r.dona, r.kg, v_shipped, v_counterparty, v_order,
      coalesce(v_document, r.code));

    v_count := v_count + 1;
  end loop;

  if v_count = 0 then
    raise exception 'Qoplar bo''sh — chiqim qilinmadi';
  end if;

  update sklad_packages
  set status = 'jonatilgan',
      shipment_id = v_shipment,
      invoice_id = coalesce(invoice_id, v_invoice)
  where id = any (p_package_ids);

  perform refresh_sklad_invoice_status(v_invoice);

  return v_shipment;
end;
$$;


-- ---------------------------------------------------------------------
-- The sales desk's own list: clients, and what each of them owes the loading
-- bay. This is the first screen of the module, so it answers the two questions
-- asked there — who has bought, and for how much.
-- ---------------------------------------------------------------------
create or replace function sklad_sales_by_counterparty(
  target_org_id uuid,
  p_search text default null,
  p_limit integer default 200
)
returns table (
  counterparty_id uuid,
  counterparty_name text,
  phone text,
  invoice_count bigint,
  open_count bigint,
  total_amount numeric,
  ordered_dona bigint,
  shipped_dona bigint,
  package_count bigint,
  last_issued_at date,
  currency text
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  select
    c.id, c.name, c.phone,
    count(i.id),
    count(i.id) filter (where i.status in ('yangi', 'qisman')),
    sum(coalesce(agg.amount, 0)),
    coalesce(sum(agg.ordered), 0),
    coalesce(sum(shipped.dona), 0),
    coalesce(sum(packs.n), 0),
    max(i.issued_at),
    min(i.currency)
  from sklad_invoices i
  join counterparties c on c.id = i.counterparty_id
  left join lateral (
    select sum(l.dona) as ordered, sum(l.amount) as amount
    from sklad_invoice_lines l where l.invoice_id = i.id
  ) agg on true
  left join lateral (
    select sum(sl.dona) as dona
    from sklad_shipment_lines sl
    join sklad_shipments sh on sh.id = sl.shipment_id and sh.invoice_id = i.id
  ) shipped on true
  left join lateral (
    select count(*) as n from sklad_packages p where p.invoice_id = i.id
  ) packs on true
  where i.org_id = target_org_id
    and is_org_member(target_org_id)
    and i.status <> 'bekor'
    and (p_search is null or p_search = '' or c.name ilike '%' || p_search || '%')
  group by c.id, c.name, c.phone
  order by max(i.issued_at) desc, c.name
  limit least(coalesce(p_limit, 200), 500);
$$;


-- ---------------------------------------------------------------------
-- The change log and live updates, as for every other warehouse document.
-- ---------------------------------------------------------------------
do $guard$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'sklad_audit_entity_check'
      and pg_get_constraintdef(oid) like '%package%'
  ) then
    alter table sklad_audit drop constraint if exists sklad_audit_entity_check;
    alter table sklad_audit add constraint sklad_audit_entity_check
      check (entity in ('batch', 'item', 'price', 'order', 'line', 'stage_entry',
                        'shipment', 'invoice', 'package'));
  end if;
end $guard$;

drop trigger if exists sklad_packages_audit on sklad_packages;
create trigger sklad_packages_audit
  after update or delete on sklad_packages
  for each row execute function log_sklad_change('package');

do $guard$
declare
  t text;
begin
  foreach t in array array['sklad_packages', 'sklad_package_lines'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table %I', t);
    end if;
  end loop;
end $guard$;
