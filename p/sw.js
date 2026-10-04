// Service worker halaman komik: URL cantik /<id> (mis. /p/685584) disajikan
// langsung dari base.html TANPA lewat redirect server (yang menghapus id).
// Aman by design: HANYA menangkap navigasi ke segmen angka murni.
// Sisanya (file, JSON, gambar, base.html sendiri) dibiarkan ke network.
// Anti-gagal: semua jalur buntu berakhir ke fetch network asli,
// jadi tidak akan pernah menghasilkan halaman error sendiri.
var SHELL_CACHE = "comic-shell-v10";
var ID_RE = /^\d+$/;
var SHELL_TIMEOUT_MS = 8000;

function scopeDir() {
    try {
        var p = new URL(self.registration.scope).pathname;
        if (p.charAt(p.length - 1) !== "/") p += "/";
        return p;
    } catch (e) { return "/p/"; }
}

function cachePutShell(resp) {
    if (!resp || !resp.ok) return resp;
    try {
        caches.open(SHELL_CACHE).then(function(c) {
            try { c.put("base.html", resp.clone()); } catch (e) {}
        }).catch(function() {});
    } catch (e) {}
    return resp;
}

function cachedShell() {
    try {
        return caches.open(SHELL_CACHE).then(function(c) {
            return c.match("base.html");
        }).catch(function() { return null; });
    } catch (e) {
        return Promise.resolve(null);
    }
}

function networkShell() {
    return fetch("base.html").then(function(r) {
        if (!r || !r.ok) throw new Error("bad shell");
        return cachePutShell(r);
    });
}

function shellResponse(req) {
    return new Promise(function(resolve) {
        var settled = false;
        function goNetwork() {
            if (settled) return;
            settled = true;
            try { clearTimeout(timer); } catch (e) {}
            var fb;
            try { fb = fetch(req); }
            catch (e) { resolve(cachedShell()); return; }
            resolve(fb.catch(function() { return cachedShell(); }));
        }
        function go(r) {
            if (settled) return null;
            settled = true;
            try { clearTimeout(timer); } catch (e) {}
            try { resolve(r); } catch (e) {}
            return null;
        }
        var timer = setTimeout(function() {
            goNetwork();
        }, SHELL_TIMEOUT_MS);
        networkShell().then(function(r) {
            go(r);
        }).catch(function() {
            cachedShell().then(function(hit) {
                if (hit) { go(hit); return; }
                goNetwork();
            }).catch(function() { goNetwork(); });
        });
    });
}

self.addEventListener("install", function(e) {
    e.waitUntil(
        caches.open(SHELL_CACHE).then(function(c) {
            return fetch("base.html").then(function(r) {
                if (r && r.ok) {
                    try { c.put("base.html", r.clone()); } catch (err) {}
                }
            }).catch(function() {});
        }).then(function() { return self.skipWaiting(); })
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
    try {
        e.respondWith(shellResponse(req));
    } catch (err) {
        /* biarkan network bawaan */
    }
});
