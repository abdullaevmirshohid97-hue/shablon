-- The production chain: an order that every shop floor writes into, from the
-- sewing line to the finished-goods warehouse to the truck.
--
-- Until now an order was three fields — a number, a name and a client — and
-- the warehouse only ever saw the end of the story: a batch appeared, already
-- made. Where an order actually was on any given day lived in people's heads
-- and in messages.
--
-- The shape here is one shared document, which is what was asked for: every
-- department sees the same order and writes its own rows into it. A cutter
-- does not get a different screen from a dyer; they get the same order with a
-- different stage column open.
--
-- Four tables:
--   sklad_stages        — the shops themselves, admin-configurable per org
--   sklad_order_lines   — the rows of an order (one product, one planned qty)
--   sklad_stage_entries — what a shop did to a row, on a day, by whom
--   sklad_shipments     — what left the building, to which client, via which
--                         manager, and what that leaves behind
--
-- Re-runnable, same as 0014-0023.


-- ---------------------------------------------------------------------
-- Order header: who owns it and when it is due.
-- ---------------------------------------------------------------------
do $guard$
begin
  if not exists (select 1 from pg_type where typname = 'sklad_order_status') then
    create type sklad_order_status as enum (
      'yangi', 'ishlab_chiqarishda', 'tayyor', 'yuklandi', 'yopilgan'
    );
  end if;
end $guard$;

alter table sklad_orders
  add column if not exists manager_id uuid references auth.users (id),
  add column if not exists deadline date,
  add column if not exists status sklad_order_status not null default 'yangi',
  add column if not exists notes text;


-- ---------------------------------------------------------------------
-- Stages. Ordered, renameable, and seeded with the route this factory
-- actually runs so the first order does not start on an empty screen.
--
-- `is_final` marks the finished-goods warehouse: output booked there is what
-- becomes available to ship, and what the analytics count as ready.
-- ---------------------------------------------------------------------
create table if not exists sklad_stages (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  name text not null,
  position integer not null default 0,
  is_final boolean not null default false,
  created_at timestamptz not null default now(),
  unique (org_id, name)
);

create index if not exists sklad_stages_org_position_idx on sklad_stages (org_id, position);

alter table sklad_stages enable row level security;
drop policy if exists sklad_stages_select on sklad_stages;
create policy sklad_stages_select on sklad_stages for select using (is_org_member(org_id));
drop policy if exists sklad_stages_write on sklad_stages;
create policy sklad_stages_write on sklad_stages
  for all using (is_org_admin(org_id)) with check (is_org_admin(org_id));

insert into sklad_stages (org_id, name, position, is_final)
select o.id, s.name, s.position, s.is_final
from organizations o
cross join (values
  ('To''qish', 10, false),
  ('Bo''yoqxona', 20, false),
  ('Quritish', 30, false),
  ('Tikuv', 40, false),
  ('Qadoqlash', 50, false),
  ('Tayyor mahsulot ombori', 60, true)
) as s(name, position, is_final)
on conflict (org_id, name) do nothing;


-- ---------------------------------------------------------------------
-- Order lines — the "qatorlar" each shop is handed.
--
-- item_id is nullable and the descriptive columns are free text beside it: an
-- order is often written before anyone has carded the product, and refusing
-- the row until someone does is how a paper list stays on paper.
-- ---------------------------------------------------------------------
create table if not exists sklad_order_lines (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  order_id uuid not null references sklad_orders (id) on delete cascade,
  item_id uuid references sklad_items (id),
  position integer not null default 0,
  description text,
  size_text text,
  color_text text,
  planned_dona integer,
  planned_kg numeric(12, 3),
  notes text,
  created_by uuid references auth.users (id) default auth.uid(),
  created_at timestamptz not null default now()
);

create index if not exists sklad_order_lines_order_idx
  on sklad_order_lines (order_id, position);
create index if not exists sklad_order_lines_org_idx on sklad_order_lines (org_id);
create index if not exists sklad_order_lines_item_idx
  on sklad_order_lines (item_id) where item_id is not null;

