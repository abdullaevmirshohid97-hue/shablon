-- Removing a client, and being told why you cannot.
--
-- The register could be added to but never corrected. A name typed wrong at
-- seven in the morning stayed wrong; a client created twice stayed twice; and
-- a test row entered while learning the app sat in the directory forever,
-- because nothing in the product could delete one.
--
-- The database could, though — counterparties_delete has allowed an admin to
-- since 0012. What it did NOT do was explain itself. A plain DELETE against a
-- client with history takes one of two paths, and neither is readable:
--
--   * transactions.counterparty_id cascades, so Postgres tries to erase the
--     ledger, and 0014's prevent_posted_delete stops it — the operator sees
--     "a posted entry cannot be deleted (document 000123)" about a document
--     they never mentioned, and the delete aborts;
--   * sklad_orders, sklad_movements, sklad_invoices and sklad_shipments do not
--     cascade, so it fails on a foreign key violation naming a constraint.
--
-- Both are the right outcome reached in the wrong words. So the rule is stated
-- once, up front, in the terms the company uses: a client with any history is
-- not deleted, and the answer says what the history is. Correcting the name is
-- what fixing a mistyped client looks like; reversing an entry is what undoing
-- money looks like. Deleting is only for a row that never meant anything.
--
-- Note there is deliberately no force. 0014 argues that a posted entry is
-- cancelled by an opposite entry and never erased, and a "delete the client
-- and everything they ever did" button is that rule with an escape hatch.
--
-- Re-runnable: create or replace throughout, same as 0014-0033.


-- ---------------------------------------------------------------------
-- Who points at this client, and how many times.
--
-- Security INVOKER on purpose, which makes it two things at once and both are
-- wanted. Called from the app it runs as the signed-in user, so RLS answers —
-- a member sees their own org's counts and nobody else sees anything. Called
-- from inside delete_counterparty, which is security definer, it inherits
-- those rights and counts every row regardless of policy, which is what an
-- authoritative check has to do.
--
-- The list of tables is not arbitrary: it is every foreign key that points at
-- counterparties, which is also what the ontology declares as inbound links to
-- `kontragent`. A new module that references a client adds a line here, and
-- ontology/schema.test.ts fails until it does.
-- ---------------------------------------------------------------------
create or replace function counterparty_references(target_org_id uuid, target_id uuid)
returns table (entity text, ref_count bigint)
language sql
stable
set search_path = public
as $$
  select 'tranzaksiya'::text, count(*)::bigint
    from transactions where org_id = target_org_id and counterparty_id = target_id
  union all
  select 'buyurtma', count(*)::bigint
    from sklad_orders where org_id = target_org_id and counterparty_id = target_id
  union all
  select 'harakat', count(*)::bigint
    from sklad_movements where org_id = target_org_id and counterparty_id = target_id
  union all
  select 'faktura', count(*)::bigint
    from sklad_invoices where org_id = target_org_id and counterparty_id = target_id
  union all
  select 'jonatma', count(*)::bigint
    from sklad_shipments where org_id = target_org_id and counterparty_id = target_id;
$$;


-- ---------------------------------------------------------------------
-- Delete a client that never meant anything, and refuse the rest by name.
--
-- security definer so the check is the function's own rather than whatever RLS
-- happens to allow the caller — and it re-counts rather than trusting what the
-- screen was showing, because the screen was drawn before the invoice was.
-- ---------------------------------------------------------------------
create or replace function delete_counterparty(target_org_id uuid, target_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  blockers text[] := '{}';
  r record;
begin
  if not can_write_finance(target_org_id) then
    raise exception 'not authorized';
  end if;

  if not exists (
    select 1 from counterparties where id = target_id and org_id = target_org_id
  ) then
    raise exception 'Mijoz topilmadi';
  end if;

  for r in
    select entity, ref_count from counterparty_references(target_org_id, target_id)
    where ref_count > 0
  loop
    blockers := blockers || format('%s ta %s', r.ref_count, r.entity);
  end loop;

  if array_length(blockers, 1) > 0 then
    raise exception
      'Bu mijozni o''chirib bo''lmaydi — unga bog''liq: %. Nomini tuzatish yoki yozuvlarni bekor qilish kerak.',
      array_to_string(blockers, ', ');
  end if;

  delete from counterparties where id = target_id and org_id = target_org_id;
end;
$$;
