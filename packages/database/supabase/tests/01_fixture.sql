-- Shared fixture: one org, an owner (admin), a staff (manager), two accounts,
-- one category, one client. Re-runnable from a clean database.

grant select, insert, update, delete on all tables in schema public to app_user;
grant usage, select on all sequences in schema public to app_user;

insert into organizations (id, name, slug)
values ('11111111-1111-1111-1111-111111111111', 'Test Org', 'test-org');

insert into auth.users (id, email, aud, role, created_at, updated_at) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'admin@test.uz', 'authenticated', 'authenticated', now(), now()),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'manager@test.uz', 'authenticated', 'authenticated', now(), now());

insert into memberships (org_id, user_id, role) values
  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000001', 'owner'),
  ('11111111-1111-1111-1111-111111111111', 'bbbbbbbb-0000-0000-0000-000000000002', 'staff');

insert into accounts (id, org_id, code, name, type) values
  ('cccccccc-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', '1', 'Mijozlar', 'receivable'),
  ('cccccccc-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', '2', 'Kassa', 'cash');

insert into transaction_categories (id, org_id, name, default_debit_account_id, default_credit_account_id)
values ('dddddddd-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'kirim',
        'cccccccc-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000002');

insert into counterparties (id, org_id, name)
values ('eeeeeeee-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Mijoz A');

create or replace function test_report(label text, ok boolean) returns void
language plpgsql as $$
begin
  raise notice '% %', case when ok then '[PASS]' else '[FAIL]' end, label;
end;
$$;

-- Posts one entry as the admin and returns its id.
create or replace function test_entry(p_when date, p_amount numeric, p_desc text default 'test')
returns uuid language plpgsql as $$
declare v_id uuid;
begin
  insert into transactions (org_id, counterparty_id, category_id, occurred_at,
    debit_account_id, debit_amount, credit_account_id, credit_amount, currency, description)
  values ('11111111-1111-1111-1111-111111111111', 'eeeeeeee-0000-0000-0000-000000000001',
    'dddddddd-0000-0000-0000-000000000001', p_when::timestamptz,
    'cccccccc-0000-0000-0000-000000000001', p_amount,
    'cccccccc-0000-0000-0000-000000000002', p_amount, 'UZS', p_desc)
  returning id into v_id;
  return v_id;
end;
$$;
