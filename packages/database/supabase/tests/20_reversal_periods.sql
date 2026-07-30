-- 0014 (reversal) + 0015 (accounting periods)

set role app_user;
set app.current_user_id = 'aaaaaaaa-0000-0000-0000-000000000001';

-- =========== reversal ===========
do $$
declare v_id uuid; v_rev uuid; t transactions; r transactions; msg text;
begin
  v_id := test_entry(current_date, 500, 'asl yozuv');

  -- Through the app: RLS filters the row out, so the DELETE is a silent no-op
  -- rather than an error. What matters is that the entry survives.
  delete from transactions where id = v_id;
  perform test_report('a posted entry survives a DELETE through RLS',
                      exists (select 1 from transactions where id = v_id));

  -- status cannot be flipped back to draft to sneak around that
  begin
    update transactions set status = 'draft' where id = v_id;
    perform test_report('status cannot be changed by a plain UPDATE', false);
  exception when others then
    get stacked diagnostics msg = message_text;
    perform test_report('status cannot be changed by a plain UPDATE',
                        msg like '%status can only be changed%');
  end;

  v_rev := reverse_transaction(v_id, current_date, 'xato summa');
  select * into t from transactions where id = v_id;
  select * into r from transactions where id = v_rev;

  perform test_report('original is marked reversed and linked',
                      t.status = 'reversed' and t.reversed_by_id = v_rev);
  perform test_report('reversal points back at the original',
                      r.status = 'reversal' and r.reversal_of_id = v_id);
  perform test_report('reversal mirrors the accounts',
                      r.debit_account_id = t.credit_account_id
                  and r.credit_account_id = t.debit_account_id);
  perform test_report('reversal carries the same amount', r.debit_amount = 500);
  perform test_report('reversal gets its own document number',
                      r.document_no is not null and r.document_no <> t.document_no);
  perform test_report('reversal records who made it',
                      r.created_by = 'aaaaaaaa-0000-0000-0000-000000000001');

  -- the pair nets to zero on the receivable side
  perform test_report('the pair nets to zero',
    (select coalesce(sum(case when da.type = 'receivable' then tx.debit_amount else 0 end
                          - case when ca.type = 'receivable' then tx.credit_amount else 0 end), 0)
     from transactions tx
     join accounts da on da.id = tx.debit_account_id
     join accounts ca on ca.id = tx.credit_account_id
     where tx.id in (v_id, v_rev)) = 0);

  begin
    perform reverse_transaction(v_id);
    perform test_report('an entry cannot be reversed twice', false);
  exception when others then
    get stacked diagnostics msg = message_text;
    perform test_report('an entry cannot be reversed twice', msg like '%already been reversed%');
  end;

  begin
    perform reverse_transaction(v_rev);
    perform test_report('a reversal cannot itself be reversed', false);
  exception when others then
    get stacked diagnostics msg = message_text;
    perform test_report('a reversal cannot itself be reversed', msg like '%cannot itself be reversed%');
  end;
end $$;

-- manager may not reverse
do $$
declare v_id uuid; msg text;
begin
  perform set_config('app.current_user_id', 'aaaaaaaa-0000-0000-0000-000000000001', false);
  v_id := test_entry(current_date, 100, 'menejer testi');
  perform set_config('app.current_user_id', 'bbbbbbbb-0000-0000-0000-000000000002', false);
  begin
    perform reverse_transaction(v_id);
    perform test_report('a manager cannot reverse an entry', false);
  exception when others then
    get stacked diagnostics msg = message_text;
    perform test_report('a manager cannot reverse an entry', msg like '%owner/admin%');
  end;
  perform set_config('app.current_user_id', 'aaaaaaaa-0000-0000-0000-000000000001', false);
end $$;

-- =========== accounting periods ===========
do $$
declare n integer; msg text; v_prev uuid; v_curr uuid;
begin
  n := generate_accounting_periods('11111111-1111-1111-1111-111111111111',
                                   extract(year from current_date)::int);
  perform test_report('12 monthly periods are generated', n = 12);

  n := generate_accounting_periods('11111111-1111-1111-1111-111111111111',
                                   extract(year from current_date)::int);
  perform test_report('regenerating the same year is a no-op', n = 0);

  select id into v_curr from accounting_periods
   where org_id = '11111111-1111-1111-1111-111111111111'
     and current_date between start_date and end_date;

  -- sequential close: January is still open, so the current month cannot close
  if extract(month from current_date) > 1 then
    begin
      perform close_accounting_period(v_curr);
      perform test_report('a period cannot close while an earlier one is open', false);
    exception when others then
      get stacked diagnostics msg = message_text;
      perform test_report('a period cannot close while an earlier one is open',
                          msg like '%close periods in order%');
    end;
  end if;

  -- close everything up to and including the current month
  for v_prev in
    select id from accounting_periods
     where org_id = '11111111-1111-1111-1111-111111111111'
       and start_date <= current_date
     order by start_date
  loop
    perform close_accounting_period(v_prev);
  end loop;
  perform test_report('periods close in order', true);
