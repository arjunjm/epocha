const CACHE = 'epocha-v1';
const STATIC_EXTS = ['.js', '.css', '.svg', '.png', '.woff2', '.woff'];

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(
  caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ).then(() => self.clients.claim())
));

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Network-first for API calls — always want fresh data
  if (url.pathname.startsWith('/api/')) return;

  // Cache-first for static assets
  if (STATIC_EXTS.some(ext => url.pathname.endsWith(ext))) {
    e.respondWith(
      caches.open(CACHE).then(async cache => {
        const cached = await cache.match(e.request);
        if (cached) return cached;
        const fresh = await fetch(e.request);
        if (fresh.ok) cache.put(e.request, fresh.clone());
        return fresh;
      })
    );
    return;
  }

  // Network-first for HTML navigation (SPA shell)
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request).catch(() =>
        caches.match('/') ?? fetch(e.request)
      )
    );
  }
});
