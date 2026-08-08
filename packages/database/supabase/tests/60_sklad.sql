\set ON_ERROR_STOP on

-- The warehouse and the production chain (0011, 0021-0025).
--
-- Four properties carry the module, and all four fail silently if they break:
--
--   1. the remainder is derived from movements and cannot go negative,
--   2. a price is invisible to staff — including through the RPCs, where
--      SECURITY DEFINER would have quietly handed it over,
--   3. receiving a typed-in invoice creates its reference data and its cards
--      without letting a storekeeper write prices, and
--   4. an order's planned / ready / shipped / remaining arithmetic holds when
--      the order is split across several despatches.

set role app_user;
set app.current_user_id = 'aaaaaaaa-0000-0000-0000-000000000001';

-- ---------------------------------------------------------------------
-- Fixture: one product card and one batch of 100 pieces.
-- ---------------------------------------------------------------------
insert into sklad_items (id, org_id, kod, name, gsm, width_cm, length_cm)
values ('f1000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
        'A-100', 'Armul maxroviy', 350, 70, 130);

insert into sklad_orders (id, org_id, order_no, counterparty_id)
values ('f2000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
        'ORD-1', 'eeeeeeee-0000-0000-0000-000000000001');

-- qoldiq_dona is deliberately given a wrong value here: the trigger owns it,
-- and whatever the app sends has to lose.
insert into sklad_batches (id, org_id, item_id, order_id, brutto_kg, netto_kg, dona_soni, qoldiq_dona)
values ('f3000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
        'f1000000-0000-0000-0000-000000000001', 'f2000000-0000-0000-0000-000000000001',
        52.0, 50.0, 100, 999);

-- =========== 1. the remainder is derived, not typed ===========
do $$
declare v_qoldiq integer; v_movements integer;
begin
  select qoldiq_dona into v_qoldiq from sklad_batches
  where id = 'f3000000-0000-0000-0000-000000000001';
  select count(*) into v_movements from sklad_movements
  where batch_id = 'f3000000-0000-0000-0000-000000000001' and is_initial;

  perform test_report('a new batch writes its own receipt movement', v_movements = 1);
  perform test_report('qoldiq comes from the movements, not from the insert', v_qoldiq = 100);
end $$;

-- =========== 2. a despatch lowers the remainder ===========
do $$
declare v_qoldiq integer; v_status text;
begin
  perform record_sklad_movement(
    'f3000000-0000-0000-0000-000000000001', 'chiqim', 40, null, current_date,
    'eeeeeeee-0000-0000-0000-000000000001', null, 'test');

  select qoldiq_dona, status::text into v_qoldiq, v_status
  from sklad_batches where id = 'f3000000-0000-0000-0000-000000000001';

  perform test_report('shipping 40 of 100 leaves 60', v_qoldiq = 60);
  perform test_report('a partial shipment leaves the status alone', v_status = 'omborda');
end $$;

-- The kg figure is derived from the batch's own per-piece weight when the
-- storekeeper does not weigh the despatch.
do $$
declare v_kg numeric;
begin
  select kg into v_kg from sklad_movements
  where batch_id = 'f3000000-0000-0000-0000-000000000001' and kind = 'chiqim';
  -- 50 kg / 100 pieces = 0.5 each, 40 out = -20.
  perform test_report('an unweighed despatch takes the per-piece weight', v_kg = -20);
end $$;

-- =========== 3. stock cannot go negative ===========
do $$
begin
  perform record_sklad_movement('f3000000-0000-0000-0000-000000000001', 'chiqim', 999);
  perform test_report('a despatch beyond the remainder is refused', false);
exception when others then
  perform test_report('a despatch beyond the remainder is refused', true);
end $$;

do $$
declare v_qoldiq integer;
begin
  select qoldiq_dona into v_qoldiq from sklad_batches
  where id = 'f3000000-0000-0000-0000-000000000001';
  perform test_report('the refused despatch left the remainder untouched', v_qoldiq = 60);
end $$;

