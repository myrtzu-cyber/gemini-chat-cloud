// Service Worker para PWA Mestre Gemini Mobile
const CACHE_NAME = 'mestre-gemini-mobile-v2'; // Versão do cache incrementada
const urlsToCache = [
  './',
  './mobile.html',
  './mobile-styles.css',
  './mobile-script.js',
  './manifest.json',
  'https://fonts.googleapis.com/css2?family=Medieval+Sharp:wght@400;700&display=swap'
];

// Instalação do Service Worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Cache aberto');
        return cache.addAll(urlsToCache);
      })
  );
});

// Interceptar requisições
self.addEventListener('fetch', (event) => {
  // Estratégia: Stale-While-Revalidate
  event.respondWith(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.match(event.request).then((cachedResponse) => {
        const fetchedResponsePromise = fetch(event.request).then((networkResponse) => {
          // Se a requisição for bem-sucedida, atualiza o cache
          if (networkResponse && networkResponse.status === 200) {
            cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        });

        // Retorna a resposta do cache imediatamente (se existir), 
        // enquanto a rede busca a nova versão em segundo plano.
        return cachedResponse || fetchedResponsePromise;
      });
    })
  );
});

// Atualização do Service Worker
self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            // Deleta caches antigos
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim()) // Força o SW a assumir controle imediato
  );
});
