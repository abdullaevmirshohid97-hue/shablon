-- The sales invoice, and the paper that carries it to the loading bay.
--
-- The despatch screen asked the storekeeper to know who the goods were for and
-- which batches to take them from. That is the manager's knowledge, not the
-- storekeeper's, and it was being re-derived at seven in the morning from a
-- phone call.
--
-- A manager now raises a faktura: client, lines, quantities, prices. It prints
-- with a QR code and a barcode. The storekeeper scans either one, the despatch
-- screen fills itself in, and they count out what the paper says.
--
-- Two codes rather than one because they are read by different things: a phone
-- camera reads the QR and lands on the document, while the wired scanner on
-- the despatch desk reads the barcode and types it into whatever field has
-- focus. Both resolve through the same lookup.
--
-- Re-runnable, same as 0014-0026.

do $guard$
begin
  if not exists (select 1 from pg_type where typname = 'sklad_invoice_status') then
    create type sklad_invoice_status as enum ('yangi', 'qisman', 'bajarildi', 'bekor');
  end if;
end $guard$;


-- ---------------------------------------------------------------------
-- The document.
--
-- `barcode` is 13 digits from a global sequence — numeric because the cheap
-- wired scanners on a loading bay read numeric Code128 far more reliably than
-- mixed case, and fixed-length because a scanner that drops a character should
-- fail to find anything rather than find the wrong document.
--
-- `invoice_no` is the human number, per org and per year, in the shape the
-- office already writes by hand.
-- ---------------------------------------------------------------------
create sequence if not exists sklad_invoice_barcode_seq start 1;

create table if not exists sklad_invoices (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  invoice_no text,
  barcode text unique,
  counterparty_id uuid not null references counterparties (id),
  manager_id uuid references auth.users (id),
  order_id uuid references sklad_orders (id),
  issued_at date not null default current_date,
  due_date date,
  status sklad_invoice_status not null default 'yangi',
  currency text not null default 'UZS' references currencies (code),
  note text,
  created_by uuid references auth.users (id) default auth.uid(),
  created_at timestamptz not null default now()
);

create index if not exists sklad_invoices_org_issued_idx
  on sklad_invoices (org_id, issued_at desc, created_at desc);
create index if not exists sklad_invoices_org_status_idx on sklad_invoices (org_id, status);
create index if not exists sklad_invoices_counterparty_idx on sklad_invoices (counterparty_id);
create index if not exists sklad_invoices_order_idx
  on sklad_invoices (order_id) where order_id is not null;

alter table sklad_invoices enable row level security;
drop policy if exists sklad_invoices_select on sklad_invoices;
create policy sklad_invoices_select on sklad_invoices
  for select using (is_org_member(org_id));
drop policy if exists sklad_invoices_insert on sklad_invoices;
create policy sklad_invoices_insert on sklad_invoices
  for insert with check (is_org_member(org_id));
drop policy if exists sklad_invoices_update on sklad_invoices;
create policy sklad_invoices_update on sklad_invoices
  for update using (is_org_member(org_id));
drop policy if exists sklad_invoices_delete on sklad_invoices;
create policy sklad_invoices_delete on sklad_invoices
  for delete using (is_org_admin(org_id));

-- ---------------------------------------------------------------------
-- Lines.
--
-- A line names the product and may name a batch: a manager who has walked the
-- floor knows which lot to send, and one who has not leaves it open for the
-- storekeeper to choose. `unit_price` sits here rather than in
-- sklad_batch_prices because this is what was sold, not what the stock is
-- valued at — the two differ and both are worth keeping.
-- ---------------------------------------------------------------------
create table if not exists sklad_invoice_lines (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  invoice_id uuid not null references sklad_invoices (id) on delete cascade,
  item_id uuid references sklad_items (id),
  batch_id uuid references sklad_batches (id),
  position integer not null default 0,
  dona integer not null check (dona > 0),
  kg numeric(12, 3),
  unit_price numeric(20, 4),
  amount numeric(20, 4),
  note text,
  created_at timestamptz not null default now()
);

create index if not exists sklad_invoice_lines_invoice_idx
  on sklad_invoice_lines (invoice_id, position);
create index if not exists sklad_invoice_lines_batch_idx
  on sklad_invoice_lines (batch_id) where batch_id is not null;

