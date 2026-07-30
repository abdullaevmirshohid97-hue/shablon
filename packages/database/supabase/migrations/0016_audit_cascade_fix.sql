-- Deleting an organization failed once its ledger had surviving entries.
--
-- transaction_audit.org_id is a foreign key to organizations. Dropping an org
-- cascades into transactions, and the AFTER DELETE audit trigger then tried to
-- write a log row referencing the organization that had just been removed —
-- a foreign key violation that aborted the whole delete.
--
-- It went unnoticed until 0014 made posted entries undeletable: before that,
-- an org was usually emptied before it was dropped, so the cascade rarely had
-- any transaction left to log.
--
-- Nothing of value is lost by skipping the log here. The audit trail exists to
-- explain changes *within* a living ledger; when the tenant itself is gone,
-- the rows it would describe are gone with it.

create or replace function log_transaction_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from organizations where id = old.org_id) then
    return null;
  end if;

  insert into transaction_audit (org_id, transaction_id, action, changed_by, old_row, new_row)
  values (
    old.org_id,
    old.id,
    lower(tg_op),
    auth.uid(),
    to_jsonb(old),
    case when tg_op = 'UPDATE' then to_jsonb(new) else null end
  );
  -- AFTER row trigger: the return value is ignored.
  return null;
end;
$$;
