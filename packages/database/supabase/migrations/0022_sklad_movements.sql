-- Stock movements: the warehouse balance stops being a number someone retypes.
--
-- Until now `sklad_batches.qoldiq_dona` was a plain editable field. Shipping a
-- batch meant setting its status to 'jonatildi' and *separately* remembering to
-- lower the remainder by hand — exactly the Excel habit this module was built
-- to replace, carried over intact. Nothing recorded that goods had left, so
-- "where did those 40 pieces go" had no answer anywhere in the system.
--
-- From here, qoldiq_dona is derived and never written by the app: it is the sum
-- of this batch's movements, maintained by trigger. The receipt of the batch
-- itself is the first movement, so the arithmetic starts complete.
--
-- Weight deliberately stays put. netto_kg is a weighing of the batch as it
-- arrived, and tara_kg / piece_weight_kg are generated from it — decrementing
-- it on every shipment would silently corrupt the piece weight. Remaining
-- weight is derived instead (piece_weight_kg x qoldiq_dona), in 0023.
--
-- Re-runnable, same as 0014-0021.

do $guard$
begin
  if not exists (select 1 from pg_type where typname = 'sklad_movement_kind') then
    create type sklad_movement_kind as enum (
      'kirim', 'chiqim', 'qaytarish', 'brak', 'korrektirovka'
    );
  end if;
end $guard$;

-- ---------------------------------------------------------------------
-- One row per physical event. `dona` and `kg` are signed: what the movement
-- did to the batch, not its absolute size. record_sklad_movement() below
-- applies the sign from the kind so callers pass a plain positive quantity.
--
-- 'korrektirovka' is the only kind whose sign is not implied — it is the
-- stocktake line, and a count can go either way.
-- ---------------------------------------------------------------------
create table if not exists sklad_movements (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  batch_id uuid not null references sklad_batches (id) on delete cascade,
  kind sklad_movement_kind not null,
  dona integer not null,
  kg numeric(12, 3),
  occurred_at date not null default current_date,
  counterparty_id uuid references counterparties (id),
  order_id uuid references sklad_orders (id),
  note text,
  /** The batch's own receipt, written by trigger and kept in step with
    * dona_soni. Never more than one per batch. */
  is_initial boolean not null default false,
  created_by uuid references auth.users (id) default auth.uid(),
  created_at timestamptz not null default now(),
  -- A stocktake line may legitimately be zero, and so may a receipt: a batch
  -- weighed in kg with no piece count recorded still has to exist.
  check (dona <> 0 or kind = 'korrektirovka' or is_initial)
);

create index if not exists sklad_movements_batch_idx
  on sklad_movements (batch_id, occurred_at desc, created_at desc);
create index if not exists sklad_movements_org_occurred_idx
  on sklad_movements (org_id, occurred_at desc);
create unique index if not exists sklad_movements_initial_key
  on sklad_movements (batch_id) where is_initial;

alter table sklad_movements enable row level security;

drop policy if exists sklad_movements_select on sklad_movements;
create policy sklad_movements_select on sklad_movements
  for select using (is_org_member(org_id));
drop policy if exists sklad_movements_insert on sklad_movements;
create policy sklad_movements_insert on sklad_movements
  for insert with check (is_org_member(org_id));
-- No update policy at all: a movement is a fact that happened. Correcting one
-- means recording the opposite movement, which is what a stock ledger is for.
-- Deleting is left to admins for the genuine mis-key.
drop policy if exists sklad_movements_delete on sklad_movements;
create policy sklad_movements_delete on sklad_movements
  for delete using (is_org_admin(org_id));


-- ---------------------------------------------------------------------
-- qoldiq_dona = sum of the batch's movements.
--
-- Refuses to leave the batch negative — a warehouse cannot hold minus forty
-- towels, and the alternative (letting it through and reporting nonsense) is
-- how stock figures stop being trusted. The message is user-facing: the web
-- form surfaces the raw Postgres error text.
-- ---------------------------------------------------------------------
create or replace function apply_sklad_movement()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_batch uuid := coalesce(new.batch_id, old.batch_id);
  v_total integer;
begin
  select coalesce(sum(dona), 0) into v_total
  from sklad_movements where batch_id = v_batch;

  if v_total < 0 then
    raise exception 'Ombor qoldig''i manfiy bo''la olmaydi (natija: % dona)', v_total;
  end if;

  update sklad_batches set qoldiq_dona = v_total where id = v_batch;
  return null;
end;
$$;

drop trigger if exists sklad_movements_apply on sklad_movements;
create trigger sklad_movements_apply
  after insert or update or delete on sklad_movements
  for each row execute function apply_sklad_movement();


-- ---------------------------------------------------------------------
-- The batch's own receipt.
--
-- Created with the batch and kept equal to dona_soni afterwards, so correcting
-- a miscounted intake stays a single edit on the batch. The `when` clause is
-- what keeps this from recursing: apply_sklad_movement() writes qoldiq_dona
-- back onto the batch, and that update leaves dona_soni untouched.
-- ---------------------------------------------------------------------
create or replace function sync_sklad_initial_movement()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into sklad_movements (org_id, batch_id, kind, dona, kg, occurred_at, order_id, is_initial)
    values (
      new.org_id, new.id, 'kirim', coalesce(new.dona_soni, 0), new.netto_kg,
      new.omborga_kirgan_sana, new.order_id, true
    );
  else
    update sklad_movements
    set dona = coalesce(new.dona_soni, 0), kg = new.netto_kg
    where batch_id = new.id and is_initial;
  end if;
  return null;
end;
$$;

