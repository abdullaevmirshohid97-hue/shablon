\set ON_ERROR_STOP on

grant select, insert, update, delete on all tables in schema public to app_user;
grant usage, select on all sequences in schema public to app_user;

-- ---------------------------------------------------------------
-- Fixture: one org, one owner (admin), one staff (manager)
-- ---------------------------------------------------------------
insert into organizations (id, name, slug)
values ('11111111-1111-1111-1111-111111111111', 'Test Org', 'test-org');

insert into auth.users (id, email, aud, role, created_at, updated_at)
values
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

-- ---------------------------------------------------------------
create or replace function test_report(label text, ok boolean) returns void
language plpgsql as $$
begin
  raise notice '% %', case when ok then '[PASS]' else '[FAIL]' end, label;
end;
$$;

-- =========== 1. manager (staff) cannot insert a transaction ===========
set role app_user;
set app.current_user_id = 'bbbbbbbb-0000-0000-0000-000000000002';

do $$
declare sqlstate_got text;
begin
  begin
    insert into transactions (org_id, counterparty_id, category_id, occurred_at,
      debit_account_id, debit_amount, credit_account_id, credit_amount, currency)
    values ('11111111-1111-1111-1111-111111111111', 'eeeeeeee-0000-0000-0000-000000000001',
      'dddddddd-0000-0000-0000-000000000001', now(),
      'cccccccc-0000-0000-0000-000000000001', 100, 'cccccccc-0000-0000-0000-000000000002', 100, 'UZS');
    perform test_report('manager INSERT transaction is refused', false);
  exception when others then
    get stacked diagnostics sqlstate_got = returned_sqlstate;
    perform test_report('manager INSERT transaction is refused (' || sqlstate_got || ')', sqlstate_got = '42501');
  end;
end $$;

-- =========== 2. manager cannot create a client ===========
do $$
declare sqlstate_got text;
begin
  begin
    insert into counterparties (org_id, name)
    values ('11111111-1111-1111-1111-111111111111', 'Yangi mijoz');
    perform test_report('manager INSERT counterparty is refused', false);
  exception when others then
    get stacked diagnostics sqlstate_got = returned_sqlstate;
    perform test_report('manager INSERT counterparty is refused (' || sqlstate_got || ')', sqlstate_got = '42501');
  end;
end $$;

-- =========== 3. manager CAN read ledger + clients ===========
do $$
declare tx_visible int; cp_visible int;
begin
  select count(*) into cp_visible from counterparties;
  select count(*) into tx_visible from transactions;
  perform test_report('manager can read the client directory', cp_visible = 1);
  perform test_report('manager can read the ledger (0 rows so far, no error)', tx_visible = 0);
end $$;

-- =========== 4. admin CAN insert, created_by is pinned ===========
set app.current_user_id = 'aaaaaaaa-0000-0000-0000-000000000001';

insert into transactions (id, org_id, counterparty_id, category_id, occurred_at,
  debit_account_id, debit_amount, credit_account_id, credit_amount, currency, description)
values ('ffffffff-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
  'eeeeeeee-0000-0000-0000-000000000001', 'dddddddd-0000-0000-0000-000000000001', now(),
  'cccccccc-0000-0000-0000-000000000001', 500, 'cccccccc-0000-0000-0000-000000000002', 500, 'UZS', 'birinchi');

do $$
declare author uuid;
begin
  select created_by into author from transactions where id = 'ffffffff-0000-0000-0000-000000000001';
  perform test_report('admin INSERT succeeds and created_by = caller',
                      author = 'aaaaaaaa-0000-0000-0000-000000000001');
end $$;

-- =========== 5. nobody can attribute a write to someone else ===========
do $$
declare sqlstate_got text;
begin
  begin
    insert into transactions (org_id, counterparty_id, category_id, occurred_at,
      debit_account_id, debit_amount, credit_account_id, credit_amount, currency, created_by)
    values ('11111111-1111-1111-1111-111111111111', 'eeeeeeee-0000-0000-0000-000000000001',
      'dddddddd-0000-0000-0000-000000000001', now(),
      'cccccccc-0000-0000-0000-000000000001', 1, 'cccccccc-0000-0000-0000-000000000002', 1, 'UZS',
      'bbbbbbbb-0000-0000-0000-000000000002');
    perform test_report('INSERT attributed to another user is refused', false);
  exception when others then
    get stacked diagnostics sqlstate_got = returned_sqlstate;
    perform test_report('INSERT attributed to another user is refused (' || sqlstate_got || ')',
                        sqlstate_got = '42501');
  end;
end $$;

-- =========== 6. audit trigger records UPDATE and DELETE ===========
-- Both legs move together: 0018 makes an unbalanced edit a constraint violation.
update transactions set debit_amount = 700, credit_amount = 700, description = 'tuzatildi'
where id = 'ffffffff-0000-0000-0000-000000000001';

