\set ON_ERROR_STOP on

-- The Finance PIN (0020_admin_finance_pin.sql). Two properties matter more
-- than the happy path:
--
--   1. only an owner/admin can issue or clear one, and
--   2. verifying is scoped to the caller — a PIN can confirm the person
--      already signed in and nobody else. If that leaked, the roster picker
--      would let anyone unlock Finance as a colleague and the audit log would
--      name the wrong person.

set role app_user;

-- =========== 1. admin issues a PIN for the staff member ===========
set app.current_user_id = 'aaaaaaaa-0000-0000-0000-000000000001';

do $$
begin
  perform admin_set_finance_pin(
    '11111111-1111-1111-1111-111111111111',
    'bbbbbbbb-0000-0000-0000-000000000002',
    'kassa1');
  perform test_report('admin can issue a staff PIN', true);
exception when others then
  perform test_report('admin can issue a staff PIN', false);
end $$;

-- Stored as a bcrypt hash, never as the code itself.
do $$
declare v_hash text;
begin
  select finance_pin_hash into v_hash from memberships
  where org_id = '11111111-1111-1111-1111-111111111111'
    and user_id = 'bbbbbbbb-0000-0000-0000-000000000002';
  perform test_report('PIN is stored hashed, not in clear',
                      v_hash is not null and v_hash <> 'kassa1' and v_hash like '$2%');
end $$;

-- =========== 2. length rule: 4-10 characters ===========
do $$
declare bad text;
begin
  foreach bad in array array['abc', 'abcdefghijk'] loop
    begin
      perform admin_set_finance_pin(
        '11111111-1111-1111-1111-111111111111',
        'bbbbbbbb-0000-0000-0000-000000000002', bad);
      perform test_report('PIN of length ' || length(bad) || ' is refused', false);
    exception when others then
      perform test_report('PIN of length ' || length(bad) || ' is refused', true);
    end;
  end loop;
end $$;

do $$
declare good text;
begin
  foreach good in array array['1234', '1234567890'] loop
    begin
      perform admin_set_finance_pin(
        '11111111-1111-1111-1111-111111111111',
        'bbbbbbbb-0000-0000-0000-000000000002', good);
      perform test_report('PIN of length ' || length(good) || ' is accepted', true);
    exception when others then
      perform test_report('PIN of length ' || length(good) || ' is accepted', false);
    end;
  end loop;
end $$;

-- Put a known code back for the verification tests below.
do $$
begin
  perform admin_set_finance_pin(
    '11111111-1111-1111-1111-111111111111',
    'bbbbbbbb-0000-0000-0000-000000000002', 'kassa1');
  perform admin_set_finance_pin(
    '11111111-1111-1111-1111-111111111111',
    'aaaaaaaa-0000-0000-0000-000000000001', 'boshliq1');
end $$;

-- =========== 3. staff cannot issue or clear anyone's PIN ===========
set app.current_user_id = 'bbbbbbbb-0000-0000-0000-000000000002';

do $$
begin
  begin
    perform admin_set_finance_pin(
      '11111111-1111-1111-1111-111111111111',
      'aaaaaaaa-0000-0000-0000-000000000001', 'hacked');
    perform test_report('staff CANNOT set another member PIN', false);
  exception when others then
    perform test_report('staff CANNOT set another member PIN', true);
  end;
end $$;

do $$
begin
  begin
    perform admin_clear_finance_pin(
      '11111111-1111-1111-1111-111111111111',
      'aaaaaaaa-0000-0000-0000-000000000001');
    perform test_report('staff CANNOT clear another member PIN', false);
  exception when others then
    perform test_report('staff CANNOT clear another member PIN', true);
  end;
end $$;

-- The admin's PIN is untouched by either attempt.
do $$
begin
  set local role postgres;
  perform test_report('admin PIN survived the staff attempts',
    (select finance_pin_hash = crypt('boshliq1', finance_pin_hash) from memberships
     where org_id = '11111111-1111-1111-1111-111111111111'
       and user_id = 'aaaaaaaa-0000-0000-0000-000000000001'));
