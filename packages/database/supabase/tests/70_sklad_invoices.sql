\set ON_ERROR_STOP on

-- Sales invoices and the scan that turns one into a despatch (0027).
--
-- The properties that matter here are about paper meeting goods:
--
--   1. a document is numbered and coded once, and the codes are unique,
--   2. any of the three things a scanner might produce — barcode, number, or
--      the id out of the QR link — finds the same document,
--   3. despatching against an invoice moves its status by itself, and a half
--      filled invoice reopens showing the half that is left,
--   4. the client and document number come off the paper rather than being
--      retyped at the desk, and
--   5. none of it crosses an org boundary.

set role app_user;
set app.current_user_id = 'aaaaaaaa-0000-0000-0000-000000000001';

-- ---------------------------------------------------------------------
-- Fixture: one card, two batches with stock on them.
-- ---------------------------------------------------------------------
insert into sklad_items (id, org_id, kod, name, gsm, width_cm, length_cm)
values ('a1000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
        'K-500', 'Jakkard maxroviy', 450, 70, 140);

insert into sklad_batches (id, org_id, item_id, netto_kg, dona_soni)
values
  ('a2000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
   'a1000000-0000-0000-0000-000000000001', 60.0, 120),
  ('a2000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111',
   'a1000000-0000-0000-0000-000000000001', 40.0, 80);

-- =========== 1. numbering and codes ===========
do $$
declare v_first uuid; v_second uuid; v_no1 text; v_no2 text; v_bar text;
begin
  select sklad_create_invoice(
    '11111111-1111-1111-1111-111111111111',
    'eeeeeeee-0000-0000-0000-000000000001',
    format('[{"itemId":"a1000000-0000-0000-0000-000000000001",
              "batchId":"%s","dona":"50","unitPrice":"4.5"}]',
           'a2000000-0000-0000-0000-000000000001')::jsonb,
    null, null, null, null, 'USD', 'birinchi'
  ) into v_first;

  select sklad_create_invoice(
    '11111111-1111-1111-1111-111111111111',
    'eeeeeeee-0000-0000-0000-000000000001',
    '[{"itemId":"a1000000-0000-0000-0000-000000000001","dona":"10"}]'::jsonb
  ) into v_second;

  select invoice_no, barcode into v_no1, v_bar
  from sklad_invoices where id = v_first;
  select invoice_no into v_no2 from sklad_invoices where id = v_second;

  perform test_report('an invoice is numbered per org and year',
                      v_no1 = 'FKT-' || extract(year from current_date)::text || '-0001');
  perform test_report('and the next one increments',
                      v_no2 = 'FKT-' || extract(year from current_date)::text || '-0002');
  perform test_report('the barcode is 13 digits',
                      v_bar ~ '^[0-9]{13}$');
end $$;

do $$
declare v_codes bigint; v_rows bigint;
begin
  select count(distinct barcode), count(*) into v_codes, v_rows from sklad_invoices;
  perform test_report('every invoice has its own barcode', v_codes = v_rows);
end $$;

-- An invoice with nothing on it is not a document.
do $$
begin
  perform sklad_create_invoice(
    '11111111-1111-1111-1111-111111111111',
    'eeeeeeee-0000-0000-0000-000000000001',
    '[{"dona":"0"},{}]'::jsonb);
  perform test_report('an invoice with no usable rows is refused', false);
exception when others then
  perform test_report('an invoice with no usable rows is refused', true);
end $$;

do $$
begin
  perform sklad_create_invoice(
    '11111111-1111-1111-1111-111111111111', null,
    '[{"itemId":"a1000000-0000-0000-0000-000000000001","dona":"5"}]'::jsonb);
  perform test_report('an invoice without a client is refused', false);
exception when others then
  perform test_report('an invoice without a client is refused', true);
end $$;

