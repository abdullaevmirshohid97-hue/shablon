-- Sklad (textile-factory warehouse) Phase 1: product card + reference data +
-- batches/lots (warehouse stock) + orders + prices (separate, admin-gated table).
--
-- Same RLS convention as every other table (is_org_member/is_org_admin from
-- 0001_init.sql). No SECURITY DEFINER RPCs needed anywhere in this migration —
-- plain table RLS is sufficient, including for price-gating: sklad_batch_prices
-- has only an admin `for all` policy and no member select policy at all, which
-- is what hides the row (PostgREST embeds it as null rather than erroring the
-- parent query).

create type sklad_batch_status as enum (
  'tayyor', 'qadoqlanmoqda', 'omborda', 'rezerv', 'jonatildi', 'qaytarildi', 'brak'
);

-- ---------------------------------------------------------------------
-- sklad_lookups: generic admin-managed dropdown table (one table, kind column)
-- mahsulot turi / ip turi / o'lcham / sort / rang / pantone — FK id references,
-- not copied name strings, so renaming is free and deleting an in-use value is
-- blocked by the FK itself.
-- ---------------------------------------------------------------------
create table sklad_lookups (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  kind text not null check (kind in ('mahsulot_turi', 'ip_turi', 'olcham', 'sort', 'rang', 'pantone')),
  name text not null,
  created_at timestamptz not null default now(),
  unique (org_id, kind, name)
);

alter table sklad_lookups enable row level security;
create policy sklad_lookups_select on sklad_lookups for select using (is_org_member(org_id));
create policy sklad_lookups_write on sklad_lookups
  for all using (is_org_admin(org_id)) with check (is_org_admin(org_id));

-- ---------------------------------------------------------------------
-- sklad_items: mahsulot kartasi (product card / item master)
-- ---------------------------------------------------------------------
create table sklad_items (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  artikul text,
  kod text,
  name text not null,
  product_type_id uuid references sklad_lookups (id),
  yarn_type_id uuid references sklad_lookups (id),
  gsm numeric(6, 2),
  size_id uuid references sklad_lookups (id),
  sort_id uuid references sklad_lookups (id),
  color_id uuid references sklad_lookups (id),
  pantone_id uuid references sklad_lookups (id),
  created_by uuid references auth.users (id) default auth.uid(),
  created_at timestamptz not null default now()
);

alter table sklad_items enable row level security;
create policy sklad_items_select on sklad_items for select using (is_org_member(org_id));
create policy sklad_items_insert on sklad_items for insert with check (is_org_member(org_id));
create policy sklad_items_update on sklad_items for update using (is_org_member(org_id));
create policy sklad_items_delete on sklad_items for delete using (is_org_admin(org_id));

-- ---------------------------------------------------------------------
-- sklad_orders: buyurtma (order) — mijoz reuses the existing counterparties table
-- ---------------------------------------------------------------------
create table sklad_orders (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  order_no text,
  order_name text,
  counterparty_id uuid references counterparties (id),
  created_by uuid references auth.users (id) default auth.uid(),
  created_at timestamptz not null default now()
);

alter table sklad_orders enable row level security;
create policy sklad_orders_select on sklad_orders for select using (is_org_member(org_id));
create policy sklad_orders_insert on sklad_orders for insert with check (is_org_member(org_id));
create policy sklad_orders_update on sklad_orders for update using (is_org_member(org_id));
create policy sklad_orders_delete on sklad_orders for delete using (is_org_admin(org_id));

-- ---------------------------------------------------------------------
-- sklad_batches: ombor qoldig'i — one row per physical lot/batch of an item.
-- tara_kg and piece_weight_kg are computed (generated) columns — never insert
-- or update them directly, Postgres rejects it.
-- ---------------------------------------------------------------------
create table sklad_batches (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  item_id uuid not null references sklad_items (id),
  order_id uuid references sklad_orders (id),

  brutto_kg numeric(12, 3),
  netto_kg numeric(12, 3),
  tara_kg numeric(12, 3) generated always as (brutto_kg - netto_kg) stored,

  dona_soni integer,
  nabor_soni integer,
  pallet_soni integer,
  piece_weight_kg numeric(12, 4) generated always as (
    case when dona_soni > 0 then round(netto_kg / dona_soni, 4) else null end
  ) stored,
  qoldiq_dona integer,

  ishlab_chiqarilgan_sana date,
  omborga_kirgan_sana date not null default current_date,
  status sklad_batch_status not null default 'omborda',

  qc_checked_by uuid references auth.users (id),
  qc_checked_at date,
  defect_type text,
  defect_qty integer,
  notes text,

  location_sector text,
  location_row text,
  location_rack text,
  location_shelf text,

  created_by uuid references auth.users (id) default auth.uid(),
  created_at timestamptz not null default now()
);

alter table sklad_batches enable row level security;
create policy sklad_batches_select on sklad_batches for select using (is_org_member(org_id));
create policy sklad_batches_insert on sklad_batches for insert with check (is_org_member(org_id));
create policy sklad_batches_update on sklad_batches for update using (is_org_member(org_id));
create policy sklad_batches_delete on sklad_batches for delete using (is_org_admin(org_id));

-- ---------------------------------------------------------------------
-- sklad_batch_prices: narxlar — separate table, admin/owner-only end to end.
-- Only one policy (for all), no member select policy — that absence is what
-- actually blocks staff from ever seeing a price row.
-- ---------------------------------------------------------------------
create table sklad_batch_prices (
  batch_id uuid primary key references sklad_batches (id) on delete cascade,
  org_id uuid not null references organizations (id) on delete cascade,
  price_per_kg numeric(14, 2),
  price_per_piece numeric(14, 2),
  price_per_set numeric(14, 2),
  total_amount numeric(14, 2),
  purchase_cost numeric(14, 2),
  profit_percent numeric(6, 2),
  profit_amount numeric(14, 2),
  currency text not null default 'UZS',
  created_at timestamptz not null default now()
);

alter table sklad_batch_prices enable row level security;
create policy sklad_batch_prices_write on sklad_batch_prices
  for all using (is_org_admin(org_id)) with check (is_org_admin(org_id));
