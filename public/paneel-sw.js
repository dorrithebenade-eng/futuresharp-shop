// paneel-sw.js — Future Shop Paneelbord-app
//
// Doelbewus minimaal, soos sw.js vir die koper-kant: bestaan net vir
// PWA-installeerbaarheid, geen kasering of aflyn-logika nie.
//
// LET WEL: word geregistreer met 'n eie omvang ("/paneelbord.html")
// sodat dit nie met die koper-kant se sw.js (omvang "/") bots nie —
// elke area kry sy eie, onafhanklike installeerbare app.

self.addEventListener("install", (gebeurtenis) => {
  self.skipWaiting();
});

self.addEventListener("activate", (gebeurtenis) => {
  gebeurtenis.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (gebeurtenis) => {
  gebeurtenis.respondWith(fetch(gebeurtenis.request));
});
