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
  select overdue_amount, overdue_date into amt, d
  from org_overdue_by_counterparty('11111111-1111-1111-1111-111111111111')
  where counterparty_id = 'eeeeeeee-0000-0000-0000-000000000001';
  perform test_report('overdue finds the past-due entry', amt = 50 and d = current_date - 5);

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
