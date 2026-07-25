# Mubosher — VPS deploy qo'llanmasi (merycollection.uz)

Bu qo'llanma Mubosher web-ilovasini (Next.js) mavjud VPS'ga — Clary, Luxury
Textile va Yukchibolla/ilova bilan **yonma-yon** — joylashtirishni tushuntiradi.
Boshqa loyihalarga tegilmaydi.

## Arxitektura

```
                         Internet (443/TLS)
                               │
                        ┌──────▼──────┐   avtomatik Let's Encrypt SSL
                        │    Caddy     │   /etc/caddy/Caddyfile (umumiy)
                        └──────┬──────┘
        merycollection.uz ─────┤
    www.merycollection.uz ─────┤  reverse_proxy 127.0.0.1:3100
    app.merycollection.uz ─────┤
  admin.merycollection.uz ─────┘
                               │
                     ┌─────────▼──────────┐
                     │  pm2: mery-web      │  Next.js standalone server
                     │  127.0.0.1:3100     │  (faqat localhost'ga bind)
                     └─────────┬──────────┘
                               │
                        Supabase (managed)  — auth, DB (RLS), realtime
```

- **Bitta** Next.js jarayoni uchala subdomenga xizmat qiladi. Kim qaysi subdomenga
  kirgani ilova ichida ajratiladi:
  - `app.merycollection.uz` — mijozlar (SaaS tenant) ilovasi.
  - `admin.merycollection.uz` — super-admin (`profiles.role_platform = 'platform_admin'`).
    Panel `noindex` + `no-referrer` bilan yopiq.
  - `merycollection.uz` — asosiy domen (hozircha ilovaning o'zi; keyin alohida
    marketing-landing qo'yish mumkin).
- Backend — Supabase (managed), VPS'da DB yo'q. Xavfsizlikning asosiy qatlami —
  Supabase **RLS** (Row Level Security) va rollar.

## Portlar (VPS'da band bo'lganlar bilan to'qnashmasligi uchun)

| Loyiha           | Port     |
| ---------------- | -------- |
| Clary API        | 4000     |
| **Mubosher web** | **3100** |

> Port 3100 faqat `127.0.0.1`'ga bind qilinadi (`ecosystem.config.cjs`),
> to'g'ridan-to'g'ri internetga ochilmaydi.

## Talablar (serverda bir marta)

- Node.js 20.x (`node -v` → v20), npm 10.
- pm2 (`npm i -g pm2`).
- Caddy (allaqachon o'rnatilgan — Clary ishlatyapti).

## Birinchi deploy (bir marta)

```bash
# 1) Kodni klon qilish
git clone https://github.com/abdullaevmirshohid97-hue/shablon.git /opt/mery
cd /opt/mery

# 2) Prod env (PUBLIC anon kalitlar — service_role EMAS)
cp apps/web/.env.production.example apps/web/.env.production
nano apps/web/.env.production
#   NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
#   NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...

# 3) Build + pm2 ishga tushirish
bash infra/deploy.sh

# 4) Reboot'dan keyin avtostart (bir marta)
pm2 startup        # chiqqan buyruqni bajaring
pm2 save
```

## Caddy bloklarini qo'shish (bir marta)

`infra/Caddyfile.snippet` ichidagi **4 blokni** umumiy `/etc/caddy/Caddyfile`
oxiriga qo'shing. Boshqa loyiha bloklariga tegmang.

```bash
sudo cp /etc/caddy/Caddyfile /etc/caddy/Caddyfile.bak-$(date +%F)   # zaxira
sudo nano /etc/caddy/Caddyfile                                      # bloklarni qo'shing
caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

## DNS (o'zingiz sozlaysiz)

Quyidagi A-record'lar VPS IP'siga to'g'ri kelsin:

| Nom     | Tur | Qiymat     |
| ------- | --- | ---------- |
| `@`     | A   | `<VPS_IP>` |
| `www`   | A   | `<VPS_IP>` |
| `app`   | A   | `<VPS_IP>` |
| `admin` | A   | `<VPS_IP>` |

DNS tarqalgach Caddy SSL'ni avtomatik oladi (certbot kerak emas).

## Keyingi deploylar (har yangilanishda)

```bash
cd /opt/mery && bash infra/deploy.sh
```

`git pull` → `npm ci` → standalone build → `pm2 restart mery-web`.

## Foydali buyruqlar

```bash
pm2 status mery-web
pm2 logs mery-web --lines 100
pm2 restart mery-web --update-env
curl -I http://127.0.0.1:3100        # jarayon javob beryaptimi
```

## Xavfsizlik (namuna loyihalar bilan bir xil qoidalar)

- **HTTPS majburiy** — Caddy avtomatik TLS + HSTS (`preload`).
- **Xavfsizlik header'lari** har blokda: `X-Content-Type-Options`,
  `X-Frame-Options: DENY` / `frame-ancestors 'none'`, `Referrer-Policy`,
  `Permissions-Policy`, `Content-Security-Policy`, `-Server`.
- **Admin paneli** `X-Robots-Tag: noindex, nofollow` + `Referrer-Policy: no-referrer`
  bilan qidiruvdan va embed'dan yopiq. Kirish — Supabase Auth + super-admin roli.
- **Node porti internetga ochilmaydi** — faqat `127.0.0.1:3100`, Caddy orqali.
- **Maxfiy kalitlar repoda yo'q** — `.env.production` gitignore'da; faqat PUBLIC
  (anon/publishable) kalitlar ishlatiladi. `service_role` kaliti hech qachon
  frontendga/repoga qo'yilmaydi.
- **Ma'lumot xavfsizligi** — Supabase RLS orqali (har tenant faqat o'z ma'lumotini
  ko'radi). Bu deploy'dan alohida, DB migratsiyalarida ta'minlanadi.

### Tavsiya (qo'shimcha qat'iylik uchun)

- CSP'dagi `https://*.supabase.co` o'rniga aniq project-ref yozib qo'ying
  (masalan `https://<ref>.supabase.co wss://<ref>.supabase.co`).
- UFW/firewall: faqat 22 (SSH), 80, 443 ochiq; 3100 va boshqa app portlari
  tashqaridan yopiq bo'lsin.
