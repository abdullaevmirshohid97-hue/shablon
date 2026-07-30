-- 0017 (multi-currency) + 0018 (general ledger)

set role app_user;
set app.current_user_id = 'aaaaaaaa-0000-0000-0000-000000000001';

-- =========== balance rule ===========
do $$
declare msg text;
begin
  begin
    insert into transactions (org_id, counterparty_id, category_id, occurred_at,
      debit_account_id, debit_amount, credit_account_id, credit_amount, currency)
    values ('11111111-1111-1111-1111-111111111111', 'eeeeeeee-0000-0000-0000-000000000001',
      'dddddddd-0000-0000-0000-000000000001', now(),
      'cccccccc-0000-0000-0000-000000000001', 100,
      'cccccccc-0000-0000-0000-000000000002', 90, 'UZS');
    perform test_report('an unbalanced entry is rejected by the database', false);
  exception when others then
    get stacked diagnostics msg = message_text;
    perform test_report('an unbalanced entry is rejected by the database',
                        msg like '%transactions_balanced%');
  end;

  begin
    insert into transactions (org_id, counterparty_id, category_id, occurred_at,
      debit_account_id, debit_amount, credit_account_id, credit_amount, currency)
    values ('11111111-1111-1111-1111-111111111111', 'eeeeeeee-0000-0000-0000-000000000001',
      'dddddddd-0000-0000-0000-000000000001', now(),
      'cccccccc-0000-0000-0000-000000000001', 100,
      'cccccccc-0000-0000-0000-000000000001', 100, 'UZS');
    perform test_report('an entry posting to one account twice is rejected', false);
  exception when others then
    get stacked diagnostics msg = message_text;
    perform test_report('an entry posting to one account twice is rejected',
                        msg like '%distinct_accounts%');
  end;
end $$;

-- =========== GL lines ===========
do $$
declare v_id uuid; n int; d numeric; c numeric;
begin
  v_id := test_entry(current_date, 500, 'GL testi');

  select count(*), sum(debit), sum(credit) into n, d, c
  from transaction_lines where transaction_id = v_id;

  perform test_report('a posting produces two GL lines', n = 2);
  perform test_report('the GL lines balance', d = 500 and c = 500);
  perform test_report('the debit line carries the debit account',
    exists (select 1 from transaction_lines
             where transaction_id = v_id and line_no = 1
               and account_id = 'cccccccc-0000-0000-0000-000000000001' and debit = 500));

  -- editing the entry restates its lines
  update transactions set debit_amount = 800, credit_amount = 800 where id = v_id;
  select sum(debit) into d from transaction_lines where transaction_id = v_id;
  perform test_report('editing an entry restates its GL lines', d = 800);

  -- lines are not writable through the API
  begin
    insert into transaction_lines (transaction_id, org_id, line_no, account_id,
      counterparty_id, debit, credit, currency, occurred_at)
    values (v_id, '11111111-1111-1111-1111-111111111111', 9,
      'cccccccc-0000-0000-0000-000000000001', 'eeeeeeee-0000-0000-0000-000000000001',
      1, 0, 'UZS', now());
    perform test_report('GL lines cannot be written directly', false);
  exception when others then
    perform test_report('GL lines cannot be written directly', true);
  end;
end $$;

-- =========== month balances ===========
do $$
declare v_bal numeric; v_id uuid;
begin
  -- Everything so far this month, from the summary table rather than the journal.
  select balance into v_bal
  from counterparty_balances('11111111-1111-1111-1111-111111111111')
  where counterparty_id = 'eeeeeeee-0000-0000-0000-000000000001';

  perform test_report('the summary table matches the journal',
    v_bal = (select coalesce(sum(
        case when da.type = 'receivable' then t.debit_amount else 0 end
      - case when ca.type = 'receivable' then t.credit_amount else 0 end), 0)
      from transactions t
      join accounts da on da.id = t.debit_account_id
      join accounts ca on ca.id = t.credit_account_id
      where t.counterparty_id = 'eeeeeeee-0000-0000-0000-000000000001' and t.status <> 'draft'));

  -- a reversal must bring the summary back down
  v_id := test_entry(current_date, 1000, 'summary storno testi');
  select balance into v_bal from counterparty_balances('11111111-1111-1111-1111-111111111111')
   where counterparty_id = 'eeeeeeee-0000-0000-0000-000000000001';
  perform reverse_transaction(v_id, current_date, 'test');
  perform test_report('a reversal nets back out of the summary',
    (select balance from counterparty_balances('11111111-1111-1111-1111-111111111111')
      where counterparty_id = 'eeeeeeee-0000-0000-0000-000000000001') = v_bal - 1000);
