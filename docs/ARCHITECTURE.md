# Arxitektura

## Manba domen

Loyiha manba hujjati — 1C uslubidagi kontragent joriy hisob varag'i ("Мубошер"). Har bir qator: sana, tavsif, Дебет счёt+summa, Кредит счёt+summa, yugurma balans (Д/К). Ikki asosiy operatsiya:

- **Tovar sotuvi**: Дебет `Клиенты` / Кредит `Продажи продукции`, kg miqdorida
- **Naqd to'lov**: Дебет `Касса` / Кредит `Клиенты`
- **Ombor chiqimi** (kamdan-kam): Дебет `Клиенты` / Кредит `Склад Основной`, дона miqdorida

Balans mantiqi: faqat `Клиенты` (receivable) hisobiga tegishli tomon balansni harakatga keltiradi — debet tomonda bo'lsa balans oshadi (mijoz qarzdor), kredit tomonda bo'lsa kamayadi. Manfiy yig'indi — balans "К" (kompaniya qarzdor) tomonga o'tadi. Bu mantiq [packages/shared/src/balance.ts](../packages/shared/src/balance.ts) dagi `computeRunningBalance` funksiyasida amalga oshirilgan va [balance.test.ts](../packages/shared/src/balance.test.ts) da manba hujjatdagi haqiqiy raqamlar bilan tekshirilgan.

## Tenant modeli

```
platform_admin (global, organizationsiz)
  └── organizations (obunachi-kompaniya)
        └── memberships (user_id, role: owner/admin/staff)
        └── counterparties (kontragentlar — masalan "Мубошер")
        └── accounts (dinamik счёт: Клиенты/Касса/Продажи/Склад)
        └── transaction_categories (masalan "Tovar sotuvi", "Naqd to'lov")
        └── transactions (Дебет/Кредит postinglar)
```

Barcha jadvallar `org_id` bo'yicha Row Level Security bilan izolyatsiya qilingan (`packages/database/supabase/migrations/0001_init.sql`). `platform_admin` roli barcha organizationlarni ko'ra oladi (super-admin panel, `/admin` sahifasi).

## Real-time oqim

`transactions` jadvali Supabase Realtime publication'ga qo'shilgan. Veb-app (`useTransactions` hook, [packages/api-client](../packages/api-client)) `postgres_changes` kanaliga obuna bo'ladi va yangi yozuv kelganda avtomatik qayta yuklanadi — mobil ilovadan kiritilgan tranzaksiya bir necha soniyada veb dashboard'da ko'rinadi.

## Oflayn strategiya (mobil)

Mobil ilova tranzaksiyani avval local SQLite navbatiga (`pending_transactions`) yozadi (`apps/mobile/src/lib/db/sync.ts`), foydalanuvchi darhol natijani ko'radi. `NetInfo` ulanish tiklanganda navbatni Supabase'ga `upsert(..., { onConflict: 'client_local_id' })` orqali jo'natadi — bu qayta urinishlarda dublikat yozuv paydo bo'lishining oldini oladi.

## Keyingi qadamlar (loyihada hali yo'q)

- To'lov/obuna integratsiyasi (Stripe yoki mahalliy to'lov provayderi) — `organizations.subscription_status`ni boshqarish uchun
- `packages/ui`: web va desktop uchun umumiy dizayn tizimi komponentlari
- EAS Build (mobil) va electron-builder (desktop) orqali CI'da avtomatik build/relizlar
- `packages/database/package.json`dagi `types:generate` skriptini ishga tushirib, `packages/api-client/src/database.types.ts`dagi qo'lda yozilgan tiplarni haqiqiy Supabase sxemasidan generatsiya qilingan tiplar bilan almashtirish
