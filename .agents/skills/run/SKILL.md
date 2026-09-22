---
name: run
description: Launch the Mubosher SaaS monorepo apps (web, mobile, desktop) for local development.
---

# Running Mubosher SaaS locally

This is an npm-workspaces + Turborepo monorepo. Node 20 required (`.nvmrc`).

1. Install deps once at the repo root: `npm install`
2. Copy env files and fill in Supabase local keys:
   - `apps/web/.env.example` -> `apps/web/.env.local`
   - `apps/mobile/.env.example` -> `apps/mobile/.env`
3. Start Supabase locally (requires Docker): `npm run supabase:start --workspace @mubosher/database`
   (alias for `supabase start` inside `packages/database`; prints the local anon key to paste into the env files)
4. Run everything in dev mode: `npm run dev` (Turborepo runs each app's `dev` script in parallel)
   - Web only: `npm run dev --workspace @mubosher/web` -> http://localhost:3000
   - Mobile only: `npm run dev --workspace @mubosher/mobile` -> Expo Metro bundler / QR code
   - Desktop only: `npm run dev --workspace @mubosher/desktop` (expects the web dev server running on :3000)

Run `npx vitest run` inside `packages/shared` to verify the ledger balance logic after any change to `computeRunningBalance`.
