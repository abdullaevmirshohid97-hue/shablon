-- Every member of an organization could read every colleague's PIN hash.
--
-- `memberships_select` (0001) is `using (is_org_member(org_id))` — correct for
-- a row policy, and the roster screens depend on it. But RLS decides rows, not
-- columns, and one of the columns on that table is `finance_pin_hash`. So a
-- staff member could select it for the whole org and take a bcrypt hash of a
-- four-digit code away with them, which is a few seconds of offline guessing.
--
-- What that would get them is bounded, and worth stating plainly: a PIN cannot
-- sign anyone in as anyone. `verify_finance_pin` has no target_user_id and
-- never has (0020), so knowing a colleague's code lets you satisfy a gate as
-- *yourself*, not enter the ledger under their name — the audit log stays
-- honest either way. It is a shared-screen lock that stopped being one for
-- anyone who thought to look.
--
-- The fix is column-level, because the problem is column-level. Postgres has
-- had per-column grants since long before RLS, and they compose with it: the
-- row policy still decides which rows, and this decides that one column is not
-- among them. The SECURITY DEFINER functions that legitimately touch the hash
-- — set_finance_pin, verify_finance_pin, has_finance_pin, admin_set_finance_pin
-- — run as the owner and are unaffected.
--
-- One consequence to know about: `select *` on memberships now fails for a
-- normal session. Nothing in the app does that (every read names its columns),
-- and a query that wants everything on this table is a query that wants
-- something it should not have.
--
-- Re-runnable, same as 0014-0039.

do $$
begin
  -- Grants are per-role and the roles differ between a local stack and a
  -- hosted project; skip any that is not present rather than failing the run.
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke select (finance_pin_hash) on public.memberships from authenticated;
  end if;

  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke select (finance_pin_hash) on public.memberships from anon;
  end if;
end $$;

-- The rest of the table stays readable exactly as before. Spelled out rather
-- than assumed: a bare `revoke ... (column)` leaves the table-level grant in
-- place, but re-granting the columns by name means this migration states the
-- whole intended shape instead of half of it.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant select (org_id, user_id, role, created_at) on public.memberships to authenticated;
  end if;
end $$;