alter table sklad_order_lines enable row level security;
drop policy if exists sklad_order_lines_select on sklad_order_lines;
create policy sklad_order_lines_select on sklad_order_lines
  for select using (is_org_member(org_id));
drop policy if exists sklad_order_lines_insert on sklad_order_lines;
create policy sklad_order_lines_insert on sklad_order_lines
  for insert with check (is_org_member(org_id));
drop policy if exists sklad_order_lines_update on sklad_order_lines;
create policy sklad_order_lines_update on sklad_order_lines
  for update using (is_org_member(org_id));
drop policy if exists sklad_order_lines_delete on sklad_order_lines;
create policy sklad_order_lines_delete on sklad_order_lines
  for delete using (is_org_admin(org_id));


-- ---------------------------------------------------------------------
-- Stage entries — one shop's work on one row, on one day.
--
-- Several rows per (line, stage) on purpose: a dye house rarely finishes a
-- thousand towels in a single pass, and forcing one row per stage would mean
-- the second day's work overwrites the first day's. Progress is the sum.
--
-- executor_name is free text next to the optional executor_id: brigades and
-- subcontractors do not have logins, and the shop still needs to record who
-- did the work. created_by always records who typed it, which is a different
-- question and the one an audit asks.
-- ---------------------------------------------------------------------
create table if not exists sklad_stage_entries (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  order_line_id uuid not null references sklad_order_lines (id) on delete cascade,
  stage_id uuid not null references sklad_stages (id),
  qty_in integer,
  qty_out integer,
  defect_qty integer,
  kg numeric(12, 3),
  executor_id uuid references auth.users (id),
  executor_name text,
  occurred_at date not null default current_date,
  note text,
  created_by uuid references auth.users (id) default auth.uid(),
  created_at timestamptz not null default now()
);

create index if not exists sklad_stage_entries_line_idx
  on sklad_stage_entries (order_line_id, stage_id);
create index if not exists sklad_stage_entries_org_occurred_idx
  on sklad_stage_entries (org_id, occurred_at desc);
create index if not exists sklad_stage_entries_stage_idx on sklad_stage_entries (stage_id);

alter table sklad_stage_entries enable row level security;
-- Everyone in the org reads every stage — that is the point of one shared
-- document. Writing is open to members too: the dyer records the dyeing.
-- Who wrote what is answered by created_by and by the audit log, not by
-- locking each shop out of the others' columns, which in a factory this size
-- only means the one person with rights types everyone's numbers.
drop policy if exists sklad_stage_entries_select on sklad_stage_entries;
create policy sklad_stage_entries_select on sklad_stage_entries
  for select using (is_org_member(org_id));
drop policy if exists sklad_stage_entries_insert on sklad_stage_entries;
create policy sklad_stage_entries_insert on sklad_stage_entries
  for insert with check (is_org_member(org_id));
drop policy if exists sklad_stage_entries_update on sklad_stage_entries;
create policy sklad_stage_entries_update on sklad_stage_entries
  for update using (is_org_member(org_id));
drop policy if exists sklad_stage_entries_delete on sklad_stage_entries;
create policy sklad_stage_entries_delete on sklad_stage_entries
  for delete using (is_org_admin(org_id));


-- ---------------------------------------------------------------------
-- Shipments — what left, to whom, through which manager.
--
-- The client sits on the shipment rather than only on the order, because one
-- order is routinely split across several: the question asked on the loading
-- bay is "how much of this order has gone to that client, and what is left",
-- and an order-level client cannot answer it.
-- ---------------------------------------------------------------------
create table if not exists sklad_shipments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  order_id uuid references sklad_orders (id),
  counterparty_id uuid references counterparties (id),
  manager_id uuid references auth.users (id),
  document_no text,
  shipped_at date not null default current_date,
  note text,
  created_by uuid references auth.users (id) default auth.uid(),
  created_at timestamptz not null default now()
);

create index if not exists sklad_shipments_org_date_idx
  on sklad_shipments (org_id, shipped_at desc);
create index if not exists sklad_shipments_order_idx
  on sklad_shipments (order_id) where order_id is not null;
create index if not exists sklad_shipments_counterparty_idx
  on sklad_shipments (counterparty_id) where counterparty_id is not null;

