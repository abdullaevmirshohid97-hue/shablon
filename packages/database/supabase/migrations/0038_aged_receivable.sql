-- Overdue was measured from the wrong deadline, and the screen never said how
-- old the debt was.
--
-- 0032 and 0037 take `overdue_date` — the *oldest* deadline that has passed —
-- and report what was outstanding on that day less everything paid since. That
-- is right for one missed deadline and wrong for two: a client billed 1000 due
-- in January and 500 due in March, who has paid nothing, is 1500 overdue on
-- any reading, and the old rule reported 1000. Everything that fell due after
-- the first miss was quietly treated as though its day had not come.
--
-- The figure comes from the *newest* deadline that has passed: what was owed by
-- the time the last one went by, less what has been paid since — which is
-- everything whose day has come and has not been settled. The oldest deadline
-- is still what `overdue_date` reports, because that answers a different
-- question: since when.
--
-- Evaluating that same expression at each 30-day edge gives the aged
-- receivable, which is what a finance department actually asks for: not "is
-- this client late" but "a week late or a season late". The figures are
-- non-decreasing as the edge moves nearer, so each bucket is the difference
-- between two of them and the four sum back to the total.
--
-- @mubosher/shared's computeOverdue has always read it this way; this brings
-- the database to it, so the dashboard and the statement stop disagreeing for
-- any client who has missed more than one deadline.
--
-- Re-runnable, same as 0014-0037.


-- ---------------------------------------------------------------------
-- The dashboard's overdue card.
-- ---------------------------------------------------------------------
drop function if exists org_overdue_by_counterparty(uuid, date, text);

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
  with cutoff as (select coalesce(p_as_of, current_date) as day),
  ledger as (
    select
      t.counterparty_id,
      t.occurred_at,
      t.due_date,
      case when da.type = 'receivable' then t.base_debit_amount else 0 end
        - case when ca.type = 'receivable' then t.base_credit_amount else 0 end as delta,
      -- A storno's mirror leg is not money anyone handed over (0037).
      case
        when ca.type = 'receivable' and t.status <> 'reversal' then t.base_credit_amount
        else 0
      end as paid
    from transactions t
    join accounts da on da.id = t.debit_account_id
    join accounts ca on ca.id = t.credit_account_id
    where t.org_id = target_org_id
      and t.status <> 'draft'
      and (da.type = 'receivable' or ca.type = 'receivable')
      and t.occurred_at::date <= (select day from cutoff)
  ),
  agg as (
    select
      c.id,
      coalesce(sum(l.delta), 0) as balance,
      -- Oldest: since when they have been late. Newest: the day to measure from.
      min(l.due_date) filter (where l.due_date < (select day from cutoff)) as overdue_date,
      max(l.due_date) filter (where l.due_date < (select day from cutoff)) as measured_from
    from counterparties c
    left join ledger l on l.counterparty_id = c.id
    where c.org_id = target_org_id
      and (p_category is null or p_category = any(c.categories))
    group by c.id
  )
  select
    c.id,
    c.name,
    round(coalesce(aged.amount, 0), 2) as overdue_amount,
    a.overdue_date
  from counterparties c
  join agg a on a.id = c.id
  left join lateral (
    select
      greatest(
        least(
          coalesce(sum(l.delta) filter (where l.occurred_at::date <= a.measured_from), 0)
            - coalesce(sum(l.paid) filter (where l.occurred_at::date > a.measured_from), 0),
          greatest(a.balance, 0)
        ),
        0
      ) as amount
    from ledger l
    where l.counterparty_id = c.id
  ) aged on true
  where c.org_id = target_org_id
    and is_org_member(target_org_id)
    and a.overdue_date is not null
    -- Settled, or in credit: not a debtor, whatever the dates say.
    and a.balance > 0
  order by 3 desc;
$$;


-- ---------------------------------------------------------------------
-- The client journal, now carrying the ladder.
-- ---------------------------------------------------------------------
drop function if exists counterparty_journal(uuid, text, uuid, text, boolean, boolean, date);

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
  overdue_1_30 numeric,
  overdue_31_60 numeric,
  overdue_61_90 numeric,
  overdue_90_plus numeric,
  not_yet_due numeric,
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
      case when da.type = 'receivable' then t.base_debit_amount else 0 end
        - case when ca.type = 'receivable' then t.base_credit_amount else 0 end as delta,
      case
        when ca.type = 'receivable' and t.status <> 'reversal' then t.base_credit_amount
        else 0
      end as paid
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
      min(l.due_date) filter (where l.due_date >= (select day from cutoff)) as next_due_date,
      -- One edge per bucket: the newest deadline that is already this old.
      max(l.due_date) filter (where (select day from cutoff) - l.due_date >= 1) as edge_1,
      max(l.due_date) filter (where (select day from cutoff) - l.due_date >= 31) as edge_31,
      max(l.due_date) filter (where (select day from cutoff) - l.due_date >= 61) as edge_61,
      max(l.due_date) filter (where (select day from cutoff) - l.due_date >= 91) as edge_91
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
    round(coalesce(aged.o1, 0), 2) as overdue_amount,
    -- Each bucket is the gap between two edges; together they come back to o1.
    round(greatest(coalesce(aged.o1, 0) - coalesce(aged.o31, 0), 0), 2) as overdue_1_30,
    round(greatest(coalesce(aged.o31, 0) - coalesce(aged.o61, 0), 0), 2) as overdue_31_60,
    round(greatest(coalesce(aged.o61, 0) - coalesce(aged.o91, 0), 0), 2) as overdue_61_90,
    round(coalesce(aged.o91, 0), 2) as overdue_90_plus,
    round(greatest(greatest(a.balance, 0) - coalesce(aged.o1, 0), 0), 2) as not_yet_due,
    a.overdue_date,
    a.next_due_date,
    a.last_entry_at,
    a.entry_count
  from counterparties c
  join agg a on a.id = c.id
  join organizations o on o.id = c.org_id
  left join auth.users u on u.id = c.manager_id
  left join profiles p on p.id = c.manager_id
  -- One pass over this client's entries answers all four edges. A null edge
  -- filters every row away, which lands on zero — the right answer for a
  -- bucket nothing has aged into yet.
  left join lateral (
    select
      greatest(least(
        coalesce(sum(l.delta) filter (where l.occurred_at::date <= a.edge_1), 0)
          - coalesce(sum(l.paid) filter (where l.occurred_at::date > a.edge_1), 0),
        greatest(a.balance, 0)), 0) as o1,
      greatest(least(
        coalesce(sum(l.delta) filter (where l.occurred_at::date <= a.edge_31), 0)
          - coalesce(sum(l.paid) filter (where l.occurred_at::date > a.edge_31), 0),
        greatest(a.balance, 0)), 0) as o31,
      greatest(least(
        coalesce(sum(l.delta) filter (where l.occurred_at::date <= a.edge_61), 0)
          - coalesce(sum(l.paid) filter (where l.occurred_at::date > a.edge_61), 0),
        greatest(a.balance, 0)), 0) as o61,
      greatest(least(
        coalesce(sum(l.delta) filter (where l.occurred_at::date <= a.edge_91), 0)
          - coalesce(sum(l.paid) filter (where l.occurred_at::date > a.edge_91), 0),
        greatest(a.balance, 0)), 0) as o91
    from ledger l
    where l.counterparty_id = c.id
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