do $$
declare n int; old_amt numeric; new_amt numeric; actor uuid;
begin
  select count(*) into n from transaction_audit where action = 'update';
  select (old_row ->> 'debit_amount')::numeric, (new_row ->> 'debit_amount')::numeric, changed_by
    into old_amt, new_amt, actor
    from transaction_audit where action = 'update' order by id desc limit 1;
  perform test_report('UPDATE writes one audit row', n = 1);
  perform test_report('audit keeps before/after amount (500 -> 700)', old_amt = 500 and new_amt = 700);
  perform test_report('audit records the actor', actor = 'aaaaaaaa-0000-0000-0000-000000000001');
end $$;

-- 0014 turned this into a no-op: a posted entry is no longer deletable, so
-- there is no delete to audit. The reversal path that replaced it is covered
-- in full by verify_reversal_periods.sql.
delete from transactions where id = 'ffffffff-0000-0000-0000-000000000001';

do $$
begin
  perform test_report('the posted entry survives the delete attempt',
    exists (select 1 from transactions where id = 'ffffffff-0000-0000-0000-000000000001'));
  perform test_report('no delete is audited, because none happened',
    (select count(*) from transaction_audit where action = 'delete') = 0);
end $$;

-- =========== 7. audit feed: admin sees it, manager does not ===========
do $$
declare admin_rows int; manager_rows int; direct_rows int;
begin
  select count(*) into admin_rows
    from list_transaction_audit('11111111-1111-1111-1111-111111111111');
  perform test_report('admin reads the audit feed', admin_rows = 1);

  perform set_config('app.current_user_id', 'bbbbbbbb-0000-0000-0000-000000000002', false);
  select count(*) into manager_rows
    from list_transaction_audit('11111111-1111-1111-1111-111111111111');
  select count(*) into direct_rows from transaction_audit;
  perform test_report('manager gets nothing from the audit feed', manager_rows = 0);
  perform test_report('manager cannot read transaction_audit directly', direct_rows = 0);
  perform set_config('app.current_user_id', 'aaaaaaaa-0000-0000-0000-000000000001', false);
end $$;

-- =========== 8. the last admin cannot be demoted or removed ===========
do $$
declare msg text;
begin
  begin
    update memberships set role = 'staff'
    where org_id = '11111111-1111-1111-1111-111111111111'
      and user_id = 'aaaaaaaa-0000-0000-0000-000000000001';
    perform test_report('demoting the last admin is blocked', false);
  exception when others then
    get stacked diagnostics msg = message_text;
    perform test_report('demoting the last admin is blocked (' || msg || ')',
                        msg like '%at least one owner or admin%');
  end;

  begin
    delete from memberships
    where org_id = '11111111-1111-1111-1111-111111111111'
      and user_id = 'aaaaaaaa-0000-0000-0000-000000000001';
    perform test_report('deleting the last admin is blocked', false);
  exception when others then
    get stacked diagnostics msg = message_text;
    perform test_report('deleting the last admin is blocked', msg like '%at least one owner or admin%');
  end;
end $$;

-- =========== 9. promote, then the original admin may step down ===========
update memberships set role = 'admin'
where org_id = '11111111-1111-1111-1111-111111111111'
  and user_id = 'bbbbbbbb-0000-0000-0000-000000000002';

do $$
begin
  update memberships set role = 'staff'
  where org_id = '11111111-1111-1111-1111-111111111111'
    and user_id = 'aaaaaaaa-0000-0000-0000-000000000001';
  perform test_report('with a second admin present, demotion is allowed', true);
exception when others then
  perform test_report('with a second admin present, demotion is allowed', false);
end $$;

-- The (now) staff user must have lost write access along with the role.
do $$
declare sqlstate_got text;
begin
  begin
    insert into counterparties (org_id, name)
    values ('11111111-1111-1111-1111-111111111111', 'Demoted admin klienti');
    perform test_report('a demoted admin immediately loses write access', false);
  exception when others then
    get stacked diagnostics sqlstate_got = returned_sqlstate;
    perform test_report('a demoted admin immediately loses write access', sqlstate_got = '42501');
  end;
end $$;

-- =========== 10. deleting the org still works (cascade vs. the guard) ===========
reset role;
do $$
declare left_over int;
begin
  delete from organizations where id = '11111111-1111-1111-1111-111111111111';
  select count(*) into left_over from memberships
   where org_id = '11111111-1111-1111-1111-111111111111';
  perform test_report('deleting an organization is not blocked by the admin guard', left_over = 0);
exception when others then
  perform test_report('deleting an organization is not blocked by the admin guard', false);
end $$;
