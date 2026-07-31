-- Reporting moves into the database.
--
-- Every dashboard figure was derived in the browser from `useOrgOverview`,
-- which fetched the org's entire transaction table on each visit — no limit,
-- no aggregation, the whole ledger over the wire so JavaScript could sum it.
-- That is fine at a few hundred rows and unusable at fifty thousand.
--
-- 0018 added account_month_balances and two aggregates on top of it. These
-- are the rest: the category breakdown, overdue and due-soon, the per-module
-- table, and a ledger page that carries its own running balance.
--
-- Re-runnable, same as 0014-0018.

-- ---------------------------------------------------------------------
-- Turnover by category, for the period panel.
--
-- Read from transactions rather than account_month_balances because the
-- breakdown needs category, unit and quantity, which a per-account monthly
-- summary deliberately does not carry.
-- ---------------------------------------------------------------------
create or replace function org_category_breakdown(
  target_org_id uuid,
  p_from date default null,
  p_to date default null,
  p_category text default null
)
returns table (
  category_name text,
  unit text,
  kind text,
  total_quantity numeric,
  total_amount numeric,
  entry_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(tc.name, '—') as category_name,
    t.unit,
    case when da.type = 'receivable' then 'kirim' else 'chiqim' end as kind,
    coalesce(sum(t.quantity), 0) as total_quantity,
    sum(case when da.type = 'receivable' then t.base_debit_amount else t.base_credit_amount end),
    count(*)
  from transactions t
  join accounts da on da.id = t.debit_account_id
  join accounts ca on ca.id = t.credit_account_id
  join counterparties c on c.id = t.counterparty_id
  left join transaction_categories tc on tc.id = t.category_id
  where t.org_id = target_org_id
    and is_org_member(target_org_id)
    and t.status <> 'draft'
    and (da.type = 'receivable' or ca.type = 'receivable')
    and (p_from is null or t.occurred_at::date >= p_from)
    and (p_to is null or t.occurred_at::date <= p_to)
    and (p_category is null or p_category = any(c.categories))
  group by 1, 2, 3
  order by 5 desc;
$$;

-- ---------------------------------------------------------------------
-- Overdue debt per client. Independent of the period filter — it is a
-- statement of where things stand now, not of what happened in a window.
-- ---------------------------------------------------------------------
create or replace function org_overdue_by_counterparty(
  target_org_id uuid,
  p_as_of date default null,
  p_category text default null
)
returns table (
  counterparty_id uuid,
  counterparty_name text,
  overdue_amount numeric,
  overdue_date date
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.id,
    c.name,
    sum(t.base_credit_amount),
    min(t.due_date)
  from transactions t
  join accounts ca on ca.id = t.credit_account_id and ca.type = 'receivable'
  join counterparties c on c.id = t.counterparty_id
  where t.org_id = target_org_id
    and is_org_member(target_org_id)
    and t.status <> 'draft'
    and t.due_date is not null
    and t.due_date < coalesce(p_as_of, current_date)
    and (p_category is null or p_category = any(c.categories))
  group by c.id, c.name
  order by 3 desc;
$$;

/** Obligations falling due inside the next `p_within_days`. */
create or replace function org_due_soon(
  target_org_id uuid,
  p_within_days integer default 7,
  p_category text default null
)
returns table (
  transaction_id uuid,
  counterparty_name text,
  description text,
  amount numeric,
  due_date date
)
language sql
stable
security definer
set search_path = public
as $$
  select t.id, c.name, t.description, t.base_credit_amount, t.due_date
  from transactions t
  join accounts ca on ca.id = t.credit_account_id and ca.type = 'receivable'
  join counterparties c on c.id = t.counterparty_id
  where t.org_id = target_org_id
    and is_org_member(target_org_id)
    and t.status <> 'draft'
    and t.due_date between current_date and current_date + coalesce(p_within_days, 7)
    and (p_category is null or p_category = any(c.categories))
  order by t.due_date;
$$;

-- ---------------------------------------------------------------------
-- Per-module totals. `counterparties.categories` is a text[] of module
-- names, so a client tagged with two modules counts in both — which is
-- what the on-screen table has always shown.
-- ---------------------------------------------------------------------
create or replace function org_module_breakdown(
  target_org_id uuid,
  p_from date default null,
  p_to date default null
)
returns table (
  module_name text,
  counterparty_count bigint,
  total_kirim numeric,
  total_chiqim numeric,
  balance numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select
    m.name,
    count(distinct c.id),
    coalesce(sum(case when da.type = 'receivable' then t.base_debit_amount else 0 end), 0),
    coalesce(sum(case when ca.type = 'receivable' then t.base_credit_amount else 0 end), 0),
    coalesce(sum(
      case when da.type = 'receivable' then t.base_debit_amount else 0 end
    - case when ca.type = 'receivable' then t.base_credit_amount else 0 end), 0)
  from modules m
  left join counterparties c on c.org_id = m.org_id and m.name = any(c.categories)
  left join transactions t
    on t.counterparty_id = c.id
   and t.status <> 'draft'
   and (p_from is null or t.occurred_at::date >= p_from)
   and (p_to is null or t.occurred_at::date <= p_to)
  left join accounts da on da.id = t.debit_account_id
  left join accounts ca on ca.id = t.credit_account_id
  where m.org_id = target_org_id and is_org_member(target_org_id)
  group by m.name
  order by m.name;
$$;

-- ---------------------------------------------------------------------
-- One page of a client's ledger, newest first, each row carrying the
-- running balance it had at that point.
--
-- The balance is a window function over the client's *whole* history, so a
-- page is correct standing alone. Computing it in the browser is what forced
-- every row to be downloaded before the first one could be drawn.
--
-- Keyset, not OFFSET: paging by (occurred_at, created_at) stays correct when
-- an entry is inserted mid-scroll, and stays fast at any depth.
-- ---------------------------------------------------------------------
create or replace function counterparty_ledger_page(
  p_counterparty_id uuid,
  p_limit integer default 100,
  p_before_occurred_at timestamptz default null,
  p_before_created_at timestamptz default null
)
returns table (
  id uuid,
  document_no text,
  occurred_at timestamptz,
  created_at timestamptz,
  due_date date,
  description text,
  quantity numeric,
  unit text,
  quantity_kg numeric,
  quantity_dona numeric,
  debit_account_type account_type,
  debit_amount numeric,
  credit_account_type account_type,
  credit_amount numeric,
  currency text,
  source fund_source,
  status transaction_status,
  reversal_of_id uuid,
  reversed_by_id uuid,
  category_name text,
  running_balance numeric,
  balance_side text
)
language sql
stable
security definer
set search_path = public
as $$
  with scoped as (
    select
      t.*,
      da.type as debit_type,
      ca.type as credit_type,
      tc.name as category_name,
      sum(
        case when da.type = 'receivable' then t.debit_amount else 0 end
      - case when ca.type = 'receivable' then t.credit_amount else 0 end
      ) over (order by t.occurred_at, t.created_at) as running
    from transactions t
    join accounts da on da.id = t.debit_account_id
    join accounts ca on ca.id = t.credit_account_id
    left join transaction_categories tc on tc.id = t.category_id
    where t.counterparty_id = p_counterparty_id
      and is_org_member(t.org_id)
  )
  select
    s.id, s.document_no, s.occurred_at, s.created_at, s.due_date, s.description,
    s.quantity, s.unit, s.quantity_kg, s.quantity_dona,
    s.debit_type, s.debit_amount, s.credit_type, s.credit_amount,
    s.currency, s.source, s.status, s.reversal_of_id, s.reversed_by_id,
    s.category_name,
    round(abs(s.running), 2),
    case when s.running >= 0 then 'debit' else 'credit' end
  from scoped s
  where p_before_occurred_at is null
     or (s.occurred_at, s.created_at) < (p_before_occurred_at, p_before_created_at)
  order by s.occurred_at desc, s.created_at desc
  limit least(coalesce(p_limit, 100), 500);
$$;
