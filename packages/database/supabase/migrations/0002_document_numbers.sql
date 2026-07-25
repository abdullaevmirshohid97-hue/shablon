-- Adds an auto-numbered "document number" to transactions, mirroring the
-- "Обороты 00000000XXX" document column from the source paper ledger.

create table org_document_counters (
  org_id uuid primary key references organizations (id) on delete cascade,
  next_no bigint not null default 1
);

alter table transactions add column document_no text;

create function assign_document_no()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  seq bigint;
begin
  if new.document_no is not null then
    return new;
  end if;

  insert into org_document_counters (org_id, next_no)
  values (new.org_id, 2)
  on conflict (org_id) do update set next_no = org_document_counters.next_no + 1
  returning next_no - 1 into seq;

  new.document_no := lpad(seq::text, 11, '0');
  return new;
end;
$$;

create trigger transactions_assign_document_no
  before insert on transactions
  for each row execute function assign_document_no();

-- Backfill existing rows (if any) in chronological order.
with numbered as (
  select id, row_number() over (partition by org_id order by occurred_at, created_at) as rn
  from transactions
  where document_no is null
)
update transactions t
set document_no = lpad(numbered.rn::text, 11, '0')
from numbered
where t.id = numbered.id;

alter table org_document_counters enable row level security;
create policy org_document_counters_select on org_document_counters
  for select using (is_org_member(org_id));
