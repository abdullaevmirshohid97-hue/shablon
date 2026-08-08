-- "Overdue debt" was summing money that had already been paid.
--
-- org_overdue_by_counterparty summed the *credit* side of the receivable for
-- rows whose due date had passed. Credit on the receivable is a payment: the
-- client handed money over and their balance went down. So the figure headed
-- "jami muddati o'tgan qarz" was a total of settled payments, and it moved the
-- wrong way — the more a client paid, the larger their overdue debt read, and
-- a client who had cleared everything still sat at the top of the list.
--
-- The same row was also being counted twice over: it reduced the running
-- balance (correctly) and appeared as debt (incorrectly), so the screen showed
-- a client owing money the ledger beside it said they did not.
--
-- What a due date can honestly tell us here is *whether* someone is late, not
-- how much: only the chiqim leg carries one (see LedgerTable), and nothing
-- records a due date against a sale. So the date decides who appears, and the
-- amount is the one real figure available — what the client actually owes now.
-- It comes from account_month_balances, the same source as
-- counterparty_balances, so the total on the card and the balance on the
-- client's own page can never disagree.
--
-- A client whose balance is settled or in credit drops off the list entirely,
-- which is the correction that matters most.
--
-- Also here: net_revenue comes back out of org_period_totals. It was added one
-- migration ago and is not a figure this business recognises.
--
-- Re-runnable, same as 0014-0030.

drop function if exists org_period_totals(uuid, date, date);

create or replace function org_period_totals(
  target_org_id uuid,
  p_from date default null,
  p_to date default null
)
returns table (
  total_kirim numeric,
  total_chiqim numeric,
  net numeric,
  total_debt numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(receivable.debit, 0) as total_kirim,
    coalesce(receivable.credit, 0) as total_chiqim,
    coalesce(receivable.debit - receivable.credit, 0) as net,
    coalesce(debt.amount, 0) as total_debt
  from
    (
      select
        sum(b.base_debit_total) as debit,
        sum(b.base_credit_total) as credit
      from account_month_balances b
      join accounts a on a.id = b.account_id and a.type = 'receivable'
      where b.org_id = target_org_id
        and (p_from is null or b.month >= date_trunc('month', p_from)::date)
        and (p_to is null or b.month <= date_trunc('month', p_to)::date)
    ) receivable,
    -- Everything owed as of the period end. Not bounded below: debt is a
    -- position, and a position has no start date.
    (
      select sum(b.base_debit_total - b.base_credit_total) as amount
      from account_month_balances b
      join accounts a on a.id = b.account_id and a.type = 'receivable'
      where b.org_id = target_org_id
        and (p_to is null or b.month <= date_trunc('month', p_to)::date)
    ) debt
  where is_org_member(target_org_id);
$$;


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
  select
    c.id,
    c.name,
    balance.amount,
    due.oldest
  from counterparties c
  -- What this client owes, from the same summary counterparty_balances reads.
  join lateral (
    select coalesce(sum(b.base_debit_total - b.base_credit_total), 0) as amount
    from account_month_balances b
    join accounts a on a.id = b.account_id and a.type = 'receivable'
    where b.counterparty_id = c.id
      and (p_as_of is null or b.month <= date_trunc('month', p_as_of)::date)
  ) balance on true
  -- Since when they have been late. The date only decides who is on the list.
  join lateral (
    select min(t.due_date) as oldest
    from transactions t
    where t.counterparty_id = c.id
      and t.status <> 'draft'
      and t.due_date is not null
      and t.due_date < coalesce(p_as_of, current_date)
  ) due on true
  where c.org_id = target_org_id
    and is_org_member(target_org_id)
    and (p_category is null or p_category = any(c.categories))
    and due.oldest is not null
    -- Settled, or in credit: not a debtor, whatever the dates say.
    and balance.amount > 0
  order by 3 desc;
$$;
