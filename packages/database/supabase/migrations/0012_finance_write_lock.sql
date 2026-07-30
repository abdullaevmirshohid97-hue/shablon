-- Finance becomes admin-write / manager-read.
--
-- Until now `transactions_insert` and `counterparties_write` (0001_init.sql)
-- only required is_org_member(), so a plain 'staff' member could enter money
-- and create clients. The business rule is the opposite: only an org
-- owner/admin enters Finance data; 'staff' is the *manager* role — it reads
-- every ledger and exports it to Excel/PDF, but never writes.
--
-- 'staff' is reused as-is rather than adding a `manager` enum value: every
-- existing policy and helper already splits on is_org_admin(), so no data
-- migration and no policy audit is needed — only the UI label changes.
--
-- Update/delete on transactions were already admin-only, so this migration
-- closes insert (both tables) and pins `created_by` to the caller, which the
-- app never populated (see 0013_transaction_audit.sql, which relies on it).

-- ---------------------------------------------------------------------
-- can_write_finance(): the one place the Finance write rule is defined.
-- Currently identical to is_org_admin(), but named for the rule rather than
-- the role, so relaxing it later (e.g. a "cashier" who may only add kirim)
-- is a single-function change instead of a policy sweep.
-- ---------------------------------------------------------------------
create function can_write_finance(target_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select is_org_admin(target_org_id);
$$;

-- ---------------------------------------------------------------------
-- transactions: insert is admin-only, and the author is recorded
-- ---------------------------------------------------------------------
-- The column has existed since 0001_init.sql but no client ever set it, so
-- every historic row is NULL. A default (not a trigger) is enough: PostgREST
-- omits keys absent from the JS payload, so the default fires, and the
-- WITH CHECK below then rejects any payload that names someone else.
alter table transactions alter column created_by set default auth.uid();

drop policy if exists transactions_insert on transactions;
create policy transactions_insert on transactions
  for insert with check (
    can_write_finance(org_id)
    and created_by = auth.uid()
  );

-- Spell out WITH CHECK on update too. Without it Postgres reuses USING, which
-- would let an admin rewrite created_by to another user after the fact.
drop policy if exists transactions_update on transactions;
create policy transactions_update on transactions
  for update using (can_write_finance(org_id))
  with check (can_write_finance(org_id));

drop policy if exists transactions_delete on transactions;
create policy transactions_delete on transactions
  for delete using (can_write_finance(org_id));

-- ---------------------------------------------------------------------
-- counterparties: was one `for all` member policy — split so managers keep
-- read access to the client directory but cannot add/rename/delete clients.
-- ---------------------------------------------------------------------
drop policy if exists counterparties_write on counterparties;

create policy counterparties_insert on counterparties
  for insert with check (can_write_finance(org_id));
create policy counterparties_update on counterparties
  for update using (can_write_finance(org_id)) with check (can_write_finance(org_id));
create policy counterparties_delete on counterparties
  for delete using (can_write_finance(org_id));

-- ---------------------------------------------------------------------
-- Lockout guard: an org must always keep at least one owner/admin.
--
-- The Settings screen lets an admin demote anyone (including themselves) to
-- 'staff'. Demoting the last one would leave an org where nobody can enter
-- data, manage employees, or undo it — unrecoverable from inside the app.
-- ---------------------------------------------------------------------
-- NEW is unassigned during a row-level DELETE trigger, and touching it there
-- raises "record new is not assigned yet" — so every reference to NEW below
-- sits inside a TG_OP = 'UPDATE' branch rather than in a combined condition,
-- which PL/pgSQL would evaluate as one SQL expression without short-circuiting.
create function prevent_last_admin_removal()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Dropping the whole org cascades into memberships. The parent row is
  -- already gone by the time those child deletes run, so its absence is how
  -- we tell "the org is being deleted" from "the last admin is being removed"
  -- — without this, the guard would make an organization undeletable.
  if tg_op = 'DELETE' and not exists (select 1 from organizations where id = old.org_id) then
    return old;
  end if;

  -- Removing or demoting someone who isn't an admin can never strand an org.
  if old.role not in ('owner', 'admin') then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  -- Still an owner/admin after the update: nothing to guard against.
  if tg_op = 'UPDATE' then
    if new.role in ('owner', 'admin') then
      return new;
    end if;
  end if;

  if not exists (
    select 1 from memberships
    where org_id = old.org_id
      and role in ('owner', 'admin')
      and user_id <> old.user_id
  ) then
    raise exception 'an organization must keep at least one owner or admin';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger memberships_keep_one_admin
  before update or delete on memberships
  for each row execute function prevent_last_admin_removal();
