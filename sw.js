/* Listo service worker: lets the app open with no connection.
   When online it fetches the newest files; when offline (or the network is slow) it uses the saved copy. */
const CACHE = 'listo-shell-v1';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

const keep = (req, res) => { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); return res; };

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const font = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (url.origin !== location.origin && !font) return;

  if (font) { // fonts never change: saved copy first
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => keep(req, res))));
    return;
  }
  // app files: network first, saved copy after 3 seconds or on failure
  e.respondWith((async () => {
    const saved = await caches.match(req, { ignoreSearch: true }) || await caches.match('./index.html');
    const fresh = fetch(req).then(res => res.ok ? keep(req, res) : (saved || res));
    if (!saved) return fresh;
    const slow = new Promise(done => setTimeout(() => done(saved), 3000));
    return Promise.race([fresh.catch(() => saved), slow]);
  })());
});
