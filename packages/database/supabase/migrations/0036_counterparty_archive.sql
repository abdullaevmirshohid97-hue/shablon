-- Removing a client becomes archiving one.
--
-- 0034 refused a client with any history; 0035 refused one whose account was
-- not square. Both were arguments about when erasing is safe, and both were
-- answering the wrong question — because the operator does not want the client
-- erased. They want them out of the list. A register that cannot be tidied
-- without destroying something is a register nobody tidies.
--
-- So nothing is destroyed. `archived_at` is set, the client leaves every list
-- they appeared in, and their entries, invoices and despatches stay exactly
-- where they were. Nothing has to be checked first, because nothing is lost:
-- the confirmation is a warning about visibility, not a rule about safety, and
-- an archived client can be brought back with one click.
--
-- What that removes is the need for the escape hatch 0035 opened. Nothing
-- deletes a ledger entry any more, so prevent_posted_delete goes back to the
-- rule 0014 wrote and the door closes. delete_counterparty is dropped rather
-- than repointed: a function named delete_ that archives is a lie waiting for
-- whoever reads only the name.
--
-- The reports are left alone on purpose. counterparty_balances and
-- org_overdue_by_counterparty answer questions about money, and an archived
-- client's balance is still money the company is owed or owes. The archive
-- shows the figure too, so it is never hidden — only moved.
--
-- Re-runnable, except for the two drops, which guard themselves.


-- ---------------------------------------------------------------------
-- The flag itself.
-- ---------------------------------------------------------------------
alter table counterparties
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references auth.users (id);

-- Every list below filters on it, and almost every row is null.
create index if not exists counterparties_active_idx
  on counterparties (org_id, name)
  where archived_at is null;


-- ---------------------------------------------------------------------
-- 0014's rule, restored. A posted entry is cancelled by an opposite entry and
-- never erased — with no exception now, since closing a client no longer
-- touches the ledger.
-- ---------------------------------------------------------------------
create or replace function prevent_posted_delete()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Tenant offboarding: deleting the organization itself cascades through
  -- everything and must not be blocked. The parent row is already gone by
  -- the time the cascade reaches here, which is how we recognise it.
  if not exists (select 1 from organizations where id = old.org_id) then
    return old;
  end if;

  if old.status <> 'draft' then
    raise exception
      'a posted entry cannot be deleted (document %) — reverse it instead',
      coalesce(old.document_no, old.id::text)
      using errcode = 'restrict_violation';
  end if;

  return old;
end;
$$;

-- Nothing hard-deletes a client now.
drop function if exists delete_counterparty(uuid, uuid);


-- ---------------------------------------------------------------------
-- Archive and restore. No conditions: the operator is told what they are
-- hiding and decides.
-- ---------------------------------------------------------------------
create or replace function archive_counterparty(target_org_id uuid, target_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not can_write_finance(target_org_id) then
    raise exception 'not authorized';
  end if;

  update counterparties
  set archived_at = now(), archived_by = auth.uid()
  where id = target_id and org_id = target_org_id and archived_at is null;

  if not found then
    raise exception 'Mijoz topilmadi yoki allaqachon arxivda';
  end if;
end;
$$;

create or replace function restore_counterparty(target_org_id uuid, target_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not can_write_finance(target_org_id) then
    raise exception 'not authorized';
  end if;

  update counterparties
  set archived_at = null, archived_by = null
  where id = target_id and org_id = target_org_id and archived_at is not null;

  if not found then
    raise exception 'Mijoz arxivda emas';
  end if;
end;
$$;


-- ---------------------------------------------------------------------
-- The client journal, minus the archived. Identical to 0032 but for the one
-- condition at the end of the outer where.
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
    and c.archived_at is null
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


-- ---------------------------------------------------------------------
-- The register, and the archive, from one function.
--
-- Dropped rather than replaced: adding a parameter with a default would leave
-- the three-argument version in place beside it and every existing call would
-- become ambiguous.
-- ---------------------------------------------------------------------
drop function if exists counterparty_directory(uuid, date, date);

create or replace function counterparty_directory(
  target_org_id uuid,
  p_start date default null,
  p_end date default null,
  p_archived boolean default false
)
returns table (
  counterparty_id uuid,
  counterparty_name text,
  phone text,
  manager_id uuid,
  manager_name text,
  currency text,
  categories text[],
  turnover numeric,
  entry_count bigint,
  balance numeric,
  total_debt numeric,
  doc_count bigint,
  archived_at timestamptz
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  with ledger as (
    select
      t.counterparty_id,
      t.occurred_at,
      case when da.type = 'receivable' then t.base_debit_amount else 0 end as debit,
      case when ca.type = 'receivable' then t.base_credit_amount else 0 end as credit
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
      coalesce(sum(l.debit - l.credit), 0) as balance,
      coalesce(
        sum(l.debit + l.credit) filter (
          where (p_start is null or l.occurred_at >= p_start)
            and (p_end is null or l.occurred_at < p_end + 1)
        ),
        0
      ) as turnover,
      count(l.*) filter (
        where (p_start is null or l.occurred_at >= p_start)
          and (p_end is null or l.occurred_at < p_end + 1)
      ) as entry_count
    from counterparties c
    left join ledger l on l.counterparty_id = c.id
    where c.org_id = target_org_id
    group by c.id
  )
  select
    c.id,
    c.name,
    c.phone,
    c.manager_id,
    coalesce(p.full_name, u.email),
    coalesce(c.currency, o.base_currency, 'UZS'),
    c.categories,
    round(a.turnover, 2),
    a.entry_count,
    round(a.balance, 2),
    round(greatest(a.balance, 0), 2),
    (
      (select count(*) from sklad_orders x where x.counterparty_id = c.id)
      + (select count(*) from sklad_movements x where x.counterparty_id = c.id)
      + (select count(*) from sklad_invoices x where x.counterparty_id = c.id)
      + (select count(*) from sklad_shipments x where x.counterparty_id = c.id)
    )::bigint,
    c.archived_at
  from counterparties c
  join agg a on a.id = c.id
  join organizations o on o.id = c.org_id
  left join auth.users u on u.id = c.manager_id
  left join profiles p on p.id = c.manager_id
  where c.org_id = target_org_id
    and is_org_member(target_org_id)
    and (c.archived_at is not null) = coalesce(p_archived, false)
  order by c.name;
$$;
