const CACHE_VERSION = "7.0.0";
const SHELL_CACHE = `tilawah-shell-${CACHE_VERSION}`;
const MEDIA_CACHE = `tilawah-media-${CACHE_VERSION}`;
const API_CACHE = `tilawah-api-${CACHE_VERSION}`;
const AUDIO_CACHE = `tilawah-audio-${CACHE_VERSION}`;

const CRITICAL_SHELL_FILES = [
  "./",
  "./index.html",
  "./manifest.json",
  "./css/styles.css",
  "./js/data.js",
  "./js/storage.js",
  "./js/scenes.js",
  "./js/audio.js",
  "./js/recorder.js",
  "./js/app.js",
  "./media/catalog.json",
  "./icons/logo.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

const OPTIONAL_PRECACHE_FILES = [
  "./icons/icon-72.png",
  "./icons/icon-96.png",
  "./icons/icon-128.png",
  "./icons/icon-144.png",
  "./icons/icon-152.png",
  "./icons/icon-180.png",
  "./icons/icon-384.png",
  "./icons/icon-512-maskable.png",
  "./media/thumbs/rain_glass.jpg",
  "./media/thumbs/mosque_dawn.jpg",
  "./media/thumbs/forest_stream.jpg",
  "./media/thumbs/starry_night.jpg"
];

async function notifyClients(payload) {
  const clients = await self.clients.matchAll({ includeUncontrolled: true, type: "window" });
  for (const client of clients) {
    client.postMessage(payload);
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then(async (cache) => {
      const failedCritical = [];
      for (const url of CRITICAL_SHELL_FILES) {
        try {
          const res = await fetch(url, { cache: "no-cache" });
          if (!res || !res.ok) {
            failedCritical.push(url);
          } else {
            await cache.put(url, res);
          }
        } catch (err) {
          failedCritical.push(url);
        }
      }

      for (const url of OPTIONAL_PRECACHE_FILES) {
        try {
          await cache.add(url);
        } catch (_) {}
      }

      if (failedCritical.length > 0) {
        await notifyClients({
          type: "SW_CACHE_WARNING",
          failedFiles: failedCritical,
          message: `Kritik uygulama dosyalarından bazıları çevrimdışı önbelleğe alınamadı (${failedCritical.length} dosya).`
        });
      }
    })
  );
});

self.addEventListener("activate", (event) => {
  const allowed = new Set([SHELL_CACHE, MEDIA_CACHE, API_CACHE, AUDIO_CACHE]);
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (!allowed.has(key)) {
            return caches.delete(key);
          }
        })
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (!event.data) return;
  if (event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  } else if (event.data.type === "CHECK_SW_HEALTH") {
    caches.open(SHELL_CACHE).then(async (cache) => {
      const keys = await cache.keys();
      notifyClients({
        type: "SW_HEALTH_REPORT",
        version: CACHE_VERSION,
        cachedShellCount: keys.length,
        expectedCount: CRITICAL_SHELL_FILES.length
      });
    });
  }
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // 1. Quran Text API requests: network-first with strict JSON validation so corrupted/wrong data is never cached
  if (url.hostname.includes("alquran.cloud")) {
    event.respondWith(
      caches.open(API_CACHE).then(async (cache) => {
        try {
          const netRes = await fetch(req);
          if (netRes && netRes.status === 200) {
            const clone = netRes.clone();
            const data = await clone.json().catch(() => null);
            if (data && data.code === 200 && Array.isArray(data.data)) {
              const headers = new Headers(netRes.headers);
              headers.set("X-Tilawah-Source", "network");
              const taggedRes = new Response(JSON.stringify(data), {
                status: 200,
                statusText: "OK",
                headers
              });
              cache.put(req, taggedRes.clone());
              return taggedRes;
            }
          }
        } catch (_) {}

        const cached = await cache.match(req);
        if (cached) {
          const body = await cached.text();
          const headers = new Headers(cached.headers);
          headers.set("X-Tilawah-Source", "sw-cache");
          return new Response(body, { status: 200, headers });
        }
        return new Response(JSON.stringify({ code: 503, status: "offline_miss" }), {
          status: 503,
          headers: { "Content-Type": "application/json", "X-Tilawah-Source": "offline-miss" }
        });
      })
    );
    return;
  }

  // 2. Recitation Audio (everyayah.com): cache-first with content-type/size validation
  if (url.hostname.includes("everyayah.com")) {
    event.respondWith(
      caches.open(AUDIO_CACHE).then(async (cache) => {
        const cached = await cache.match(req);
        if (cached) return cached;
        try {
          const netRes = await fetch(req, { mode: "cors" });
          if (netRes && netRes.status === 200) {
            const cType = netRes.headers.get("content-type") || "";
            if (cType.includes("audio") || cType.includes("mpeg") || cType.includes("octet-stream")) {
              cache.put(req, netRes.clone());
            }
          }
          return netRes;
        } catch (_) {
          return new Response(null, { status: 504, statusText: "Audio Fetch Failed" });
        }
      })
    );
    return;
  }

  // 3. Google Fonts
  if (url.hostname.includes("googleapis.com") || url.hostname.includes("gstatic.com")) {
    event.respondWith(
      caches.open(SHELL_CACHE).then(async (cache) => {
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

  // 4. Local Media & Icons
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
          return cached || new Response(null, { status: 404, statusText: "Media Offline Miss" });
        }
      })
    );
    return;
  }

  // 5. App Shell (HTML, CSS, JS)
  event.respondWith(
    caches.open(SHELL_CACHE).then(async (cache) => {
      const cached = await cache.match(req);
      const netPromise = fetch(req)
        .then((netRes) => {
          if (netRes && netRes.status === 200) {
            cache.put(req, netRes.clone());
          }
          return netRes;
        })
        .catch(() => cached);
      return cached || netPromise;
    })
  );
});
