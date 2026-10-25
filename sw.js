/* .Py México · permite instalar la app y abrirla rápido.
   Si cambias algún archivo, sube el número de VERSION para que todos reciban la versión nueva. */
const VERSION = 'pymx-v2';
const ARCHIVOS = ['./', 'index.html', 'styles.css?v=2', 'app.js?v=2', 'config.js?v=2', 'privacidad.html', 'manifest.webmanifest', 'fonts/manrope.woff2', 'fonts/fraunces.woff2', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/favicon.svg'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // el servidor de Google siempre va directo
  // Primero la red (para recibir cambios); si no hay internet, lo guardado.
  e.respondWith(
    fetch(req).then(res => {
      if (res && res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req).then(r => r || caches.match('index.html')))
  );
});
