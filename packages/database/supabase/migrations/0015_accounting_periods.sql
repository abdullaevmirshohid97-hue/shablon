-- Accounting periods, and the lock that makes a closed month actually closed.
--
-- Modelled on Oracle NetSuite's Accounting Periods: monthly records with an
-- open/closed status, sequential close, and a hard block on posting into a
-- closed period. Without it, last month's reported figures silently change
-- whenever someone back-dates an entry — the single most common way a ledger
-- loses the trust of the person relying on it.
--
-- Deliberately permissive in one direction: an org that has never generated
-- periods is not locked out of anything. The gate only engages once a period
-- covering the date exists and is closed.
--
-- Re-runnable: every statement below guards against the object already
-- existing. These are applied by hand in the Supabase SQL editor, where a
-- half-finished run leaves committed statements behind and the retry then
-- fails on the first line it already created.


do $guard$
begin
  if not exists (select 1 from pg_type where typname = 'accounting_period_status') then
    create type accounting_period_status as enum ('open', 'closed');
  end if;
end $guard$;

create table if not exists accounting_periods (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  name text not null,
  start_date date not null,
  end_date date not null,
  status accounting_period_status not null default 'open',
  closed_at timestamptz,
  closed_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  unique (org_id, start_date),
  check (end_date >= start_date)
);

create index if not exists accounting_periods_org_range_idx
  on accounting_periods (org_id, start_date, end_date);

-- Non-overlap is enforced with a trigger rather than an exclusion constraint:
-- that would need btree_gist, and Supabase installs extensions into their own
-- schema, which the gist operator class would then not resolve through
-- (the same search_path trap documented in 0008).
create or replace function prevent_overlapping_periods()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Rows with the same start_date are excluded: a BEFORE INSERT trigger fires
  -- ahead of ON CONFLICT arbitration, so without this, re-running
  -- generate_accounting_periods() would raise here instead of skipping the
  -- month it already created. The unique(org_id, start_date) constraint is
  -- what actually rejects a genuine duplicate.
  if exists (
    select 1 from accounting_periods
    where org_id = new.org_id
      and id <> new.id
      and start_date <> new.start_date
      and daterange(start_date, end_date, '[]') && daterange(new.start_date, new.end_date, '[]')
  ) then
    raise exception 'accounting period % overlaps an existing period', new.name;
  end if;
  return new;
end;
$$;

drop trigger if exists accounting_periods_no_overlap on accounting_periods;
create trigger accounting_periods_no_overlap
  before insert or update on accounting_periods
  for each row execute function prevent_overlapping_periods();

alter table accounting_periods enable row level security;

drop policy if exists accounting_periods_select on accounting_periods;
create policy accounting_periods_select on accounting_periods
  for select using (is_org_member(org_id));
drop policy if exists accounting_periods_insert on accounting_periods;
create policy accounting_periods_insert on accounting_periods
  for insert with check (is_org_admin(org_id));
drop policy if exists accounting_periods_delete on accounting_periods;
create policy accounting_periods_delete on accounting_periods
  for delete using (is_org_admin(org_id) and status = 'open');
-- No UPDATE policy on purpose: open/closed moves only through the two RPCs
-- below, which is where the sequencing and permission rules live.

-- ---------------------------------------------------------------------
-- The lock
-- ---------------------------------------------------------------------
create or replace function assert_period_open(target_org_id uuid, target_date date)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_period accounting_periods;
begin
  select * into v_period
  from accounting_periods
  where org_id = target_org_id and target_date between start_date and end_date;

  -- No period defined for this date: nothing to enforce.
  if not found then
    return;
  end if;

  if v_period.status = 'closed' then
    raise exception 'accounting period "%" is closed', v_period.name
      using errcode = 'restrict_violation';
  end if;
end;
$$;

create or replace function assert_transaction_period_open()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform assert_period_open(new.org_id, new.occurred_at::date);
    return new;

  elsif tg_op = 'UPDATE' then
    -- Only a change that moves money or moves a date can restate a closed
    -- period. Bookkeeping updates — marking an entry reversed, linking it to
    -- its reversal — must still work on an entry sitting in a closed month,
    -- which is exactly what reverse_transaction() does.
    if new.occurred_at is distinct from old.occurred_at
      or new.debit_amount is distinct from old.debit_amount
      or new.credit_amount is distinct from old.credit_amount
      or new.debit_account_id is distinct from old.debit_account_id
      or new.credit_account_id is distinct from old.credit_account_id
    then
      perform assert_period_open(old.org_id, old.occurred_at::date);
      perform assert_period_open(new.org_id, new.occurred_at::date);
    end if;
    return new;

  else
    -- Same tenant-offboarding exemption as prevent_posted_delete().
    if exists (select 1 from organizations where id = old.org_id) then
      perform assert_period_open(old.org_id, old.occurred_at::date);
    end if;
    return old;
  end if;
