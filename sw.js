const CACHE_NAME = "gestao-territorios-v18-password-notice-only";
const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css?v=18",
  "./app.js?v=18",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png"
];
const FIREBASE_MODULES = [
  "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js",
  "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js",
  "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await cache.addAll(APP_SHELL);
      await Promise.allSettled(
        FIREBASE_MODULES.map(async (url) => {
          const response = await fetch(url, { mode: "cors" });
          if (response.ok) await cache.put(url, response);
        })
      );
    })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put("./index.html", copy));
          return response;
        })
        .catch(() => caches.match("./index.html"))
    );
    return;
  }

  const localAsset = url.origin === self.location.origin;
  const firebaseModule = url.hostname === "www.gstatic.com" && url.pathname.includes("/firebasejs/");

  if (localAsset || firebaseModule) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const update = fetch(request)
          .then((response) => {
            if (response.ok || response.type === "cors") {
              const copy = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
            }
            return response;
          })
          .catch(() => cached);
        return cached || update;
      })
    );
  }
});
