const CACHE_NAME = "piggy-bank-v20";
const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css?v=20",
  "./app.js?v=20",
  "./manifest.webmanifest?v=20",
  "./assets/creative-coin-logo.png",
  "./assets/little-saver-pig.png",
  "./assets/little-saver-pig-icon.png",
  "./assets/balance-pig.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