-- =========== 4. emptying the batch marks it despatched ===========
do $$
declare v_status text; v_qoldiq integer;
begin
  perform record_sklad_movement('f3000000-0000-0000-0000-000000000001', 'chiqim', 60);
  select status::text, qoldiq_dona into v_status, v_qoldiq
  from sklad_batches where id = 'f3000000-0000-0000-0000-000000000001';
  perform test_report('an emptied batch becomes jonatildi', v_status = 'jonatildi' and v_qoldiq = 0);
end $$;

-- A return puts goods back and says so.
do $$
declare v_qoldiq integer; v_status text;
begin
  perform record_sklad_movement('f3000000-0000-0000-0000-000000000001', 'qaytarish', 10);
  select qoldiq_dona, status::text into v_qoldiq, v_status
  from sklad_batches where id = 'f3000000-0000-0000-0000-000000000001';
  perform test_report('a return adds back and marks the batch returned',
                      v_qoldiq = 10 and v_status = 'qaytarildi');
end $$;

-- =========== 5. correcting the intake re-syncs the remainder ===========
do $$
declare v_qoldiq integer;
begin
  -- 100 came in, 100 went out, 10 came back. Correcting the intake to 120
  -- should move the remainder by the same 20.
  update sklad_batches set dona_soni = 120 where id = 'f3000000-0000-0000-0000-000000000001';
  select qoldiq_dona into v_qoldiq from sklad_batches
  where id = 'f3000000-0000-0000-0000-000000000001';
  perform test_report('correcting dona_soni moves the remainder with it', v_qoldiq = 30);
end $$;

-- =========== 6. the change log records edits, not machine noise ===========
do $$
declare v_before bigint; v_after bigint;
begin
  select count(*) into v_before from sklad_audit where entity = 'batch';
  -- A partial despatch: only qoldiq_dona changes on the batch row.
  perform record_sklad_movement('f3000000-0000-0000-0000-000000000001', 'chiqim', 5);
  select count(*) into v_after from sklad_audit where entity = 'batch';
  perform test_report('a movement does not spam the change log', v_after = v_before);
end $$;

do $$
declare v_before bigint; v_after bigint;
begin
  select count(*) into v_before from sklad_audit where entity = 'batch';
  update sklad_batches set notes = 'dog'' bor' where id = 'f3000000-0000-0000-0000-000000000001';
  select count(*) into v_after from sklad_audit where entity = 'batch';
  perform test_report('a human edit is recorded', v_after = v_before + 1);
end $$;

-- =========== 7. one kod, one product card ===========
do $$
begin
  insert into sklad_items (org_id, kod, name)
  values ('11111111-1111-1111-1111-111111111111', 'A-100', 'Nusxa');
  perform test_report('a duplicate kod is refused', false);
exception when unique_violation then
  perform test_report('a duplicate kod is refused', true);
end $$;

-- A blank kod stays free: two cards may both be waiting for one.
do $$
begin
  insert into sklad_items (org_id, kod, name)
  values ('11111111-1111-1111-1111-111111111111', null, 'Nomsiz 1'),
         ('11111111-1111-1111-1111-111111111111', null, 'Nomsiz 2');
  perform test_report('cards without a kod are still allowed', true);
exception when others then
  perform test_report('cards without a kod are still allowed', false);
end $$;

-- ---------------------------------------------------------------------
-- 8. Prices: the property the whole module rests on.
-- ---------------------------------------------------------------------
insert into sklad_batch_prices (batch_id, org_id, price_per_kg, total_amount, currency)
values ('f3000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
        4.00, 400.00, 'USD');

do $$
declare v_total numeric;
begin
  select total_amount into v_total
  from sklad_batch_page('11111111-1111-1111-1111-111111111111'::uuid)
  where id = 'f3000000-0000-0000-0000-000000000001';
  perform test_report('an admin sees the price through the list RPC', v_total = 400.00);
end $$;

set app.current_user_id = 'bbbbbbbb-0000-0000-0000-000000000002';

do $$
declare v_rows bigint;
begin
  select count(*) into v_rows from sklad_batch_prices;
  perform test_report('staff cannot read the price table at all', v_rows = 0);
end $$;

do $$
declare v_total numeric; v_batches bigint;
begin
  select count(*), max(total_amount) into v_batches, v_total
  from sklad_batch_page('11111111-1111-1111-1111-111111111111'::uuid);
  perform test_report('staff still see the batches', v_batches > 0);
  perform test_report('but the list RPC hands staff no price', v_total is null);
