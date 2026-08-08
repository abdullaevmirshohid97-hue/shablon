-- Sklad hardening: indexes, product identity, money precision, change history,
-- and live updates.
--
-- 0011 laid out the tables correctly but left the operational layer empty: not
-- one index (Postgres does not index a foreign key for you), nothing stopping
-- the same artikul being carded twice, prices pinned to a currency column no
-- write ever set, and no record of who changed a batch or a price. Finance got
-- all of that in 0013/0017; the warehouse — where a disputed number is usually
-- about physical goods and someone's shift — never did.
--
-- Re-runnable, same as 0014-0020: these are applied by hand in the Supabase SQL
-- editor, where a half-finished run leaves committed statements behind.


-- ---------------------------------------------------------------------
-- Indexes.
--
-- The batch list is read one way above all others: this org, newest arrival
-- first. Everything else (item, order, status) narrows that set.
-- ---------------------------------------------------------------------
create index if not exists sklad_batches_org_received_idx
  on sklad_batches (org_id, omborga_kirgan_sana desc, created_at desc);
create index if not exists sklad_batches_org_status_idx
  on sklad_batches (org_id, status);
create index if not exists sklad_batches_item_idx
  on sklad_batches (item_id);
create index if not exists sklad_batches_order_idx
  on sklad_batches (order_id) where order_id is not null;

create index if not exists sklad_items_org_name_idx on sklad_items (org_id, name);
create index if not exists sklad_lookups_org_kind_idx on sklad_lookups (org_id, kind, name);
create index if not exists sklad_orders_org_created_idx on sklad_orders (org_id, created_at desc);
create index if not exists sklad_orders_counterparty_idx
  on sklad_orders (counterparty_id) where counterparty_id is not null;
create index if not exists sklad_batch_prices_org_idx on sklad_batch_prices (org_id);

-- The six lookup columns on a product card are all filtered on from the list
-- screen, and each is highly selective.
create index if not exists sklad_items_product_type_idx
  on sklad_items (product_type_id) where product_type_id is not null;
create index if not exists sklad_items_color_idx
  on sklad_items (color_id) where color_id is not null;
create index if not exists sklad_items_size_idx
  on sklad_items (size_id) where size_id is not null;
create index if not exists sklad_items_sort_idx
  on sklad_items (sort_id) where sort_id is not null;


-- ---------------------------------------------------------------------
-- Money.
--
-- Two problems, one cause: nothing ever wrote `currency`, so every price row
-- claims UZS regardless of what was typed — and the invoices this warehouse
-- actually works from are quoted in USD. Widening to the 0017 shape (20,4)
-- while we are here: numeric(14,2) tops out just under a trillion, which UZS
-- reaches sooner than is comfortable.
-- ---------------------------------------------------------------------
do $guard$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'sklad_batch_prices'
      and column_name = 'price_per_kg'
      and numeric_precision = 20
      and numeric_scale = 4
  ) then
    alter table sklad_batch_prices
      alter column price_per_kg type numeric(20, 4),
      alter column price_per_piece type numeric(20, 4),
      alter column price_per_set type numeric(20, 4),
      alter column total_amount type numeric(20, 4),
      alter column purchase_cost type numeric(20, 4),
      alter column profit_amount type numeric(20, 4);
  end if;
end $guard$;

-- Ties the column to the shared currency list from 0017 instead of accepting
-- any string. 'UZS' is already in that table, so existing rows validate.
do $guard$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'sklad_batch_prices_currency_fkey'
  ) then
    alter table sklad_batch_prices
      add constraint sklad_batch_prices_currency_fkey
      foreign key (currency) references currencies (code);
  end if;
end $guard$;


-- ---------------------------------------------------------------------
-- Change history.
--
-- One log for the whole module rather than a table per entity: the question
-- asked in practice is "what happened to this batch", and the answer spans the
-- batch row, its price and its product card.
--
-- Inserts are logged for prices and skipped elsewhere — batches, items and
-- orders all carry `created_by`, so their creation is already described by the
-- surviving row. sklad_batch_prices has no such column and a first price is
-- exactly as interesting as a changed one.
-- ---------------------------------------------------------------------
create table if not exists sklad_audit (
  id bigint generated always as identity primary key,
  org_id uuid not null references organizations (id) on delete cascade,
  entity text not null check (entity in ('batch', 'item', 'price', 'order')),
  -- Deliberately not a foreign key: a delete must leave its audit row behind,
  -- which a references-cascade would remove along with the record.
  entity_id uuid not null,
  action text not null check (action in ('insert', 'update', 'delete')),
  changed_by uuid references auth.users (id),
  changed_at timestamptz not null default now(),
  old_row jsonb,
  new_row jsonb
);

create index if not exists sklad_audit_org_changed_idx on sklad_audit (org_id, changed_at desc);
create index if not exists sklad_audit_entity_idx on sklad_audit (entity, entity_id);

alter table sklad_audit enable row level security;

