-- A real general ledger underneath the journal.
--
-- `transactions` stores a two-sided posting in one row (debit account +
-- credit account + both amounts) — the 1C shape, and a correct one, but
-- nothing in the database checked that the two sides agreed, and every report
-- had to re-derive per-account figures by scanning the whole table in the
-- browser.
--
-- Three things here, in Oracle NetSuite's shape:
--   * the balance rule enforced by the database, not by application code;
--   * transaction_lines — the GL rows, one per leg, which is what a
--     "GL Impact" view reads and what a future multi-line entry will write
--     directly without another data migration;
--   * account_month_balances — running per-account, per-client, per-month
--     totals maintained incrementally, so a dashboard reads a handful of
--     summary rows instead of every entry the org has ever made.
--
-- transaction_lines is derived from transactions by trigger today. That keeps
-- every existing write path — web, mobile offline sync, the reversal RPC —
-- working untouched while the reporting side moves onto the ledger shape.

-- ---------------------------------------------------------------------
-- The balance rule
-- ---------------------------------------------------------------------
alter table transactions
  add constraint transactions_balanced check (debit_amount = credit_amount),
  add constraint transactions_distinct_accounts check (debit_account_id <> credit_account_id);

-- ---------------------------------------------------------------------
-- transaction_lines: the GL rows
-- ---------------------------------------------------------------------
create table transaction_lines (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references transactions (id) on delete cascade,
  org_id uuid not null references organizations (id) on delete cascade,
  line_no smallint not null,
  account_id uuid not null references accounts (id),
  counterparty_id uuid not null references counterparties (id) on delete cascade,
  debit numeric(20, 4) not null default 0 check (debit >= 0),
  credit numeric(20, 4) not null default 0 check (credit >= 0),
  base_debit numeric(20, 4) not null default 0,
  base_credit numeric(20, 4) not null default 0,
  currency text not null,
  occurred_at timestamptz not null,
  memo text,
  unique (transaction_id, line_no),
  -- A line moves money one way. Both sides on one line is a modelling error.
  check (not (debit > 0 and credit > 0))
);

create index transaction_lines_gl_idx
  on transaction_lines (org_id, account_id, occurred_at);
create index transaction_lines_counterparty_idx
  on transaction_lines (org_id, counterparty_id, occurred_at);

alter table transaction_lines enable row level security;

-- Read-only to the API: lines are written by the trigger below, never
-- directly, so there is deliberately no insert/update/delete policy.
create policy transaction_lines_select on transaction_lines
  for select using (is_org_member(org_id));

-- SECURITY DEFINER because transaction_lines has no insert policy at all —
-- that absence is what keeps the GL read-only to the API. Without it this
-- trigger runs as the caller and every posting fails on its own side effect.
create function sync_transaction_lines()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from transaction_lines where transaction_id = new.id;

  -- A reversed entry and its mirror both keep their lines: they net to zero
  -- against each other, which is exactly how the ledger should read. Only a
  -- draft has no GL effect yet.
  if new.status = 'draft' then
    return new;
  end if;

  insert into transaction_lines (
    transaction_id, org_id, line_no, account_id, counterparty_id,
    debit, credit, base_debit, base_credit, currency, occurred_at, memo
  ) values
    (new.id, new.org_id, 1, new.debit_account_id, new.counterparty_id,
     new.debit_amount, 0, coalesce(new.base_debit_amount, new.debit_amount), 0,
     new.currency, new.occurred_at, new.description),
    (new.id, new.org_id, 2, new.credit_account_id, new.counterparty_id,
     0, new.credit_amount, 0, coalesce(new.base_credit_amount, new.credit_amount),
     new.currency, new.occurred_at, new.description);

  return new;
end;
$$;

create trigger transactions_sync_lines
  after insert or update on transactions
  for each row execute function sync_transaction_lines();

-- Defence in depth: even though the trigger above always writes a balanced
-- pair, the ledger asserts it for itself. Deferred, so the two inserts of a
-- pair are judged together at commit rather than mid-statement.
create function assert_transaction_lines_balanced()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_id uuid := coalesce(new.transaction_id, old.transaction_id);
  v_debit numeric;
  v_credit numeric;
begin
  select coalesce(sum(debit), 0), coalesce(sum(credit), 0)
    into v_debit, v_credit
  from transaction_lines where transaction_id = v_id;

  if v_debit <> v_credit then
    raise exception 'general ledger out of balance for transaction %: debit % <> credit %',
      v_id, v_debit, v_credit;
  end if;

  return null;
end;
$$;

create constraint trigger transaction_lines_balanced
  after insert or update or delete on transaction_lines
  deferrable initially deferred
  for each row execute function assert_transaction_lines_balanced();

-- ---------------------------------------------------------------------
-- account_month_balances: the summary Oracle keeps per account per period
--
-- Keyed by calendar month rather than by an accounting_periods row: an org
-- that has not generated periods still gets fast dashboards, and closing a
-- month never has to rebuild anything.
-- ---------------------------------------------------------------------
create table account_month_balances (
  org_id uuid not null references organizations (id) on delete cascade,
  month date not null,
  account_id uuid not null references accounts (id) on delete cascade,
  counterparty_id uuid not null references counterparties (id) on delete cascade,
  debit_total numeric(20, 4) not null default 0,
  credit_total numeric(20, 4) not null default 0,
  base_debit_total numeric(20, 4) not null default 0,
  base_credit_total numeric(20, 4) not null default 0,
  primary key (org_id, month, account_id, counterparty_id)
);

