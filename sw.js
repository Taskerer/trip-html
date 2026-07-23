const CACHE_VERSION = 'v5'; // Обновили версию!
const APP_CACHE = `ug-app-${CACHE_VERSION}`;
const FONT_CACHE = `ug-fonts-v1`;

const URLS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(APP_CACHE).then(cache => cache.addAll(URLS_TO_CACHE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => Promise.all(
      cacheNames.map(cacheName => {
        if (cacheName.startsWith('ug-app-') && cacheName !== APP_CACHE) {
          return caches.delete(cacheName);
        }
      })
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // 1. ЖЕЛЕЗОБЕТОННОЕ КЭШИРОВАНИЕ ШРИФТОВ (С игнорированием Vary)
  if (url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com') {
    event.respondWith(
      // ignoreVary: true - магия, которая чинит баг с оффлайном!
      caches.match(event.request, { ignoreVary: true }).then(cachedResponse => {
        if (cachedResponse) return cachedResponse;

        return fetch(event.request).then(networkResponse => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(FONT_CACHE).then(cache => cache.put(event.request, responseToCache));
          }
          return networkResponse;
        }).catch(() => { /* В оффлайне просто ничего не делаем */ });
      })
    );
    return;
  }

  // 2. КЭШИРОВАНИЕ ОСТАЛЬНОГО ПРИЛОЖЕНИЯ
  event.respondWith(
    caches.match(event.request, { ignoreVary: true }).then(cachedResponse => {
      const fetchPromise = fetch(event.request).then(networkResponse => {
        if (event.request.method === 'GET' && networkResponse && networkResponse.status === 200) {
          caches.open(APP_CACHE).then(cache => cache.put(event.request, networkResponse.clone()));
        }
        return networkResponse;
      }).catch(() => {});
      return cachedResponse || fetchPromise;
    })
  );
});
