-- =====================================================================
-- Mubosher — LOGIN + DEMO (yangi loyiha: zsegffswqmmvehclekji)
-- =====================================================================
-- ESLATMA: bu loyihada SXEMA ALLAQACHON MAVJUD (jadvallar, RLS, funksiyalar).
-- Shuning uchun bu skript faqat LOGIN foydalanuvchi + tashkilot + demo
-- ma'lumotni yaratadi (migratsiyalar qayta ishga tushmaydi).
--
-- QANDAY ISHLATISH:
--   1. https://supabase.com/dashboard/project/zsegffswqmmvehclekji/sql/new
--   2. Shu faylning HAMMASINI nusxalab qo'ying -> Run
--   3. Pastda 'TAYYOR! ...' chiqsa — bo'ldi.
--
-- Kirish:  Email: muboshercrm@gmail.com   Parol: Mubosher2026!
--
-- Idempotent: xohlagancha qayta ishga tushiring (eski demo o'chirilib,
-- toza yangidan yaratiladi).
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;
set search_path = public, extensions;

do $$
declare
  v_email    text := 'muboshercrm@gmail.com';
  v_password text := 'Mubosher2026!';
  v_user_id  uuid;
  v_org_id   uuid := gen_random_uuid();
  v_clients  uuid;
  v_cash     uuid;
  v_sales    uuid;
begin
  -- --- Eski demo ma'lumotlarini tozalash ---------------------------------
  delete from organizations where slug like 'demo-fabrika%';
  delete from auth.users where email = v_email;

  v_user_id := gen_random_uuid();

  -- --- 1. Auth foydalanuvchi (parol bilan, darhol tasdiqlangan) ----------
  -- MUHIM: confirmation_token / recovery_token / email_change_token_new /
  -- email_change ustunlari defolt NULL. Ularni bo'sh satr qilib qo'ymasak,
  -- GoTrue login paytida NULL'ni o'qiy olmay "Database error querying schema"
  -- (500) qaytaradi. Shuning uchun ularni '' qilib beramiz.
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) values (
    '00000000-0000-0000-0000-000000000000',
    v_user_id, 'authenticated', 'authenticated', v_email,
    crypt(v_password, gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Demo Admin"}'::jsonb,
    '', '', '', ''
  );

  -- Parol bilan kirish uchun identities yozuvi ham shart
  insert into auth.identities (
    id, user_id, provider_id, identity_data, provider,
    last_sign_in_at, created_at, updated_at
  ) values (
    gen_random_uuid(), v_user_id, v_user_id::text,
    json_build_object('sub', v_user_id::text, 'email', v_email)::jsonb,
    'email', now(), now(), now()
  );

  -- --- 2. Tashkilot + EGA (owner) a'zolik --------------------------------
  insert into organizations (id, name, slug, base_currency, subscription_status)
  values (v_org_id, 'Demo Fabrika', 'demo-fabrika-' || substr(v_org_id::text, 1, 8), 'UZS', 'active');

  insert into memberships (org_id, user_id, role)
  values (v_org_id, v_user_id, 'owner')
  on conflict (org_id, user_id) do update set role = 'owner';

  -- --- 3. Schyotlar ------------------------------------------------------
  insert into accounts (org_id, code, name, type) values
    (v_org_id, 'clients', 'Mijozlar', 'receivable'),
    (v_org_id, 'cash',    'Kassa',    'cash'),
    (v_org_id, 'sales',   'Sotuv',    'sales');

  select id into v_clients from accounts where org_id = v_org_id and code = 'clients';
  select id into v_cash    from accounts where org_id = v_org_id and code = 'cash';
  select id into v_sales   from accounts where org_id = v_org_id and code = 'sales';

  -- Kirim = debet "Mijozlar" (qarz oshadi); Chiqim = kredit "Mijozlar" (qarz kamayadi)
  insert into transaction_categories (org_id, name, unit, default_debit_account_id, default_credit_account_id)
  values
    (v_org_id, 'Tovar sotuvi', 'kg',  v_clients, v_sales),
    (v_org_id, 'Naqd to''lov', null,  v_cash,    v_clients);

  -- --- Demo mijoz (mobil ilovada ro'yxatda ko'rinadi) --------------------
  insert into counterparties (org_id, name, phone, categories)
  values (v_org_id, 'Jafar aka', '+998 90 123 45 67', array['Ichki bozor']);

  raise notice '==================================================';
  raise notice 'TAYYOR!  Email: %   Parol: %', v_email, v_password;
  raise notice '==================================================';
end $$;
