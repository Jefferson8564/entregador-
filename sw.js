// sw.js — Service Worker do Caixa PDV
// Estratégia: network-first para HTML (garante atualização automática),
//             cache-first para tudo mais (ícones, manifest → funciona offline).

const CACHE_NAME = 'caixa-pdv-v1';

const HTML_ASSETS = [
  './',
  './index.html',
];

const STATIC_ASSETS = [
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
];

// ─── INSTALL ────────────────────────────────────────────────
// skipWaiting() garante que este SW assume o controle imediatamente,
// sem ficar preso no estado "waiting" aguardando abas fecharem.
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll([...HTML_ASSETS, ...STATIC_ASSETS]))
      .then(() => self.skipWaiting())
  );
});

// ─── ACTIVATE ───────────────────────────────────────────────
// Limpa caches de versões anteriores e assume controle de todas as abas.
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// ─── FETCH ──────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  if (!event.request.url.startsWith(self.location.origin)) return;

  const url = new URL(event.request.url);
  const isHTML = url.pathname.endsWith('.html') || url.pathname.endsWith('/');

  if (isHTML) {
    // NETWORK-FIRST para HTML:
    // Sempre tenta buscar a versão mais recente na rede.
    // Se offline, cai no cache.
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
  } else {
    // CACHE-FIRST para assets estáticos (ícones, manifest, etc.)
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(response => {
          if (response && response.status === 200 && response.type === 'basic') {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        });
      })
    );
  }
});

// ─── MESSAGE ─────────────────────────────────────────────────
// Recebe o sinal do index.html para pular a fila e ativar imediatamente.
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