end $$;

-- =========== currency ===========
do $$
declare v_rate numeric; v_id uuid; t transactions;
begin
  insert into exchange_rates (org_id, from_code, to_code, rate, effective_date)
  values ('11111111-1111-1111-1111-111111111111', 'USD', 'UZS', 12600, current_date - 10);

  v_rate := get_exchange_rate('11111111-1111-1111-1111-111111111111', 'USD', 'UZS', current_date);
  perform test_report('the rate in force is the latest quote on or before the date',
                      v_rate = 12600);

  perform test_report('the inverse pair is derived from the same quote',
    round(get_exchange_rate('11111111-1111-1111-1111-111111111111', 'UZS', 'USD', current_date), 8)
      = round(1::numeric / 12600, 8));

  insert into exchange_rates (org_id, from_code, to_code, rate, effective_date)
  values ('11111111-1111-1111-1111-111111111111', 'USD', 'UZS', 12800, current_date);
  perform test_report('a later quote supersedes an earlier one',
    get_exchange_rate('11111111-1111-1111-1111-111111111111', 'USD', 'UZS', current_date) = 12800);

  -- a USD entry is stored in USD and reported in the org's base currency
  insert into transactions (org_id, counterparty_id, category_id, occurred_at,
    debit_account_id, debit_amount, credit_account_id, credit_amount, currency, description)
  values ('11111111-1111-1111-1111-111111111111', 'eeeeeeee-0000-0000-0000-000000000001',
    'dddddddd-0000-0000-0000-000000000001', now(),
    'cccccccc-0000-0000-0000-000000000001', 100,
    'cccccccc-0000-0000-0000-000000000002', 100, 'USD', 'dollar yozuvi')
  returning id into v_id;

  select * into t from transactions where id = v_id;
  perform test_report('a foreign-currency entry keeps its own amount', t.debit_amount = 100);
  perform test_report('the rate of the day is recorded on the entry', t.exchange_rate = 12800);
  perform test_report('the base-currency figure is derived from it',
                      t.base_debit_amount = 1280000);
  perform test_report('the GL line carries the base figure too',
    (select base_debit from transaction_lines where transaction_id = v_id and line_no = 1)
      = 1280000);

  -- an explicitly agreed contract rate wins over the table
  insert into transactions (org_id, counterparty_id, category_id, occurred_at,
    debit_account_id, debit_amount, credit_account_id, credit_amount, currency,
    exchange_rate, description)
  values ('11111111-1111-1111-1111-111111111111', 'eeeeeeee-0000-0000-0000-000000000001',
    'dddddddd-0000-0000-0000-000000000001', now(),
    'cccccccc-0000-0000-0000-000000000001', 10,
    'cccccccc-0000-0000-0000-000000000002', 10, 'USD', 13000, 'shartnoma kursi')
  returning id into v_id;
  perform test_report('an explicit contract rate overrides the table',
    (select base_debit_amount from transactions where id = v_id) = 130000);
end $$;

-- a manager may read the ledger and the summaries, but not quote a rate
do $$
declare n int; msg text;
begin
  perform set_config('app.current_user_id', 'bbbbbbbb-0000-0000-0000-000000000002', false);
  select count(*) into n from transaction_lines;
  perform test_report('a manager can read the GL', n > 0);
  select count(*) into n from counterparty_balances('11111111-1111-1111-1111-111111111111');
  perform test_report('a manager can read the balance summary', n > 0);
  begin
    insert into exchange_rates (org_id, from_code, to_code, rate, effective_date)
    values ('11111111-1111-1111-1111-111111111111', 'EUR', 'UZS', 14000, current_date);
    perform test_report('a manager cannot quote an exchange rate', false);
  exception when others then
    get stacked diagnostics msg = message_text;
    perform test_report('a manager cannot quote an exchange rate', true);
  end;
  perform set_config('app.current_user_id', 'aaaaaaaa-0000-0000-0000-000000000001', false);
end $$;

-- tenant offboarding, now with lines and balances attached
reset role;
do $$
begin
  delete from organizations where id = '11111111-1111-1111-1111-111111111111';
  perform test_report('deleting an organization still cascades cleanly',
    not exists (select 1 from transaction_lines)
    and not exists (select 1 from account_month_balances));
exception when others then
  perform test_report('deleting an organization still cascades cleanly', false);
end $$;