alter table sklad_invoice_lines enable row level security;
drop policy if exists sklad_invoice_lines_select on sklad_invoice_lines;
create policy sklad_invoice_lines_select on sklad_invoice_lines
  for select using (is_org_member(org_id));
drop policy if exists sklad_invoice_lines_insert on sklad_invoice_lines;
create policy sklad_invoice_lines_insert on sklad_invoice_lines
  for insert with check (is_org_member(org_id));
drop policy if exists sklad_invoice_lines_update on sklad_invoice_lines;
create policy sklad_invoice_lines_update on sklad_invoice_lines
  for update using (is_org_member(org_id));
drop policy if exists sklad_invoice_lines_delete on sklad_invoice_lines;
create policy sklad_invoice_lines_delete on sklad_invoice_lines
  for delete using (is_org_member(org_id));

-- The despatch that fulfilled it, so a shipment can be traced back to the sale.
alter table sklad_shipments add column if not exists invoice_id uuid references sklad_invoices (id);
create index if not exists sklad_shipments_invoice_idx
  on sklad_shipments (invoice_id) where invoice_id is not null;


-- ---------------------------------------------------------------------
-- Numbering and codes, assigned once at insert.
-- ---------------------------------------------------------------------
create table if not exists org_invoice_counters (
  org_id uuid not null references organizations (id) on delete cascade,
  year integer not null,
  next_no bigint not null default 1,
  primary key (org_id, year)
);

alter table org_invoice_counters enable row level security;
drop policy if exists org_invoice_counters_select on org_invoice_counters;
create policy org_invoice_counters_select on org_invoice_counters
  for select using (is_org_member(org_id));

create or replace function assign_sklad_invoice_no()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_year integer := extract(year from new.issued_at)::integer;
  v_seq bigint;
begin
  if new.invoice_no is null then
    insert into org_invoice_counters (org_id, year, next_no)
    values (new.org_id, v_year, 2)
    on conflict (org_id, year)
      do update set next_no = org_invoice_counters.next_no + 1
    returning next_no - 1 into v_seq;

    new.invoice_no := 'FKT-' || v_year || '-' || lpad(v_seq::text, 4, '0');
  end if;

  if new.barcode is null then
    new.barcode := lpad(nextval('sklad_invoice_barcode_seq')::text, 13, '0');
  end if;

  return new;
end;
$$;

drop trigger if exists sklad_invoices_assign_no on sklad_invoices;
create trigger sklad_invoices_assign_no
  before insert on sklad_invoices
  for each row execute function assign_sklad_invoice_no();


