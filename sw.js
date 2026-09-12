'use strict';
// Bump VERSION whenever ANY of the three files changes. Deploy them together.
// Assets are pinned as a set: keep old tabs on their worker until they close.
const VERSION = '1.0.0';
const SCOPE = self.registration.scope;
const PREFIX = 'read-chinese:' + SCOPE + ':';
const CACHE = PREFIX + VERSION;
const url = path => new URL(path, SCOPE).href;
const INDEX = url('index.html');
const ASSETS = [INDEX, url('manifest.json'), url('sw.js')];

self.addEventListener('install', event => {
  // All-or-nothing install. index.html includes PDF.js, its worker, all CMaps,
  // standard fonts, Mammoth, styles, and icons; no CDN assets need warming.
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(ASSETS.map(asset => new Request(asset, {cache:'reload'})));
    // No skipWaiting(): an update must not mix new assets into an old open tab.
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      // Only this app's scope owns these caches.
      if (key.startsWith(PREFIX) && key !== CACHE) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const requested = new URL(request.url);
  if (requested.origin !== self.location.origin) return;
  const isEntry = requested.pathname === new URL(SCOPE).pathname || requested.pathname === new URL(INDEX).pathname;
  const canonical = isEntry ? INDEX : requested.origin + requested.pathname;
  // Do not turn unrelated requests or missing files into HTML responses.
  if (!ASSETS.includes(canonical)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(canonical);
    if (cached) return cached;
    try {
      const response = await fetch(request);
      if (response.ok && response.type === 'basic') {
        try { await cache.put(canonical, response.clone()); } catch { /* Storage may be full. */ }
      }
      return response;
    } catch {
      return new Response('The app is not cached yet. Reconnect and open it once to enable offline access.', {
        status:503, headers:{'Content-Type':'text/plain; charset=utf-8'}
      });
    }
  })());
});
