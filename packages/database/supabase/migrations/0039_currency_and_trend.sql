-- Two questions the dashboard could not answer: "how much of this is dollars"
-- and "which way is it going".
--
-- Every existing aggregate reports in the org's base currency, which is the
-- only way to add a dollar entry to a sum entry and get a number that means
-- anything. It is also why the book has never been readable *as* dollars: the
-- conversion is applied before anyone sees it, so a business that keeps some
-- accounts in USD has no view of what those accounts actually did.
--
-- org_currency_totals answers it without converting anything. It groups by the
-- currency each entry was made in and sums the raw amounts, so a USD row is
-- dollars and a UZS row is sums, and the two are never added together. Nothing
-- here is comparable across rows, on purpose.
--
-- org_monthly_series is the shape of the last N months — turnover per month
-- and the debt position at the end of each. It carries the balance from before
-- the window into the first month, so the opening figure is the real one
-- rather than a line starting at zero. Pass a currency for the unconverted
-- view; pass null for the consolidated one, in base currency.
--
-- Re-runnable, same as 0014-0038.


-- ---------------------------------------------------------------------
-- What each currency did over the period.
--
-- The flows are period-scoped; `total_debt` is not, and cannot be — a debt is
-- a position, so it is stated as of the period end (or today) and labelled
-- that way everywhere it is shown.
-- ---------------------------------------------------------------------
create or replace function org_currency_totals(
  target_org_id uuid,
  p_from date default null,
  p_to date default null,
  p_category text default null
)
returns table (
  currency text,
  total_kirim numeric,
  total_chiqim numeric,
  net numeric,
  total_debt numeric,
  entry_count bigint,
  counterparty_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with ledger as (
    select
      t.currency,
      t.counterparty_id,
      t.occurred_at::date as day,
      case when da.type = 'receivable' then t.debit_amount else 0 end as debit,
      case when ca.type = 'receivable' then t.credit_amount else 0 end as credit
    from transactions t
    join accounts da on da.id = t.debit_account_id
    join accounts ca on ca.id = t.credit_account_id
    join counterparties c on c.id = t.counterparty_id
    where t.org_id = target_org_id
      and t.status <> 'draft'
      and (da.type = 'receivable' or ca.type = 'receivable')
      and (p_category is null or p_category = any(c.categories))
  )
  select
    x.currency,
    round(coalesce(sum(x.debit) filter (where x.in_period), 0), 2),
    round(coalesce(sum(x.credit) filter (where x.in_period), 0), 2),
    round(coalesce(sum(x.debit - x.credit) filter (where x.in_period), 0), 2),
    round(greatest(coalesce(sum(x.debit - x.credit) filter (where x.as_of), 0), 0), 2),
    count(*) filter (where x.in_period),
    count(distinct x.counterparty_id) filter (where x.in_period)
  from (
    select
      ledger.currency,
      ledger.counterparty_id,
      ledger.debit,
      ledger.credit,
      (p_from is null or ledger.day >= p_from)
        and (p_to is null or ledger.day <= p_to) as in_period,
      ledger.day <= coalesce(p_to, current_date) as as_of
    from ledger
  ) x
  where is_org_member(target_org_id)
  group by x.currency
  -- A currency with no movement in the period but an outstanding balance still
  -- has a line: it is money owed, and a period filter is not a reason to hide it.
  having count(*) filter (where x.in_period) > 0
      or coalesce(sum(x.debit - x.credit) filter (where x.as_of), 0) <> 0
  order by 5 desc, 1;
$$;


-- ---------------------------------------------------------------------
-- The last N months, for the trend.
-- ---------------------------------------------------------------------
create or replace function org_monthly_series(
  target_org_id uuid,
  p_months int default 12,
  p_currency text default null,
  p_category text default null
)
returns table (
  month date,
  total_kirim numeric,
  total_chiqim numeric,
  closing_debt numeric
)
language sql
stable
security definer
set search_path = public
as $$
  with bounds as (
    select
      (date_trunc('month', current_date)
        - make_interval(months => greatest(coalesce(p_months, 12), 1) - 1))::date as first_month,
      date_trunc('month', current_date)::date as last_month
  ),
  ledger as (
    select
      date_trunc('month', t.occurred_at)::date as month,
      -- Converted only when no currency was asked for: a single-currency view
      -- shows the amounts as they were entered, which is the point of it.
      case
        when da.type = 'receivable'
          then case when p_currency is null then t.base_debit_amount else t.debit_amount end
        else 0
      end as debit,
      case
        when ca.type = 'receivable'
          then case when p_currency is null then t.base_credit_amount else t.credit_amount end
        else 0
      end as credit
    from transactions t
    join accounts da on da.id = t.debit_account_id
    join accounts ca on ca.id = t.credit_account_id
    join counterparties c on c.id = t.counterparty_id
    where t.org_id = target_org_id
      and t.status <> 'draft'
      and (da.type = 'receivable' or ca.type = 'receivable')
      and (p_currency is null or t.currency = p_currency)
      and (p_category is null or p_category = any(c.categories))
  ),
  months as (
    select generate_series(
      (select first_month from bounds),
      (select last_month from bounds),
      interval '1 month'
    )::date as month
  ),
  -- What was already owed when the window opens. Without it the first month's
  -- closing figure is the month's movement wearing the name of a balance.
  opening as (
    select coalesce(sum(l.debit - l.credit), 0) as amount
    from ledger l
    where l.month < (select first_month from bounds)
  ),
  per_month as (
    select
      m.month,
      coalesce(sum(l.debit), 0) as kirim,
      coalesce(sum(l.credit), 0) as chiqim
    from months m
    left join ledger l on l.month = m.month
    group by m.month
  )
  select
    p.month,
    round(p.kirim, 2),
    round(p.chiqim, 2),
    round(
      (select amount from opening) + sum(p.kirim - p.chiqim) over (order by p.month),
      2
    )
  from per_month p
  where is_org_member(target_org_id)
  order by p.month;
$$;
