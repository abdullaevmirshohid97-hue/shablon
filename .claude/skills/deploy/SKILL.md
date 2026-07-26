---
name: deploy
description: Deploy the Mubosher web app (idaa.uz and/or merycollection.uz) to the shared Hostinger VPS — Caddy + pm2 + Supabase. Covers first-time setup, redeploys, DNS, TLS, and the gotchas that actually bit us.
---

# Deploying Mubosher web → idaa.uz / merycollection.uz

Next.js **standalone** app, run under **pm2**, reverse-proxied by **Caddy**, backend on **Supabase** (managed). The VPS is **shared** with the owner's other production apps — never touch their files.

Two domains are both owned by the user and both wired up to the **same** pm2 process (`mery-web`, port 3100) — they can run simultaneously, no conflict:

- **idaa.uz** — primary choice, but has an unresolved **`.uz` registry delegation problem** (see Troubleshooting) — `dig`/`nslookup` against the `.uz` TLD server itself returns NXDOMAIN even though `whois` shows `Status: ACTIVE`. Likely a registrar-side provisioning issue at aHost; a support ticket was filed.
- **merycollection.uz** — prepared as a **standby/fallback** while idaa.uz's registry issue is pending. Caddy blocks ready in `infra/Caddyfile.merycollection.snippet`; not yet added to the live Caddyfile (add it if/when you want this domain live — safe to add alongside idaa.uz's blocks, or instead of them).

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

## Caddy (once per domain)

Append the 4 blocks (apex / www / app / admin) from **one or both** snippet files to the **shared** `/etc/caddy/Caddyfile`. Do NOT edit other projects' blocks.

- `infra/Caddyfile.snippet` → idaa.uz
- `infra/Caddyfile.merycollection.snippet` → merycollection.uz (standby)

```bash
sudo cp /etc/caddy/Caddyfile /etc/caddy/Caddyfile.bak-$(date +%F)
sudo nano /etc/caddy/Caddyfile          # paste the blocks at the end (either or both files)
caddy validate --config /etc/caddy/Caddyfile
sudo systemctl restart caddy            # ⚠️ RESTART, not reload — admin API is off
```

## Redeploys (every update)

```bash
cd /opt/mery && bash infra/deploy.sh    # git pull → npm ci → standalone build → pm2 restart mery-web
```

## DNS (both domains, same pattern)

A records, all → `72.61.88.214`, for **each** domain you're activating (idaa.uz was set up via aHost's DNS-менеджер; merycollection.uz — check its own registrar's DNS panel):

| Host    | Type | Value        |
| ------- | ---- | ------------ |
| `@`     | A    | 72.61.88.214 |
| `www`   | A    | 72.61.88.214 |
| `app`   | A    | 72.61.88.214 |
| `admin` | A    | 72.61.88.214 |

- **Delete any duplicate `@` A record** (aHost auto-adds `@ → 185.196.212.52`, its own host) — apex must point only to the VPS.
- Leave `mail`/`ftp` CNAME, `MX`, `SPF/DKIM/DMARC` TXT alone (email).
- `www` may already have a CNAME → delete it before adding the A record (can't mix CNAME + A).
- New domains take a few hours (up to 24h) for the registry delegation to propagate globally, even when `whois` shows `Status: ACTIVE` — but see the idaa.uz gotcha below, which is a _different_ (non-propagation) problem.

## Super-admin bootstrap (local, once)

Scripts in `1997/` (gitignored) are repointed to zsegff. From `d:\shablon` locally:

```bash
node 1997/bootstrap-admin.mjs                 # creates platform_admin + "Demo Fabrika" org
node 1997/set-admin-password.mjs <password>   # optional: password login (more reliable than magic link)
```

Login page supports password (default tab) + magic link. Admin panel is at `/admin` (host `admin.idaa.uz` redirects `/` → `/admin`), gated server-side by `profiles.role_platform = 'platform_admin'`. RLS already lets platform_admin read across all orgs — no migration needed.

## Troubleshooting (real issues we hit)

- **idaa.uz never resolves, even after 12h+** → NOT a propagation issue. Diagnosis: aHost's own nameserver (`nslookup app.idaa.uz 185.196.212.52`) answers correctly with `72.61.88.214`, but the **`.uz` TLD server itself** (`ns.uz`, 91.212.89.8) returns **NXDOMAIN** for `idaa.uz` while resolving other `.uz` domains fine (e.g. `nslookup cctld.uz ns.uz` works). This means `.uz` registry has NOT delegated the domain at all — no amount of waiting fixes this; it's a registrar-side provisioning problem. `whois idaa.uz` showing identical Creation/Expiration dates was the first red flag. **Action:** file a support ticket with aHost asking them to confirm registration completed at the UZINFOCOM registry and push/sync the delegation; also flagged a stray `not.defined.` 4th nameserver entry in whois to be cleaned up. **Workaround while waiting:** use merycollection.uz instead (see above) — its Caddy blocks are ready in `infra/Caddyfile.merycollection.snippet`, just needs its A records set and the blocks appended.
- **`systemctl reload caddy` → "Job failed"** but `caddy validate` says Valid → admin API is off on this box. Use `sudo systemctl restart caddy`.
- **Caddy cert `challenge failed ... NXDOMAIN` for `*.clary.uz`** → Clary's own subdomains without DNS; harmless noise, not ours.
- **`node` misbehaves in the VS Code terminal (local)** → `Remove-Item Env:ELECTRON_RUN_AS_NODE` (PowerShell) or use an external terminal.
- Verify the app itself independent of DNS/TLS: `curl -I http://127.0.0.1:3100` → expect `307 → /login`.
- To distinguish "still propagating" from "registry never delegated it" for any domain: query the TLD's own authoritative NS directly (find it via `whois <domain>` or a known sibling domain on the same TLD), not just the registrar's nameserver.

## Security checklist

- Repo is **public** → keep secrets in gitignored `1997/` only; `.env.production` holds just the anon key.
- Caddy sets HSTS/CSP/`X-Frame-Options`/`-Server`; CSP `connect-src` is pinned to the zsegff Supabase ref; admin block adds `noindex`.
- Node port `3100` binds `127.0.0.1` only (never exposed directly).
- After the demo, **rotate** the `service_role`/`secret` keys + DB password (they were shared in chat) via the Supabase dashboard, then update `1997/supabase-credentials.md`.
