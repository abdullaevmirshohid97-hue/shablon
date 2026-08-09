import type { Metadata, Viewport } from 'next';
import { Providers } from './providers';
import { LocaleProvider } from '@/lib/i18n/LocaleProvider';
import { ThemeProvider, themeBootstrapScript } from '@/lib/prefs/ThemeProvider';
import { Header } from '@/components/Header';
import { getServerLocale } from '@/lib/i18n/server';
import './globals.css';

export const metadata: Metadata = {
  title: 'idaa finance — Joriy hisob-kitob',
  description: 'Kontragentlar bilan joriy hisob-kitobni yuritish SaaS tizimi',
  // Next serves app/manifest.ts at this path; naming it here is what puts the
  // link tag in the head, which is what makes the site installable.
  manifest: '/manifest.webmanifest',
  applicationName: 'idaa finance',
  appleWebApp: {
    capable: true,
    title: 'idaa',
    // Black-translucent lets the page colour run under the status bar rather
    // than leaving a grey band above the header.
    statusBarStyle: 'black-translucent',
  },
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    // iOS ignores the manifest and reads only this.
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
};

export const viewport: Viewport = {
  // The installed window's chrome takes this colour.
  themeColor: '#141417',
  // viewport-fit lets the layout reach under a notch once there is no address
  // bar above it.
  viewportFit: 'cover',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getServerLocale();

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        {/* Sets the palette on <html> before the first paint — see
            themeBootstrapScript. Anything later than this is a white flash. */}
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
      </head>
      <body>
        <Providers>
          <ThemeProvider>
            <LocaleProvider initialLocale={locale}>
              <Header />
              {children}
            </LocaleProvider>
          </ThemeProvider>
        </Providers>
      </body>
    </html>
  );
}
