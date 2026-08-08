-- 0019 reporting functions

set role app_user;
set app.current_user_id = 'aaaaaaaa-0000-0000-0000-000000000001';

-- A second client and a module, so the breakdowns have something to group by.
insert into modules (org_id, name)
values ('11111111-1111-1111-1111-111111111111', 'Sochiq');

update counterparties set categories = array['Sochiq']
where id = 'eeeeeeee-0000-0000-0000-000000000001';

insert into counterparties (id, org_id, name, categories)
values ('eeeeeeee-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111',
        'Mijoz B', array['Sochiq']);

insert into transaction_categories (id, org_id, name, unit,
  default_debit_account_id, default_credit_account_id)
values ('dddddddd-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111',
        'chiqim', 'kg',
        'cccccccc-0000-0000-0000-000000000002', 'cccccccc-0000-0000-0000-000000000001');

-- Three kirim on A (100 + 200 + 300), one chiqim on A that is overdue,
-- one chiqim on B due in three days.
do $$
begin
  perform test_entry(current_date - 20, 100, 'k1');
  perform test_entry(current_date - 10, 200, 'k2');
  perform test_entry(current_date, 300, 'k3');

  insert into transactions (org_id, counterparty_id, category_id, occurred_at, due_date,
    debit_account_id, debit_amount, credit_account_id, credit_amount, currency, description, quantity, unit)
  values ('11111111-1111-1111-1111-111111111111', 'eeeeeeee-0000-0000-0000-000000000001',
    'dddddddd-0000-0000-0000-000000000002', (current_date - 15)::timestamptz, current_date - 5,
    'cccccccc-0000-0000-0000-000000000002', 50,
    'cccccccc-0000-0000-0000-000000000001', 50, 'UZS', 'muddati otgan', 7, 'kg');

  insert into transactions (org_id, counterparty_id, category_id, occurred_at, due_date,
    debit_account_id, debit_amount, credit_account_id, credit_amount, currency, description)
  values ('11111111-1111-1111-1111-111111111111', 'eeeeeeee-0000-0000-0000-000000000002',
    'dddddddd-0000-0000-0000-000000000002', current_date::timestamptz, current_date + 3,
    'cccccccc-0000-0000-0000-000000000002', 80,
    'cccccccc-0000-0000-0000-000000000001', 80, 'UZS', 'yaqinlashgan');
end $$;

-- =========== category breakdown ===========
do $$
declare kirim numeric; chiqim numeric; qty numeric;
begin
  select total_amount into kirim from org_category_breakdown(
    '11111111-1111-1111-1111-111111111111') where kind = 'kirim';
  -- Grouped by category x unit x kind, so the two chiqim entries (one in kg,
  -- one with no unit) are deliberately separate rows and have to be summed.
  select coalesce(sum(total_amount), 0), coalesce(sum(total_quantity), 0)
    into chiqim, qty
    from org_category_breakdown('11111111-1111-1111-1111-111111111111')
   where kind = 'chiqim';

  perform test_report('category breakdown totals kirim', kirim = 600);
  perform test_report('category breakdown totals chiqim', chiqim = 130);
  perform test_report('category breakdown carries quantity', qty = 7);

  -- A window that excludes the two oldest kirim.
  select total_amount into kirim from org_category_breakdown(
    '11111111-1111-1111-1111-111111111111', current_date - 1, current_date) where kind = 'kirim';
  perform test_report('category breakdown respects the period', kirim = 300);
end $$;

-- =========== overdue / due soon ===========
do $$
declare amt numeric; d date; n int;
begin
  -- 600 billed, 50 paid against a date that has passed. The figure is the 550
  -- still owed; the old version reported the 50 already in the till.
  select overdue_amount, overdue_date into amt, d
  from org_overdue_by_counterparty('11111111-1111-1111-1111-111111111111')
  where counterparty_id = 'eeeeeeee-0000-0000-0000-000000000001';
  perform test_report('overdue reports what is owed, dated from when it fell due',
                      amt = 550 and d = current_date - 5);

  select count(*) into n from org_overdue_by_counterparty('11111111-1111-1111-1111-111111111111');
  perform test_report('the not-yet-due entry is not counted as overdue', n = 1);

  select count(*) into n from org_due_soon('11111111-1111-1111-1111-111111111111', 7);
  perform test_report('due-soon finds the upcoming obligation', n = 1);

  select count(*) into n from org_due_soon('11111111-1111-1111-1111-111111111111', 1);
  perform test_report('due-soon respects its horizon', n = 0);
end $$;

-- =========== module breakdown ===========
do $$
declare r record;
begin
  select * into r from org_module_breakdown('11111111-1111-1111-1111-111111111111')
  where module_name = 'Sochiq';
  perform test_report('module counts both tagged clients', r.counterparty_count = 2);
  perform test_report('module sums kirim', r.total_kirim = 600);
  perform test_report('module sums chiqim', r.total_chiqim = 130);
  perform test_report('module nets the balance', r.balance = 470);