end $$;

-- posting into a closed period is blocked
do $$
declare msg text;
begin
  begin
    perform test_entry(current_date, 250, 'yopiq davrga');
    perform test_report('posting into a closed period is blocked', false);
  exception when others then
    get stacked diagnostics msg = message_text;
    perform test_report('posting into a closed period is blocked', msg like '%is closed%');
  end;
end $$;

-- but bookkeeping on an entry already inside a closed period still works:
-- reversing it must post the mirror into the next, open month
do $$
declare v_id uuid; v_rev uuid; v_next date; msg text;
begin
  v_next := (date_trunc('month', current_date) + interval '1 month')::date;

  -- an entry that predates the close
  select id into v_id from transactions
   where org_id = '11111111-1111-1111-1111-111111111111' and status = 'posted'
   order by created_at limit 1;

  v_rev := reverse_transaction(v_id, v_next, 'yopiq davrdagi yozuvni storno');
  perform test_report('an entry in a closed period can still be reversed into an open one',
                      (select status from transactions where id = v_id) = 'reversed'
                  and (select occurred_at::date from transactions where id = v_rev) = v_next);
end $$;

-- reopen: admin cannot, owner can, newest first
do $$
declare v_curr uuid; v_jan uuid; msg text;
begin
  select id into v_curr from accounting_periods
   where org_id = '11111111-1111-1111-1111-111111111111'
     and current_date between start_date and end_date;
  select id into v_jan from accounting_periods
   where org_id = '11111111-1111-1111-1111-111111111111' and status = 'closed'
   order by start_date limit 1;

  if v_jan <> v_curr then
    begin
      perform reopen_accounting_period(v_jan);
      perform test_report('an older period cannot reopen while a newer one is closed', false);
    exception when others then
      get stacked diagnostics msg = message_text;
      perform test_report('an older period cannot reopen while a newer one is closed',
                          msg like '%newest first%');
    end;
  end if;

  -- a plain admin (not owner) is refused
  perform set_config('app.current_user_id', 'bbbbbbbb-0000-0000-0000-000000000002', false);
  update memberships set role = 'admin'
   where org_id = '11111111-1111-1111-1111-111111111111'
     and user_id = 'bbbbbbbb-0000-0000-0000-000000000002';
  begin
    perform reopen_accounting_period(v_curr);
    perform test_report('a non-owner admin cannot reopen a period', false);
  exception when others then
    get stacked diagnostics msg = message_text;
    perform test_report('a non-owner admin cannot reopen a period', msg like '%owner can reopen%');
  end;

  perform set_config('app.current_user_id', 'aaaaaaaa-0000-0000-0000-000000000001', false);
  perform reopen_accounting_period(v_curr);
  perform test_report('the owner can reopen the newest closed period',
                      (select status from accounting_periods where id = v_curr) = 'open');
end $$;

-- periods must not overlap, and the feed reports figures
do $$
declare msg text; n integer;
begin
  begin
    insert into accounting_periods (org_id, name, start_date, end_date)
    values ('11111111-1111-1111-1111-111111111111', 'ustma-ust',
            date_trunc('year', current_date)::date,
            (date_trunc('year', current_date) + interval '2 months')::date);
    perform test_report('overlapping periods are rejected', false);
  exception when others then
    get stacked diagnostics msg = message_text;
    perform test_report('overlapping periods are rejected', msg like '%overlaps%');
  end;

  select count(*) into n
  from list_accounting_periods('11111111-1111-1111-1111-111111111111',
                               extract(year from current_date)::int);
  perform test_report('the period feed lists the year', n = 12);
end $$;

-- RLS is not the real protection: service_role and the Supabase dashboard
-- bypass it entirely. The trigger is what stops a posted entry being erased.
reset role;
do $$
declare v_id uuid; msg text;
begin
  -- A fresh entry: everything posted earlier in this file has since been
  -- reversed, so selecting an existing 'posted' row would find nothing and the
  -- delete would be a no-op for the wrong reason.
  v_id := test_entry(current_date, 900, 'superuser delete testi');
  begin
    delete from transactions where id = v_id;
    perform test_report('a posted entry cannot be deleted even bypassing RLS', false);
  exception when others then
    get stacked diagnostics msg = message_text;
    perform test_report('a posted entry cannot be deleted even bypassing RLS',
                        msg like '%cannot be deleted%');
  end;
end $$;

-- tenant offboarding still works with all guards installed
do $$
begin
  delete from organizations where id = '11111111-1111-1111-1111-111111111111';
  perform test_report('deleting an organization is blocked by neither guard', true);
exception when others then
  perform test_report('deleting an organization is blocked by neither guard', false);
end $$;
