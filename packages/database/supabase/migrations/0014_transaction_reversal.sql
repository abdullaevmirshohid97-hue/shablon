-- Posted ledger entries stop being deletable; they are reversed instead.
--
-- This is the rule every serious accounting system enforces (Oracle NetSuite,
-- Odoo, 1C): once an entry has hit the ledger it is history. Correcting it
-- means posting a mirror-image entry that cancels it, leaving both visible.
-- Deleting silently rewrites the past — 0013's audit log recorded that it
-- happened, but could not bring the row back.
--
-- Two mechanisms, deliberately:
--   * RLS narrows what the app may do;
--   * a trigger blocks the delete outright, because service_role and the
--     Supabase dashboard bypass RLS entirely and would otherwise still be
--     able to erase a posted entry.
--
-- 'draft' exists in the enum and in the policies, so a submit-for-approval
-- flow needs no further migration, but no UI creates drafts yet: today every
-- entry is born 'posted' and nothing in the ledger can be deleted.
--
-- Re-runnable: every statement below guards against the object already
-- existing. These are applied by hand in the Supabase SQL editor, where a
-- half-finished run leaves committed statements behind and the retry then
-- fails on the first line it already created.


do $guard$
begin
  if not exists (select 1 from pg_type where typname = 'transaction_status') then
    create type transaction_status as enum ('draft', 'posted', 'reversed', 'reversal');
  end if;
end $guard$;

alter table transactions
  add column if not exists status transaction_status not null default 'posted',
  -- On the reversing entry: which entry it cancels. On the original:
  -- which entry cancelled it. Kept on both sides so the ledger can link
  -- either direction without a scan.
  add column if not exists reversal_of_id uuid references transactions (id),
  add column if not exists reversed_by_id uuid references transactions (id),
  add column if not exists reversal_reason text,
  add column if not exists posted_at timestamptz;

update transactions set posted_at = created_at where posted_at is null;

create index if not exists transactions_reversal_of_idx
  on transactions (reversal_of_id) where reversal_of_id is not null;
create index if not exists transactions_org_status_idx on transactions (org_id, status);

-- ---------------------------------------------------------------------
-- Status may only move through the RPCs below, never through a plain
-- UPDATE. Without this an admin could flip a posted row back to 'draft'
-- and then delete it, walking straight around the rule above.
-- ---------------------------------------------------------------------
create or replace function guard_transaction_status()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status is distinct from old.status
     and coalesce(current_setting('app.status_change', true), '') <> 'on' then
    raise exception 'transaction status can only be changed by posting or reversing';
  end if;
  return new;
end;
$$;

drop trigger if exists transactions_guard_status on transactions;
create trigger transactions_guard_status
  before update on transactions
  for each row execute function guard_transaction_status();

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

drop trigger if exists transactions_prevent_posted_delete on transactions;
create trigger transactions_prevent_posted_delete
  before delete on transactions
  for each row execute function prevent_posted_delete();

-- ---------------------------------------------------------------------
-- Policies: drafts are editable and deletable, posted entries are neither
-- deletable nor (once reversed) editable.
-- ---------------------------------------------------------------------
drop policy if exists transactions_delete on transactions;
create policy transactions_delete on transactions
  for delete using (can_write_finance(org_id) and status = 'draft');

drop policy if exists transactions_update on transactions;
create policy transactions_update on transactions
  for update using (can_write_finance(org_id) and status in ('draft', 'posted'))
  with check (can_write_finance(org_id));

-- ---------------------------------------------------------------------
-- reverse_transaction(): the mirror image, on its own date.
--
-- Amounts and accounts swap sides; quantities are negated so kg/dona
-- turnover nets out the same way the money does. The reversal carries no
-- due date — the obligation it cancelled is gone.
-- ---------------------------------------------------------------------
create or replace function reverse_transaction(
  p_transaction_id uuid,
  p_reversal_date date default null,
  p_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  t transactions;
  v_new_id uuid;
begin
  select * into t from transactions where id = p_transaction_id;
  if not found then
    raise exception 'transaction not found';
  end if;

  if not can_write_finance(t.org_id) then
    raise exception 'only an org owner/admin can reverse an entry';
  end if;

  if t.status = 'reversed' then
    raise exception 'this entry has already been reversed';
  elsif t.status = 'reversal' then
    raise exception 'a reversing entry cannot itself be reversed';
  elsif t.status = 'draft' then
    raise exception 'a draft entry is deleted, not reversed';
  end if;

  insert into transactions (
    org_id, counterparty_id, category_id, occurred_at, due_date, description,
    quantity, unit, quantity_kg, quantity_dona,
    debit_account_id, debit_amount, credit_account_id, credit_amount,
    currency, source, created_by, posted_at,
    status, reversal_of_id, reversal_reason
  ) values (
    t.org_id, t.counterparty_id, t.category_id,
    coalesce(p_reversal_date, current_date)::timestamptz,
    null,
    coalesce(p_reason, 'Storno: ' || coalesce(t.description, t.document_no, '')),
    -t.quantity, t.unit, -t.quantity_kg, -t.quantity_dona,
    t.credit_account_id, t.credit_amount, t.debit_account_id, t.debit_amount,
    t.currency, t.source, auth.uid(), now(),
    'reversal', t.id, p_reason
  )
  returning id into v_new_id;

  perform set_config('app.status_change', 'on', true);
  update transactions
  set status = 'reversed', reversed_by_id = v_new_id
  where id = t.id;
  perform set_config('app.status_change', 'off', true);

  return v_new_id;
end;
$$;

-- Draft -> posted. Unused by the UI today, but it is the other half of the
-- lifecycle and belongs with the guard that makes status changes privileged.
create or replace function post_transaction(p_transaction_id uuid)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  t transactions;
begin
  select * into t from transactions where id = p_transaction_id;
  if not found then
    raise exception 'transaction not found';
  end if;
  if not can_write_finance(t.org_id) then
    raise exception 'only an org owner/admin can post an entry';
  end if;
  if t.status <> 'draft' then
    raise exception 'only a draft entry can be posted';
  end if;

  perform set_config('app.status_change', 'on', true);
  update transactions set status = 'posted', posted_at = now() where id = t.id;
  perform set_config('app.status_change', 'off', true);
end;
$$;
