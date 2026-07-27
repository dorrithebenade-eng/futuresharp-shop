// sw.js — Future Shop Leser-app
//
// Doelbewus minimaal: hierdie service worker doen GEEN kasering of
// aflyn-logika nie. Dit bestaan net om aan Chrome/Android se
// installeerbaarheid-vereistes te voldoen (sodat die "Installeer app"
// wenk proaktief wys). Bestaande IndexedDB-aflyn-boekberging in die
// leser bly heeltemal ongeraak.

self.addEventListener("install", (gebeurtenis) => {
  self.skipWaiting();
});

self.addEventListener("activate", (gebeurtenis) => {
  gebeurtenis.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (gebeurtenis) => {
  // Deurloop-versoek — geen kasering, geen aflyn-gedrag nie.
  gebeurtenis.respondWith(fetch(gebeurtenis.request));
});
