-- The client journal, an account manager on every client, and the currencies
-- this business actually trades in.
--
-- Three things, one migration, because they are one screen: the overview needs
-- a list of every client showing who looks after them, what is past due and
-- what is owed in total — and the currency each of those figures is kept in.
--
-- The two debt figures are genuinely different, which they were not before.
-- Total debt is the balance today. Past-due debt is what was outstanding when
-- the deadline passed and has not been paid off since — capped at the current
-- balance, because a client cannot owe more overdue than they owe. Pay some of
-- it down and the past-due figure falls; let the debt grow afterwards and only
-- the total moves. That is the distinction between "kechikkan" and "jami" that
-- a single number cannot carry.
--
-- Computed from `transactions` rather than account_month_balances: a due date
-- lands on a day and the summary is per month, so aging against it there would
-- be a month out. One grouped pass over an indexed column, for a screen that
-- lists clients rather than entries.
--
-- Re-runnable, same as 0014-0031.


-- ---------------------------------------------------------------------
-- Currencies. Adding a row here is a migration rather than a user action —
-- exchange_rates and every price column reference this table by code.
-- ---------------------------------------------------------------------
insert into currencies (code, symbol, precision) values
  ('KZT', '₸', 2),      -- Qozog'iston tengesi
  ('KGS', 'som', 2),    -- Qirg'iziston somi
  ('TJS', 'SM', 2),     -- Tojikiston somoniysi
  ('AZN', '₼', 2),      -- Ozarbayjon manati
  ('AFN', '؋', 2),      -- Afg'oniston afg'oniysi
  ('CNY', '¥', 2),      -- Xitoy yuani
  ('GBP', '£', 2)       -- Britaniya funti
on conflict (code) do nothing;


-- ---------------------------------------------------------------------
-- Who looks after this client.
--
-- Shipments and invoices already carry a manager, but those answer "who
-- handled this despatch". This answers "whose client is this", which is the
-- column the journal is sorted and filtered by when someone asks why a debt
-- has been sitting there for a month.
-- ---------------------------------------------------------------------
alter table counterparties add column if not exists manager_id uuid references auth.users (id);

create index if not exists counterparties_manager_idx
  on counterparties (manager_id) where manager_id is not null;


-- ---------------------------------------------------------------------
-- One row per client, with everything the journal and the debtors panel show.
--
-- SECURITY DEFINER only to resolve the manager through auth.users / profiles,
-- which a member cannot read directly — hence the explicit membership check,
-- the same shape as every other function here that does this.
-- ---------------------------------------------------------------------
create or replace function counterparty_journal(
  target_org_id uuid,
  p_search text default null,
  p_manager_id uuid default null,
  p_currency text default null,
  p_only_debtors boolean default false,
  p_only_overdue boolean default false,
  p_as_of date default null
)
returns table (
  counterparty_id uuid,
  counterparty_name text,
  phone text,
  currency text,
  categories text[],
  manager_id uuid,
  manager_name text,
  total_debt numeric,
  overdue_amount numeric,
  overdue_date date,
  next_due_date date,
  last_entry_at timestamptz,
  entry_count bigint
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  with cutoff as (select coalesce(p_as_of, current_date) as day),
  ledger as (
    select
      t.counterparty_id,
      t.occurred_at,
      t.due_date,
      -- Signed movement on the receivable: what the client owes, per entry.
      case when da.type = 'receivable' then t.base_debit_amount else 0 end
        - case when ca.type = 'receivable' then t.base_credit_amount else 0 end as delta,
      -- The payment side on its own, for the aging below.
      case when ca.type = 'receivable' then t.base_credit_amount else 0 end as paid
    from transactions t
    join accounts da on da.id = t.debit_account_id
    join accounts ca on ca.id = t.credit_account_id
    where t.org_id = target_org_id
      and t.status <> 'draft'
      and (da.type = 'receivable' or ca.type = 'receivable')
  ),
  agg as (
    select
      c.id,
      coalesce(sum(l.delta), 0) as balance,
      max(l.occurred_at) as last_entry_at,
      count(l.*) as entry_count,
      min(l.due_date) filter (where l.due_date < (select day from cutoff)) as overdue_date,
      min(l.due_date) filter (where l.due_date >= (select day from cutoff)) as next_due_date
    from counterparties c
    left join ledger l on l.counterparty_id = c.id
    where c.org_id = target_org_id
    group by c.id
  )
  select
    c.id,
    c.name,
    c.phone,
    coalesce(c.currency, o.base_currency, 'UZS'),
    c.categories,
    c.manager_id,
    coalesce(p.full_name, u.email),
    round(greatest(a.balance, 0), 2) as total_debt,
    -- What was outstanding when the deadline passed, less everything paid
    -- since. Oldest debt settles first, which is how anyone reading an aged
    -- receivable expects it to behave: a payment lowers the overdue part,
    -- a *new* debt raises the total and leaves the overdue part alone, and
    -- paying past it clears it while the newer debt remains in the total.
    round(
      greatest(
        least(coalesce(aged.balance_then, 0) - coalesce(aged.paid_after, 0), a.balance),
        0
      ),
      2
    ) as overdue_amount,
    a.overdue_date,
    a.next_due_date,
    a.last_entry_at,
    a.entry_count
  from counterparties c
  join agg a on a.id = c.id
  join organizations o on o.id = c.org_id
  left join auth.users u on u.id = c.manager_id
  left join profiles p on p.id = c.manager_id
  left join lateral (
    select
      sum(l.delta) filter (where l.occurred_at::date <= a.overdue_date) as balance_then,
      sum(l.paid) filter (where l.occurred_at::date > a.overdue_date) as paid_after
    from ledger l
    where l.counterparty_id = c.id
      and a.overdue_date is not null
  ) aged on true
  where c.org_id = target_org_id
    and is_org_member(target_org_id)
    and (p_manager_id is null or c.manager_id = p_manager_id)
    and (p_currency is null or p_currency = '' or coalesce(c.currency, o.base_currency) = p_currency)
    and (not coalesce(p_only_debtors, false) or a.balance > 0)
    and (
      not coalesce(p_only_overdue, false)
      or (a.overdue_date is not null and a.balance > 0)
    )
    and (
      p_search is null or p_search = '' or
      c.name ilike '%' || p_search || '%' or
      c.phone ilike '%' || p_search || '%' or
      coalesce(p.full_name, u.email) ilike '%' || p_search || '%'
    )
  order by round(greatest(a.balance, 0), 2) desc, c.name;
$$;