end;
$$;

drop trigger if exists transactions_assert_period_open on transactions;
create trigger transactions_assert_period_open
  before insert or update or delete on transactions
  for each row execute function assert_transaction_period_open();

-- ---------------------------------------------------------------------
-- Management RPCs
-- ---------------------------------------------------------------------
create or replace function generate_accounting_periods(target_org_id uuid, p_year integer)
returns integer
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_month integer;
  v_start date;
  v_created integer := 0;
begin
  if not is_org_admin(target_org_id) then
    raise exception 'only an org owner/admin can generate accounting periods';
  end if;
  if p_year < 2000 or p_year > 2100 then
    raise exception 'year out of range';
  end if;

  for v_month in 1..12 loop
    v_start := make_date(p_year, v_month, 1);
    insert into accounting_periods (org_id, name, start_date, end_date)
    values (
      target_org_id,
      to_char(v_start, 'YYYY-MM'),
      v_start,
      (v_start + interval '1 month - 1 day')::date
    )
    on conflict (org_id, start_date) do nothing;

    if found then
      v_created := v_created + 1;
    end if;
  end loop;

  return v_created;
end;
$$;

create or replace function close_accounting_period(p_period_id uuid)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  p accounting_periods;
  v_drafts integer;
begin
  select * into p from accounting_periods where id = p_period_id;
  if not found then
    raise exception 'accounting period not found';
  end if;
  if not is_org_admin(p.org_id) then
    raise exception 'only an org owner/admin can close a period';
  end if;
  if p.status = 'closed' then
    raise exception 'period "%" is already closed', p.name;
  end if;

  -- Sequential close, as in NetSuite: an earlier month left open would
  -- otherwise still be movable underneath a month reported as final.
  if exists (
    select 1 from accounting_periods
    where org_id = p.org_id and status = 'open' and start_date < p.start_date
  ) then
    raise exception 'an earlier period is still open — close periods in order';
  end if;

  select count(*) into v_drafts
  from transactions
  where org_id = p.org_id
    and status = 'draft'
    and occurred_at::date between p.start_date and p.end_date;

  if v_drafts > 0 then
    raise exception 'period "%" still has % unposted draft entries', p.name, v_drafts;
  end if;

  update accounting_periods
  set status = 'closed', closed_at = now(), closed_by = auth.uid()
  where id = p_period_id;
end;
$$;

-- Reopening is the owner's call, not an admin's: it makes finalised figures
-- movable again, which is the one action here with no audit-safe undo.
create or replace function reopen_accounting_period(p_period_id uuid)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  p accounting_periods;
begin
  select * into p from accounting_periods where id = p_period_id;
  if not found then
    raise exception 'accounting period not found';
  end if;

  if not exists (
    select 1 from memberships
    where org_id = p.org_id and user_id = auth.uid() and role = 'owner'
  ) and not is_platform_admin() then
    raise exception 'only the organization owner can reopen a period';
  end if;

  if p.status = 'open' then
    raise exception 'period "%" is already open', p.name;
  end if;

  if exists (
    select 1 from accounting_periods
    where org_id = p.org_id and status = 'closed' and start_date > p.start_date
  ) then
    raise exception 'a later period is closed — reopen periods newest first';
  end if;

  update accounting_periods
  set status = 'open', closed_at = null, closed_by = null
  where id = p_period_id;
end;
$$;

-- Period list with the figures an admin checks before closing.
create or replace function list_accounting_periods(target_org_id uuid, p_year integer default null)
returns table (
  id uuid,
  name text,
  start_date date,
  end_date date,
  status accounting_period_status,
  closed_at timestamptz,
  closed_by_name text,
  entry_count bigint,
  draft_count bigint,
  total_kirim numeric,
  total_chiqim numeric
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  select
    p.id,
    p.name,
    p.start_date,
    p.end_date,
    p.status,
    p.closed_at,
    coalesce(pr.full_name, u.email) as closed_by_name,
    count(t.id) as entry_count,
    count(t.id) filter (where t.status = 'draft') as draft_count,
    coalesce(sum(t.debit_amount) filter (where da.type = 'receivable'), 0) as total_kirim,
    coalesce(sum(t.credit_amount) filter (where ca.type = 'receivable'), 0) as total_chiqim
  from accounting_periods p
  left join auth.users u on u.id = p.closed_by
  left join profiles pr on pr.id = p.closed_by
  left join transactions t
    on t.org_id = p.org_id
   and t.occurred_at::date between p.start_date and p.end_date
  left join accounts da on da.id = t.debit_account_id
  left join accounts ca on ca.id = t.credit_account_id
  where p.org_id = target_org_id
    and is_org_member(target_org_id)
    and (p_year is null or extract(year from p.start_date) = p_year)
  group by p.id, p.name, p.start_date, p.end_date, p.status, p.closed_at, pr.full_name, u.email
  order by p.start_date;
$$;