create index account_month_balances_org_month_idx on account_month_balances (org_id, month);

alter table account_month_balances enable row level security;
create policy account_month_balances_select on account_month_balances
  for select using (is_org_member(org_id));

-- Same reason as sync_transaction_lines(): the summary table is read-only
-- to the API, so the code that maintains it has to own the write.
create function apply_line_to_balances(
  p_org_id uuid,
  p_occurred_at timestamptz,
  p_account_id uuid,
  p_counterparty_id uuid,
  p_debit numeric,
  p_credit numeric,
  p_base_debit numeric,
  p_base_credit numeric
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into account_month_balances as b (
    org_id, month, account_id, counterparty_id,
    debit_total, credit_total, base_debit_total, base_credit_total
  ) values (
    p_org_id, date_trunc('month', p_occurred_at)::date, p_account_id, p_counterparty_id,
    p_debit, p_credit, p_base_debit, p_base_credit
  )
  on conflict (org_id, month, account_id, counterparty_id) do update set
    debit_total = b.debit_total + excluded.debit_total,
    credit_total = b.credit_total + excluded.credit_total,
    base_debit_total = b.base_debit_total + excluded.base_debit_total,
    base_credit_total = b.base_credit_total + excluded.base_credit_total;
$$;

create function maintain_account_month_balances()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Deletes and updates back their old figures out first, so an edit is a
  -- reversal plus a re-apply rather than a recount of the whole month.
  if tg_op in ('UPDATE', 'DELETE') then
    if exists (select 1 from organizations where id = old.org_id) then
      perform apply_line_to_balances(
        old.org_id, old.occurred_at, old.account_id, old.counterparty_id,
        -old.debit, -old.credit, -old.base_debit, -old.base_credit
      );
    end if;
  end if;

  if tg_op in ('INSERT', 'UPDATE') then
    perform apply_line_to_balances(
      new.org_id, new.occurred_at, new.account_id, new.counterparty_id,
      new.debit, new.credit, new.base_debit, new.base_credit
    );
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger transaction_lines_maintain_balances
  after insert or update or delete on transaction_lines
  for each row execute function maintain_account_month_balances();

-- ---------------------------------------------------------------------
-- Backfill
-- ---------------------------------------------------------------------
insert into transaction_lines (
  transaction_id, org_id, line_no, account_id, counterparty_id,
  debit, credit, base_debit, base_credit, currency, occurred_at, memo
)
select t.id, t.org_id, 1, t.debit_account_id, t.counterparty_id,
       t.debit_amount, 0, coalesce(t.base_debit_amount, t.debit_amount), 0,
       t.currency, t.occurred_at, t.description
from transactions t where t.status <> 'draft'
union all
select t.id, t.org_id, 2, t.credit_account_id, t.counterparty_id,
       0, t.credit_amount, 0, coalesce(t.base_credit_amount, t.credit_amount),
       t.currency, t.occurred_at, t.description
from transactions t where t.status <> 'draft';

-- ---------------------------------------------------------------------
-- Server-side aggregates — what the dashboard reads instead of every row
-- ---------------------------------------------------------------------

/** Closing balance per client, from the summary table. Positive = the client owes us. */
create function counterparty_balances(target_org_id uuid, p_as_of date default null)
returns table (
  counterparty_id uuid,
  counterparty_name text,
  balance numeric,
  base_balance numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.id,
    c.name,
    coalesce(sum(b.debit_total - b.credit_total), 0),
    coalesce(sum(b.base_debit_total - b.base_credit_total), 0)
  from counterparties c
  left join account_month_balances b
    on b.counterparty_id = c.id
   and (p_as_of is null or b.month <= date_trunc('month', p_as_of)::date)
  left join accounts a on a.id = b.account_id and a.type = 'receivable'
  where c.org_id = target_org_id
    and is_org_member(target_org_id)
    and (b.account_id is null or a.id is not null)
  group by c.id, c.name
  order by 3 desc;
$$;

/** Turnover for a date range, read from the monthly summary. */
create function org_period_totals(
  target_org_id uuid,
  p_from date default null,
  p_to date default null
)
returns table (total_kirim numeric, total_chiqim numeric, net numeric)
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(sum(b.base_debit_total), 0) as total_kirim,
    coalesce(sum(b.base_credit_total), 0) as total_chiqim,
    coalesce(sum(b.base_debit_total - b.base_credit_total), 0) as net
  from account_month_balances b
  join accounts a on a.id = b.account_id and a.type = 'receivable'
  where b.org_id = target_org_id
    and is_org_member(target_org_id)
    and (p_from is null or b.month >= date_trunc('month', p_from)::date)
    and (p_to is null or b.month <= date_trunc('month', p_to)::date);
$$;