end $$;

-- =========== ledger page ===========
do $$
declare n int; first_row record; last_row record; page2 int; overlap int;
begin
  select count(*) into n from counterparty_ledger_page('eeeeeeee-0000-0000-0000-000000000001');
  perform test_report('ledger page returns the client history', n = 4);

  select * into first_row from counterparty_ledger_page('eeeeeeee-0000-0000-0000-000000000001') limit 1;
  perform test_report('ledger page is newest first', first_row.description = 'k3');

  -- Running balance at the newest row = 100 + 200 - 50 + 300
  perform test_report('running balance is computed over the whole history',
                      first_row.running_balance = 550 and first_row.balance_side = 'debit');

  -- Keyset paging: two pages of two must not overlap and must cover all four.
  select count(*) into n from counterparty_ledger_page('eeeeeeee-0000-0000-0000-000000000001', 2);
  perform test_report('the limit is honoured', n = 2);

  select occurred_at, created_at into last_row
  from counterparty_ledger_page('eeeeeeee-0000-0000-0000-000000000001', 2)
  order by occurred_at, created_at limit 1;

  select count(*) into page2 from counterparty_ledger_page(
    'eeeeeeee-0000-0000-0000-000000000001', 2, last_row.occurred_at, last_row.created_at);
  perform test_report('the next keyset page returns the remainder', page2 = 2);

  select count(*) into overlap from (
    select id from counterparty_ledger_page('eeeeeeee-0000-0000-0000-000000000001', 2)
    intersect
    select id from counterparty_ledger_page(
      'eeeeeeee-0000-0000-0000-000000000001', 2, last_row.occurred_at, last_row.created_at)
  ) x;
  perform test_report('keyset pages do not overlap', overlap = 0);
end $$;

-- =========== a reversal nets out of the reports ===========
do $$
declare v_id uuid; before_amt numeric; after_amt numeric;
begin
  select total_amount into before_amt
  from org_category_breakdown('11111111-1111-1111-1111-111111111111') where kind = 'kirim';

  select id into v_id from transactions
   where counterparty_id = 'eeeeeeee-0000-0000-0000-000000000001'
     and description = 'k1' and status = 'posted';
  perform reverse_transaction(v_id, current_date, 'test');

  select coalesce(sum(total_amount), 0) into after_amt
  from org_category_breakdown('11111111-1111-1111-1111-111111111111') where kind = 'kirim';

  -- The mirror posts a chiqim of 100, so kirim is unchanged while the pair
  -- nets to zero in the balance — which is what the ledger page must show.
  perform test_report('a reversal leaves kirim turnover intact', after_amt = before_amt);
  perform test_report('a reversal moves the running balance back',
    (select running_balance from counterparty_ledger_page('eeeeeeee-0000-0000-0000-000000000001')
      limit 1) = 450);
end $$;

-- =========== a manager may read every report ===========
do $$
declare n int;
begin
  perform set_config('app.current_user_id', 'bbbbbbbb-0000-0000-0000-000000000002', false);
  select count(*) into n from org_category_breakdown('11111111-1111-1111-1111-111111111111');
  perform test_report('a manager can read the category breakdown', n > 0);
  select count(*) into n from counterparty_ledger_page('eeeeeeee-0000-0000-0000-000000000001');
  perform test_report('a manager can read the ledger page', n > 0);
  select count(*) into n from org_module_breakdown('11111111-1111-1111-1111-111111111111');
  perform test_report('a manager can read the module breakdown', n > 0);
end $$;

-- ---------------------------------------------------------------------
-- The three figures on the dashboard (0029).
--
-- The third card used to be labelled turnover while computing debt movement.
-- These assertions pin down what each of the three now actually means, which
-- is the part a rename alone would not have fixed.
-- ---------------------------------------------------------------------
set app.current_user_id = 'aaaaaaaa-0000-0000-0000-000000000001';


-- The distinction the rename alone would have missed: with a period that
-- starts after the old sale, the movement figure excludes it and the debt
-- figure does not.
do $$
declare r record;
begin
  select * into r from org_period_totals(
    '11111111-1111-1111-1111-111111111111', current_date - 5, current_date + 1);

  perform test_report('the period figure counts only the period''s movement',
                      r.net < r.total_debt);
  perform test_report('total debt ignores the period start — a position, not a flow',
                      r.total_debt = (
                        select coalesce(sum(base_balance), 0)
                        from counterparty_balances('11111111-1111-1111-1111-111111111111')));
end $$;

-- Nothing changed about the two figures that were already right.
do $$
declare r record;
begin
  select * into r from org_period_totals('11111111-1111-1111-1111-111111111111');
  perform test_report('kirim and chiqim still net to the movement figure',
                      r.net = r.total_kirim - r.total_chiqim);
