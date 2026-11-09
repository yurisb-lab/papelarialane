// Guarda a Central no aparelho para abrir mesmo sem internet.
// Ao mudar qualquer arquivo do app, aumente VERSION para os aparelhos baixarem a versão nova.
const VERSION = 'v1';
const CACHE = `elane-${VERSION}`;
const APP_FILES = [
  './',
  'index.html',
  'css/app.css',
  'css/fonts.css',
  'js/app.js',
  'js/bg-remover.js',
  'js/bg-worker.js',
  'js/card.js',
  'js/cloud.js',
  'js/cloud-config.js',
  'js/db.js',
  'js/editor.js',
  'js/export.js',
  'js/fonts.js',
  'js/fx.js',
  'js/group.js',
  'js/history.js',
  'js/icons.js',
  'js/image.js',
  'js/library.js',
  'js/modal.js',
  'js/notebook.js',
  'js/pdf.js',
  'js/records.js',
  'js/render.js',
  'js/share.js',
  'js/silhouette.js',
  'js/stickers.js',
  'js/templates.js',
  'js/themes.js',
  'js/toast.js',
  'js/views/binder.js',
  'js/views/home.js',
  'js/views/notebooks.js',
  'js/views/pc-panels.js',
  'js/views/photocards.js',
  'js/views/stickers.js',
  'js/views/themes.js',
  'vendor/jspdf.umd.min.js',
  'fonts/bungee-latin.woff2',
  'fonts/caveat-latin.woff2',
  'fonts/dancing-script-latin.woff2',
  'fonts/fredoka-latin.woff2',
  'fonts/lobster-latin.woff2',
  'fonts/nunito-latin.woff2',
  'fonts/pacifico-latin.woff2',
  'fonts/permanent-marker-latin.woff2',
  'fonts/rubik-bubbles-latin.woff2',
  'manifest.webmanifest',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(APP_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('elane-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Usa a versão da internet quando der; sem internet, usa a guardada.
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true }).then((r) => r || caches.match('index.html')))
  );
});
