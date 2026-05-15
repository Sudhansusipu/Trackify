const CACHE_NAME = 'trackify-todo-v1';
const urlsToCache = [
  '/',
  '/todo.html',
  '/css/style.css',
  '/js/script.js',
  'https://cdn.jsdelivr.net/npm/chart.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) return response;
        return fetch(event.request).catch(() => {
          // Fallback logic could go here
        });
      })
  );
});