end $$;

do $$
declare v_sum numeric;
begin
  select max(sum_total_amount) into v_sum
  from sklad_batch_page('11111111-1111-1111-1111-111111111111'::uuid);
  perform test_report('and no footer total either', v_sum is null);
end $$;

-- ---------------------------------------------------------------------
-- 9. Receiving a typed-in invoice.
-- ---------------------------------------------------------------------
do $$
declare v_count integer; v_item uuid; v_lookup uuid;
begin
  -- Still the staff member: creating reference data is the point.
  select sklad_receive_rows(
    '11111111-1111-1111-1111-111111111111',
    '[{"kod":"B-200","name":"Jakkard velyur","productType":"Jakkard velyur",
       "color":"Kulrang","width":"70","length":"140","gsm":"500","netto":"48.5","dona":"108"},
      {},
      {"kod":"B-200","netto":"12.0","dona":"27"}]'::jsonb,
    'f2000000-0000-0000-0000-000000000001'
  ) into v_count;

  perform test_report('blank grid rows are skipped, not rejected', v_count = 2);

  select id into v_item from sklad_items
  where org_id = '11111111-1111-1111-1111-111111111111' and kod = 'B-200';
  perform test_report('a typed invoice line creates its product card', v_item is not null);

  select id into v_lookup from sklad_lookups
  where org_id = '11111111-1111-1111-1111-111111111111'
    and kind = 'rang' and name = 'Kulrang';
  perform test_report('a colour nobody had entered before is created', v_lookup is not null);
end $$;

do $$
declare v_cards bigint; v_batches bigint;
begin
  select count(*) into v_cards from sklad_items
  where org_id = '11111111-1111-1111-1111-111111111111' and kod = 'B-200';
  select count(*) into v_batches from sklad_batches b
  join sklad_items i on i.id = b.item_id
  where i.kod = 'B-200';

  perform test_report('a repeated kod reuses the one card', v_cards = 1);
  perform test_report('but each invoice line is its own batch', v_batches = 2);
end $$;

do $$
declare v_qoldiq integer;
begin
  select qoldiq_dona into v_qoldiq from sklad_batches b
  join sklad_items i on i.id = b.item_id
  where i.kod = 'B-200' and b.dona_soni = 108;
  perform test_report('a received batch starts with its full count in stock', v_qoldiq = 108);
end $$;

-- Receiving carries no money at all since 0028: price belongs to the sales
-- invoice, set by a manager while selling. Prices sent by an out-of-date
-- client are ignored rather than honoured.
do $$
declare v_prices bigint; v_batches bigint;
begin
  perform sklad_receive_rows(
    '11111111-1111-1111-1111-111111111111',
    '[{"kod":"C-300","name":"Vafel","netto":"10","dona":"20",
       "pricePerKg":"9.99","totalAmount":"99.90"}]'::jsonb);

  set role postgres;
  select count(*) into v_prices from sklad_batch_prices p
  join sklad_batches b on b.id = p.batch_id
  join sklad_items i on i.id = b.item_id
  where i.kod = 'C-300';
  select count(*) into v_batches from sklad_batches b
  join sklad_items i on i.id = b.item_id where i.kod = 'C-300';
  set role app_user;

  perform test_report('receiving still books the goods', v_batches = 1);
  perform test_report('but writes no price, whoever is receiving', v_prices = 0);
end $$;

set app.current_user_id = 'aaaaaaaa-0000-0000-0000-000000000001';

do $$
declare v_price numeric; v_batches bigint;
begin
  perform sklad_receive_rows(
    '11111111-1111-1111-1111-111111111111',
    '[{"kod":"D-400","name":"Peshtamal","netto":"10","dona":"20",
       "pricePerKg":"5.50","totalAmount":"55.00","currency":"USD"}]'::jsonb);

  select count(*) into v_batches from sklad_batches b
  join sklad_items i on i.id = b.item_id where i.kod = 'D-400';
  select p.total_amount into v_price from sklad_batch_prices p
  join sklad_batches b on b.id = p.batch_id
  join sklad_items i on i.id = b.item_id
  where i.kod = 'D-400';

  perform test_report('an admin receiving books the goods too', v_batches = 1);
  perform test_report('and no price either — that is the invoice''s job',
                      v_price is null);
