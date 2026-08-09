import type { MetadataRoute } from 'next';

/**
 * What a browser needs before it will offer to install the site.
 *
 * The point is that nobody has to be sent an APK. Chrome on Android and on
 * the desktop reads this, sees a service worker with a fetch handler, and puts
 * "Install" in its own menu — and the header carries a button that triggers
 * the same prompt for people who never open that menu.
 *
 * `display: standalone` is what removes the address bar, which is the whole
 * difference between a bookmark and something that feels like an app.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'idaa finance',
    short_name: 'idaa',
    description: 'Kontragentlar bilan joriy hisob-kitob va ombor tizimi',
    // Root rather than /hub: the front door decides where to send you
    // depending on whether the session is still good.
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'any',
    // Graphite, matching the app chrome — the colour of the phone's status bar
    // once installed.
    theme_color: '#141417',
    background_color: '#FAFAFA',
    lang: 'uz',
    dir: 'ltr',
    categories: ['business', 'finance', 'productivity'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      // Separate file, padded inside its safe zone: Android crops a maskable
      // icon to whatever shape the launcher uses, and an unpadded mark loses
      // its corners.
      {
        src: '/icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    shortcuts: [
      { name: 'Sklad', short_name: 'Sklad', url: '/hub/sklad' },
      { name: 'Kirim', short_name: 'Kirim', url: '/hub/sklad/kirim' },
      { name: 'Chiqim', short_name: 'Chiqim', url: '/hub/sotuv/chiqim' },
    ],
  };
}
