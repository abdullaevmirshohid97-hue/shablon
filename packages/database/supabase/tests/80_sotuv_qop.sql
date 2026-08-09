\set ON_ERROR_STOP on

-- The sack, and the two codes that make it countable (0033).
--
-- The properties that matter here are the ones a warehouse loses money on
-- when they are wrong:
--
--   1. every product card carries exactly one barcode, assigned once, unique,
--      and it is what tells a red rose from a yellow one,
--   2. a thousand pieces at fifty to a sack is twenty sacks — and a thousand
--      and ten is twenty-one, the last one holding ten, not a rounding error,
--   3. packing does not move stock, despatching does,
--   4. a sack can be mixed, corrected, and then not corrected once it has
--      gone,
--   5. one scan tells the desk which of three things it just read,
--   6. confirming a sale writes off exactly what was in the sacks, marks them
--      gone, and moves the invoice's status by itself,
--   7. none of it crosses an org boundary.

set role app_user;
set app.current_user_id = 'aaaaaaaa-0000-0000-0000-000000000001';

-- ---------------------------------------------------------------------
-- Fixture: two product cards that differ only by colour — the exact case the
-- barcode rule exists for — and a lot of each.
-- ---------------------------------------------------------------------
insert into sklad_lookups (id, org_id, kind, name)
values
  ('b0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'rang', 'Qizil'),
  ('b0000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'rang', 'Sariq');

insert into sklad_items (id, org_id, kod, name, width_cm, length_cm, color_id)
values
  ('a1000000-0000-0000-0000-000000000011', '11111111-1111-1111-1111-111111111111',
   'ATIR-Q', 'Atirgul velur', 70, 130, 'b0000000-0000-0000-0000-000000000001'),
  ('a1000000-0000-0000-0000-000000000012', '11111111-1111-1111-1111-111111111111',
   'ATIR-S', 'Atirgul velur', 70, 130, 'b0000000-0000-0000-0000-000000000002');

insert into sklad_batches (id, org_id, item_id, netto_kg, dona_soni, qoldiq_dona)
values
  ('a2000000-0000-0000-0000-000000000011', '11111111-1111-1111-1111-111111111111',
   'a1000000-0000-0000-0000-000000000011', 500.0, 1000, 1000),
  ('a2000000-0000-0000-0000-000000000012', '11111111-1111-1111-1111-111111111111',
   'a1000000-0000-0000-0000-000000000012', 100.0, 200, 200);

-- =========== 1. the product barcode ===========
do $$
declare v_q text; v_s text; v_dupes integer;
begin
  select barcode into v_q from sklad_items where id = 'a1000000-0000-0000-0000-000000000011';
  select barcode into v_s from sklad_items where id = 'a1000000-0000-0000-0000-000000000012';

  perform test_report('item barcode is assigned on insert', v_q is not null and v_s is not null);
  perform test_report('item barcode is 13 digits', length(v_q) = 13 and v_q ~ '^[0-9]{13}$');
  perform test_report('item barcode is in the product range (2…)', left(v_q, 1) = '2');
  perform test_report('two colours of one model get two barcodes', v_q <> v_s);

  select count(*) into v_dupes
  from (select barcode from sklad_items where barcode is not null
        group by barcode having count(*) > 1) d;
  perform test_report('item barcodes are unique', v_dupes = 0);
end $$;

-- A card that arrives with a barcode keeps it; the trigger only fills blanks.
do $$
declare v_bar text;
begin
  insert into sklad_items (org_id, kod, name, barcode)
  values ('11111111-1111-1111-1111-111111111111', 'MAN', 'Qo''lda kiritilgan', '2999999999999')
  returning barcode into v_bar;
  perform test_report('an explicit barcode is not overwritten', v_bar = '2999999999999');
end $$;

-- =========== 2. packing a lot into uniform sacks ===========
do $$
declare v_made integer; v_lines integer; v_dona integer; v_qoldiq integer;
begin
  select sklad_pack_batch(
    '11111111-1111-1111-1111-111111111111',
    'a2000000-0000-0000-0000-000000000011',
    50, 1000
  ) into v_made;

  perform test_report('1000 pieces at 50 a sack is 20 sacks', v_made = 20);

  select count(*), sum(l.dona) into v_lines, v_dona
  from sklad_package_lines l
  join sklad_packages p on p.id = l.package_id
  where l.batch_id = 'a2000000-0000-0000-0000-000000000011';

  perform test_report('each sack holds one line', v_lines = 20);
  perform test_report('the sacks hold the whole thousand', v_dona = 1000);

  select qoldiq_dona into v_qoldiq
  from sklad_batches where id = 'a2000000-0000-0000-0000-000000000011';
  perform test_report('packing does not move stock', v_qoldiq = 1000);
end $$;

-- The uneven case: the remainder is a sack, not a rounding error.
do $$
declare v_made integer; v_last integer;
begin
  select sklad_pack_batch(
    '11111111-1111-1111-1111-111111111111',
    'a2000000-0000-0000-0000-000000000012',
    50, 210
  ) into v_made;

  perform test_report('210 at 50 a sack is 5 sacks', v_made = 5);

  select l.dona into v_last
  from sklad_package_lines l
  join sklad_packages p on p.id = l.package_id
  where l.batch_id = 'a2000000-0000-0000-0000-000000000012'
  order by p.created_at desc, p.code desc
  limit 1;

  perform test_report('the last sack holds the remainder', v_last = 10);
end $$;

do $$
declare v_err text;
begin
  begin
    perform sklad_pack_batch('11111111-1111-1111-1111-111111111111',
      'a2000000-0000-0000-0000-000000000011', 0);
    v_err := 'no error';
  exception when others then v_err := 'raised';
  end;
  perform test_report('zero per sack is refused', v_err = 'raised');
end $$;

-- =========== 3. sack codes ===========
do $$
declare v_codes integer; v_bars integer; v_shape integer;
begin
  select count(distinct code), count(distinct barcode) into v_codes, v_bars
  from sklad_packages where org_id = '11111111-1111-1111-1111-111111111111';
  perform test_report('every sack has its own code and barcode', v_codes = 25 and v_bars = 25);

  select count(*) into v_shape
  from sklad_packages
  where org_id = '11111111-1111-1111-1111-111111111111'
    and (code !~ '^QOP-[0-9]{4}-[0-9]{4}$' or left(barcode, 1) <> '3');
  perform test_report('sack codes follow the rule (QOP-YYYY-NNNN, 3…)', v_shape = 0);
end $$;

-- =========== 4. the mixed sack ===========
do $$
declare v_pkg uuid; v_lines integer; v_dona integer; v_err text;
begin
  select sklad_save_package(
    '11111111-1111-1111-1111-111111111111',
    '[{"itemId":"a1000000-0000-0000-0000-000000000011","batchId":"a2000000-0000-0000-0000-000000000011","dona":"30"},
      {"itemId":"a1000000-0000-0000-0000-000000000012","batchId":"a2000000-0000-0000-0000-000000000012","dona":"20"}]'::jsonb
  ) into v_pkg;

  select count(*), sum(dona) into v_lines, v_dona
  from sklad_package_lines where package_id = v_pkg;
  perform test_report('a mixed sack holds several models', v_lines = 2 and v_dona = 50);

  -- Correcting it replaces the contents rather than appending to them.
  perform sklad_save_package(
    '11111111-1111-1111-1111-111111111111',
    '[{"itemId":"a1000000-0000-0000-0000-000000000011","batchId":"a2000000-0000-0000-0000-000000000011","dona":"45"}]'::jsonb,
    v_pkg
  );
  select count(*), sum(dona) into v_lines, v_dona
  from sklad_package_lines where package_id = v_pkg;
  perform test_report('editing replaces the contents', v_lines = 1 and v_dona = 45);

  -- A line with no batch named picks one, rather than losing the write-off.
  perform sklad_save_package(
    '11111111-1111-1111-1111-111111111111',
    '[{"itemId":"a1000000-0000-0000-0000-000000000012","dona":"5"}]'::jsonb,
    v_pkg
  );
  select count(*) into v_lines
  from sklad_package_lines
  where package_id = v_pkg and batch_id = 'a2000000-0000-0000-0000-000000000012';
  perform test_report('a line without a lot is given one', v_lines = 1);

  begin
    perform sklad_save_package('11111111-1111-1111-1111-111111111111', '[]'::jsonb, v_pkg);
    v_err := 'no error';
  exception when others then v_err := 'raised';
  end;
  perform test_report('an empty sack is refused', v_err = 'raised');
end $$;

-- =========== 5. one scan, one answer ===========
do $$
declare v_kind text; v_id uuid; v_item uuid; v_avail integer; v_inv uuid; v_client text;
begin
  select kind, id into v_kind, v_id
  from sklad_scan('11111111-1111-1111-1111-111111111111',
                  (select barcode from sklad_items
                   where id = 'a1000000-0000-0000-0000-000000000011'));
  perform test_report('a product barcode reads as a product',
                      v_kind = 'mahsulot' and v_id = 'a1000000-0000-0000-0000-000000000011');

  select kind, available_dona into v_kind, v_avail
  from sklad_scan('11111111-1111-1111-1111-111111111111', 'ATIR-S');
  perform test_report('the production code finds the card too', v_kind = 'mahsulot');
  perform test_report('a product scan reports what is in stock', v_avail = 200);

  select kind into v_kind
  from sklad_scan('11111111-1111-1111-1111-111111111111',
                  (select barcode from sklad_packages order by code limit 1));
  perform test_report('a sack barcode reads as a sack', v_kind = 'qop');

  select kind into v_kind
  from sklad_scan('11111111-1111-1111-1111-111111111111',
                  (select code from sklad_packages order by code limit 1));
  perform test_report('the printed QOP number finds the sack', v_kind = 'qop');

  perform test_report('nonsense finds nothing',
                      not exists (select 1 from sklad_scan(
                        '11111111-1111-1111-1111-111111111111', 'ZZZ-NOT-A-CODE')));
end $$;

-- =========== 6. the sale, confirmed ===========
do $$
declare
  v_invoice uuid; v_kind text; v_scan_inv uuid;
  v_ids uuid[]; v_shipment uuid; v_qoldiq integer; v_status sklad_invoice_status;
  v_shipped integer; v_gone integer; v_err text; v_carrier text;
begin
  select sklad_create_invoice(
    '11111111-1111-1111-1111-111111111111',
    'eeeeeeee-0000-0000-0000-000000000001',
    '[{"itemId":"a1000000-0000-0000-0000-000000000011","dona":"100","unitPrice":"25000"}]'::jsonb
  ) into v_invoice;

  -- The invoice's own barcode still resolves, and now through one resolver.
  select kind, invoice_id into v_kind, v_scan_inv
  from sklad_scan('11111111-1111-1111-1111-111111111111',
                  (select barcode from sklad_invoices where id = v_invoice));
  perform test_report('an invoice barcode reads as an invoice',
                      v_kind = 'faktura' and v_scan_inv = v_invoice);

  -- A product scan points at the client waiting for it — the barcode finding
  -- the client and their invoice without anybody typing a name.
  select invoice_id, counterparty_name into v_scan_inv, v_carrier
  from sklad_scan('11111111-1111-1111-1111-111111111111',
                  (select barcode from sklad_items
                   where id = 'a1000000-0000-0000-0000-000000000011'));
  perform test_report('a product scan finds the open invoice for it', v_scan_inv = v_invoice);
  perform test_report('and names the client', v_carrier = 'Mijoz A');

  -- Two sacks of fifty off the red lot, spoken for by this invoice.
  select array_agg(p.id) into v_ids
  from (
    select p.id
    from sklad_packages p
    join sklad_package_lines l on l.package_id = p.id
    where l.batch_id = 'a2000000-0000-0000-0000-000000000011'
      and p.status = 'tayyor' and l.dona = 50
    order by p.code
    limit 2
  ) p;

  select sklad_issue_packages(
    '11111111-1111-1111-1111-111111111111', v_ids, v_invoice,
    'BTS Express', 'TRK-001'
  ) into v_shipment;

  select qoldiq_dona into v_qoldiq
  from sklad_batches where id = 'a2000000-0000-0000-0000-000000000011';
  perform test_report('despatch writes the goods off the lot', v_qoldiq = 900);

  select count(*) into v_gone
  from sklad_packages where id = any (v_ids) and status = 'jonatilgan'
    and shipment_id = v_shipment;
  perform test_report('the sacks are marked gone', v_gone = 2);

  select sum(dona) into v_shipped
  from sklad_shipment_lines where shipment_id = v_shipment;
  perform test_report('the despatch carries exactly what was in them', v_shipped = 100);

  select status into v_status from sklad_invoices where id = v_invoice;
  perform test_report('the invoice closes itself', v_status = 'bajarildi');

  select carrier into v_carrier from sklad_shipments where id = v_shipment;
  perform test_report('the carrier is recorded', v_carrier = 'BTS Express');

  -- The same sacks cannot go twice.
  begin
    perform sklad_issue_packages('11111111-1111-1111-1111-111111111111', v_ids, v_invoice);
    v_err := 'no error';
  exception when others then v_err := 'raised';
  end;
  perform test_report('a shipped sack cannot ship again', v_err = 'raised');

  -- Nor can its contents be rewritten after the fact.
  begin
    perform sklad_save_package(
      '11111111-1111-1111-1111-111111111111',
      '[{"itemId":"a1000000-0000-0000-0000-000000000011","dona":"1"}]'::jsonb,
      v_ids[1]);
    v_err := 'no error';
  exception when others then v_err := 'raised';
  end;
  perform test_report('a shipped sack cannot be edited', v_err = 'raised');

  begin
    perform sklad_delete_package('11111111-1111-1111-1111-111111111111', v_ids[1]);
    v_err := 'no error';
  exception when others then v_err := 'raised';
  end;
  perform test_report('a shipped sack cannot be deleted', v_err = 'raised');
end $$;

-- =========== 7. the desk's own list ===========
do $$
declare v_name text; v_amount numeric; v_packs bigint; v_shipped bigint;
begin
  select counterparty_name, total_amount, package_count, shipped_dona
  into v_name, v_amount, v_packs, v_shipped
  from sklad_sales_by_counterparty('11111111-1111-1111-1111-111111111111');

  perform test_report('the sales list names the client', v_name = 'Mijoz A');
  perform test_report('and totals what they bought', v_amount = 2500000);
  perform test_report('and counts their sacks', v_packs >= 2);
  perform test_report('and what has left', v_shipped = 100);
end $$;

-- =========== 8. org boundaries ===========
do $$
declare v_rows integer;
begin
  set app.current_user_id = 'aaaaaaaa-0000-0000-0000-000000000009';

  select count(*) into v_rows from sklad_packages;
  perform test_report('a stranger sees no sacks', v_rows = 0);

  select count(*) into v_rows
  from sklad_scan('11111111-1111-1111-1111-111111111111',
                  (select barcode from sklad_items
                   where kod = 'ATIR-Q'));
  perform test_report('a stranger scans nothing', v_rows = 0);

  select count(*) into v_rows
  from sklad_sales_by_counterparty('11111111-1111-1111-1111-111111111111');
  perform test_report('a stranger sees no sales', v_rows = 0);

  set app.current_user_id = 'aaaaaaaa-0000-0000-0000-000000000001';
end $$;
