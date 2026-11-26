/* ============================================================
   tracker.js — Pencatat kunjungan & penonton untuk situs statis

   Cloudflare Pages Function /api/count + D1 (binding DB).
   Semua key dikirim dalam SATU request (hit & get digabung).
   Tidak ada provider lama / fallback CountAPI.

   Endpoint DIHITUNG OTOMATIS:
     - Di domain production      -> endpoint domain itu sendiri (/api/count)
     - Di localhost / 127.0.0.1  -> otomatis ke endpoint production
                                    https://allyoulikecomic.pages.dev/api/count

   Jadi pindah domain = langsung ikut, TANPA edit / tukar-tukar.
   Override manual (opsional, untuk wrangler dev):
     window.VH_API = 'http://127.0.0.1:8788/api/count';
   ============================================================ */
(function (window, document) {
    'use strict';

    var IS_LOCAL = /^(localhost|127\.0\.0\.1|::1)$/.test(window.location.hostname);
    var PROD_API = 'https://allyoulikecomic.pages.dev/api/count';

    function defaultEndpoint() {
        try {
            var script = document.currentScript;
            if (!script) {
                var scripts = document.getElementsByTagName('script');
                for (var i = scripts.length - 1; i >= 0; i--) {
                    if (/tracker\.js/.test(scripts[i].src || '')) { script = scripts[i]; break; }
                }
            }
            if (script && script.src) return new URL('api/count', script.src).href;
        } catch (e) {}
        return new URL('/api/count', window.location.href).href;
    }

    var API = window.VH_API || (IS_LOCAL ? PROD_API : defaultEndpoint());
    var PREFIX = 'comichen';
    var PAGE_NAME = decodeURIComponent((window.location.pathname.split('/').pop() || '').split('?')[0]);
    var started = false;

    /* ---------- Utility ---------- */
    function slug(str) {
        return String(str == null ? '' : str).toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 100);
    }

    function keyOf() {
        var parts = [PREFIX];
        for (var i = 0; i < arguments.length; i++) {
            var s = slug(arguments[i]);
            if (s) parts.push(s);
        }
        return parts.join('_');
    }

    function zeroPad(n) { return n < 10 ? '0' + n : String(n); }

    function isoFor(daysAgo) {
        var d = new Date();
        d.setDate(d.getDate() - (daysAgo || 0));
        return d.getFullYear() + '-' + zeroPad(d.getMonth() + 1) + '-' + zeroPad(d.getDate());
    }

    function dayKey(daysAgo) {
        return keyOf('day', isoFor(daysAgo));
    }

    function isoHourOf(d) {
        return d.getFullYear() + '-' + zeroPad(d.getMonth() + 1) + '-' + zeroPad(d.getDate()) + '-' + zeroPad(d.getHours());
    }

    function fmt(n) {
        n = parseInt(n, 10) || 0;
        return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    }

    /* ---------- Transport ---------- */
    var pending = { hit: [], get: [] };
    var waiters = [];
    var flushTimer = null;

    function enqueue(action, key) {
        return new Promise(function (resolve) {
            key = String(key == null ? '' : key);
            if (!key) { resolve(0); return; }
            pending[action].push(key);
            waiters.push({ action: action, key: key, resolve: resolve });
            if (flushTimer === null) flushTimer = setTimeout(flush, 0);
        });
    }

    function many(action, keys) {
        var list = (keys || []).map(function (k) { return String(k == null ? '' : k); }).filter(Boolean);
        var promises = [];
        // Worker membatasi 200 key per request.
        for (var i = 0; i < list.length; i += 150) {
            for (var j = i; j < Math.min(i + 150, list.length); j++) {
                promises.push(enqueue(action, list[j]));
            }
        }
        return Promise.all(promises);
    }

    function requestCounts(hits, gets) {
        var params = [];
        hits.forEach(function (k) { params.push('hit=' + encodeURIComponent(k)); });
        gets.forEach(function (k) { params.push('get=' + encodeURIComponent(k)); });
        var sep = API.indexOf('?') === -1 ? '?' : '&';
        return fetch(API + sep + params.join('&'), {
            method: 'GET', cache: 'no-store', keepalive: true
        }).then(function (r) {
            if (!r.ok) throw new Error('http ' + r.status);
            return r.json().catch(function () { return {}; });
        }).then(function (j) {
            if (!j || j.ok === false) throw new Error('api error');
            return j.values || {};
        });
    }

    function flush() {
        flushTimer = null;
        var hits = pending.hit.splice(0);
        var gets = pending.get.splice(0);
        var current = waiters.splice(0);
        if (!hits.length && !gets.length) return;

        requestCounts(hits, gets).then(function (values) {
            current.forEach(function (w) {
                w.resolve((values && values[w.key]) || 0);
            });
        }).catch(function (e) {
            console.warn('[VH] batch gagal', e.message);
            current.forEach(function (w) { w.resolve(0); });
        });
    }

    function hit(key) { return enqueue('hit', key); }
    function get(key) { return enqueue('get', key); }

    /* ---------- Public API ---------- */
    window.VH = {
        keyOf: keyOf,
        slug: slug,
        isoFor: isoFor,
        dayKey: dayKey,
        isoHourOf: isoHourOf,
        hit: hit,
        get: get,
        hitMany: function (keys) { return many('hit', keys); },
        getMany: function (keys) { return many('get', keys); },
        fmt: fmt,
        endpoint: API
    };

    /* Video "dibuka" (halaman video dikunjungi) */
    window.VH_hitVideoPage = function (title) {
        return hit(keyOf('video', title));
    };

    /* Video "diputar" (episode benar-benar diputar) */
    window.VH_hitWatch = function (title) {
        return hit(keyOf('watch', title));
    };

    /* Video "dishare" - optimistik update UI dulu */
    window.VH_hitShare = function (title) {
        if (!title) { console.warn('[VH] hitShare tanpa title'); return Promise.resolve(0); }
        var k = keyOf('share', title);
        console.log('[VH] hitShare', title, '->', k);
        var els0 = document.querySelectorAll('.vh-share-el');
        Array.prototype.forEach.call(els0, function (el) {
            var cur = parseInt((el.textContent || '0').replace(/\./g, ''), 10) || 0;
            el.textContent = fmt(cur + 1);
        });
        return hit(k).then(function (v) {
            var els = document.querySelectorAll('.vh-share-el');
            Array.prototype.forEach.call(els, function (el) { el.textContent = fmt(v); });
            console.log('[VH] hitShare ok', k, v);
            return v;
        });
    };

    /* Ambil buka + putar + share dalam SATU request */
    window.VH_fillVideoStats = function (title) {
        if (!title) return;
        many('get', [keyOf('video', title), keyOf('watch', title), keyOf('share', title)])
            .then(function (res) {
                var viewsEls = document.querySelectorAll('.vh-views-el');
                var playedEls = document.querySelectorAll('.vh-played-el');
                var shareEls = document.querySelectorAll('.vh-share-el');
                Array.prototype.forEach.call(viewsEls, function (el) { el.textContent = fmt(res[0]); });
                Array.prototype.forEach.call(playedEls, function (el) { el.textContent = fmt(res[1]); });
                Array.prototype.forEach.call(shareEls, function (el) { el.textContent = fmt(res[2]); });
            });
    };

    /* Badge "sekian kali dilihat" di kartu daftar video (index) */
    window.VH_attachCardCounts = function (gridId, videos) {
        var grid = document.getElementById(gridId);
        if (!grid || !videos || !videos.length) return;
        var cards = Array.prototype.slice.call(grid.querySelectorAll('.video-item'));
        var keys = cards.map(function (card) {
            var url = card.getAttribute('data-url') || '';
            var fname = decodeURIComponent((url.split('/').pop() || '').split('?')[0]);
            var match = null;
            for (var i = 0; i < videos.length; i++) {
                if ((videos[i].link || '').trim() === fname) { match = videos[i]; break; }
            }
            var title = match ? match.title : fname.replace(/\.html$/i, '');
            return keyOf('video', title);
        });
        many('get', keys).then(function (counts) {
            cards.forEach(function (card, i) {
                if (!counts[i]) return;
                var thumb = card.querySelector('.video-thumb-container');
                if (!thumb || thumb.querySelector('.vh-card-count')) return;
                var b = document.createElement('div');
                b.className = 'vh-card-count';
                b.textContent = '\uD83D\uDC41 ' + fmt(counts[i]);
                thumb.appendChild(b);
            });
        });
    };

    /* ---------- CSS kecil ---------- */
    if (!document.getElementById('vh-tracker-style')) {
        var st = document.createElement('style');
        st.id = 'vh-tracker-style';
        st.textContent =
            '.vh-card-count{position:absolute;right:0;bottom:0;padding:4px 8px;' +
            'font-size:11px;font-weight:700;color:#fff;background:rgba(10,10,10,0.88);' +
            'border-radius:4px 0 0 0;border-top:1px solid rgba(162,0,249,0.6);' +
            'border-left:1px solid rgba(162,0,249,0.6);z-index:3;}';
        document.head.appendChild(st);
    }

    /* Tombol dashboard dimatikan sesuai request - tidak tampil di semua html */
    var _oldBtn = document.getElementById('vh-dashboard-btn');
    if (_oldBtn) _oldBtn.remove();

    /* Slug halaman saat ini (dipakai autoTrack + hit baca) */
    function currentPageSlug() {
        var page = PAGE_NAME || 'index';
        if (window.location.pathname.endsWith('/') || !page) page = 'index';
        page = page.replace(/\.html$/i, '') || 'index';
        var lower = page.toLowerCase();
        if (lower === '' || lower === 'index') page = 'index';
        try {
            var qs = new URLSearchParams(window.location.search);
            var qid = (qs.get('id') || qs.get('code') || '').trim().replace(/^#/, '');
            if (qid && lower === 'base') page = qid;
        } catch (e) {}
        return page;
    }

    /* Dibaca: hit saat mode baca dibuka (maks 1x per 60 detik per halaman) */
    window.VH_hitRead = function () {
        try {
            var page = currentPageSlug();
            var tkey = 'vh_read_' + page;
            var last = null;
            try { last = sessionStorage.getItem(tkey); } catch (e) {}
            if (last && Date.now() - parseInt(last, 10) < 60000) return Promise.resolve(0);
            try { sessionStorage.setItem(tkey, String(Date.now())); } catch (e) {}
            return hit(keyOf('read', page));
        } catch (e) { return Promise.resolve(0); }
    };

    /* ---------- Auto-hit kunjungan: SATU request untuk semua key ---------- */
    function autoTrack() {
        if (started) return;
        started = true;
        // jangan hit jika sedang di halaman stats agar tidak mengotori data
        if (window.location.pathname.indexOf('/stats') !== -1 || window.location.pathname.indexOf('/dash/') !== -1) return;
        try {
            var sessKey = 'vh_hit_' + window.location.pathname;
            var last = sessionStorage.getItem(sessKey);
            if (last && Date.now() - parseInt(last, 10) < 2000) {
                console.log('[VH] skip hit (throttle 2s):', window.location.pathname);
                return;
            }
            sessionStorage.setItem(sessKey, String(Date.now()));
        } catch (e) {}

        var now = new Date();
        var monthKey = now.getFullYear() + '-' + zeroPad(now.getMonth() + 1);
        var page = currentPageSlug();
        var keysToHit = [
            keyOf('total'),
            keyOf('day', isoFor(0)),
            keyOf('hour', isoHourOf(now)),
            keyOf('month', monthKey),
            keyOf('page', page)
        ];

        // share count opsional: ikut satu request yang sama
        try {
            var sharedTitle = new URLSearchParams(window.location.search).get('shared');
            if (sharedTitle) keysToHit.push(keyOf('share', sharedTitle));
        } catch (e) {}

        many('hit', keysToHit);
    }

    // Langsung tembak tanpa tunggu DOM (fetch tidak butuh DOM).
    try { autoTrack(); } catch (e) {}
})(window, document);