-- Read is admin-only; there is deliberately no insert/update/delete policy at
-- all, so the SECURITY DEFINER trigger below is the only thing that can write
-- here and the log cannot be edited from the app by anyone.
drop policy if exists sklad_audit_select on sklad_audit;
create policy sklad_audit_select on sklad_audit
  for select using (is_org_admin(org_id));

create or replace function log_sklad_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entity text := tg_argv[0];
  v_old jsonb;
  v_new jsonb;
begin
  if tg_op = 'DELETE' then
    v_old := to_jsonb(old);
  elsif tg_op = 'INSERT' then
    v_new := to_jsonb(new);
  else
    v_old := to_jsonb(old);
    v_new := to_jsonb(new);
    -- qoldiq_dona is maintained by the movement trigger in 0022. A change to
    -- it alone is the stock ledger doing its job, not a person editing a row,
    -- and logging it would bury the edits that matter under machine noise.
    if (v_old - 'qoldiq_dona') = (v_new - 'qoldiq_dona') then
      return null;
    end if;
  end if;

  insert into sklad_audit (org_id, entity, entity_id, action, changed_by, old_row, new_row)
  values (
    coalesce((v_new ->> 'org_id')::uuid, (v_old ->> 'org_id')::uuid),
    v_entity,
    -- sklad_batch_prices is keyed by batch_id, every other table by id.
    coalesce(
      (v_new ->> 'id')::uuid, (v_old ->> 'id')::uuid,
      (v_new ->> 'batch_id')::uuid, (v_old ->> 'batch_id')::uuid
    ),
    lower(tg_op),
    auth.uid(),
    v_old,
    v_new
  );
  -- AFTER row trigger: the return value is ignored.
  return null;
end;
$$;

drop trigger if exists sklad_batches_audit on sklad_batches;
create trigger sklad_batches_audit
  after update or delete on sklad_batches
  for each row execute function log_sklad_change('batch');

drop trigger if exists sklad_items_audit on sklad_items;
create trigger sklad_items_audit
  after update or delete on sklad_items
  for each row execute function log_sklad_change('item');

drop trigger if exists sklad_orders_audit on sklad_orders;
create trigger sklad_orders_audit
  after update or delete on sklad_orders
  for each row execute function log_sklad_change('order');

drop trigger if exists sklad_batch_prices_audit on sklad_batch_prices;
create trigger sklad_batch_prices_audit
  after insert or update or delete on sklad_batch_prices
  for each row execute function log_sklad_change('price');


-- ---------------------------------------------------------------------
-- Readable feed for the admin screen.
--
-- SECURITY DEFINER because it resolves the actor through auth.users/profiles,
-- which no member may read directly — so the org-admin check is made here,
-- explicitly, exactly as list_transaction_audit does.
--
-- The product is resolved from whichever id the row happens to carry: the
-- batch's item_id, the price's batch_id, or the item row itself. Any of those
-- records may since have been deleted, hence left joins throughout.
-- ---------------------------------------------------------------------
create or replace function list_sklad_audit(target_org_id uuid, p_limit integer default 100)
returns table (
  id bigint,
  entity text,
  entity_id uuid,
  action text,
  changed_at timestamptz,
  changed_by_name text,
  item_name text,
  artikul text,
  old_row jsonb,
  new_row jsonb
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  select
    a.id,
    a.entity,
    a.entity_id,
    a.action,
    a.changed_at,
    coalesce(p.full_name, u.email) as changed_by_name,
    i.name as item_name,
    i.artikul,
    a.old_row,
    a.new_row
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
-- Live updates. Two storekeepers on two screens were not seeing each other's
-- entries: only `transactions` was ever added to the publication (0001).
-- ---------------------------------------------------------------------
do $guard$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'sklad_batches'
  ) then
    alter publication supabase_realtime add table sklad_batches;
  end if;
end $guard$;


-- ---------------------------------------------------------------------
-- Product identity.
--
-- Last in the file on purpose: it is the one section that can refuse to apply,
-- and everything above is worth having even on an org whose data needs
-- cleaning first.
--
-- Artikul is how the floor refers to a product out loud. Two cards sharing one
-- means two stock figures for the same cloth, and nothing in the app would
-- ever say which is right. Empty stays free-form — a card may legitimately not
-- have one yet.
--
-- Guarded rather than attempted-and-failed, because an org that already has
-- duplicates needs to be told which ones, not handed a bare index error. Merge
-- them, then re-run this file: everything else is a no-op the second time.
-- ---------------------------------------------------------------------
do $guard$
declare
  v_dupes text;
begin
  select string_agg(format('%s (%s x)', artikul, n), ', ')
  into v_dupes
  from (
    select artikul, count(*) as n
    from sklad_items
    where artikul is not null and artikul <> ''
    group by org_id, artikul
    having count(*) > 1
  ) d;

  if v_dupes is not null then
    raise exception
      'Bir xil artikul bilan bir nechta mahsulot kartasi bor: %. Avval ularni birlashtiring.',
      v_dupes;
  end if;
end $guard$;

create unique index if not exists sklad_items_org_artikul_key
  on sklad_items (org_id, artikul) where artikul is not null and artikul <> '';
