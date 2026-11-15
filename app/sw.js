// Service worker para o modo offline (K1). Só roda quando o app é servido
// numa página própria ou empacotado como APK; dentro do claude.ai é ignorado.
const CACHE = "rbt-v0.9.1";
const FILES = ["./", "index.html", "css/app.css", "js/app.js", "js/data.js", "js/store.js", "js/stats.js", "js/ui.js", "js/core.js", "js/register.js", "js/live.js", "js/views.js", "js/analysis.js", "js/share.js", "js/onboard.js",
  "icon.svg", "manifest.webmanifest", "fonts/press-start-2p-latin-400-normal.woff2", "fonts/jersey-10-latin-400-normal.woff2"];
self.addEventListener("install", (e) => e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting())));
self.addEventListener("activate", (e) => e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => {
    const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); return res;
  }).catch(() => caches.match("index.html"))));
});
