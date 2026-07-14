-- Demo seed data mirroring the sample "Мубошер" ledger.
-- NOTE: requires a real auth.users row to attach memberships to; run
-- `supabase db reset` after creating a local user (e.g. via Studio) if you
-- want memberships wired up, or adjust the user_id below.

insert into organizations (id, name, slug, base_currency, subscription_status)
values ('00000000-0000-0000-0000-000000000001', 'Demo Fabrika', 'demo-fabrika', 'UZS', 'active')
on conflict do nothing;

insert into accounts (org_id, code, name, type) values
  ('00000000-0000-0000-0000-000000000001', 'clients', 'Клиенты', 'receivable'),
  ('00000000-0000-0000-0000-000000000001', 'cash', 'Касса', 'cash'),
  ('00000000-0000-0000-0000-000000000001', 'sales', 'Продажи продукции', 'sales'),
  ('00000000-0000-0000-0000-000000000001', 'warehouse', 'Склад Основной', 'inventory')
on conflict do nothing;

insert into transaction_categories (org_id, name, unit, default_debit_account_id, default_credit_account_id)
select
  '00000000-0000-0000-0000-000000000001',
  'Tovar sotuvi',
  'kg',
  (select id from accounts where org_id = '00000000-0000-0000-0000-000000000001' and code = 'clients'),
  (select id from accounts where org_id = '00000000-0000-0000-0000-000000000001' and code = 'sales')
on conflict do nothing;

insert into transaction_categories (org_id, name, unit, default_debit_account_id, default_credit_account_id)
select
  '00000000-0000-0000-0000-000000000001',
  'Naqd to''lov',
  null,
  (select id from accounts where org_id = '00000000-0000-0000-0000-000000000001' and code = 'cash'),
  (select id from accounts where org_id = '00000000-0000-0000-0000-000000000001' and code = 'clients')
on conflict do nothing;

insert into counterparties (id, org_id, name, categories)
values ('00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001', 'Мубошер', array['Внутренний рынок'])
on conflict do nothing;

insert into transactions (org_id, counterparty_id, category_id, occurred_at, description, quantity, unit, debit_account_id, debit_amount, credit_account_id, credit_amount, currency)
select
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000010',
  (select id from transaction_categories where org_id = '00000000-0000-0000-0000-000000000001' and name = 'Tovar sotuvi'),
  '2026-01-05 17:17:49+00',
  '412 кг мубошер',
  412,
  'kg',
  (select id from accounts where org_id = '00000000-0000-0000-0000-000000000001' and code = 'clients'),
  2554.00,
  (select id from accounts where org_id = '00000000-0000-0000-0000-000000000001' and code = 'sales'),
  2554.00,
  'UZS'
union all
select
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000010',
  (select id from transaction_categories where org_id = '00000000-0000-0000-0000-000000000001' and name = 'Naqd to''lov'),
  '2026-01-06 16:27:55+00',
  'СОЧИК ПУЛИ ЖАФАР АКА (МУБОШЕР)',
  null,
  null,
  (select id from accounts where org_id = '00000000-0000-0000-0000-000000000001' and code = 'cash'),
  2400.00,
  (select id from accounts where org_id = '00000000-0000-0000-0000-000000000001' and code = 'clients'),
  2400.00,
  'UZS';
