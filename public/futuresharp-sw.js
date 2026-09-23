// futuresharp-sw.js — die Future Sharp-paneel as app
//
// Doelbewus minimaal, soos paneel-sw.js: bestaan net sodat die blaaier die
// paneel as installeerbare app herken. Geen kasering of aflyn-logika nie;
// alles gaan altyd na die netwerk, dus is die data altyd lewendig.
//
// Geregistreer met omvang "/futuresharp", sodat dit nie met die ander areas se
// apps bots nie.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (e) => e.respondWith(fetch(e.request)));
