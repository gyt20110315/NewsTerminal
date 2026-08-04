/// NewsTerminal Service Worker — PWA offline support
const CACHE_NAME = 'newsterminal-v5';
const MAX_CACHE_ITEMS = 200;

// Derive scope-relative paths so the SW works under a subpath (GitHub Pages).
const BASE = new URL('./', self.location).pathname;
const PRECACHE_URLS = [
  BASE,
  `${BASE}manifest.json`,
  `${BASE}sw.js`,
  `${BASE}icons/icon-192.png`,
  `${BASE}icons/icon-512.png`,
];

// Install: precache essential assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

// Activate: clean old caches and take control immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((names) =>
        Promise.all(
          names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))
        )
      ),
      self.clients.claim(),
    ])
  );
});

// Helper: limit cache size
async function trimCache(cacheName, maxItems) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length > maxItems) {
    const toDelete = keys.slice(0, keys.length - maxItems);
    await Promise.all(toDelete.map((req) => cache.delete(req)));
  }
}

// Network-first with cache fallback
self.addEventListener('fetch', (event) => {
  if (
    event.request.method !== 'GET' ||
    event.request.url.includes('/api/') ||
    event.request.url.includes('/ws') ||
    event.request.url.includes('chrome-extension://')
  ) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, clone);
            trimCache(CACHE_NAME, MAX_CACHE_ITEMS);
          });
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
