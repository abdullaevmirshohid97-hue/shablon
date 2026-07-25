import type { NextConfig } from 'next';
import { join } from 'node:path';

const nextConfig: NextConfig = {
  transpilePackages: ['@mubosher/shared', '@mubosher/api-client'],
  // `standalone` bundles a minimal Node server + only the traced deps into
  // .next/standalone — bu VPS'da pm2 orqali ishga tushiriladi (Caddy reverse_proxy).
  output: process.env.NEXT_OUTPUT_STANDALONE === 'true' ? 'standalone' : undefined,
  // Monorepo'da standalone tracing ildizi repo ildizi bo'lishi shart, aks holda
  // workspace paketlari (@mubosher/*) va root node_modules standalone'ga tushmaydi.
  // `next build` cwd = apps/web, shuning uchun ikki bosqich yuqoriga = repo ildizi.
  outputFileTracingRoot: join(process.cwd(), '../../'),
  // Xavfsizlik: `X-Powered-By: Next.js` header'ini olib tashlaymiz (Caddy ham -Server qiladi).
  poweredByHeader: false,
};

export default nextConfig;
