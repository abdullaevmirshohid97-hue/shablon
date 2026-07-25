// ============================================================================
// pm2 ecosystem — Mubosher web (idaa.uz)
//
// Bu VPS boshqa loyihalar bilan BIRGA ishlaydi (clary-api, luxury, ilova...).
// Bu jarayon nomi `mery-web` — boshqalarga tegmaydi.
//
// Serverda (/opt/mery ichida) birinchi ishga tushirish:
//   pm2 start infra/ecosystem.config.cjs
//   pm2 save          # reboot'dan keyin avtomatik tiklanishi uchun
//   pm2 startup       # (bir marta) systemd bilan avtostart
//
// Keyingi deploylar deploy.sh orqali: pm2 restart mery-web --update-env
// ============================================================================
module.exports = {
  apps: [
    {
      name: 'mery-web',
      // Next.js standalone server. outputFileTracingRoot repo ildizi bo'lgani
      // uchun server.js apps/web ostida turadi.
      script: 'apps/web/.next/standalone/apps/web/server.js',
      cwd: '/opt/mery',
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '512M',
      // .env.production dagi NEXT_PUBLIC_* build paytida bundle'ga yopishtiriladi;
      // bu yerda faqat runtime server sozlamalari.
      env: {
        NODE_ENV: 'production',
        // FAQAT localhost'ga bind — tashqariga Caddy reverse_proxy orqali chiqadi.
        // Node porti (3100) to'g'ridan-to'g'ri internetga ochilmaydi.
        HOSTNAME: '127.0.0.1',
        PORT: '3100',
      },
    },
  ],
};
