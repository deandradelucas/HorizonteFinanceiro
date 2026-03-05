// ============================================================
// LEGEND: Este script pertence ao "Horizonte Financeiro"
// LEGEND (PT): Service Worker para funcionalidade PWA (Progressive Web App).
//   - Cacheia assets estáticos para uso offline
//   - Intercepta requisições fetch para servir do cache
// ============================================================
const CACHE_NAME = 'horizonte-v1.1'; // Incrementado para forçar atualização
const ASSETS = [
  '/login.html',
  '/index.html',
  '/style.css',
  '/script.js'
];

// Evento de instalação: abre o cache e adiciona os arquivos iniciais
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting(); // Força a ativação imediata
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
});

self.addEventListener('fetch', (event) => {
  // Ignora chamadas de API e redirecionamentos da raiz
  if (event.request.url.includes('/api/') || event.request.mode === 'navigate') {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((response) => response || fetch(event.request))
  );
});
