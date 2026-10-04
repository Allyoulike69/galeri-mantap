// Service worker halaman komik: URL cantik /<id> (mis. /p/685584) disajikan
// langsung dari base.html TANPA lewat redirect server (yang menghapus id).
// Aman by design: HANYA menangkap navigasi ke segmen angka murni.
// Sisanya (file, JSON, gambar, base.html sendiri) dibiarkan ke network.
var SHELL_CACHE = "comic-shell-v9";
var ID_RE = /^\d+$/;

function scopeDir() {
    try {
        var p = new URL(self.registration.scope).pathname;
        if (p.charAt(p.length - 1) !== "/") p += "/";
        return p;
    } catch (e) { return "/p/"; }
}

function shellResponse() {
    return caches.open(SHELL_CACHE).then(function(c) {
        return fetch("base.html").then(function(r) {
            if (r && r.ok) {
                try { c.put("base.html", r.clone()); } catch (e) {}
            }
            return r;
        }).catch(function() {
            return c.match("base.html");
        });
    });
}

self.addEventListener("install", function(e) {
    e.waitUntil(
        shellResponse()
            .then(function() { return self.skipWaiting(); })
            .catch(function() { return self.skipWaiting(); })
    );
});

self.addEventListener("activate", function(e) {
    e.waitUntil(
        caches.keys().then(function(keys) {
            return Promise.all(keys.map(function(k) {
                if (k !== SHELL_CACHE) return caches.delete(k);
                return Promise.resolve(true);
            }));
        }).then(function() {
            return self.clients.claim();
        }).catch(function() {})
    );
});

self.addEventListener("fetch", function(e) {
    var req = e.request;
    if (!req || req.method !== "GET" || req.mode !== "navigate") return;
    var rel = "";
    try {
        var u = new URL(req.url);
        var dir = scopeDir();
        if (u.pathname.indexOf(dir) !== 0) return;
        rel = u.pathname.slice(dir.length).split("?")[0].split("#")[0];
        if (rel === "" || rel.indexOf(".") !== -1) return;
        if (!ID_RE.test(rel)) return;
    } catch (err) { return; }
    e.respondWith(shellResponse());
});
