-- Change history for ledger entries.
--
-- 0012 pinned `created_by` so every new row records who entered it, but an
-- edit or a delete still left no trace — the ledger simply looked different
-- than it did yesterday. With managers now on read-only Finance, the
-- remaining question an owner asks is "who changed this number, and what was
-- it before?". This answers it.
--
-- Only UPDATE and DELETE are logged: an INSERT is already fully described by
-- the surviving row plus its created_by.

create table transaction_audit (
  id bigint generated always as identity primary key,
  org_id uuid not null references organizations (id) on delete cascade,
  -- Deliberately not a foreign key: a delete must leave its audit row behind,
  -- which a references-cascade would remove along with the transaction.
  transaction_id uuid not null,
  action text not null check (action in ('update', 'delete')),
  changed_by uuid references auth.users (id),
  changed_at timestamptz not null default now(),
  old_row jsonb not null,
  new_row jsonb
);

create index transaction_audit_org_changed_idx on transaction_audit (org_id, changed_at desc);
create index transaction_audit_transaction_idx on transaction_audit (transaction_id);

alter table transaction_audit enable row level security;

-- Read is admin-only; there is deliberately no insert/update/delete policy at
-- all, so the SECURITY DEFINER trigger below is the only thing that can write
-- here and the log cannot be edited from the app by anyone.
create policy transaction_audit_select on transaction_audit
  for select using (is_org_admin(org_id));

create function log_transaction_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
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

create trigger transactions_audit
  after update or delete on transactions
  for each row execute function log_transaction_change();

-- Readable feed for the Settings screen: resolves the actor and the client to
-- names, and lifts the handful of fields worth showing out of the jsonb.
-- debit_amount is used as "the amount" because a posting always stores the
-- same figure on both legs (see useCreateTransaction).
create function list_transaction_audit(target_org_id uuid, p_limit integer default 100)
returns table (
  id bigint,
  transaction_id uuid,
  action text,
  changed_at timestamptz,
  changed_by_name text,
  counterparty_name text,
  document_no text,
  occurred_at timestamptz,
  old_amount numeric,
  new_amount numeric,
  old_description text,
  new_description text
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  select
    a.id,
    a.transaction_id,
    a.action,
    a.changed_at,
    coalesce(p.full_name, u.email) as changed_by_name,
    c.name as counterparty_name,
    a.old_row ->> 'document_no' as document_no,
    (a.old_row ->> 'occurred_at')::timestamptz as occurred_at,
    (a.old_row ->> 'debit_amount')::numeric as old_amount,
    (a.new_row ->> 'debit_amount')::numeric as new_amount,
    a.old_row ->> 'description' as old_description,
    a.new_row ->> 'description' as new_description
  from transaction_audit a
  left join auth.users u on u.id = a.changed_by
  left join profiles p on p.id = a.changed_by
  left join counterparties c on c.id = (a.old_row ->> 'counterparty_id')::uuid
  where a.org_id = target_org_id and is_org_admin(target_org_id)
  order by a.changed_at desc
  limit least(coalesce(p_limit, 100), 500);
$$;