-- ---------------------------------------------------------------------
-- Status follows fulfilment.
--
-- Recomputed from the despatches against the invoice rather than set by hand,
-- for the same reason the stock remainder is: a status somebody has to
-- remember to change is a status that is wrong by Thursday. 'bekor' is the one
-- a person sets, and it is left alone.
-- ---------------------------------------------------------------------
create or replace function refresh_sklad_invoice_status(p_invoice_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ordered bigint;
  v_shipped bigint;
begin
  if p_invoice_id is null then
    return;
  end if;

  select coalesce(sum(dona), 0) into v_ordered
  from sklad_invoice_lines where invoice_id = p_invoice_id;

  select coalesce(sum(sl.dona), 0) into v_shipped
  from sklad_shipment_lines sl
  join sklad_shipments sh on sh.id = sl.shipment_id
  where sh.invoice_id = p_invoice_id;

  update sklad_invoices
  set status = case
        when status = 'bekor' then status
        when v_shipped <= 0 then 'yangi'
        when v_shipped >= v_ordered then 'bajarildi'
        else 'qisman'
      end
  where id = p_invoice_id;
end;
$$;


-- ---------------------------------------------------------------------
-- Scanning: one code in, one document out.
--
-- Takes the barcode, the invoice number, or the uuid out of the QR link — the
-- storekeeper does not know which of the three the scanner just typed, and
-- should not have to. Numbers are compared case-insensitively and trimmed,
-- because a scanner appended a carriage return and a person typing it by hand
-- appended a space.
--
-- Returns the lines with what is still outstanding on each, which is what the
-- despatch screen actually needs: an invoice half-filled yesterday should open
-- showing the other half.
-- ---------------------------------------------------------------------
create or replace function sklad_invoice_by_code(target_org_id uuid, p_code text)
returns table (
  invoice_id uuid,
  invoice_no text,
  barcode text,
  status sklad_invoice_status,
  issued_at date,
  counterparty_id uuid,
  counterparty_name text,
  order_id uuid,
  manager_id uuid,
  currency text,
  note text,
  line_id uuid,
  item_id uuid,
  batch_id uuid,
  kod text,
  item_name text,
  width_cm numeric,
  length_cm numeric,
  color_name text,
  ordered_dona integer,
  shipped_dona bigint,
  remaining_dona integer,
  batch_qoldiq_dona integer,
  unit_price numeric,
  amount numeric
)
language sql
stable
set search_path = public
as $$
  with target as (
    select i.*
    from sklad_invoices i
    where i.org_id = target_org_id
      and (
        i.barcode = btrim(p_code)
        or lower(i.invoice_no) = lower(btrim(p_code))
        or i.id::text = btrim(p_code)
      )
    limit 1
  )
  select
    t.id, t.invoice_no, t.barcode, t.status, t.issued_at,
    t.counterparty_id, c.name, t.order_id, t.manager_id, t.currency, t.note,
    l.id, l.item_id, l.batch_id,
    it.kod, it.name, it.width_cm, it.length_cm, cl.name,
    l.dona,
    coalesce(shipped.dona, 0),
    greatest(l.dona - coalesce(shipped.dona, 0), 0)::integer,
    b.qoldiq_dona,
    l.unit_price, l.amount
  from target t
  join counterparties c on c.id = t.counterparty_id
  left join sklad_invoice_lines l on l.invoice_id = t.id
  left join sklad_items it on it.id = l.item_id
  left join sklad_lookups cl on cl.id = it.color_id
  left join sklad_batches b on b.id = l.batch_id
  -- Fulfilment is matched by batch where the line names one, and otherwise by
  -- product: a manager who left the lot open cannot have their line closed by
  -- a despatch of something else.
  left join lateral (
    select sum(sl.dona) as dona
    from sklad_shipment_lines sl
    join sklad_shipments sh on sh.id = sl.shipment_id and sh.invoice_id = t.id
    where (l.batch_id is not null and sl.batch_id = l.batch_id)
       or (l.batch_id is null and sl.batch_id in (
             select b2.id from sklad_batches b2 where b2.item_id = l.item_id))
  ) shipped on true
  order by l.position, l.created_at;
$$;


-- ---------------------------------------------------------------------
-- The queue on the despatch desk: invoices still owing goods.
-- ---------------------------------------------------------------------
create or replace function sklad_invoice_page(
  target_org_id uuid,
  p_status text default null,
  p_counterparty_id uuid default null,
  p_search text default null,
  p_limit integer default 100
)
returns table (
  invoice_id uuid,
  invoice_no text,
  barcode text,
  status sklad_invoice_status,
  issued_at date,
  due_date date,
  counterparty_id uuid,
  counterparty_name text,
  manager_name text,
  order_no text,
  currency text,
  line_count bigint,
  ordered_dona bigint,
  shipped_dona bigint,
  total_amount numeric
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  select
    i.id, i.invoice_no, i.barcode, i.status, i.issued_at, i.due_date,
    i.counterparty_id, c.name,
    coalesce(p.full_name, u.email),
    o.order_no, i.currency,
    coalesce(agg.line_count, 0),
    coalesce(agg.ordered, 0),
    coalesce(shipped.dona, 0),
    agg.amount
  from sklad_invoices i
  join counterparties c on c.id = i.counterparty_id
  left join auth.users u on u.id = i.manager_id
  left join profiles p on p.id = i.manager_id
  left join sklad_orders o on o.id = i.order_id
  left join lateral (
    select count(*) as line_count, sum(l.dona) as ordered, sum(l.amount) as amount
    from sklad_invoice_lines l where l.invoice_id = i.id
  ) agg on true
  left join lateral (
    select sum(sl.dona) as dona
    from sklad_shipment_lines sl
    join sklad_shipments sh on sh.id = sl.shipment_id and sh.invoice_id = i.id
  ) shipped on true
  where i.org_id = target_org_id
    and is_org_member(target_org_id)
    and (p_status is null or p_status = '' or i.status = p_status::sklad_invoice_status)
    and (p_counterparty_id is null or i.counterparty_id = p_counterparty_id)
    and (
      p_search is null or p_search = '' or
      i.invoice_no ilike '%' || p_search || '%' or
      i.barcode like '%' || p_search || '%' or
      c.name ilike '%' || p_search || '%'
    )
  order by i.issued_at desc, i.created_at desc
  limit least(coalesce(p_limit, 100), 500);
$$;


-- ---------------------------------------------------------------------
-- Raising an invoice: header and lines in one call, so a manager never ends
-- up with a numbered document that has nothing on it.
-- ---------------------------------------------------------------------
create or replace function sklad_create_invoice(
  target_org_id uuid,
  p_counterparty_id uuid,
  p_rows jsonb,
  p_order_id uuid default null,
  p_manager_id uuid default null,
  p_issued_at date default null,
  p_due_date date default null,
  p_currency text default null,
  p_note text default null
)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  r jsonb;
  v_invoice uuid;
  v_dona integer;
  v_price numeric;
  v_position integer := 0;
  v_count integer := 0;
begin
  if p_counterparty_id is null then
    raise exception 'Mijozni tanlang';
  end if;

  insert into sklad_invoices
    (org_id, counterparty_id, manager_id, order_id, issued_at, due_date, currency, note)
  values
    (target_org_id, p_counterparty_id, coalesce(p_manager_id, auth.uid()), p_order_id,
     coalesce(p_issued_at, current_date), p_due_date, coalesce(nullif(p_currency, ''), 'UZS'),
     nullif(btrim(coalesce(p_note, '')), ''))
  returning id into v_invoice;

  for r in select * from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb))
  loop
    v_dona := coalesce(nullif(r ->> 'dona', '')::integer, 0);
    if v_dona <= 0 then
      continue;
    end if;

    v_position := v_position + 1;
    v_price := nullif(r ->> 'unitPrice', '')::numeric;

    insert into sklad_invoice_lines
      (org_id, invoice_id, item_id, batch_id, position, dona, kg, unit_price, amount, note)
    values (
      target_org_id, v_invoice,
      nullif(r ->> 'itemId', '')::uuid,
      nullif(r ->> 'batchId', '')::uuid,
      v_position,
      v_dona,
      nullif(r ->> 'kg', '')::numeric,
      v_price,
      coalesce(nullif(r ->> 'amount', '')::numeric, v_price * v_dona),
      nullif(btrim(coalesce(r ->> 'note', '')), '')
    );

    v_count := v_count + 1;
  end loop;

  if v_count = 0 then
    raise exception 'Fakturada qator yo''q';
  end if;

  return v_invoice;