end $$;

-- ---------------------------------------------------------------------
-- 9b. Dimensions and despatch in bulk (0026).
-- ---------------------------------------------------------------------
do $$
declare v_w numeric; v_l numeric;
begin
  select width_cm, length_cm into v_w, v_l
  from sklad_items
  where org_id = '11111111-1111-1111-1111-111111111111' and kod = 'B-200';
  perform test_report('typed dimensions land on the card as two numbers',
                      v_w = 70 and v_l = 140);
end $$;

do $$
declare v_size text;
begin
  select sklad_size_text(70, 130) into v_size;
  -- numeric(6,1) renders 70.0; the invoice says 70.
  perform test_report('a whole measurement prints without a decimal', v_size = '70x130');
end $$;

do $$
declare v_shipment uuid; v_qoldiq integer; v_batch uuid; v_lines bigint;
begin
  select b.id, b.qoldiq_dona into v_batch, v_qoldiq
  from sklad_batches b join sklad_items i on i.id = b.item_id
  where i.kod = 'B-200' and b.dona_soni = 108;

  select sklad_issue_rows(
    '11111111-1111-1111-1111-111111111111',
    format('[{"batchId":"%s","dona":"8"},{"batchId":"","dona":""}]', v_batch)::jsonb,
    'eeeeeeee-0000-0000-0000-000000000001',
    null,
    'aaaaaaaa-0000-0000-0000-000000000001',
    'CH-1'
  ) into v_shipment;

  select count(*) into v_lines from sklad_shipment_lines where shipment_id = v_shipment;
  select qoldiq_dona into v_qoldiq from sklad_batches where id = v_batch;

  perform test_report('a bulk despatch skips its blank rows', v_lines = 1);
  perform test_report('and takes the goods off the shelf', v_qoldiq = 100);
end $$;

do $$
declare v_kind text; v_dona integer;
begin
  select m.kind::text, m.dona into v_kind, v_dona
  from sklad_movements m
  join sklad_batches b on b.id = m.batch_id
  join sklad_items i on i.id = b.item_id
  where i.kod = 'B-200' and m.kind = 'chiqim';
  perform test_report('the despatch went through the stock ledger, not around it',
                      v_kind = 'chiqim' and v_dona = -8);
end $$;

-- The whole document fails together: a line that would overdraw takes the
-- lines before it with it, so no half-loaded truck is ever recorded.
do $$
declare v_batch uuid; v_before integer; v_after integer; v_shipments bigint;
begin
  select b.id, b.qoldiq_dona into v_batch, v_before
  from sklad_batches b join sklad_items i on i.id = b.item_id
  where i.kod = 'B-200' and b.dona_soni = 108;
  select count(*) into v_shipments from sklad_shipments;

  begin
    perform sklad_issue_rows(
      '11111111-1111-1111-1111-111111111111',
      format('[{"batchId":"%s","dona":"5"},{"batchId":"%s","dona":"99999"}]', v_batch, v_batch)::jsonb,
      'eeeeeeee-0000-0000-0000-000000000001');
    perform test_report('an overdrawn line aborts the whole despatch', false);
  exception when others then
    perform test_report('an overdrawn line aborts the whole despatch', true);
  end;

  select qoldiq_dona into v_after from sklad_batches where id = v_batch;
  perform test_report('and the good line before it is rolled back too', v_after = v_before);
end $$;

do $$
declare v_rows bigint;
begin
  select count(*) into v_rows
  from sklad_issuable_batches('11111111-1111-1111-1111-111111111111'::uuid, 'B-200');
  perform test_report('the despatch picker offers only batches with stock left', v_rows = 2);
end $$;


-- ---------------------------------------------------------------------
-- 10. The production chain.
-- ---------------------------------------------------------------------
insert into sklad_order_lines (id, org_id, order_id, item_id, position, planned_dona)
values ('f4000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
        'f2000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000001', 1, 1000);

do $$
declare v_stages bigint; v_cells bigint;
begin
  select count(*) into v_stages from sklad_stages
  where org_id = '11111111-1111-1111-1111-111111111111';
  select count(*) into v_cells
  from sklad_order_stage_matrix('f2000000-0000-0000-0000-000000000001'::uuid);

  perform test_report('a new org starts with a seeded route', v_stages = 6);
  perform test_report('the grid has a cell per row and shop, filled or not',
                      v_cells = v_stages);
