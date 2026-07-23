const CACHE_VERSION = 'v4'; // Обязательно меняем версию, чтобы браузер обновил SW
const APP_CACHE = `ug-app-${CACHE_VERSION}`;
const FONT_CACHE = `ug-fonts-v1`; // Кэш шрифтов обновляется редко

// Что кэшируем сразу при установке
const URLS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(APP_CACHE).then(cache => {
      return cache.addAll(URLS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          // Удаляем старые кэши приложения (кроме шрифтов, они статичны)
          if (cacheName.startsWith('ug-app-') && cacheName !== APP_CACHE) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // === СТРАТЕГИЯ 1: Для Google Fonts (Сначала кэш, потом сеть) ===
  // Это уберет моргание шрифтов при повторных заходах
  if (url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com') {
    event.respondWith(
      caches.match(event.request).then(cachedResponse => {
        if (cachedResponse) {
          return cachedResponse; // Отдаем моментально из кэша!
        }
        return fetch(event.request).then(networkResponse => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(FONT_CACHE).then(cache => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        });
      })
    );
    return; // Завершаем обработку для шрифтов
  }

  // === СТРАТЕГИЯ 2: Для самого приложения (Stale-while-revalidate) ===
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      const fetchPromise = fetch(event.request).then(networkResponse => {
        if (event.request.method === 'GET' && networkResponse && networkResponse.status === 200) {
          caches.open(APP_CACHE).then(cache => cache.put(event.request, networkResponse.clone()));
        }
        return networkResponse;
      }).catch(() => {
         // Офлайн режим: просто ничего не делаем, вернется cachedResponse
      });
      return cachedResponse || fetchPromise;
    })
  );
});
