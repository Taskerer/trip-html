const CACHE_VERSION = 'v18';
const APP_CACHE = `ug-app-${CACHE_VERSION}`;
const FONT_CACHE = `ug-fonts-v2`; // Обновляем кэш шрифтов

const URLS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
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
        // Удаляем ВСЕ старые кэши, кроме актуальных APP_CACHE и FONT_CACHE
        if (cacheName !== APP_CACHE && cacheName !== FONT_CACHE) {
          return caches.delete(cacheName);
        }
      })
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // 1. ЖЕЛЕЗОБЕТОННОЕ КЭШИРОВАНИЕ ШРИФТОВ
  if (url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com') {
    event.respondWith(
      caches.match(event.request, { ignoreVary: true }).then(cachedResponse => {
        if (cachedResponse) return cachedResponse;

        return fetch(event.request).then(networkResponse => {
          // ИСПРАВЛЕНИЕ: Разрешаем сохранять ответы со статусом 0 (Opaque responses)
          if (networkResponse && (networkResponse.status === 200 || networkResponse.status === 0)) {
            const responseToCache = networkResponse.clone();
            caches.open(FONT_CACHE).then(cache => cache.put(event.request, responseToCache));
          }
          return networkResponse;
        }).catch(() => { /* В оффлайне тихо игнорируем ошибку сети */ });
      })
    );
    return;
  }

  // 2. КЭШИРОВАНИЕ ОСТАЛЬНОГО ПРИЛОЖЕНИЯ
  event.respondWith(
    caches.match(event.request, { ignoreVary: true }).then(cachedResponse => {
      const fetchPromise = fetch(event.request).then(networkResponse => {
        if (event.request.method === 'GET' && networkResponse && (networkResponse.status === 200 || networkResponse.status === 0)) {
          caches.open(APP_CACHE).then(cache => cache.put(event.request, networkResponse.clone()));
        }
        return networkResponse;
      }).catch(() => {});
      return cachedResponse || fetchPromise;
    })
  );
});