end $$;

-- Output at a middle stage is progress, but it is not ready to ship.
do $$
declare v_ready bigint;
begin
  insert into sklad_stage_entries (org_id, order_line_id, stage_id, qty_out, defect_qty)
  select '11111111-1111-1111-1111-111111111111', 'f4000000-0000-0000-0000-000000000001', id, 900, 20
  from sklad_stages
  where org_id = '11111111-1111-1111-1111-111111111111' and name = 'Bo''yoqxona';

  select ready_dona into v_ready
  from sklad_order_progress('f2000000-0000-0000-0000-000000000001'::uuid);
  perform test_report('a middle shop''s output is not counted as ready', v_ready = 0);
end $$;

do $$
declare v_ready bigint; v_defect bigint; v_remaining integer;
begin
  insert into sklad_stage_entries (org_id, order_line_id, stage_id, qty_out)
  select '11111111-1111-1111-1111-111111111111', 'f4000000-0000-0000-0000-000000000001', id, 880
  from sklad_stages
  where org_id = '11111111-1111-1111-1111-111111111111' and is_final;

  select ready_dona, defect_dona, remaining_dona into v_ready, v_defect, v_remaining
  from sklad_order_progress('f2000000-0000-0000-0000-000000000001'::uuid);

  perform test_report('the finished-goods shop''s output is what is ready', v_ready = 880);
  perform test_report('defects are totalled across every shop', v_defect = 20);
  perform test_report('nothing shipped yet, so the whole plan is outstanding',
                      v_remaining = 1000);
end $$;

-- Two despatches to two clients out of one order.
insert into counterparties (id, org_id, name)
values ('eeeeeeee-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Mijoz B');

do $$
declare v_shipment uuid; v_remaining integer; v_clients bigint;
begin
  insert into sklad_shipments (org_id, order_id, counterparty_id, manager_id)
  values ('11111111-1111-1111-1111-111111111111', 'f2000000-0000-0000-0000-000000000001',
          'eeeeeeee-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001')
  returning id into v_shipment;
  insert into sklad_shipment_lines (org_id, shipment_id, order_line_id, dona, kg)
  values ('11111111-1111-1111-1111-111111111111', v_shipment,
          'f4000000-0000-0000-0000-000000000001', 600, 300);

  insert into sklad_shipments (org_id, order_id, counterparty_id)
  values ('11111111-1111-1111-1111-111111111111', 'f2000000-0000-0000-0000-000000000001',
          'eeeeeeee-0000-0000-0000-000000000002')
  returning id into v_shipment;
  insert into sklad_shipment_lines (org_id, shipment_id, order_line_id, dona)
  values ('11111111-1111-1111-1111-111111111111', v_shipment,
          'f4000000-0000-0000-0000-000000000001', 250);

  select remaining_dona into v_remaining
  from sklad_order_progress('f2000000-0000-0000-0000-000000000001'::uuid);
  select count(*) into v_clients
  from sklad_order_clients('f2000000-0000-0000-0000-000000000001'::uuid);

  perform test_report('an order split across two clients still adds up',
                      v_remaining = 150);
  perform test_report('and each client is accounted for separately', v_clients = 2);
end $$;

do $$
declare v_dona bigint;
begin
  select shipped_dona into v_dona
  from sklad_order_clients('f2000000-0000-0000-0000-000000000001'::uuid)
  where counterparty_name = 'Mijoz A';
  perform test_report('how much went to one named client', v_dona = 600);
end $$;

-- The analytics row for the whole order.
do $$
declare v_planned bigint; v_ready bigint; v_shipped bigint; v_stage text;
begin
  select planned_dona, ready_dona, shipped_dona, current_stage
  into v_planned, v_ready, v_shipped, v_stage
  from sklad_order_summary('11111111-1111-1111-1111-111111111111'::uuid)
  where order_id = 'f2000000-0000-0000-0000-000000000001';

  perform test_report('the summary reports the plan', v_planned = 1000);
  perform test_report('the summary reports what is ready', v_ready = 880);
  perform test_report('the summary reports what has gone', v_shipped = 850);
  perform test_report('and names the furthest shop that has reported',
                      v_stage = 'Tayyor mahsulot ombori');
