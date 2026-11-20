/* Notizliste Service Worker – App-Shell, Scanner (zxing) und Texterkennung (tesseract) offline verfügbar */
const VERSION = "notizliste-v2.0.0";
const SHELL = ["./", "./index.html", "./manifest.json", "./icon-192.png", "./icon-512.png", "./apple-touch-icon.png"];
const HEAVY = [
  "./zxing/zxing_reader.wasm",
  "./tess/worker.min.js",
  "./tess/eng.traineddata.gz",
  "./tess/core/tesseract-core-simd-lstm.wasm.js",
  "./tess/core/tesseract-core-simd-lstm.wasm",
  "./tess/core/tesseract-core-lstm.wasm.js",
  "./tess/core/tesseract-core-lstm.wasm",
];

const addAll = async (cache, urls) => {
  await Promise.allSettled(urls.map((u) => cache.add(new Request(u, { cache: "reload" }))));
};

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(VERSION).then(async (cache) => {
      await addAll(cache, SHELL);
      await addAll(cache, HEAVY);
      await self.skipWaiting();
    })
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

const isHeavy = (url) => /\/(zxing|tess)\//.test(url.pathname);

const cacheFirst = async (req) => {
  const cache = await caches.open(VERSION);
  const hit = await cache.match(req, { ignoreSearch: true });
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) cache.put(req, res.clone());
  return res;
};

const networkFirst = async (req, fallbackUrl) => {
  const cache = await caches.open(VERSION);
  try {
    const res = await fetch(req);
    if (res.ok && req.method === "GET") cache.put(req, res.clone());
    return res;
  } catch (err) {
    const hit = (await cache.match(req, { ignoreSearch: true })) || (fallbackUrl && (await cache.match(fallbackUrl)));
    if (hit) return hit;
    throw err;
  }
};

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.includes("/sockjs-node") || url.pathname.includes("hot-update")) return;
  if (isHeavy(url)) return e.respondWith(cacheFirst(req));
  if (req.mode === "navigate") return e.respondWith(networkFirst(req, "./index.html"));
  e.respondWith(networkFirst(req));
});