end $$;

do $$
declare n int;
begin
  perform set_config('app.current_user_id', 'bbbbbbbb-0000-0000-0000-000000000002', false);
  select count(*) into n from org_period_totals('11111111-1111-1111-1111-111111111111');
  perform test_report('a manager can read the dashboard totals', n = 1);
end $$;

-- ---------------------------------------------------------------------
-- Overdue debt is what is owed, not what was paid (0031).
--
-- The old version summed the credit side of the receivable for rows past
-- their due date — money the client had already handed over. It moved the
-- wrong way: paying more made the figure larger, and a client who had cleared
-- everything stayed at the top of the list.
-- ---------------------------------------------------------------------
set app.current_user_id = 'aaaaaaaa-0000-0000-0000-000000000001';

do $$
declare r record; v_balance numeric;
begin
  -- Mijoz A: billed 600 + 900, paid 50 against a date that has passed.
  select * into r from org_overdue_by_counterparty('11111111-1111-1111-1111-111111111111')
  where counterparty_id = 'eeeeeeee-0000-0000-0000-000000000001';

  select base_balance into v_balance
  from counterparty_balances('11111111-1111-1111-1111-111111111111')
  where counterparty_id = 'eeeeeeee-0000-0000-0000-000000000001';

  perform test_report('overdue reports the debt, not the 50 already paid',
                      r.overdue_amount = v_balance);
  perform test_report('and it is the same figure as the client''s own balance',
                      r.overdue_amount > 50);
end $$;

-- A client who settles drops off, however late they were.
do $$
declare v_before bigint; v_after bigint; v_owed numeric;
begin
  select count(*) into v_before from org_overdue_by_counterparty(
    '11111111-1111-1111-1111-111111111111')
  where counterparty_id = 'eeeeeeee-0000-0000-0000-000000000001';

  select base_balance into v_owed
  from counterparty_balances('11111111-1111-1111-1111-111111111111')
  where counterparty_id = 'eeeeeeee-0000-0000-0000-000000000001';

  -- Pay the balance off in full.
  insert into transactions (org_id, counterparty_id, occurred_at,
    debit_account_id, debit_amount, credit_account_id, credit_amount, currency, description)
  values ('11111111-1111-1111-1111-111111111111', 'eeeeeeee-0000-0000-0000-000000000001',
    current_date::timestamptz,
    'cccccccc-0000-0000-0000-000000000002', v_owed,
    'cccccccc-0000-0000-0000-000000000001', v_owed, 'UZS', 'hammasini yopdi');

  select count(*) into v_after from org_overdue_by_counterparty(
    '11111111-1111-1111-1111-111111111111')
  where counterparty_id = 'eeeeeeee-0000-0000-0000-000000000001';

  perform test_report('a client who was on the overdue list was there before',
                      v_before = 1);
  perform test_report('and drops off once they have settled', v_after = 0);
end $$;

-- Paying more can only shrink the figure. Under the old version it grew.
do $$
declare v_first numeric; v_second numeric;
begin
  select overdue_amount into v_first from org_overdue_by_counterparty(
    '11111111-1111-1111-1111-111111111111')
  where counterparty_id = 'eeeeeeee-0000-0000-0000-000000000002';

  insert into transactions (org_id, counterparty_id, occurred_at,
    debit_account_id, debit_amount, credit_account_id, credit_amount, currency, description)
  values ('11111111-1111-1111-1111-111111111111', 'eeeeeeee-0000-0000-0000-000000000002',
    current_date::timestamptz,
    'cccccccc-0000-0000-0000-000000000002', 10,
    'cccccccc-0000-0000-0000-000000000001', 10, 'UZS', 'qisman to''lov');

  select overdue_amount into v_second from org_overdue_by_counterparty(
    '11111111-1111-1111-1111-111111111111')
  where counterparty_id = 'eeeeeeee-0000-0000-0000-000000000002';

  perform test_report('a payment lowers the overdue figure rather than raising it',
                      v_first is null or v_second is null or v_second < v_first);
end $$;

-- ---------------------------------------------------------------------
-- The client journal (0032).
--
-- Past-due and total are two figures, not one. Total is the balance today;
-- past-due is what was outstanding when the deadline passed, capped at what
-- is still owed — so paying it down lowers it and a later debt does not.
-- ---------------------------------------------------------------------
set app.current_user_id = 'aaaaaaaa-0000-0000-0000-000000000001';

insert into counterparties (id, org_id, name, currency, manager_id)
values ('eeeeeeee-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111',
        'Mijoz C', 'USD', 'bbbbbbbb-0000-0000-0000-000000000002');

