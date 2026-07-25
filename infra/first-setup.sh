#!/usr/bin/env bash
# ============================================================================
# Mubosher web (merycollection.uz) — VPS'da BIRINCHI MARTA sozlash.
#
# Bu skript repo ichida keladi, shuning uchun avval klonlab, keyin ishga
# tushiring (klon bir marta, qo'lda):
#
#   git clone https://github.com/abdullaevmirshohid97-hue/shablon.git /opt/mery
#   cd /opt/mery
#   bash infra/first-setup.sh
#
# Keyingi barcha deploylar: cd /opt/mery && bash infra/deploy.sh
#
# Boshqa loyihalarga (Clary, Luxury/yuseef, Yukchibolla) tegmaydi — faqat
# /opt/mery va pm2 `mery-web`.
# ============================================================================
set -euo pipefail

# Repo ildizi (skript joylashuvidan kelib chiqib — cwd qanday bo'lishidan qat'i nazar)
REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_DIR"

# --- 1. Prod env: FAQAT public anon (publishable) kalit ----------------------
# service_role / secret / DB parol BU YERGA HECH QACHON yozilmaydi — app faqat
# NEXT_PUBLIC_SUPABASE_URL va NEXT_PUBLIC_SUPABASE_ANON_KEY o'qiydi.
if [ ! -f apps/web/.env.production ]; then
  cat > apps/web/.env.production <<'ENV'
NEXT_PUBLIC_SUPABASE_URL=https://zsegffswqmmvehclekji.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpzZWdmZnN3cW1tdmVoY2xla2ppIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ2MDM0NDIsImV4cCI6MjEwMDE3OTQ0Mn0.3OR17nOtPOjCXL5Wk9CmVKIZWlEke5F4zS-e9R6zVSo
ENV
  echo "✓ apps/web/.env.production yaratildi (zsegff, anon)."
else
  echo "• apps/web/.env.production allaqachon bor — tegilmadi."
fi

# --- 2. pm2 (global) ---------------------------------------------------------
if ! command -v pm2 >/dev/null 2>&1; then
  echo "▶ pm2 o'rnatilyapti (global)..."
  npm i -g pm2
fi

# --- 3. Build + ishga tushirish ---------------------------------------------
bash infra/deploy.sh

# --- 4. Reboot'dan keyin avtostart ------------------------------------------
pm2 save
echo ""
echo "✅ Birinchi sozlash tugadi."
echo "   Avtostart uchun bir marta:  pm2 startup   (chiqqan buyruqni bajaring), so'ng: pm2 save"
echo ""
echo "Keyingi qadam: infra/Caddyfile.snippet bloklarini /etc/caddy/Caddyfile ga qo'shing."
