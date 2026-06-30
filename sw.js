const CACHE_NAME = "bolao-copa-v2";
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./supabase-config.js",
  "./manifest.json",
  "./soccer-ball.png"
];

self.addEventListener("install", (event) => {
  // Ativa o novo service worker imediatamente, sem esperar fechar as abas.
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
      )
      // Assume o controle das abas abertas para servir a versao nova na hora.
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin) return;

  // Rede primeiro: sempre tenta a versao mais nova do app. Se estiver offline,
  // cai para o cache. Antes era cache primeiro, o que prendia o usuario numa
  // versao antiga do app.js/styles.css mesmo apos um novo deploy.
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
