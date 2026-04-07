const CACHE_NAME = 'upm-cache-v1';

// Static assets to heavily cache (Cache First)
const STATIC_ASSETS = [
  '/',
  '/static/style.css',
  '/static/neela-tap.css',
  '/static/neela-tap.js',
  '/static/favicon.png',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Use addAll with try catch by mapping individually so one missing icon doesn't crash the worker install
      return Promise.all(
        STATIC_ASSETS.map(url => {
          return cache.add(url).catch(err => console.log(`[ServiceWorker] Install: Failed to cache ${url}`));
        })
      );
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log(`[ServiceWorker] Removing old cache: ${key}`);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') {
    return;
  }
  
  const url = new URL(event.request.url);

  // Exclude dynamic API routes to prevent getting stuck in a processing/finished state
  if (url.pathname.startsWith('/status/') || url.pathname.startsWith('/download/') || url.pathname.startsWith('/create-job') || url.pathname.startsWith('/cleanup/')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // For static assets, Cache First strategy
  if (url.pathname.startsWith('/static/') || url.pathname === '/manifest.json') {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(event.request).then((networkResponse) => {
          if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
            return networkResponse;
          }
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
          return networkResponse;
        });
      })
    );
  } else {
    // For HTML and anything else: Network First, fallback to Cache
    event.respondWith(
      fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
           const responseToCache = networkResponse.clone();
           caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseToCache));
        }
        return networkResponse;
      }).catch(() => {
        return caches.match(event.request);
      })
    );
  }
});
