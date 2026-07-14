# Mubosher SaaS

Kontragentlar (mubosherlar) bilan joriy hisob-kitobni yuritish uchun multi-tenant SaaS. Qog'oz/1C uslubidagi Дебет/Кредит/Текущее сальдо varag'ini raqamlashtiradi: har bir mijoz-kompaniya o'z kontragentlarini, tovar sotuvi va naqd to'lovlarini kiritadi, joriy balans avtomatik hisoblanadi va barcha platformalarda (mobil, veb, desktop) real vaqtda ko'rinadi.

## Stack

- **Backend**: Supabase (Postgres, Auth, Realtime), SQL migrations in [packages/database](packages/database)
- **Monorepo**: Turborepo + npm workspaces, Node 20
- **Web**: Next.js 15 (App Router) + Tailwind — [apps/web](apps/web)
- **Mobile**: Expo SDK 54 (React Native, TypeScript), offline-first with `expo-sqlite` — [apps/mobile](apps/mobile)
- **Desktop**: Electron shell wrapping the web app — [apps/desktop](apps/desktop)
- **Shared domain logic**: [packages/shared](packages/shared) (zod schemas, running-balance calculation, i18n)
- **Data access**: [packages/api-client](packages/api-client) (typed Supabase client + React Query hooks, shared by web and mobile)

## Repository layout

```
apps/
  web/        Next.js dashboard + super-admin panel
  mobile/     Expo entry app (offline-first)
  desktop/    Electron shell
packages/
  database/   Supabase SQL migrations, seed data
  shared/     Domain types, zod schemas, balance logic (+ unit tests)
  api-client/ Supabase client wrapper + React Query hooks
  config/     Shared eslint/tsconfig
  ui/         (reserved) shared React components for web/desktop
```

## Getting started

See [.claude/skills/run/SKILL.md](.claude/skills/run/SKILL.md) for the full local dev workflow. Short version:

```sh
npm install
cp apps/web/.env.example apps/web/.env.local
cp apps/mobile/.env.example apps/mobile/.env
npm run dev
```

Supabase locally requires Docker: `npm run supabase:start --workspace @mubosher/database`.

## Domain model

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the full schema and tenancy model.
