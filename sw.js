/* NutriCalc · sw.js
 * Service worker: precachea todos los archivos de la app para que funcione sin conexión
 * cuando se sirve por http/https (por ejemplo, en GitHub Pages). En file:// no se registra.
 *
 * Estrategia: responde desde la caché y, si hay red, actualiza la caché en segundo plano;
 * los cambios publicados se ven en la siguiente recarga. Al agregar o quitar archivos,
 * actualiza la lista ARCHIVOS y sube VERSION.
 */
var VERSION = 'v1';
var CACHE = 'nutricalc-' + VERSION;

var ARCHIVOS = [
  './',
  'index.html',
  'tests.html',
  'manifest.webmanifest',
  'css/fonts.css',
  'css/styles.css',
  'css/print.css',
  'js/data.js',
  'js/calc.js',
  'js/state.js',
  'js/ui.js',
  'vendor/bootstrap/css/bootstrap.min.css',
  'vendor/bootstrap/js/bootstrap.bundle.min.js',
  'vendor/bootstrap-icons/bootstrap-icons.min.css',
  'vendor/bootstrap-icons/fonts/bootstrap-icons.woff2',
  'vendor/bootstrap-icons/fonts/bootstrap-icons.woff',
  'assets/fonts/instrument-sans-latin-400-normal.woff2',
  'assets/fonts/instrument-sans-latin-500-normal.woff2',
  'assets/fonts/instrument-sans-latin-600-normal.woff2',
  'assets/fonts/instrument-sans-latin-700-normal.woff2',
  'assets/fonts/jetbrains-mono-latin-400-normal.woff2',
  'assets/fonts/jetbrains-mono-latin-500-normal.woff2',
  'assets/fonts/jetbrains-mono-latin-700-normal.woff2',
  'assets/icons/favicon.svg',
  'assets/icons/icon-192.png',
  'assets/icons/icon-512.png'
];

self.addEventListener('install', function (ev) {
  ev.waitUntil(
    caches.open(CACHE)
      .then(function (cache) { return cache.addAll(ARCHIVOS); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (ev) {
  ev.waitUntil(
    caches.keys()
      .then(function (claves) {
        return Promise.all(claves
          .filter(function (c) { return c.indexOf('nutricalc-') === 0 && c !== CACHE; })
          .map(function (c) { return caches.delete(c); }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (ev) {
  var req = ev.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  ev.respondWith(
    caches.open(CACHE).then(function (cache) {
      /* ignoreSearch: la fuente de íconos se pide con ?hash en la URL */
      return cache.match(req, { ignoreSearch: true }).then(function (enCache) {
        var deRed = fetch(req)
          .then(function (res) {
            if (res && res.ok) cache.put(req, res.clone());
            return res;
          })
          .catch(function () {
            if (enCache) return enCache;
            if (req.mode === 'navigate') return cache.match('index.html');
            return Response.error();
          });
        if (enCache) {
          ev.waitUntil(deRed);
          return enCache;
        }
        return deRed;
      });
    })
  );
});
