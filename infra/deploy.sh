#!/usr/bin/env bash
# ============================================================================
# Mubosher web (merycollection.uz) — VPS'ga bir-buyruqli deploy
#
# MUHIM: bu VPS boshqa loyihalar bilan BIRGA ishlaydi (clary-api, luxury,
# ilova/yukchibolla...). Bu skript FAQAT /opt/mery papkasi va pm2'dagi
# `mery-web` jarayoniga tegadi — boshqa loyihalarga SIRA tegmaydi.
# Caddyfile'ni ham O'ZGARTIRMAYDI (u umumiy fayl) — Caddy blokini
# infra/Caddyfile.snippet dan qo'lda qo'shasiz.
#
# Birinchi marta (serverda, bir marta):
#   git clone https://github.com/abdullaevmirshohid97-hue/shablon.git /opt/mery
#   cd /opt/mery
#   cp apps/web/.env.production.example apps/web/.env.production
#   nano apps/web/.env.production        # haqiqiy Supabase URL + anon key
#   bash infra/deploy.sh
#
# Keyingi deploylar:  cd /opt/mery && bash infra/deploy.sh
# ============================================================================
set -euo pipefail

REPO_DIR="/opt/mery"
WEB_DIR="$REPO_DIR/apps/web"
STANDALONE="$WEB_DIR/.next/standalone"

GREEN='\033[0;32m'; BLUE='\033[0;34m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
log()  { echo -e "${BLUE}▶${NC} $1"; }
ok()   { echo -e "${GREEN}✓${NC} $1"; }
warn() { echo -e "${YELLOW}⚠${NC} $1"; }
die()  { echo -e "${RED}✗ $1${NC}"; exit 1; }

cd "$REPO_DIR"

# --- 1. Kod ---
log "GitHub'dan oxirgi kodni olish (main)..."
git pull --ff-only origin main
ok "Repo yangilandi"

# --- 2. Prod env tekshiruvi (build paytida bundle'ga yopishtiriladi) ---
if [ ! -f "$WEB_DIR/.env.production" ]; then
  die ".env.production yo'q. Avval:
    cp apps/web/.env.production.example apps/web/.env.production
    nano apps/web/.env.production   # Supabase URL + anon key"
fi
ok ".env.production topildi"

# --- 3. Bog'liqliklar (barcha workspace, lockfile bo'yicha) ---
log "npm ci (frozen lockfile)..."
npm ci
ok "Bog'liqliklar o'rnatildi"

# --- 4. Web'ni standalone rejimda build qilish ---
# @mubosher/shared va @mubosher/api-client Next tomonidan source'dan
# transpil qilinadi (transpilePackages) — alohida build kerak emas.
log "Web'ni build qilish (standalone)..."
( cd "$WEB_DIR" && NEXT_OUTPUT_STANDALONE=true npx next build )
ok "Build tugadi"

# --- 5. Standalone tree'ni yig'ish: static + public server.js yoniga ---
log "Statik fayllarni standalone'ga ko'chirish..."
mkdir -p "$STANDALONE/apps/web/.next"
rm -rf "$STANDALONE/apps/web/.next/static"
cp -r "$WEB_DIR/.next/static" "$STANDALONE/apps/web/.next/static"
if [ -d "$WEB_DIR/public" ]; then
  rm -rf "$STANDALONE/apps/web/public"
  cp -r "$WEB_DIR/public" "$STANDALONE/apps/web/public"
fi
ok "Standalone tayyor"

# --- 6. pm2 ---
if pm2 describe mery-web > /dev/null 2>&1; then
  log "mery-web qayta ishga tushirilyapti (pm2)..."
  pm2 restart mery-web --update-env
else
  log "mery-web birinchi marta ishga tushirilyapti (pm2)..."
  pm2 start "$REPO_DIR/infra/ecosystem.config.cjs"
  pm2 save
  warn "Avtostart uchun bir marta:  pm2 startup   (chiqqan buyruqni bajaring)"
fi
ok "mery-web ishlayapti (127.0.0.1:3100)"

echo ""
ok "🚀 Deploy tugadi"
echo ""
echo "Caddy bloklari hali qo'shilmagan bo'lsa (birinchi marta):"
echo "   1) infra/Caddyfile.snippet ichidagi bloklarni /etc/caddy/Caddyfile oxiriga qo'shing"
echo "   2) caddy validate --config /etc/caddy/Caddyfile"
echo "   3) systemctl reload caddy"
echo ""
echo "DNS (o'zingiz sozlaysiz): merycollection.uz, www, app, admin → shu VPS IP (A-record)"
