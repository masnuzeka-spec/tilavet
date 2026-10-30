const CACHE_VERSION = "v6.0.0";
const SHELL_CACHE = `tilawah-shell-${CACHE_VERSION}`;
const MEDIA_CACHE = `tilawah-media-${CACHE_VERSION}`;
const DATA_CACHE = `tilawah-data-${CACHE_VERSION}`;
const QURAN_CACHE = "tilawah-quran-data-v2";

const APP_SHELL_FILES = [
  "./",
  "./index.html",
  "./manifest.json",
  "./css/core.css",
  "./css/pro-studio.css",
  "./js/core.js",
  "./js/pro-studio.js",
  "./data/templates.json",
  "./media/catalog.json",
  "./icons/logo.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then(async (cache) => {
      for (const url of APP_SHELL_FILES) {
        try {
          await cache.add(url);
        } catch (_) {
          // İsteğe bağlı medya/ikon henüz yüklenmemişse kurulumu kırma
        }
      }
    })
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (![SHELL_CACHE, MEDIA_CACHE, DATA_CACHE, QURAN_CACHE].includes(key)) {
            return caches.delete(key);
          }
        })
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  if (
    url.hostname.includes("alquran.cloud") ||
    url.hostname.includes("everyayah.com") ||
    url.hostname.includes("googleapis.com") ||
    url.hostname.includes("gstatic.com")
  ) {
    event.respondWith(
      caches.open(DATA_CACHE).then(async (cache) => {
        const cached = await cache.match(req);
        if (cached) return cached;
        try {
          const netRes = await fetch(req);
          if (netRes && netRes.status === 200) {
            cache.put(req, netRes.clone());
          }
          return netRes;
        } catch (err) {
          return cached || Response.error();
        }
      })
    );
    return;
  }

  if (url.pathname.includes("/media/") || url.pathname.includes("/icons/")) {
    event.respondWith(
      caches.open(MEDIA_CACHE).then(async (cache) => {
        const cached = await cache.match(req);
        if (cached) return cached;
        try {
          const netRes = await fetch(req);
          if (netRes && netRes.status === 200) {
            cache.put(req, netRes.clone());
          }
          return netRes;
        } catch (_) {
          return cached || Response.error();
        }
      })
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      const fetchPromise = fetch(req)
        .then((netRes) => {
          if (netRes && netRes.status === 200) {
            caches.open(SHELL_CACHE).then((c) => c.put(req, netRes.clone()));
          }
          return netRes;
        })
        .catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
