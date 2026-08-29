-- Two functions, two answers to "how much is past due" — and a storno that
-- pays a debt off.
--
-- 0031 fixed org_overdue_by_counterparty by making the amount the client's
-- whole balance: the due date says *whether* they are late, and the balance
-- was the only honest figure available at the time. 0032 then went further for
-- the client journal — what is past due is what was outstanding when the
-- deadline passed, less everything paid since, capped at the balance. Oldest
-- debt settles first, so a payment lowers the overdue part while a new sale
-- raises only the total.
--
-- Both are live, and the dashboard renders both at once: the "jami muddati
-- o'tgan qarz" card reads 0031's rule, and the journal and debtors panel below
-- it read 0032's. For any client who has paid something since missing a
-- deadline the two disagree, on one screen, under headings that promise the
-- same figure. Which is right is not a matter of taste — 0031's overstates,
-- because it counts debt run up *after* the missed deadline as already late.
--
-- The second correction is to `paid`. It counts every credit on the
-- receivable, and the mirror leg of a storno is a credit on the receivable —
-- so cancelling a mistyped sale was quietly clearing the client's oldest debt
-- as though they had settled it. A reversal is a correction, not money anyone
-- handed over, and it nets against its own entry in the balance already.
--
-- One rule now, in both functions and in @mubosher/shared's computeOverdue,
-- which is what the statement, the export and every card on screen read.
--
-- Re-runnable, same as 0014-0036.


-- ---------------------------------------------------------------------
-- The dashboard's overdue card.
--
-- Computed from `transactions` rather than account_month_balances: a deadline
-- lands on a day and that summary is per month, so aging against it there
-- would be up to a month out — which is why 0032 read transactions.
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
      -- Signed movement on the receivable: what the client owes, per entry.
      case when da.type = 'receivable' then t.base_debit_amount else 0 end
        - case when ca.type = 'receivable' then t.base_credit_amount else 0 end as delta,
      -- Money actually handed over, for the aging below. A storno's mirror leg
      -- is excluded: it cancels an entry, it does not settle one.
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
      min(l.due_date) filter (where l.due_date < (select day from cutoff)) as overdue_date
    from counterparties c
    left join ledger l on l.counterparty_id = c.id
    where c.org_id = target_org_id
      and (p_category is null or p_category = any(c.categories))
    group by c.id
  )
  select
    c.id,
    c.name,
    round(
      greatest(
        least(coalesce(aged.balance_then, 0) - coalesce(aged.paid_after, 0), a.balance),
        0
      ),
      2
    ) as overdue_amount,
    a.overdue_date
  from counterparties c
  join agg a on a.id = c.id
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
    and a.overdue_date is not null
    -- Settled, or in credit: not a debtor, whatever the dates say.
    and a.balance > 0
  order by 3 desc;
$$;


-- ---------------------------------------------------------------------
-- The client journal (0032), unchanged but for the same `paid` correction.
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
      case when da.type = 'receivable' then t.base_debit_amount else 0 end
        - case when ca.type = 'receivable' then t.base_credit_amount else 0 end as delta,
      -- See above: a reversal is a correction, not a payment.
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