-- =========== 2. the scan finds it, however it was read ===========
do $$
declare v_id uuid; v_bar text; v_no text; v_byBar uuid; v_byNo uuid; v_byId uuid;
begin
  select id, barcode, invoice_no into v_id, v_bar, v_no
  from sklad_invoices where note = 'birinchi';

  select invoice_id into v_byBar
  from sklad_invoice_by_code('11111111-1111-1111-1111-111111111111'::uuid, v_bar);
  select invoice_id into v_byNo
  from sklad_invoice_by_code('11111111-1111-1111-1111-111111111111'::uuid, v_no);
  select invoice_id into v_byId
  from sklad_invoice_by_code('11111111-1111-1111-1111-111111111111'::uuid, v_id::text);

  perform test_report('the barcode finds the invoice', v_byBar = v_id);
  perform test_report('the printed number finds the same one', v_byNo = v_id);
  perform test_report('and so does the id out of the QR link', v_byId = v_id);
end $$;

-- A scanner appends whitespace; a person typing it appends more.
do $$
declare v_bar text; v_found uuid;
begin
  select barcode into v_bar from sklad_invoices where note = 'birinchi';
  select invoice_id into v_found
  from sklad_invoice_by_code('11111111-1111-1111-1111-111111111111'::uuid, '  ' || v_bar || '  ');
  perform test_report('surrounding whitespace from the scanner is ignored', v_found is not null);
end $$;

do $$
declare v_rows bigint;
begin
  select count(*) into v_rows
  from sklad_invoice_by_code('11111111-1111-1111-1111-111111111111'::uuid, '0000000000000');
  perform test_report('an unknown code finds nothing rather than the wrong thing', v_rows = 0);
end $$;

-- =========== 3. the scan carries the client and what is outstanding ===========
do $$
declare v_client text; v_ordered integer; v_remaining integer; v_qoldiq integer;
begin
  select counterparty_name, ordered_dona, remaining_dona, batch_qoldiq_dona
  into v_client, v_ordered, v_remaining, v_qoldiq
  from sklad_invoice_by_code(
    '11111111-1111-1111-1111-111111111111'::uuid,
    (select barcode from sklad_invoices where note = 'birinchi'));

  perform test_report('the scan names the client', v_client = 'Mijoz A');
  perform test_report('and what was sold', v_ordered = 50);
  perform test_report('and what is still owed', v_remaining = 50);
  perform test_report('and what the named batch actually holds', v_qoldiq = 120);
end $$;

-- =========== 4. despatching against it moves its status ===========
do $$
declare v_id uuid; v_shipment uuid; v_status text; v_remaining integer;
begin
  select id into v_id from sklad_invoices where note = 'birinchi';

  select sklad_issue_rows(
    '11111111-1111-1111-1111-111111111111',
    '[{"batchId":"a2000000-0000-0000-0000-000000000001","dona":"20"}]'::jsonb,
    null, null, null, null, null, null, v_id
  ) into v_shipment;

  select status::text into v_status from sklad_invoices where id = v_id;
  select remaining_dona into v_remaining
  from sklad_invoice_by_code(
    '11111111-1111-1111-1111-111111111111'::uuid,
    (select barcode from sklad_invoices where id = v_id));

  perform test_report('a part despatch makes the invoice partial', v_status = 'qisman');
  perform test_report('and it reopens showing the half that is left', v_remaining = 30);
end $$;

-- The client and the document number came off the paper, not off the desk.
do $$
declare v_client uuid; v_doc text; v_invoice uuid;
begin
  select sh.counterparty_id, sh.document_no, sh.invoice_id into v_client, v_doc, v_invoice
  from sklad_shipments sh
  where sh.invoice_id = (select id from sklad_invoices where note = 'birinchi');

  perform test_report('the despatch took the client from the invoice',
                      v_client = 'eeeeeeee-0000-0000-0000-000000000001');
  perform test_report('and its document number', v_doc like 'FKT-%');
  perform test_report('and the sale it answers to is recorded', v_invoice is not null);
end $$;

do $$
declare v_qoldiq integer;
begin
  select qoldiq_dona into v_qoldiq from sklad_batches
  where id = 'a2000000-0000-0000-0000-000000000001';
  perform test_report('the goods actually left the shelf', v_qoldiq = 100);
end $$;

