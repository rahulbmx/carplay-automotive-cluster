const CACHE_NAME = 'autocluster-v2.2';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './styles.css?v=2.2',
  './lookup-table.js?v=2.2',
  './audio.js?v=2.2',
  './weather.js?v=2.2',
  './app.js?v=2.2',
  './manifest.json?v=2.2',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Network first for HTML and dynamic scripts to avoid stale cache
  if (event.request.mode === 'navigate' || event.request.url.includes('index.html') || event.request.url.includes('.js') || event.request.url.includes('.css')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      return cachedResponse || fetch(event.request);
    })
  );
});