end $$;

-- A member of another org must see none of it. Set up as postgres: auth.users
-- is Supabase's table and app_user has no business writing to it.
set role postgres;
insert into organizations (id, name, slug)
values ('99999999-9999-9999-9999-999999999999', 'Other Org', 'other-org');
insert into auth.users (id, email, aud, role, created_at, updated_at)
values ('cccccccc-9999-0000-0000-000000000009', 'other@test.uz', 'authenticated',
        'authenticated', now(), now());
insert into memberships (org_id, user_id, role)
values ('99999999-9999-9999-9999-999999999999', 'cccccccc-9999-0000-0000-000000000009', 'owner');
set role app_user;

-- The new org must have come out of that insert with a route of its own.
do $$
declare v_stages bigint;
begin
  select count(*) into v_stages from sklad_stages
  where org_id = '99999999-9999-9999-9999-999999999999';
  perform test_report('an org created after the migration is seeded too', v_stages = 6);
end $$;

set app.current_user_id = 'cccccccc-9999-0000-0000-000000000009';

do $$
declare v_batches bigint; v_lines bigint;
begin
  select count(*) into v_batches from sklad_batches;
  select count(*) into v_lines from sklad_order_lines;
  perform test_report('another org sees none of these batches', v_batches = 0);
  perform test_report('another org sees none of these order rows', v_lines = 0);
end $$;

do $$
begin
  perform record_sklad_movement('f3000000-0000-0000-0000-000000000001', 'chiqim', 1);
  perform test_report('another org cannot move this stock', false);
exception when others then
  perform test_report('another org cannot move this stock', true);
end $$;

-- ---------------------------------------------------------------------
-- Receiving refuses rather than swallows (0030).
--
-- A row with weights and counts on it but no product named used to be skipped
-- in silence: the call returned a count that did not include it, the screen
-- reported success, and the typed invoice was cleared. These pin down that it
-- now fails loudly and leaves nothing half-saved.
-- ---------------------------------------------------------------------
set app.current_user_id = 'aaaaaaaa-0000-0000-0000-000000000001';

do $$
declare v_before bigint; v_after bigint;
begin
  select count(*) into v_before from sklad_batches;

  begin
    perform sklad_receive_rows(
      '11111111-1111-1111-1111-111111111111',
      '[{"kod":"E-500","name":"Yaxshi qator","netto":"10","dona":"20"},
        {"brutto":"38","netto":"37.18","dona":"125"}]'::jsonb);
    perform test_report('a row with data but no product named is refused', false);
  exception when others then
    perform test_report('a row with data but no product named is refused', true);
  end;

  select count(*) into v_after from sklad_batches;
  perform test_report('and the good row before it is rolled back with it',
                      v_after = v_before);
end $$;

-- The spare rows the grid always sends are still not an error.
do $$
declare v_saved integer;
begin
  select sklad_receive_rows(
    '11111111-1111-1111-1111-111111111111',
    '[{},
      {"kod":"E-500","name":"Yaxshi qator","netto":"10","dona":"20"},
      {"productType":"   "},
      {}]'::jsonb) into v_saved;
  perform test_report('blank and whitespace-only rows are skipped, not refused',
                      v_saved = 1);
end $$;

-- The refusal names the row, counted the way the grid numbers them.
do $$
declare v_message text;
begin
  begin
    perform sklad_receive_rows(
      '11111111-1111-1111-1111-111111111111',
      '[{}, {}, {"netto":"5"}]'::jsonb);
  exception when others then
    get stacked diagnostics v_message = message_text;
  end;
  perform test_report('the refusal names the row the storekeeper is looking at',
                      v_message like '3 -qatorda%');
end $$;

-- A save that lands nothing must not come back looking like a save.
do $$
begin
  perform sklad_receive_rows('11111111-1111-1111-1111-111111111111', '[{},{}]'::jsonb);
  perform test_report('an all-blank save reports failure, not zero success', false);
exception when others then
  perform test_report('an all-blank save reports failure, not zero success', true);
end $$;