do $$
declare v_status text;
begin
  perform sklad_issue_rows(
    '11111111-1111-1111-1111-111111111111',
    '[{"batchId":"a2000000-0000-0000-0000-000000000001","dona":"30"}]'::jsonb,
    null, null, null, null, null, null,
    (select id from sklad_invoices where note = 'birinchi'));

  select status::text into v_status from sklad_invoices where note = 'birinchi';
  perform test_report('filling the rest closes the invoice', v_status = 'bajarildi');
end $$;

-- A cancelled invoice stays cancelled: that one is a person's decision.
do $$
declare v_status text;
begin
  update sklad_invoices set status = 'bekor' where note = 'birinchi';
  perform refresh_sklad_invoice_status((select id from sklad_invoices where note = 'birinchi'));
  select status::text into v_status from sklad_invoices where note = 'birinchi';
  perform test_report('a cancelled invoice is not revived by the recount', v_status = 'bekor');
end $$;

-- =========== 5. the despatch note prints what the driver needs ===========
do $$
declare v_no text; v_client text; v_lines bigint;
begin
  select count(*) into v_lines
  from sklad_shipment_note((
    select sh.id from sklad_shipments sh
    where sh.invoice_id = (select id from sklad_invoices where note = 'birinchi')
    limit 1));

  select invoice_no, counterparty_name into v_no, v_client
  from sklad_shipment_note((
    select sh.id from sklad_shipments sh
    where sh.invoice_id = (select id from sklad_invoices where note = 'birinchi')
    limit 1))
  limit 1;

  perform test_report('the despatch note lists its lines', v_lines = 1);
  perform test_report('and names the invoice it answers to', v_no like 'FKT-%');
  perform test_report('and the client', v_client = 'Mijoz A');
end $$;

-- =========== 6. the queue on the despatch desk ===========
do $$
declare v_rows bigint; v_ordered bigint; v_shipped bigint;
begin
  select count(*) into v_rows
  from sklad_invoice_page('11111111-1111-1111-1111-111111111111'::uuid);
  perform test_report('the desk sees every invoice', v_rows = 2);

  select ordered_dona, shipped_dona into v_ordered, v_shipped
  from sklad_invoice_page('11111111-1111-1111-1111-111111111111'::uuid)
  where invoice_no like '%-0001';
  perform test_report('with what was sold and what has gone',
                      v_ordered = 50 and v_shipped = 50);
end $$;

do $$
declare v_rows bigint;
begin
  select count(*) into v_rows
  from sklad_invoice_page('11111111-1111-1111-1111-111111111111'::uuid, 'yangi');
  perform test_report('and can be narrowed to the ones still owing goods', v_rows = 1);
end $$;

-- =========== 7. staff may raise and fulfil, but see no margin ===========
set app.current_user_id = 'bbbbbbbb-0000-0000-0000-000000000002';

do $$
declare v_rows bigint;
begin
  select count(*) into v_rows
  from sklad_invoice_page('11111111-1111-1111-1111-111111111111'::uuid);
  perform test_report('a storekeeper can read the invoice queue', v_rows = 2);
end $$;

-- =========== 8. nothing crosses an org boundary ===========
set role postgres;
insert into organizations (id, name, slug)
values ('88888888-8888-8888-8888-888888888888', 'Boshqa', 'boshqa');
insert into auth.users (id, email, aud, role, created_at, updated_at)
values ('dddddddd-8888-0000-0000-000000000008', 'boshqa@test.uz', 'authenticated',
        'authenticated', now(), now());
insert into memberships (org_id, user_id, role)
values ('88888888-8888-8888-8888-888888888888', 'dddddddd-8888-0000-0000-000000000008', 'owner');
set role app_user;

set app.current_user_id = 'dddddddd-8888-0000-0000-000000000008';

do $$
declare v_rows bigint;
begin
  select count(*) into v_rows
  from sklad_invoice_by_code(
    '11111111-1111-1111-1111-111111111111'::uuid,
    (select barcode from sklad_invoices limit 1));
  perform test_report('another org scanning this barcode gets nothing', v_rows = 0);
end $$;

do $$
declare v_rows bigint;
begin
  select count(*) into v_rows from sklad_invoices;
  perform test_report('and cannot list them either', v_rows = 0);
end $$;
