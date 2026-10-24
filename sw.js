// Service worker: keeps the app, its fonts and the map library available offline,
// and serves saved map tiles from the browser cache when there is no signal.
var SHELL = "japan-shell-v3", TILES = "japan-tiles-v3", RUNTIME = "japan-runtime-v3";
var SHELL_URLS = ["./", "./index.html",
  "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css",
  "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"];
self.addEventListener("install", function(e){
  e.waitUntil(caches.open(SHELL).then(function(c){ return Promise.all(SHELL_URLS.map(function(u){ return c.add(u).catch(function(){}); })); }).then(function(){ return self.skipWaiting(); }));
});
self.addEventListener("activate", function(e){
  e.waitUntil(caches.keys().then(function(keys){
    return Promise.all(keys.filter(function(k){ return [SHELL, TILES, RUNTIME].indexOf(k) < 0; }).map(function(k){ return caches.delete(k); }));
  }).then(function(){ return self.clients.claim(); }));
});
self.addEventListener("fetch", function(e){
  var req = e.request;
  if (req.method !== "GET") return;
  var url = req.url;
  // map tiles: saved copy first, then network, saving what comes back
  if (url.indexOf("cyberjapandata.gsi.go.jp/xyz/") >= 0) {
    e.respondWith(caches.open(TILES).then(function(c){
      return c.match(url).then(function(hit){
        if (hit) return hit;
        // a readable copy is checked before storing; if the server does not allow that, pass the tile through unsaved
        return fetch(url, {mode: "cors"}).then(function(r){ if (r.ok) c.put(url, r.clone()); return r; }, function(){ return fetch(req); });
      });
    }));
    return;
  }
  // the page itself: network first so updates arrive, cached copy when offline
  if (req.mode === "navigate" || url.indexOf("index.html") >= 0) {
    e.respondWith(fetch(req).then(function(r){ caches.open(SHELL).then(function(c){ c.put("./index.html", r.clone()); }); return r; })
      .catch(function(){ return caches.match("./index.html"); }));
    return;
  }
  // fonts, map library, artwork and photos: cache first, fill from network
  e.respondWith(caches.match(req).then(function(hit){
    if (hit) return hit;
    return fetch(req).then(function(r){
      if (r && (r.ok || r.type === "opaque")) caches.open(RUNTIME).then(function(c){ c.put(req, r.clone()); });
      return r;
    }).catch(function(){ return hit; });
  }));
});
