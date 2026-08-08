/*
 * The service worker exists for two reasons, and deliberately does no more.
 *
 * First, a browser will not offer to install a site without one that handles
 * fetch. Second, Next.js emits its JavaScript and CSS under /_next/static/
 * with a content hash in every filename, so those files can never go stale —
 * caching them makes the second visit open at once, on a phone, on a warehouse
 * connection.
 *
 * Everything else goes straight to the network, every time. This is a ledger:
 * a cached balance that is an hour old is worse than a spinner, and an offline
 * page that lets someone type a delivery into a void is worse than both. So
 * pages and API calls are never served from the cache, and the offline
 * fallback says only that there is no connection.
 */

const VERSION = 'idaa-v1';
const ASSETS = `${VERSION}-assets`;
const SHELL = `${VERSION}-shell`;
const OFFLINE_URL = '/offline.html';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((cache) => cache.add(OFFLINE_URL))
      // A missing fallback must not stop the worker installing; without it the
      // site simply loses its install prompt for no good reason.
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => !key.startsWith(VERSION)).map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Hashed build output: the filename changes whenever the contents do, so a
  // hit is always correct and a miss is a one-time cost.
  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ??
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              void caches.open(ASSETS).then((cache) => cache.put(request, copy));
            }
            return response;
          }),
      ),
    );
    return;
  }

  // Navigations: network only, with a page that says so when there is none.
  // Never a cached copy — the figures on it would be from another day.
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)));
  }
});