do $$
begin
  -- Owed 1000 by the time the deadline passed, then 400 paid afterwards.
  insert into transactions (org_id, counterparty_id, occurred_at, due_date,
    debit_account_id, debit_amount, credit_account_id, credit_amount, currency, description)
  values ('11111111-1111-1111-1111-111111111111', 'eeeeeeee-0000-0000-0000-000000000003',
    (current_date - 30)::timestamptz, null,
    'cccccccc-0000-0000-0000-000000000001', 1000,
    'cccccccc-0000-0000-0000-000000000002', 1000, 'UZS', 'sotuv');

  insert into transactions (org_id, counterparty_id, occurred_at, due_date,
    debit_account_id, debit_amount, credit_account_id, credit_amount, currency, description)
  values ('11111111-1111-1111-1111-111111111111', 'eeeeeeee-0000-0000-0000-000000000003',
    (current_date - 10)::timestamptz, current_date - 20,
    'cccccccc-0000-0000-0000-000000000002', 400,
    'cccccccc-0000-0000-0000-000000000001', 400, 'UZS', 'qisman to''lov');
end $$;

do $$
declare r record;
begin
  select * into r from counterparty_journal('11111111-1111-1111-1111-111111111111')
  where counterparty_id = 'eeeeeeee-0000-0000-0000-000000000003';

  perform test_report('total debt is the balance today', r.total_debt = 600);
  perform test_report('past-due is what was outstanding at the deadline, capped at that',
                      r.overdue_amount = 600);
  perform test_report('and it is dated from when the deadline passed',
                      r.overdue_date = current_date - 20);
  perform test_report('the journal names the account manager',
                      r.manager_name is not null);
  perform test_report('and carries the client''s own currency', r.currency = 'USD');
end $$;

-- A debt run up after the deadline moves the total and not the past-due part.
do $$
declare r record;
begin
  insert into transactions (org_id, counterparty_id, occurred_at,
    debit_account_id, debit_amount, credit_account_id, credit_amount, currency, description)
  values ('11111111-1111-1111-1111-111111111111', 'eeeeeeee-0000-0000-0000-000000000003',
    current_date::timestamptz,
    'cccccccc-0000-0000-0000-000000000001', 500,
    'cccccccc-0000-0000-0000-000000000002', 500, 'UZS', 'yangi sotuv');

  select * into r from counterparty_journal('11111111-1111-1111-1111-111111111111')
  where counterparty_id = 'eeeeeeee-0000-0000-0000-000000000003';

  perform test_report('a later debt raises the total', r.total_debt = 1100);
  perform test_report('but not what was already overdue', r.overdue_amount = 600);
end $$;

-- Paying the overdue part down lowers it.
do $$
declare r record;
begin
  insert into transactions (org_id, counterparty_id, occurred_at,
    debit_account_id, debit_amount, credit_account_id, credit_amount, currency, description)
  values ('11111111-1111-1111-1111-111111111111', 'eeeeeeee-0000-0000-0000-000000000003',
    current_date::timestamptz,
    'cccccccc-0000-0000-0000-000000000002', 700,
    'cccccccc-0000-0000-0000-000000000001', 700, 'UZS', 'yana to''lov');

  select * into r from counterparty_journal('11111111-1111-1111-1111-111111111111')
  where counterparty_id = 'eeeeeeee-0000-0000-0000-000000000003';

  -- Oldest debt settles first: 1100 paid against a 1000 overdue balance clears
  -- it outright, and what remains in the total is the newer sale.
  perform test_report('paying lowers the total', r.total_debt = 400);
  perform test_report('paying past the overdue part clears it', r.overdue_amount = 0);
end $$;

-- The filters the journal toolbar drives.
do $$
declare n int;
begin
  select count(*) into n from counterparty_journal('11111111-1111-1111-1111-111111111111');
  perform test_report('the journal lists every client, debtor or not', n >= 3);

  select count(*) into n from counterparty_journal(
    '11111111-1111-1111-1111-111111111111', null, null, null, false, true);
  perform test_report('and can be narrowed to the overdue ones', n >= 1 and n < 3);

  select count(*) into n from counterparty_journal(
    '11111111-1111-1111-1111-111111111111', null,
    'bbbbbbbb-0000-0000-0000-000000000002');
  perform test_report('filtering by manager finds their clients', n = 1);

  select count(*) into n from counterparty_journal(
    '11111111-1111-1111-1111-111111111111', null, null, 'USD');
  perform test_report('filtering by currency works', n = 1);

  select count(*) into n from counterparty_journal(
    '11111111-1111-1111-1111-111111111111', 'Mijoz C');
  perform test_report('and search finds a client by name', n = 1);
end $$;

do $$
declare n int;
begin
  select count(*) into n from currencies
  where code in ('KZT', 'KGS', 'TJS', 'AZN', 'AFN', 'CNY', 'GBP');
  perform test_report('the neighbouring currencies are available', n = 7);
end $$;
