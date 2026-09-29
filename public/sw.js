// Service Worker mínimo para PWA
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Solo cachear la página principal
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => {
        return new Response('Sin conexión', {
          headers: { 'Content-Type': 'text/plain' }
        });
      })
    );
  }
});