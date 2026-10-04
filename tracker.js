/* ============================================================
   tracker.js — Pencatat kunjungan & penonton untuk situs statis
   Menggunakan CountAPI (countapi.mileshilliard.com)
   Gratis, tanpa daftar, tanpa API key. CORS terbuka (*)
   Catatan: angka counter bersifat publik & bisa dinaikkan orang.
   ============================================================ */
(function (window, document) {
    'use strict';

    var API = 'https://countapi.mileshilliard.com/api/v1';
    var PREFIX = 'comichen';
    var PAGE_NAME = decodeURIComponent((window.location.pathname.split('/').pop() || '').split('?')[0]);
    var started = false;

    /* ---------- Utility ---------- */
    function http(action, key, retries) {
        retries = retries || 1;
        function doFetch(attempt){
            return fetch(API + '/' + action + '/' + encodeURIComponent(key), {
                method: 'GET', cache: 'no-store', keepalive: true
            }).then(function (r) {
                if(!r.ok) throw new Error('http '+r.status);
                return r.json().catch(function () { return {}; });
            }).then(function (j) {
                var v = parseInt(j && j.value, 10);
                return isNaN(v) ? 0 : v;
            }).catch(function (e) {
                if(attempt < retries){
                    return new Promise(function(res){ setTimeout(function(){ res(doFetch(attempt+1)); }, 400); });
                }
                console.warn('[VH] http fail', action, key, e.message);
                return 0;
            });
        }
        return doFetch(0);
    }

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

    /* ---------- Public API ---------- */
    window.VH = {
        keyOf: keyOf,
        slug: slug,
        isoFor: isoFor,
        dayKey: dayKey,
        isoHourOf: isoHourOf,
        hit: http.bind(null, 'hit'),
        get: http.bind(null, 'get'),
        fmt: fmt
    };

    /* Video "dibuka" (halaman video dikunjungi) */
    window.VH_hitVideoPage = function (title) {
        return http('hit', keyOf('video', title));
    };

    /* Video "diputar" (episode benar-benar diputar) */
    window.VH_hitWatch = function (title) {
        return http('hit', keyOf('watch', title));
    };

    /* Video "dishare" - pakai keepalive + retry biar tidak hilang saat popup */
    window.VH_hitShare = function (title) {
        if(!title) { console.warn('[VH] hitShare tanpa title'); return Promise.resolve(0); }
        var k=keyOf('share', title);
        console.log('[VH] hitShare', title, '->', k);
        // optimistik update UI dulu
        var els0=document.querySelectorAll('.vh-share-el');
        Array.prototype.forEach.call(els0, function(el){
            var cur=parseInt((el.textContent||'0').replace(/\./g,''),10)||0;
            el.textContent=fmt(cur+1);
        });
        return fetch(API + '/hit/' + encodeURIComponent(k), {method:'GET', cache:'no-store', keepalive:true})
            .then(function(r){ return r.json().catch(function(){return {};}); })
            .then(function(j){ var v=parseInt(j && j.value,10); if(isNaN(v)) v=0; var els=document.querySelectorAll('.vh-share-el'); Array.prototype.forEach.call(els, function(el){ el.textContent=fmt(v); }); console.log('[VH] hitShare ok',k,v); return v; })
            .catch(function(e){ console.warn('[VH] hitShare gagal',k,e); return 0; });
    };

    /* Ambil jumlah buka + putar + share, lalu tampilkan di elemen .vh-views-el / .vh-played-el / .vh-share-el */
    window.VH_fillVideoStats = function (title) {
        if (!title) return;
        Promise.all([
            http('get', keyOf('video', title)),
            http('get', keyOf('watch', title)),
            http('get', keyOf('share', title))
        ]).then(function (res) {
            var viewsEls = document.querySelectorAll('.vh-views-el');
            var playedEls = document.querySelectorAll('.vh-played-el');
            var shareEls = document.querySelectorAll('.vh-share-el');
            Array.prototype.forEach.call(viewsEls, function (el) { el.textContent = fmt(res[0]); });
            Array.prototype.forEach.call(playedEls, function (el) { el.textContent = fmt(res[1]); });
            Array.prototype.forEach.call(shareEls, function (el) { el.textContent = fmt(res[2]); });
        });
    };

    /* Pasang badge "sekian kali dilihat" di kartu daftar video (index) */
    window.VH_attachCardCounts = function (gridId, videos) {
        var grid = document.getElementById(gridId);
        if (!grid || !videos || !videos.length) return;
        Array.prototype.forEach.call(grid.querySelectorAll('.video-item'), function (card) {
            var url = card.getAttribute('data-url') || '';
            var fname = decodeURIComponent((url.split('/').pop() || '').split('?')[0]);
            var match = null;
            for (var i = 0; i < videos.length; i++) {
                if ((videos[i].link || '').trim() === fname) { match = videos[i]; break; }
            }
            var title = match ? match.title : fname.replace(/\.html$/i, '');
            http('get', keyOf('video', title)).then(function (n) {
                if (!n) return;
                var thumb = card.querySelector('.video-thumb-container');
                if (!thumb || thumb.querySelector('.vh-card-count')) return;
                var b = document.createElement('div');
                b.className = 'vh-card-count';
                b.textContent = '\uD83D\uDC41 ' + fmt(n);
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
    var _oldBtn=document.getElementById('vh-dashboard-btn');
    if(_oldBtn) _oldBtn.remove();
    // if (window.location.pathname.indexOf('/stats') === -1 && !document.getElementById('vh-dashboard-btn')) { ... } - dihapus

    /* Slug halaman saat ini (dipakai autoTrack + hit baca) */
    function currentPageSlug() {
        var page = PAGE_NAME || 'index';
        if (window.location.pathname.endsWith('/') || !page) page = 'index';
        page = page.replace(/\.html$/i, '') || 'index';
        var lower = page.toLowerCase();
        if (lower === '' || lower === 'index') page = 'index';
        // base dinamis (?id=/?code=): bedakan per komik
        try {
            var qs = new URLSearchParams(window.location.search);
            var qid = (qs.get('id') || qs.get('code') || '').trim().replace(/^#/, '');
            if (qid && lower === 'base') page = 'base-' + qid;
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
            return http('hit', keyOf('read', page), 1);
        } catch (e) { return Promise.resolve(0); }
    };

    /* ---------- Auto-hit kunjungan (total / harian / jam / bulanan / per-halaman) ---------- */
    function autoTrack() {
        if (started) return;
        started = true;
        // jangan hit jika sedang di halaman stats agar tidak mengotori data
        if (window.location.pathname.indexOf('/stats') !== -1 || window.location.pathname.indexOf('/dash/') !== -1) return;
        // throttle dimatikan untuk akurasi (20 viewer harus 20 hit) - hanya cegah double-hit 2 detik
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

        // sequential + keepalive biar tidak rate-limit 5 parallel
        var page = currentPageSlug();
        var keysToHit=[keyOf('total'), keyOf('day', isoFor(0)), keyOf('hour', isoHourOf(now)), keyOf('month', monthKey), keyOf('page', page)];
        // Tembak berurutan TANPA jeda timer: timer mati saat pindah halaman,
        // sedangkan request yg sedang jalan diselamatkan keepalive.
        (async function(){
            for(var i=0;i<keysToHit.length;i++){
                try{ await http('hit', keysToHit[i], 1); }catch(e){}
            }
        })();

        // share count opsional: jika ada ?share= di URL, hit share untuk video terkait (tetap hit page di atas)
        try {
            var params = new URLSearchParams(window.location.search);
            var sharedTitle = params.get('shared');
            if (sharedTitle) http('hit', keyOf('share', sharedTitle));
        } catch (e) {}
    }

    // Langsung tembak tanpa tunggu DOM (fetch tidak butuh DOM).
    // Versi lama menunggu 300ms + jeda antar-hit: keburu mati saat pengunjung pindah halaman.
    try { autoTrack(); } catch (e) {}
})(window, document);