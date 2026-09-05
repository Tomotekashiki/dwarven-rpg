const CACHE_NAME = "dwarven-rpg-v1.1.1";
const ASSETS_TO_CACHE = [
  "./",
  "./index.html",
  "./manifest.json",
  "./style.css",
  "./app.js?v=1.1.1",
  "./game.swf?v=1.1.1",
  "./favicon.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-180.png",
  "./ruffle/ruffle.js",
  "./ruffle/core.ruffle.15317142e75ce021ac04.js",
  "./ruffle/core.ruffle.5e30dc5777a75720eae2.js"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("[Service Worker] Caching core assets...");
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log("[Service Worker] Purging old cache:", key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  // Safari / iOS WebKit Bug Fix:
  // WebAssembly streaming instantiation fails if intercepted by Service Worker synthetic response.
  // We let the browser fetch .wasm files natively via HTTP/HTTPS directly.
  if (event.request.url.includes(".wasm")) {
    return;
  }

  // Network-First for app.js and game.swf so code and game updates apply immediately
  if (event.request.url.includes("app.js") || event.request.url.includes("game.swf")) {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return networkResponse;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && event.request.method === "GET") {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return networkResponse;
      });
    }).catch(() => {
      return caches.match("./index.html");
    })
  );
});
