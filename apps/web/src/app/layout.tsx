import type { Metadata } from 'next';
import { Providers } from './providers';
import { LocaleProvider } from '@/lib/i18n/LocaleProvider';
import { Header } from '@/components/Header';
import { getServerLocale } from '@/lib/i18n/server';
import './globals.css';

export const metadata: Metadata = {
  title: 'idaa finance — Joriy hisob-kitob',
  description: 'Kontragentlar bilan joriy hisob-kitobni yuritish SaaS tizimi',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getServerLocale();

  return (
    <html lang={locale}>
      <body>
        <Providers>
          <LocaleProvider initialLocale={locale}>
            <Header />
            {children}
          </LocaleProvider>
        </Providers>
      </body>
    </html>
  );
}
