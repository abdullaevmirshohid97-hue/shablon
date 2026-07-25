---
name: deploy
description: Deploy the Mubosher web app (idaa.uz) to the shared Hostinger VPS — Caddy + pm2 + Supabase. Covers first-time setup, redeploys, DNS, TLS, and the gotchas that actually bit us.
---

# Deploying Mubosher web → idaa.uz

Next.js **standalone** app, run under **pm2**, reverse-proxied by **Caddy**, backend on **Supabase** (managed). The VPS is **shared** with the owner's other production apps — never touch their files.

> 🔐 **Secrets are NOT in this repo.** Supabase keys, DB password, admin email/ids, and VPS details live in `1997/supabase-credentials.md`, which is gitignored (`/1997/`). The repo is **public** — never commit service_role/secret keys or `.env*` (only `.env*.example`).

## Fixed facts

| Thing         | Value                                                                                                                                                                         |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Domain        | **idaa.uz** (apex + `www` + `app` + `admin`), registrar aHost/SUVAN NET, NS `rdns{1,2,3}.ahost.uz`                                                                            |
| VPS           | Hostinger, host `srv1564290`, public IP `72.61.88.214` (shared with Clary, Luxury/yuseef.com, Yukchibolla/ilova)                                                              |
| Deploy dir    | `/opt/mery`                                                                                                                                                                   |
| Process       | pm2 `mery-web`, Next standalone bound to `127.0.0.1:3100`                                                                                                                     |
| Prod Supabase | project **`zsegffswqmmvehclekji`** (the FAOL one; `oxzenyupcolsamojccfg` is the OLD archive — do not use)                                                                     |
| App env keys  | web: `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` only (anon = public-safe); mobile: `EXPO_PUBLIC_*`. Never put `service_role`/`secret` in `.env.production`. |

## Requirements (on the VPS, once)

- Node 20 (`node -v` → v20), npm 10
- pm2 (`npm i -g pm2`) — `first-setup.sh` installs it if missing
- Caddy (already installed; Clary uses it). **Admin API is OFF** → you must `restart`, not `reload` (see gotcha).

## First-time deploy

```bash
git clone https://github.com/abdullaevmirshohid97-hue/shablon.git /opt/mery
cd /opt/mery
bash infra/first-setup.sh      # writes apps/web/.env.production (zsegff + anon), pm2 install, build, start
pm2 startup                    # run the printed command once
pm2 save
```

`first-setup.sh` auto-creates `.env.production` with the prod URL + anon key. `infra/deploy.sh` fails loudly if `.env.production` is missing.

## Caddy (once)

Append the 4 blocks from `infra/Caddyfile.snippet` (idaa.uz / www / app / admin) to the **shared** `/etc/caddy/Caddyfile`. Do NOT edit other projects' blocks.

```bash
sudo cp /etc/caddy/Caddyfile /etc/caddy/Caddyfile.bak-$(date +%F)
sudo nano /etc/caddy/Caddyfile          # paste the blocks at the end
caddy validate --config /etc/caddy/Caddyfile
sudo systemctl restart caddy            # ⚠️ RESTART, not reload — admin API is off
```

## Redeploys (every update)

```bash
cd /opt/mery && bash infra/deploy.sh    # git pull → npm ci → standalone build → pm2 restart mery-web
```

## DNS (registrar = aHost, clients.ahost.uz)

A records, all → `72.61.88.214`:

| Host    | Type | Value        |
| ------- | ---- | ------------ |
| `@`     | A    | 72.61.88.214 |
| `www`   | A    | 72.61.88.214 |
| `app`   | A    | 72.61.88.214 |
| `admin` | A    | 72.61.88.214 |

- **Delete any duplicate `@` A record** (aHost auto-adds `@ → 185.196.212.52`, its own host) — apex must point only to the VPS.
- Leave `mail`/`ftp` CNAME, `MX`, `SPF/DKIM/DMARC` TXT alone (email).
- `www` may already have a CNAME → delete it before adding the A record (can't mix CNAME + A).
- New `.uz` domains take a few hours (up to 24h) for the registry delegation to propagate globally, even when `whois` shows `Status: ACTIVE`.

## Super-admin bootstrap (local, once)

Scripts in `1997/` (gitignored) are repointed to zsegff. From `d:\shablon` locally:

```bash
node 1997/bootstrap-admin.mjs                 # creates platform_admin + "Demo Fabrika" org
node 1997/set-admin-password.mjs <password>   # optional: password login (more reliable than magic link)
```

Login page supports password (default tab) + magic link. Admin panel is at `/admin` (host `admin.idaa.uz` redirects `/` → `/admin`), gated server-side by `profiles.role_platform = 'platform_admin'`. RLS already lets platform_admin read across all orgs — no migration needed.

## Troubleshooting (real issues we hit)

- **`systemctl reload caddy` → "Job failed"** but `caddy validate` says Valid → admin API is off on this box. Use `sudo systemctl restart caddy`.
- **Site not loading, `dig NS idaa.uz +short` empty** → `.uz` delegation not propagated yet. Confirm the authoritative NS already serves it: `dig @185.196.212.52 app.idaa.uz +short` should return `72.61.88.214`. Then just wait; re-run `dig NS idaa.uz +short` until it lists `rdns*.ahost.uz`.
- **Caddy cert `challenge failed ... NXDOMAIN` for `*.clary.uz`** → Clary's own subdomains without DNS; harmless noise, not ours.
- **`node` misbehaves in the VS Code terminal (local)** → `Remove-Item Env:ELECTRON_RUN_AS_NODE` (PowerShell) or use an external terminal.
- Verify the app itself independent of DNS/TLS: `curl -I http://127.0.0.1:3100` → expect `307 → /login`.

## Security checklist

- Repo is **public** → keep secrets in gitignored `1997/` only; `.env.production` holds just the anon key.
- Caddy sets HSTS/CSP/`X-Frame-Options`/`-Server`; CSP `connect-src` is pinned to the zsegff Supabase ref; admin block adds `noindex`.
- Node port `3100` binds `127.0.0.1` only (never exposed directly).
- After the demo, **rotate** the `service_role`/`secret` keys + DB password (they were shared in chat) via the Supabase dashboard, then update `1997/supabase-credentials.md`.