alter table sklad_shipments enable row level security;
drop policy if exists sklad_shipments_select on sklad_shipments;
create policy sklad_shipments_select on sklad_shipments
  for select using (is_org_member(org_id));
drop policy if exists sklad_shipments_insert on sklad_shipments;
create policy sklad_shipments_insert on sklad_shipments
  for insert with check (is_org_member(org_id));
drop policy if exists sklad_shipments_update on sklad_shipments;
create policy sklad_shipments_update on sklad_shipments
  for update using (is_org_member(org_id));
drop policy if exists sklad_shipments_delete on sklad_shipments;
create policy sklad_shipments_delete on sklad_shipments
  for delete using (is_org_admin(org_id));

-- A shipment line may point at an order line, at a warehouse batch, or at
-- both. Pointing at the batch is what lets the stock ledger stay in step: the
-- app records a 'chiqim' movement against it (0022) as the same action.
create table if not exists sklad_shipment_lines (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  shipment_id uuid not null references sklad_shipments (id) on delete cascade,
  order_line_id uuid references sklad_order_lines (id),
  batch_id uuid references sklad_batches (id),
  dona integer not null,
  kg numeric(12, 3),
  note text,
  created_at timestamptz not null default now(),
  check (dona > 0)
);

create index if not exists sklad_shipment_lines_shipment_idx
  on sklad_shipment_lines (shipment_id);
create index if not exists sklad_shipment_lines_order_line_idx
  on sklad_shipment_lines (order_line_id) where order_line_id is not null;
create index if not exists sklad_shipment_lines_batch_idx
  on sklad_shipment_lines (batch_id) where batch_id is not null;

alter table sklad_shipment_lines enable row level security;
drop policy if exists sklad_shipment_lines_select on sklad_shipment_lines;
create policy sklad_shipment_lines_select on sklad_shipment_lines
  for select using (is_org_member(org_id));
drop policy if exists sklad_shipment_lines_insert on sklad_shipment_lines;
create policy sklad_shipment_lines_insert on sklad_shipment_lines
  for insert with check (is_org_member(org_id));
drop policy if exists sklad_shipment_lines_update on sklad_shipment_lines;
create policy sklad_shipment_lines_update on sklad_shipment_lines
  for update using (is_org_member(org_id));
drop policy if exists sklad_shipment_lines_delete on sklad_shipment_lines;
create policy sklad_shipment_lines_delete on sklad_shipment_lines
  for delete using (is_org_admin(org_id));


-- ---------------------------------------------------------------------
-- These belong in the change log for the same reason batches do (0021).
-- ---------------------------------------------------------------------
do $guard$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'sklad_audit_entity_check'
      and pg_get_constraintdef(oid) like '%shipment%'
  ) then
    alter table sklad_audit drop constraint if exists sklad_audit_entity_check;
    alter table sklad_audit add constraint sklad_audit_entity_check
      check (entity in ('batch', 'item', 'price', 'order', 'line', 'stage_entry', 'shipment'));
  end if;
end $guard$;

drop trigger if exists sklad_order_lines_audit on sklad_order_lines;
create trigger sklad_order_lines_audit
  after update or delete on sklad_order_lines
  for each row execute function log_sklad_change('line');

drop trigger if exists sklad_stage_entries_audit on sklad_stage_entries;
create trigger sklad_stage_entries_audit
  after update or delete on sklad_stage_entries
  for each row execute function log_sklad_change('stage_entry');

drop trigger if exists sklad_shipments_audit on sklad_shipments;
create trigger sklad_shipments_audit
  after update or delete on sklad_shipments
  for each row execute function log_sklad_change('shipment');


-- ---------------------------------------------------------------------
-- Live updates: the whole premise is several shops on the same document at
-- once, so an entry made on the dye house screen has to appear on the sewing
-- floor's without a refresh.
-- ---------------------------------------------------------------------
do $guard$
declare
  t text;
begin
  foreach t in array array['sklad_order_lines', 'sklad_stage_entries', 'sklad_shipments'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table %I', t);
    end if;
  end loop;
end $guard$;
