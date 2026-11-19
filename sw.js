// Guarda a Central no aparelho para abrir mesmo sem internet.
// Ao mudar qualquer arquivo do app, aumente VERSION para os aparelhos baixarem a versão nova.
const VERSION = 'v9';
const CACHE = `elane-${VERSION}`;
const APP_FILES = [
  './',
  'index.html',
  'css/app.css',
  'css/fonts.css',
  'css/themes.css',
  'js/app.js',
  'js/backup.js',
  'js/bg-remover.js',
  'js/bg-worker.js',
  'js/brush.js',
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
  'js/mockup.js',
  'js/notebook.js',
  'js/pdftools.js',
  'js/pdf.js',
  'js/qr.js',
  'js/records.js',
  'js/render.js',
  'js/share.js',
  'js/silhouette.js',
  'js/stickers.js',
  'js/templates.js',
  'js/theme.js',
  'js/themes.js',
  'js/toast.js',
  'js/views/backup.js',
  'js/views/binder.js',
  'js/views/button-preview.js',
  'js/views/home.js',
  'js/views/notebooks.js',
  'js/views/pdf.js',
  'js/views/pc-panels.js',
  'js/views/photocards.js',
  'js/views/stickers.js',
  'js/views/themes.js',
  'vendor/jspdf.umd.min.js',
  'vendor/pdf-lib.min.js',
  'vendor/pdf.min.js',
  'vendor/pdf.worker.min.js',
  'vendor/jszip.min.js',
  'vendor/qrcode.mjs',
  'fonts/bungee-latin.woff2',
  'fonts/caveat-latin.woff2',
  'fonts/dancing-script-latin.woff2',
  'fonts/figtree-latin.woff2',
  'fonts/fraunces-italic-latin.woff2',
  'fonts/fraunces-latin.woff2',
  'fonts/fredoka-latin.woff2',
  'fonts/lobster-latin.woff2',
  'fonts/nunito-latin.woff2',
  'fonts/pacifico-latin.woff2',
  'fonts/permanent-marker-latin.woff2',
  'fonts/rubik-bubbles-latin.woff2',
  'fonts/great-vibes-latin.woff2',
  'fonts/pinyon-script-latin.woff2',
  'fonts/allura-latin.woff2',
  'fonts/parisienne-latin.woff2',
  'fonts/alex-brush-latin.woff2',
  'fonts/italianno-latin.woff2',
  'fonts/monsieur-la-doulaise-latin.woff2',
  'fonts/mrs-saint-delafield-latin.woff2',
  'fonts/corinthia-latin.woff2',
  'fonts/birthstone-latin.woff2',
  'fonts/sacramento-latin.woff2',
  'fonts/satisfy-latin.woff2',
  'fonts/yellowtail-latin.woff2',
  'fonts/kaushan-script-latin.woff2',
  'fonts/damion-latin.woff2',
  'fonts/playball-latin.woff2',
  'fonts/cormorant-garamond-latin.woff2',
  'fonts/playfair-display-latin.woff2',
  'fonts/bodoni-moda-latin.woff2',
  'fonts/cinzel-latin.woff2',
  'fonts/cinzel-decorative-latin.woff2',
  'fonts/italiana-latin.woff2',
  'fonts/gilda-display-latin.woff2',
  'fonts/dm-serif-display-latin.woff2',
  'fonts/yeseva-one-latin.woff2',
  'fonts/abril-fatface-latin.woff2',
  'fonts/montserrat-latin.woff2',
  'fonts/josefin-sans-latin.woff2',
  'fonts/raleway-latin.woff2',
  'fonts/jost-latin.woff2',
  'fonts/tenor-sans-latin.woff2',
  'fonts/baloo-2-latin.woff2',
  'fonts/chewy-latin.woff2',
  'fonts/titan-one-latin.woff2',
  'fonts/bagel-fat-one-latin.woff2',
  'fonts/grandstander-latin.woff2',
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
