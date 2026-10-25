/* Service worker: lets the site install as an app and open fast / offline.
   Bump VERSION whenever you want every visitor to drop old cached files. */
const VERSION = 'v1';
const SHELL = `shell-${VERSION}`;
const RUNTIME = `runtime-${VERSION}`;
const SHELL_FILES = [
  '/',
  '/manifest.webmanifest',
  '/favicon.svg',
  '/favicon.ico',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png',
];
const MAX_RUNTIME_ENTRIES = 80;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL).then((cache) => cache.addAll(SHELL_FILES)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== SHELL && key !== RUNTIME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

async function trim(cacheName, max) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length > max) await Promise.all(keys.slice(0, keys.length - max).map((key) => cache.delete(key)));
}

// network first, fall back to the cache (pages and the playlist, so edits show up straight away)
async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response && response.ok) cache.put(request, response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) return cached;
    if (request.mode === 'navigate') {
      const shell = await caches.match('/');
      if (shell) return shell;
    }
    throw error;
  }
}

// serve from the cache and refresh it in the background (hashed assets, icons, images, fonts)
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response && (response.ok || response.type === 'opaque')) {
        cache.put(request, response.clone()).then(() => trim(cacheName, MAX_RUNTIME_ENTRIES));
      }
      return response;
    })
    .catch(() => cached);
  return cached || network;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  // never touch audio / video / range requests (streaming songs and videos), the browser handles those
  if (request.headers.has('range') || ['audio', 'video'].includes(request.destination)) return;
  // dev server and Chrome extension requests
  if (url.pathname.startsWith('/@') || url.pathname.startsWith('/src/') || url.pathname.startsWith('/node_modules/')) return;
  if (!/^https?:$/.test(url.protocol)) return;

  const sameOrigin = url.origin === self.location.origin;

  if (request.mode === 'navigate' || (sameOrigin && url.pathname === '/songs.js')) {
    event.respondWith(networkFirst(request, SHELL));
    return;
  }
  if (sameOrigin) {
    event.respondWith(staleWhileRevalidate(request, SHELL));
    return;
  }
  // cross-origin images and fonts (hero photos, Google / CDN fonts, cover art)
  if (['image', 'font', 'style'].includes(request.destination)) {
    event.respondWith(staleWhileRevalidate(request, RUNTIME));
  }
});
