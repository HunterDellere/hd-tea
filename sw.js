/* hd-tea — service worker
 *
 * Strategy (mirrors jiaoluo-shuwu):
 *   - Install: pre-cache the shell (styles, scripts, data, manifest, icons).
 *   - Fetch (HTML): network-first, fall back to cache.
 *   - Fetch (other same-origin GET): stale-while-revalidate.
 *   - Cross-origin (Google Fonts): runtime cache so offline reading works.
 */
const VERSION = 'hd-tea-v1';
const SHELL_CACHE = `${VERSION}-shell`;
const RUNTIME_CACHE = `${VERSION}-runtime`;

const SHELL_ASSETS = [
  './',
  './index.html',
  './style.css',
  './tokens.css',
  './scripts/homepage.js',
  './scripts/toc-scroll.js',
  './scripts/theme.js',
  './data/entries.json',
  './data/search-index.json',
  './manifest.webmanifest',
  './icons/favicon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_ASSETS).catch(() => null))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

function isHtmlRequest(req) {
  return req.mode === 'navigate' ||
    (req.method === 'GET' && (req.headers.get('accept') || '').includes('text/html'));
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // HTML: network-first
  if (isHtmlRequest(req)) {
    event.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(RUNTIME_CACHE).then((c) => c.put(req, copy));
        return res;
      }).catch(() => caches.match(req).then((hit) => hit || caches.match('./index.html')))
    );
    return;
  }

  // Same-origin assets + fonts: stale-while-revalidate
  if (url.origin === location.origin || url.hostname.endsWith('gstatic.com') || url.hostname.endsWith('googleapis.com')) {
    event.respondWith(
      caches.match(req).then((hit) => {
        const refresh = fetch(req).then((res) => {
          caches.open(RUNTIME_CACHE).then((c) => c.put(req, res.clone()));
          return res;
        }).catch(() => hit);
        return hit || refresh;
      })
    );
  }
});