end;
$$;


-- ---------------------------------------------------------------------
-- Despatch, now able to answer to an invoice.
--
-- Same function, one more argument: the shipment records which sale it
-- fulfilled, and the invoice's status is recomputed from what has actually
-- left rather than being ticked off by hand.
--
-- Dropped rather than replaced. A new parameter with a default does not
-- replace the old function, it overloads it — and an eight-argument call would
-- then match both and fail as ambiguous, at runtime, on the loading bay.
-- ---------------------------------------------------------------------
drop function if exists sklad_issue_rows(uuid, jsonb, uuid, uuid, uuid, text, date, text);

create or replace function sklad_issue_rows(
  target_org_id uuid,
  p_rows jsonb,
  p_counterparty_id uuid default null,
  p_order_id uuid default null,
  p_manager_id uuid default null,
  p_document_no text default null,
  p_shipped_at date default null,
  p_note text default null,
  p_invoice_id uuid default null
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
  v_counterparty uuid := p_counterparty_id;
  v_order uuid := p_order_id;
  v_document text := p_document_no;
  v_count integer := 0;
begin
  -- Scanned in from an invoice: the client, the order and the document number
  -- are on the paper, and re-typing them is how they end up disagreeing.
  if p_invoice_id is not null then
    select
      coalesce(v_counterparty, i.counterparty_id),
      coalesce(v_order, i.order_id),
      coalesce(v_document, i.invoice_no)
    into v_counterparty, v_order, v_document
    from sklad_invoices i
    where i.id = p_invoice_id and i.org_id = target_org_id;

    if v_counterparty is null then
      raise exception 'Faktura topilmadi';
    end if;
  end if;

  insert into sklad_shipments
    (org_id, order_id, counterparty_id, manager_id, document_no, shipped_at, note, invoice_id)
  values
    (target_org_id, v_order, v_counterparty, p_manager_id, v_document, v_shipped, p_note,
     p_invoice_id)
  returning id into v_shipment;

  for r in select * from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb))
  loop
    v_batch := nullif(r ->> 'batchId', '')::uuid;
    v_dona := coalesce(nullif(r ->> 'dona', '')::integer, 0);
    v_kg := nullif(r ->> 'kg', '')::numeric;

    if v_batch is null or v_dona <= 0 then
      continue;
    end if;

    insert into sklad_shipment_lines
      (org_id, shipment_id, order_line_id, batch_id, dona, kg, note)
    values
      (target_org_id, v_shipment, nullif(r ->> 'orderLineId', '')::uuid, v_batch, v_dona, v_kg,
       nullif(btrim(coalesce(r ->> 'note', '')), ''));

    perform record_sklad_movement(
      v_batch, 'chiqim', v_dona, v_kg, v_shipped, v_counterparty, v_order, v_document);

    v_count := v_count + 1;
  end loop;

  if v_count = 0 then
    raise exception 'Chiqim uchun qator kiritilmagan';
  end if;

  perform refresh_sklad_invoice_status(p_invoice_id);

  return v_shipment;