end $$;

-- =========== 4. verification is scoped to the caller ===========
set role app_user;
set app.current_user_id = 'bbbbbbbb-0000-0000-0000-000000000002';

do $$
begin
  perform test_report('staff own PIN verifies',
    verify_finance_pin('11111111-1111-1111-1111-111111111111', 'kassa1') = true);
  perform test_report('staff wrong PIN is refused',
    verify_finance_pin('11111111-1111-1111-1111-111111111111', 'kassa2') = false);
  -- The whole point: the admin's real PIN must not unlock a staff session.
  perform test_report('staff CANNOT verify with the admin PIN',
    verify_finance_pin('11111111-1111-1111-1111-111111111111', 'boshliq1') = false);
  perform test_report('has_finance_pin is true for staff',
    has_finance_pin('11111111-1111-1111-1111-111111111111') = true);
end $$;

-- =========== 5. self-service change keeps the same rules ===========
do $$
begin
  perform set_finance_pin('11111111-1111-1111-1111-111111111111', 'yangi9');
  perform test_report('staff can change their own PIN',
    verify_finance_pin('11111111-1111-1111-1111-111111111111', 'yangi9') = true);
  perform test_report('the replaced PIN stops working',
    verify_finance_pin('11111111-1111-1111-1111-111111111111', 'kassa1') = false);
exception when others then
  perform test_report('staff can change their own PIN', false);
end $$;

do $$
begin
  begin
    perform set_finance_pin('11111111-1111-1111-1111-111111111111', 'ab');
    perform test_report('self-set honours the 4-10 rule', false);
  exception when others then
    perform test_report('self-set honours the 4-10 rule', true);
  end;
end $$;

-- =========== 6. the admin directory reports PIN status ===========
set app.current_user_id = 'aaaaaaaa-0000-0000-0000-000000000001';

do $$
begin
  perform test_report('list_org_members flags who has a PIN',
    (select bool_and(has_finance_pin)
     from list_org_members('11111111-1111-1111-1111-111111111111')));
end $$;

-- Staff get nothing from the admin directory (0009 behaviour, still true).
set app.current_user_id = 'bbbbbbbb-0000-0000-0000-000000000002';

do $$
begin
  perform test_report('list_org_members is empty for staff',
    (select count(*) from list_org_members('11111111-1111-1111-1111-111111111111')) = 0);
end $$;

-- =========== 7. clearing falls back to the login password ===========
set app.current_user_id = 'aaaaaaaa-0000-0000-0000-000000000001';

do $$
begin
  perform admin_clear_finance_pin(
    '11111111-1111-1111-1111-111111111111',
    'bbbbbbbb-0000-0000-0000-000000000002');
  perform test_report('admin can clear a staff PIN', true);
exception when others then
  perform test_report('admin can clear a staff PIN', false);
end $$;

set app.current_user_id = 'bbbbbbbb-0000-0000-0000-000000000002';

do $$
begin
  perform test_report('has_finance_pin is false once cleared',
    has_finance_pin('11111111-1111-1111-1111-111111111111') = false);
  -- No PIN means no PIN unlocks it — not "any PIN unlocks it".
  perform test_report('a cleared PIN verifies against nothing',
    verify_finance_pin('11111111-1111-1111-1111-111111111111', 'yangi9') = false);
end $$;

-- =========== 8. a non-member is never a target ===========
set app.current_user_id = 'aaaaaaaa-0000-0000-0000-000000000001';

do $$
begin
  begin
    perform admin_set_finance_pin(
      '11111111-1111-1111-1111-111111111111',
      '99999999-0000-0000-0000-000000000009', 'kassa1');
    perform test_report('PIN cannot be set for a non-member', false);
  exception when others then
    perform test_report('PIN cannot be set for a non-member', true);
  end;
end $$;

reset role;
