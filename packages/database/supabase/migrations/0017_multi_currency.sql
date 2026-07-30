-- Multi-currency, on the Oracle NetSuite model.
--
-- Every entry keeps three things instead of one: the amount as transacted,
-- the currency it was transacted in, and the rate that applied on its own
-- date. The base-currency figure is derived from those and stored, so a
-- report run next year shows what the entry was worth when it happened —
-- not what it would be worth at today's rate.
--
-- `transactions.currency` has existed since 0001 but every write hardcoded
-- 'UZS', and nothing recorded a rate, so cross-currency reporting was
-- impossible even though the column suggested otherwise.

-- ---------------------------------------------------------------------
-- Precision. numeric(14,2) tops out just under a trillion, which UZS
-- reaches sooner than is comfortable, and two decimals is not enough for
-- a rate-converted figure to round-trip.
-- ---------------------------------------------------------------------
alter table transactions
  alter column debit_amount type numeric(20, 4),
  alter column credit_amount type numeric(20, 4);

create table currencies (
  code text primary key,
  symbol text not null,
  /** Decimal places for display. UZS is quoted whole in practice. */
  precision smallint not null default 2,
  created_at timestamptz not null default now()
);

insert into currencies (code, symbol, precision) values
  ('UZS', 'so''m', 0),
  ('USD', '$', 2),
  ('EUR', '€', 2),
  ('RUB', '₽', 2)
on conflict (code) do nothing;

alter table currencies enable row level security;
-- A shared reference list: readable by anyone signed in, writable by nobody
-- through the API (adding a currency is a migration, not a user action).
create policy currencies_select on currencies
  for select using (auth.uid() is not null);

-- ---------------------------------------------------------------------
-- Rates are per-org: two tenants may legitimately book the same day at
-- different rates (bank vs. central bank vs. contract rate).
-- ---------------------------------------------------------------------
create table exchange_rates (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  from_code text not null references currencies (code),
  to_code text not null references currencies (code),
  rate numeric(20, 8) not null check (rate > 0),
  effective_date date not null,
  created_by uuid references auth.users (id) default auth.uid(),
  created_at timestamptz not null default now(),
  unique (org_id, from_code, to_code, effective_date),
  check (from_code <> to_code)
);

create index exchange_rates_lookup_idx
  on exchange_rates (org_id, from_code, to_code, effective_date desc);

alter table exchange_rates enable row level security;
create policy exchange_rates_select on exchange_rates
  for select using (is_org_member(org_id));
create policy exchange_rates_write on exchange_rates
  for all using (can_write_finance(org_id)) with check (can_write_finance(org_id));

/**
 * The rate in force on `target_date`: the most recent quote on or before it.
 * Falls back to the inverse of the opposite pair, so quoting USD->UZS alone
 * is enough to convert in both directions. Returns null when nothing is
 * quoted, which callers treat as "cannot convert" rather than "rate 1".
 */
create function get_exchange_rate(
  target_org_id uuid,
  p_from text,
  p_to text,
  target_date date
)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_from = p_to then 1::numeric
    else coalesce(
      (select rate from exchange_rates
        where org_id = target_org_id and from_code = p_from and to_code = p_to
          and effective_date <= target_date
        order by effective_date desc limit 1),
      (select 1 / rate from exchange_rates
        where org_id = target_org_id and from_code = p_to and to_code = p_from
          and effective_date <= target_date
        order by effective_date desc limit 1)
    )
  end;
$$;

-- ---------------------------------------------------------------------
-- Base-currency amounts on every entry
-- ---------------------------------------------------------------------
alter table transactions
  add column exchange_rate numeric(20, 8),
  add column base_debit_amount numeric(20, 4),
  add column base_credit_amount numeric(20, 4);

/**
 * Fills the rate and the base amounts from the entry's own date. An explicit
 * `exchange_rate` on the payload wins — a contract rate agreed for one deal
 * has to be recordable even when it differs from the org's table.
 *
 * When no rate is quoted at all the entry still posts, at rate 1. Refusing
 * it would mean a single missing rate row blocks data entry, which is a
 * worse failure than a base figure that needs correcting later.
 */
create function set_transaction_base_amounts()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_base text;
  v_rate numeric;
begin
  select base_currency into v_base from organizations where id = new.org_id;
  v_base := coalesce(v_base, 'UZS');

  v_rate := coalesce(
    new.exchange_rate,
    get_exchange_rate(new.org_id, new.currency, v_base, new.occurred_at::date),
    1
  );

  new.exchange_rate := v_rate;
  new.base_debit_amount := round(new.debit_amount * v_rate, 4);
  new.base_credit_amount := round(new.credit_amount * v_rate, 4);
  return new;
end;
$$;

create trigger transactions_set_base_amounts
  before insert or update of debit_amount, credit_amount, currency, occurred_at, exchange_rate
  on transactions
  for each row execute function set_transaction_base_amounts();

-- Backfill: every existing row is base currency at rate 1.
update transactions
set exchange_rate = 1,
    base_debit_amount = debit_amount,
    base_credit_amount = credit_amount
where exchange_rate is null;