end;
$$;


-- ---------------------------------------------------------------------
-- A despatch note, for printing. Carries its own codes so the copy that goes
-- with the driver can be scanned back.
-- ---------------------------------------------------------------------
create or replace function sklad_shipment_note(p_shipment_id uuid)
returns table (
  shipment_id uuid,
  document_no text,
  shipped_at date,
  counterparty_name text,
  manager_name text,
  order_no text,
  invoice_id uuid,
  invoice_no text,
  invoice_barcode text,
  note text,
  line_id uuid,
  kod text,
  item_name text,
  width_cm numeric,
  length_cm numeric,
  color_name text,
  dona integer,
  kg numeric
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  select
    sh.id, sh.document_no, sh.shipped_at, c.name,
    coalesce(p.full_name, u.email),
    o.order_no, sh.invoice_id, inv.invoice_no, inv.barcode, sh.note,
    sl.id, i.kod, i.name, i.width_cm, i.length_cm, cl.name, sl.dona, sl.kg
  from sklad_shipments sh
  left join counterparties c on c.id = sh.counterparty_id
  left join auth.users u on u.id = sh.manager_id
  left join profiles p on p.id = sh.manager_id
  left join sklad_orders o on o.id = sh.order_id
  left join sklad_invoices inv on inv.id = sh.invoice_id
  left join sklad_shipment_lines sl on sl.shipment_id = sh.id
  left join sklad_batches b on b.id = sl.batch_id
  left join sklad_items i on i.id = b.item_id
  left join sklad_lookups cl on cl.id = i.color_id
  where sh.id = p_shipment_id
    and is_org_member(sh.org_id)
  order by sl.created_at;
$$;


-- ---------------------------------------------------------------------
-- The change log and live updates, as for every other warehouse document.
-- ---------------------------------------------------------------------
do $guard$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'sklad_audit_entity_check'
      and pg_get_constraintdef(oid) like '%invoice%'
  ) then
    alter table sklad_audit drop constraint if exists sklad_audit_entity_check;
    alter table sklad_audit add constraint sklad_audit_entity_check
      check (entity in ('batch', 'item', 'price', 'order', 'line', 'stage_entry',
                        'shipment', 'invoice'));
  end if;
end $guard$;

drop trigger if exists sklad_invoices_audit on sklad_invoices;
create trigger sklad_invoices_audit
  after update or delete on sklad_invoices
  for each row execute function log_sklad_change('invoice');

do $guard$
declare
  t text;
begin
  foreach t in array array['sklad_invoices', 'sklad_invoice_lines'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table %I', t);
    end if;
  end loop;
end $guard$;
