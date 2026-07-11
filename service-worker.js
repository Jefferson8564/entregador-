/* Service worker do app do entregador — O Rei da Coxinha
   Estratégia:
   - HTML/JS do próprio app: network-first (sempre busca a versão nova; só usa cache se estiver offline)
   - Bibliotecas externas (MapLibre, Supabase, fontes): cache-first (raramente mudam, carrega mais rápido)
   - Chamadas pro Supabase (dados em tempo real): nunca cacheia, sempre direto na rede

   IMPORTANTE: toda vez que subir uma atualização importante do index.html, mude o número
   da CACHE_VERSION abaixo. Isso força os celulares a limparem o cache antigo e pegarem
   a versão nova na hora, em vez de ficar preso numa versão desatualizada. */

const CACHE_VERSION = 'v1';
const CACHE_NAME = `rei-da-coxinha-entregador-${CACHE_VERSION}`;

const ARQUIVOS_APP = [
  './',
  './index.html',
  './manifest.json',
  './icon-512.png'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ARQUIVOS_APP)).catch(() => {})
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((chaves) =>
      Promise.all(chaves.filter((c) => c !== CACHE_NAME).map((c) => caches.delete(c)))
    ).then(() => self.clients.claim())
  );
});

function ehSupabase(url){
  return url.hostname.endsWith('.supabase.co');
}

function ehBibliotecaExterna(url){
  return url.hostname === 'unpkg.com'
      || url.hostname === 'cdn.jsdelivr.net'
      || url.hostname === 'fonts.googleapis.com'
      || url.hostname === 'fonts.gstatic.com';
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if(req.method !== 'GET') return; // nunca intercepta POST/PATCH (ex: updates no Supabase)

  const url = new URL(req.url);

  // dados em tempo real: sempre direto na rede, nunca cacheado
  if(ehSupabase(url)) return;

  // bibliotecas externas fixas por versão na URL: cache-first
  if(ehBibliotecaExterna(url)){
    event.respondWith(
      caches.match(req).then((cacheado) => {
        if(cacheado) return cacheado;
        return fetch(req).then((resp) => {
          const clone = resp.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          return resp;
        });
      })
    );
    return;
  }

  // arquivos do próprio app (HTML/JS/ícones): network-first, com fallback pro cache se cair offline
  event.respondWith(
    fetch(req).then((resp) => {
      const clone = resp.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
      return resp;
    }).catch(() => caches.match(req).then((cacheado) => cacheado || caches.match('./index.html')))
  );
});