drop trigger if exists sklad_batches_initial_movement on sklad_batches;
create trigger sklad_batches_initial_movement
  after insert on sklad_batches
  for each row execute function sync_sklad_initial_movement();

drop trigger if exists sklad_batches_sync_initial_movement on sklad_batches;
create trigger sklad_batches_sync_initial_movement
  after update on sklad_batches
  for each row
  when (old.dona_soni is distinct from new.dona_soni or old.netto_kg is distinct from new.netto_kg)
  execute function sync_sklad_initial_movement();


-- ---------------------------------------------------------------------
-- Recording a movement.
--
-- Takes a positive quantity and derives the sign, so a storekeeper is never
-- asked to reason about it. Runs with the caller's own rights: the insert
-- passes through the RLS policies above, and a non-member gets nothing.
--
-- Status follows the stock rather than being set by hand: a batch that has
-- shipped out entirely is 'jonatildi', one that is receiving again is back
-- 'omborda'. A partial shipment leaves the status alone — the goods are still
-- in the warehouse.
-- ---------------------------------------------------------------------
-- p_kind is text, not the enum: PostgREST passes RPC arguments as JSON, and an
-- enum parameter puts the client at the mercy of how that gets cast. Taking
-- text and casting here fails loudly on a bad value instead of at the protocol
-- boundary, and keeps the signature stable if a kind is ever added.
create or replace function record_sklad_movement(
  p_batch_id uuid,
  p_kind text,
  p_dona integer,
  p_kg numeric default null,
  p_occurred_at date default null,
  p_counterparty_id uuid default null,
  p_order_id uuid default null,
  p_note text default null
)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_kind sklad_movement_kind := p_kind::sklad_movement_kind;
  v_org uuid;
  v_piece_weight numeric;
  v_signed integer;
  v_kg numeric;
  v_id uuid;
  v_remaining integer;
begin
  select org_id, piece_weight_kg into v_org, v_piece_weight
  from sklad_batches where id = p_batch_id;

  if v_org is null then
    raise exception 'Partiya topilmadi';
  end if;

  if coalesce(p_dona, 0) = 0 and v_kind <> 'korrektirovka' then
    raise exception 'Miqdorni kiriting';
  end if;

  if v_kind = 'korrektirovka' then
    -- The only kind that may legitimately arrive as zero, and the only one
    -- whose sign is the caller's to choose.
    v_signed := coalesce(p_dona, 0);
  elsif v_kind in ('chiqim', 'brak') then
    v_signed := -abs(p_dona);
  else
    v_signed := abs(p_dona);
  end if;

  -- Falls back to the batch's own per-piece weight so a shipment carries a
  -- sensible kg figure without the storekeeper reaching for a calculator.
  v_kg := coalesce(p_kg * sign(v_signed), round(v_piece_weight * v_signed, 3));

  insert into sklad_movements
    (org_id, batch_id, kind, dona, kg, occurred_at, counterparty_id, order_id, note)
  values
    (v_org, p_batch_id, v_kind, v_signed, v_kg,
     coalesce(p_occurred_at, current_date), p_counterparty_id, p_order_id, p_note)
  returning id into v_id;

  select qoldiq_dona into v_remaining from sklad_batches where id = p_batch_id;

  update sklad_batches
  set status = case
        when v_kind = 'qaytarish' then 'qaytarildi'::sklad_batch_status
        when v_remaining = 0 and v_kind = 'chiqim' then 'jonatildi'::sklad_batch_status
        when v_remaining = 0 and v_kind = 'brak' then 'brak'::sklad_batch_status
        when v_remaining > 0 and v_kind = 'kirim' and status in ('jonatildi', 'brak')
          then 'omborda'::sklad_batch_status
        else status
      end
  where id = p_batch_id;

  return v_id;
end;
$$;


-- ---------------------------------------------------------------------
-- Backfill.
--
-- Every batch predating this migration gets its receipt. Where the recorded
-- remainder already differs from what came in, the gap is booked as a
-- 'korrektirovka' rather than as an invented shipment — we know the stock was
-- adjusted, we do not know that it was sold, and the log should not claim to.
-- Net effect: today's qoldiq figures come out of the migration unchanged.
-- ---------------------------------------------------------------------
-- Row by row, because inserting the receipt immediately rewrites qoldiq_dona
-- through the trigger — a second set-based statement would then read the value
-- this migration just derived instead of the one it is trying to preserve. The
-- FOR loop's cursor holds the pre-migration snapshot.
do $backfill$
declare
  r record;
begin
  for r in
    select b.id, b.org_id, b.dona_soni, b.netto_kg, b.omborga_kirgan_sana, b.order_id, b.qoldiq_dona
    from sklad_batches b
    where not exists (select 1 from sklad_movements m where m.batch_id = b.id and m.is_initial)
  loop
    insert into sklad_movements
      (org_id, batch_id, kind, dona, kg, occurred_at, order_id, is_initial)
    values
      (r.org_id, r.id, 'kirim', coalesce(r.dona_soni, 0), r.netto_kg, r.omborga_kirgan_sana,
       r.order_id, true);

    if r.qoldiq_dona is not null and r.qoldiq_dona <> coalesce(r.dona_soni, 0) then
      insert into sklad_movements (org_id, batch_id, kind, dona, occurred_at, note)
      values (
        r.org_id, r.id, 'korrektirovka', r.qoldiq_dona - coalesce(r.dona_soni, 0),
        r.omborga_kirgan_sana, 'Migratsiya 0022: mavjud qoldiqqa moslashtirildi'
      );
    end if;
  end loop;
end $backfill$;

do $guard$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'sklad_movements'
  ) then
    alter publication supabase_realtime add table sklad_movements;
  end if;
end $guard$;
