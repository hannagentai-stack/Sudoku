const CACHE_NAME = 'sudoku-v1';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
        return cache.addAll(['/', '/static/css/style.css', '/static/js/script.js', '/static/icon.png']);
    })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => response || fetch(event.request))
  );
});
