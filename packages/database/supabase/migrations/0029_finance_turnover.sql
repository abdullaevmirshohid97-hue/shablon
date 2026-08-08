-- The dashboard's third figure was called turnover and was not turnover.
--
-- org_period_totals sums the receivable account: debit is goods billed to a
-- client, credit is money they paid. Its third column, debit minus credit, is
-- therefore how much the clients' debt *moved* — not how much business was
-- done. Labelling it "sof aylanma" put a debt figure under a revenue heading
-- on the front page of a finance product.
--
-- Two corrections, and they are different corrections:
--
--   Debt. Renaming the column is not enough, because debit-minus-credit over a
--   *filtered period* is the change in debt during that period, not the debt.
--   Pick March and it reads as the whole receivable when it is one month of
--   movement. So total_debt is computed as of the period end and ignores
--   p_from entirely — every month up to the cutoff, which is what "umumiy"
--   means.
--
--   Turnover. Revenue is not on the receivable account at all; it is the
--   credit side of the sales accounts (see ARCHITECTURE.md: a sale posts
--   Дебет Клиенты / Кредит Продажи продукции). net_revenue reads it there, so
--   it counts what was sold whether or not anyone has paid yet, and a reversal
--   nets itself out because the reversing entry posts the opposite side.
--
-- `net` stays, unchanged, and is still the period's movement on the
-- receivable. It is a real figure and the ledger export uses it; it simply is
-- not the one the front page should lead with.
--
-- Re-runnable, same as 0014-0028.

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
  total_debt numeric,
  net_revenue numeric
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
    coalesce(debt.amount, 0) as total_debt,
    coalesce(revenue.amount, 0) as net_revenue
  from
    -- Movement on the receivable inside the period: what was billed, and what
    -- came back in.
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
    -- Everything owed as of the period end. Deliberately not bounded below:
    -- debt is a position, not a flow, and a position has no start date.
    (
      select sum(b.base_debit_total - b.base_credit_total) as amount
      from account_month_balances b
      join accounts a on a.id = b.account_id and a.type = 'receivable'
      where b.org_id = target_org_id
        and (p_to is null or b.month <= date_trunc('month', p_to)::date)
    ) debt,
    -- Revenue, from the sales accounts. Credit less debit, because a revenue
    -- account is increased by credits and a return or a reversal debits it
    -- straight back off.
    (
      select sum(b.base_credit_total - b.base_debit_total) as amount
      from account_month_balances b
      join accounts a on a.id = b.account_id and a.type = 'sales'
      where b.org_id = target_org_id
        and (p_from is null or b.month >= date_trunc('month', p_from)::date)
        and (p_to is null or b.month <= date_trunc('month', p_to)::date)
    ) revenue
  where is_org_member(target_org_id);
$$;
