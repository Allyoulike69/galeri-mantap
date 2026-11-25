// ========= KONFIGURASI URL =========
const SITE_ROOT = window.location.pathname.split("/").slice(0, -2).join("/") + "/";
const DATA_URLS = [
    SITE_ROOT + "p/daftar-comic.json",
    SITE_ROOT + "p/daftar-comic2.json",
    SITE_ROOT + "p/daftar-comic3.json",
    SITE_ROOT + "p/daftar-comic4.json",
    SITE_ROOT + "p/daftar-comic5.json"
];
// Ambil semua file JSON paralel lalu gabung jadi satu list.
// File yang belum ada / gagal otomatis dianggap kosong,
// jadi daftar-comic2..5.json boleh dibuat bertahap.
function fetchAllPages() {
    return Promise.all(DATA_URLS.map(function(url) {
        return fetch(url)
            .then(function(res) { if (!res.ok) throw new Error("skip"); return res.json(); })
            .then(function(data) { return Array.isArray(data) ? data : (data.pages || []); })
            .catch(function() { return []; });
    })).then(function(lists) {
        var seenCodeByLink = {};
        var seenCodeTitle = {};
        var merged = [];
        lists.forEach(function(items) {
            items.forEach(function(p) {
                if (!p || !p.link) return;
                var code = ((p.code || "").trim());
                var title = ((p.title || "").trim());
                if (seenCodeByLink[p.link] !== undefined) {
                    // link sudah ada: simpan juga HANYA jika code beda & berisi
                    // (mis. dua komik beda yang sama-sama pakai base.html)
                    if (!code || code === seenCodeByLink[p.link]) return;
                } else {
                    seenCodeByLink[p.link] = code;
                }
                if (code && title) {
                    var ct = code + "|" + title;
                    if (seenCodeTitle[ct]) return; // salah input: code + nama sama
                    seenCodeTitle[ct] = true;
                }
                merged.push(p);
            });
        });
        return merged;
    });
}
const BASE_URL = SITE_ROOT + "p/";
const HOME_URL = SITE_ROOT;
const VIDEO_URL = "https://alyoulikevideo.pages.dev/";
const SEARCH_PAGE_URL = SITE_ROOT + "search.html";

// ========= GLOBAL VARIABLES =========
let allPages = [];
let currentImages = [];
let currentIndex = 0;
let zoomLevel = 1.0;
let maxZoom = 3.0;
let readerFit = 'fit-horizontal';
let preloadPages = 3;
let pageTurnSide = 'right';
let scrollSpeed = 240;
let currentPageTitle = '';
let catalogWaiters = [];

// Jalankan cb setelah katalog komik termuat (agar slug sama dengan dashboard)
function whenCatalogReady(cb) {
    if (Array.isArray(allPages) && allPages.length) { try { cb(); } catch (e) {} return; }
    catalogWaiters.push(cb);
}
function flushCatalogWaiters() {
    const waiters = catalogWaiters;
    catalogWaiters = [];
    waiters.forEach(function (cb) { try { cb(); } catch (e) {} });
}

// ========= FUNGSI UNTUK MENDAPATKAN ID KOMIK DARI URL =========
var APP_BUILD = "20261004-v9";

function getComicIdFromUrl() {
    const path = window.location.pathname;
    const fileName = path.split('/').pop();
    // base.html = 1 halaman dinamis untuk semua komik: id diambil dari ?id= / ?code=
    // (atau #fragment sebagai cadangan)
    if (fileName.toLowerCase() === "base.html") {
        try {
            const q = new URLSearchParams(window.location.search);
            const id = (q.get("id") || q.get("code") || "").trim().replace(/^#/, "");
            if (id) return id;
            const h = (window.location.hash || "").replace(/^#/, "").trim();
            if (h) return h;
        } catch (e) {}
    }
    const comicId = fileName.replace('.html', '');
    return comicId;
}

// Slug untuk Like/Share/Read — HARUS sama dengan yang dipakai dash/comic.html
// (entrySlugs): nama file link tanpa .html, atau "base-<code>" untuk base.html.
function getTrackSlug() {
    const comicId = getComicIdFromUrl();
    const pages = Array.isArray(allPages) ? allPages : [];
    const entry = pages.find(function (p) {
        if (!p) return false;
        const code = String(p.code || '').trim().replace(/^#+/, '');
        const base = String(p.link || '').split('?')[0].split('/').pop().replace(/\.html$/i, '');
        return code === comicId || base === comicId;
    });
    if (entry) {
        const link = String(entry.link || '').trim();
        const base = link.split('?')[0].split('/').pop().replace(/\.html$/i, '');
        const codeNum = String(entry.code || '').trim().replace(/^#+/, '');
        if (base && base.toLowerCase() !== 'base') return base;
        if (/base\.html/i.test(link) && codeNum) return 'base-' + codeNum;
        if (codeNum) return codeNum;
    }
    // Fallback kalau katalog belum termuat: pakai id mentah (link katalog = angka)
    return comicId;
}

// ========= FUNGSI UNTUK MENGUPDATE PAGE TITLE & INFO =========
function updatePageTitleFromData(allPages) {
    const comicId = getComicIdFromUrl();
    const titleSpan = document.getElementById('pageTitleNumber');
    
    const comicData = allPages.find(page => {
        const linkFileName = ((page.link || '').split('?')[0]).replace('.html', '');
        const codeNorm = ((page.code || '').trim());
        return linkFileName === comicId || page.title === `#${comicId}` || page.title === comicId || codeNorm === `#${comicId}` || codeNorm === comicId;
    });
    
    if (comicData) {
        let displayTitle = comicData.title;
        if (!displayTitle.startsWith('#')) {
            displayTitle = '#' + displayTitle;
        }
        titleSpan.textContent = displayTitle;
        try { document.title = comicData.title; } catch (e) {}
        console.log(`Page title updated to: ${displayTitle} from JSON data`);
        
        populateInfo(comicData, allPages);
    } else {
        titleSpan.textContent = `#${comicId}`;
        try { document.title = `#${comicId}`; } catch (e) {}
        console.log(`Page title fallback to: #${comicId} (not found in JSON)`);
    }
}

// Waktu relatif: "2 months, 3 weeks ago" dari tanggal upload ke hari ini
function timeAgo(dateStr) {
    if (!dateStr || dateStr === '-') return '';
    var d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    var diff = Date.now() - d.getTime();
    if (diff < 0) return '';
    function u(n, w) { return n + ' ' + w + (n === 1 ? '' : 's'); }
    var mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return u(mins, 'minute') + ' ago';
    var hours = Math.floor(mins / 60);
    if (hours < 24) return u(hours, 'hour') + ' ago';
    var days = Math.floor(hours / 24);
    if (days < 7) return u(days, 'day') + ' ago';
    var years = Math.floor(days / 365);
    var restY = days % 365;
    var months = Math.floor(restY / 30);
    var restM = restY % 30;
    var weeks = Math.floor(restM / 7);
    var ddays = restM % 7;
    var parts = [];
    if (years > 0) parts.push(u(years, 'year'));
    if (months > 0) parts.push(u(months, 'month'));
    if (weeks > 0) parts.push(u(weeks, 'week'));
    if (ddays > 0 && parts.length < 2) parts.push(u(ddays, 'day'));
    parts = parts.slice(0, 2);
    if (parts.length === 0) return u(days, 'day') + ' ago';
    return parts.join(' ') + ' ago';
}

function populateInfo(data, allPages) {
    function getCounts(field) {
        const counts = {};
        allPages.forEach(p => {
            const val = p[field];
            if (val && val !== '-' && val !== '') {
                val.split(',').forEach(v => {
                    const key = v.trim().toLowerCase();
                    counts[key] = (counts[key] || 0) + 1;
                });
            }
        });
        return counts;
    }
    const tagFields = ['Parodies','Characters','Tags','Artists','Groups','Languages','Categories'];
    const plainFields = ['Pages','Uploaded'];
    const codeEl = document.getElementById('info-code');
    if (codeEl) {
        const val = data['code'];
        if (val === undefined || val === '' || val === '-') {
            codeEl.closest('.info-item').style.display = 'none';
        } else {
            codeEl.textContent = val;
            codeEl.onclick = function() {
                navigator.clipboard.writeText(val).then(() => {
                    const toast = document.createElement('div');
                    toast.textContent = 'Copied!';
                    toast.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#333;color:#fff;padding:10px 20px;border-radius:6px;z-index:9999;font-size:14px;';
                    document.body.appendChild(toast);
                    setTimeout(() => toast.remove(), 1500);
                });
            };
        }
    }
    const titleEl = document.getElementById('info-title');
    if (titleEl) {
        const val = data['title'];
        if (val === undefined || val === '' || val === '-') {
            titleEl.closest('.info-item').style.display = 'none';
        } else {
            titleEl.innerHTML = val.replace(/\[([^\]]+)\]/g, '<span style="color:#999;">[$1]</span>');
        }
    }
    tagFields.forEach(f => {
        const el = document.getElementById('info-' + f.toLowerCase());
        if (el) {
            const val = data[f];
            if (val === undefined || val === '-' || String(val).trim() === '') {
                el.closest('.info-item').style.display = 'none';
            } else {
                const counts = getCounts(f);
                const pageMap = {'Tags':'tag','Parodies':'parody','Characters':'character','Artists':'artist','Groups':'group','Languages':'language','Categories':'category'};
                const page = pageMap[f];
                el.innerHTML = val.split(',').map(v => {
                    const name = v.trim();
                    const count = counts[name.toLowerCase()] || 0;
                    const tagName = page ? '<a href="../'+page+'.html?q='+encodeURIComponent(name)+'" class="tag-name">'+name+'</a>' : '<span class="tag-name">'+name+'</span>';
                    return '<span class="info-tag">'+tagName+'<span class="tag-count">'+count+'</span></span>';
                }).join('');
            }
        }
    });
    plainFields.forEach(f => {
        const el = document.getElementById('info-' + f.toLowerCase());
        if (el) {
            const val = data[f];
            if (val === undefined || val === '-' || String(val).trim() === '') {
                el.closest('.info-item').style.display = 'none';
            } else if (f === 'Uploaded') {
                var rel = timeAgo(val);
                if (rel) {
                    el.innerHTML = escapeHtml(rel) + ' <span class="upload-date">(' + escapeHtml(val) + ')</span>';
                } else {
                    el.textContent = val;
                }
            } else {
                el.textContent = val;
            }
        }
    });
    const cover = document.getElementById('info-cover');
    if (cover && data.image) {
        cover.src = proxied(data.image);
        var infoBox = document.getElementById('infocomic-container');
        if (infoBox) infoBox.style.setProperty('--cover-bg', 'url("' + String(data.image).replace(/"/g, '%22') + '")');
    }
}

// ========= FUNGSI UNTUK STORAGE KEYS =========
function getComicIdForStorage() {
    return window.location.pathname + currentPageTitle;
}

// ========= PROGRESS FUNCTIONS =========
function saveProgress(pageIndex) {
    const comicId = getComicIdForStorage();
    sessionStorage.setItem(`reader_progress_${comicId}`, pageIndex.toString());
    console.log('Progress saved to sessionStorage:', pageIndex);
}

function getProgress() {
    const comicId = getComicIdForStorage();
    const saved = sessionStorage.getItem(`reader_progress_${comicId}`);
    if (saved && !isNaN(parseInt(saved))) {
        return parseInt(saved);
    }
    return 0;
}

function clearProgress() {
    const comicId = getComicIdForStorage();
    sessionStorage.removeItem(`reader_progress_${comicId}`);
    console.log('Progress cleared for:', comicId);
}

// ========= HIGHLIGHT FUNCTIONS =========
function highlightGalleryImage(imageIndex) {
    const gallery = document.getElementById('comic-gallery');
    if (!gallery) return;
    
    const images = gallery.querySelectorAll('img');
    if (images.length > 0 && imageIndex >= 0 && imageIndex < images.length) {
        images.forEach(img => img.classList.remove('highlight'));
        images[imageIndex].classList.add('highlight');
        images[imageIndex].scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => {
            images[imageIndex].classList.remove('highlight');
        }, 2000);
    }
}

// CDN proxy: semua gambar ibb otomatis dilewatkan cache cepat.
// Kamu tetap tempel link ibb biasa — tidak perlu edit satu-satu.
// Proxy DIMATIKAN sementara (gambar broken di browser — diduga images.weserv.nl
// tidak bisa diakses dari sisi pengguna). Kembalikan ke versi proxy kapan saja.
// Link ibb dipakai langsung seperti semula.
function proxied(url) {
    return url;
}

// ========= READER FUNCTIONS =========
function openReader(index) {
    currentIndex = index;
    zoomLevel = 1.0;
    updateMaxZoom();
    
    document.getElementById('manga-reader').style.display = 'flex';
    closeReaderSettings();
    try { if (window.__vhHideSocialBars) window.__vhHideSocialBars(); } catch (e) {}
    showCurrentPage();
    try { if (window.VH_hitRead) window.VH_hitRead(); } catch (e) {}
    console.log('Reader opened at page:', index + 1);
}

function showCurrentPage() {
    const img = document.getElementById('reader-image');
    const content = document.getElementById('reader-content');
    img.onload = applyZoomTransform;
    img.src = proxied(currentImages[currentIndex]);
    applyReaderFit();
    applyZoomTransform();
    const pageText = `${currentIndex + 1} of ${currentImages.length}`;
    document.getElementById('page-counter').textContent = pageText;
    document.getElementById('page-counter-bottom').textContent = pageText;
    updateZoomLabels();
    // Jump on page turn: kembali ke bagian atas gambar.
    if (content) content.scrollTop = 0;
    saveProgress(currentIndex);
    preloadReaderPages();
}

function nextPage() { 
    if (currentIndex < currentImages.length - 1) { 
        currentIndex++; 
        showCurrentPage();
    } else if (currentIndex === currentImages.length - 1) {
        clearProgress();
    }
}

function prevPage() { 
    if (currentIndex > 0) { 
        currentIndex--; 
        showCurrentPage();
    } 
}

function firstPage() { 
    currentIndex = 0; 
    showCurrentPage();
}

function lastPage() { 
    currentIndex = currentImages.length - 1; 
    showCurrentPage();
}

function zoomIn() { 
    updateMaxZoom(); 
    applyZoomAt(Math.min(maxZoom, zoomLevel + 0.25)); 
}

function zoomOut() { 
    applyZoomAt(Math.max(1.0, zoomLevel - 0.25)); 
}

function closeReader() { 
    document.getElementById('manga-reader').style.display = 'none';
    closeReaderSettings();
    try { if (window.__vhShowSocialBars) window.__vhShowSocialBars(); } catch (e) {}
    const lastPageRead = getProgress();
    if (lastPageRead > 0) {
        setTimeout(() => {
            highlightGalleryImage(lastPageRead);
        }, 100);
    }
}

function updateMaxZoom() { 
    maxZoom = 3.0; 
}

// ========= READER SETTINGS =========
// Wrapper diukur sesuai zoom supaya area scroll mencakup semua sisi gambar.
// Tanpa ini, transform:scale() dari tengah membuat sisi kiri minus dan tidak bisa di-scroll.
function applyZoomTransform() {
    const img = document.getElementById('reader-image');
    const wrap = document.getElementById('reader-zoom-wrap');
    const content = document.getElementById('reader-content');
    if (!img || !wrap || !content) return;

    const nw = img.naturalWidth || img.offsetWidth || 0;
    const nh = img.naturalHeight || img.offsetHeight || 0;
    if (!nw || !nh) return;

    const cs = getComputedStyle(content);
    const availW = Math.max(1, content.clientWidth - parseFloat(cs.paddingLeft || 0) - parseFloat(cs.paddingRight || 0));
    const availH = Math.max(1, content.clientHeight - parseFloat(cs.paddingTop || 0) - parseFloat(cs.paddingBottom || 0));

    let showW, showH;
    if (readerFit === 'fit-horizontal') {
        showW = availW;
        showH = nh * (availW / nw);
    } else {
        const fit = Math.min(1, availW / nw, availH / nh);
        showW = nw * fit;
        showH = nh * fit;
    }

    img.style.width = showW + 'px';
    img.style.height = showH + 'px';
    img.style.transformOrigin = 'top left';
    img.style.transform = `scale(${zoomLevel})`;

    wrap.style.width = (showW * zoomLevel) + 'px';
    wrap.style.height = (showH * zoomLevel) + 'px';
    updateZoomLabels();
}

// Zoom mengikuti area yang sedang dilihat, bukan selalu kembali ke tengah.
function applyZoomAt(nextZoom) {
    const img = document.getElementById('reader-image');
    const content = document.getElementById('reader-content');
    if (!img || !content) return;

    const oldRect = img.getBoundingClientRect();
    const viewRect = content.getBoundingClientRect();
    const viewW = content.clientWidth || viewRect.width;
    const viewH = content.clientHeight || viewRect.height;

    // Titik fokus = tengah area yang sedang terlihat, dalam fraksi gambar.
    let fx = 0.5, fy = 0.5;
    if (oldRect.width > 0) {
        fx = (viewRect.left + viewW / 2 - oldRect.left) / oldRect.width;
        fx = Math.max(0, Math.min(1, fx));
    }
    if (oldRect.height > 0) {
        fy = (viewRect.top + viewH / 2 - oldRect.top) / oldRect.height;
        fy = Math.max(0, Math.min(1, fy));
    }

    zoomLevel = nextZoom;
    applyZoomTransform();

    const newRect = img.getBoundingClientRect();
    const imgLeftInScroll = newRect.left - viewRect.left + content.scrollLeft;
    const imgTopInScroll = newRect.top - viewRect.top + content.scrollTop;
    const maxLeft = Math.max(0, content.scrollWidth - content.clientWidth);
    const maxTop = Math.max(0, content.scrollHeight - content.clientHeight);

    content.scrollLeft = Math.max(0, Math.min(maxLeft, imgLeftInScroll + fx * newRect.width - viewW / 2));
    content.scrollTop = Math.max(0, Math.min(maxTop, imgTopInScroll + fy * newRect.height - viewH / 2));
}

function zoomPercent() {
    return zoomLevel.toFixed(1) + 'x';
}

function updateZoomLabels() {
    const text = zoomPercent();
    ['zoom-level', 'zoom-level-bottom'].forEach(function (id) {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    });
    // Dropdown settings memakai label persen, tapi nilainya tetap angka zoom.
    const sel = document.getElementById('settings-zoom');
    if (sel && sel.tagName === 'SELECT') sel.value = String(Number(zoomLevel.toFixed(2)));
}

function updateSettingsUI() {
    const preloadSel = document.getElementById('preload-select');
    if (preloadSel) preloadSel.value = String(preloadPages);

    const scalingSel = document.getElementById('scaling-select');
    if (scalingSel) scalingSel.value = readerFit;

    document.querySelectorAll('#reader-settings [data-turn]').forEach(function (btn) {
        btn.classList.toggle('active', btn.getAttribute('data-turn') === pageTurnSide);
    });
    updateZoomLabels();
}

function applyReaderFit() {
    const content = document.getElementById('reader-content');
    if (!content) return;
    content.classList.remove('fit-both', 'fit-horizontal', 'fit-original');
    content.classList.add(readerFit);
    updateSettingsUI();
}

function setReaderFit(mode) {
    readerFit = mode;
    applyReaderFit();
    // Hitung ulang ukuran gambar: tanpa ini inline width/height dari fit-horizontal
    // tetap dipakai sehingga Fit page terlihat tidak berubah.
    applyZoomTransform();
}

function toggleImageScaling() {
    setReaderFit(readerFit === 'fit-horizontal' ? 'fit-both' : 'fit-horizontal');
}

function setZoomLevel(value) {
    const target = Math.max(1, Math.min(maxZoom, parseFloat(value) || 1));
    applyZoomAt(target);
}

function resetZoom() {
    setZoomLevel(1.0);
}

function setPreloadPages(n) {
    preloadPages = n;
    updateSettingsUI();
    preloadReaderPages();
}

function preloadReaderPages() {
    if (!currentImages.length) return;
    for (let step = 1; step <= preloadPages; step++) {
        [currentIndex - step, currentIndex + step].forEach(function (i) {
            if (i < 0 || i >= currentImages.length) return;
            const im = new Image();
            im.src = proxied(currentImages[i]);
        });
    }
}

function setPageTurn(side) {
    pageTurnSide = side;
    updateSettingsUI();
}

function readerImageClick(e) {
    const img = e && e.currentTarget ? e.currentTarget : document.getElementById('reader-image');
    if (!img) return;
    const rect = img.getBoundingClientRect();
    const isRight = ((e && e.clientX ? e.clientX : rect.left + rect.width / 2) - rect.left) >= rect.width / 2;
    if (pageTurnSide === 'right') {
        if (isRight) nextPage(); else prevPage();
    } else {
        if (isRight) prevPage(); else nextPage();
    }
}

function scrollReader(dir, fast) {
    const content = document.getElementById('reader-content');
    if (!content) return;
    content.scrollTop += dir * scrollSpeed * (fast ? 2 : 1);
}

function closeReaderSettings() {
    const panel = document.getElementById('reader-settings');
    if (panel) panel.classList.remove('show');
}

function toggleReaderSettings(btn) {
    const panel = document.getElementById('reader-settings');
    if (!panel) return;
    const willOpen = !panel.classList.contains('show');
    panel.classList.toggle('show', willOpen);
    if (willOpen) updateSettingsUI();
    if (btn) btn.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
}

// Tutup panel saat klik di luar panel / tombol gear.
document.addEventListener('click', function (e) {
    const panel = document.getElementById('reader-settings');
    if (!panel || !panel.classList.contains('show')) return;
    const t = e.target;
    if (panel.contains(t)) return;
    if (t && t.closest && t.closest('.settings-btn')) return;
    closeReaderSettings();
});

// Hitung ulang ukuran gambar saat jendela diubah.
window.addEventListener('resize', function () {
    const r = document.getElementById('manga-reader');
    if (r && r.style.display === 'flex') applyZoomTransform();
});

// ========= GALLERY INIT =========
let galleryItemsPerPage = 30;
let galleryCurrentCount = 0;

// Isi #raw-links dari id-comic.json (cocok code halaman).
// Tidak ketemu / gagal → pakai isi bawaan HTML seperti biasa.
// Cari code dari katalog untuk halaman tanpa parameter (mis. base.html polos:
// cari entri yang link-nya file ini, ambil code-nya).
function resolveCatalogCode() {
    try {
        if (typeof allPages === "undefined" || !allPages) return "";
        var me = "";
        try { me = window.location.pathname.split("/").pop().toLowerCase(); } catch (e) {}
        for (var i = 0; i < allPages.length; i++) {
            var lk = ((allPages[i] && allPages[i].link) || "").split("/").pop().toLowerCase();
            if (lk && lk === me) {
                return (((allPages[i] && allPages[i].code) || "").trim().replace(/^#/, ""));
            }
        }
    } catch (e) {}
    return "";
}

// Ingatan navigasi komik (untuk URL cantik yang landing di base.html).
function lastClickedId() {
    try {
        var raw = localStorage.getItem("lastComic");
        if (!raw) return "";
        var o = JSON.parse(raw);
        if (!o || !o.id) return "";
        if ((Date.now() - (o.t || 0)) > 15 * 60 * 1000) return "";
        return String(o.id);
    } catch (e) { return ""; }
}
function sessionComicId() {
    // Hanya format baru {id,t,v:2} yang dipercaya. Format lama (string polos
    // era fallback) SELALU ditolak — itu sumber ingatan basi #497908.
    try {
        var raw = sessionStorage.getItem("currentComic") || "";
        if (!raw) return "";
        var o = JSON.parse(raw);
        if (o && o.v === 2 && o.id) return String(o.id);
        return "";
    } catch (e) { return ""; }
}
function rememberComicId(id) {
    if (!id) return;
    try { sessionStorage.setItem("currentComic", JSON.stringify({ id: String(id), t: Date.now(), v: 2 })); } catch (e) {}
}
function beautifyUrl(id, wasExplicit) {
    try {
        if (wasExplicit) return;
        if (!id || !/^\d+$/.test(String(id))) return;
        var path = window.location.pathname;
        var cur = path.split("/").pop();
        if (cur === String(id)) return;
        var base = path.replace(/[^\/]*$/, "");
        window.history.replaceState(null, "", base + id);
    } catch (e) {}
}

function loadIdPictures() {
    var rawId = "";
    try { rawId = getComicIdFromUrl(); } catch (e) {}
    var explicit = !!(rawId && rawId !== "base");
    var comicId = rawId;
    // base.html polos: code diambil dari entri katalog yang link-nya file ini
    if (!explicit) {
        try {
            var resolved = resolveCatalogCode();
            if (resolved) comicId = resolved;
        } catch (e) {}
    }
    // landing dari URL cantik yang kena redirect (id hilang di jalan).
    // reload/back: ingatan tab ini pasti benar (halaman sama dibuka ulang).
    // navigasi baru: HANYA klik segar (<15 mnt). Session basi dilarang
    // karena pernah menimpa klik baru dengan komik lama.
    if (!explicit && (!comicId || comicId === "base")) {
        try {
            var _nt = "";
            try {
                var _nav = performance.getEntriesByType("navigation");
                if (_nav && _nav[0] && _nav[0].type) _nt = _nav[0].type;
            } catch (e0) {}
            if (_nt === "reload" || _nt === "back_forward") {
                comicId = sessionComicId() || lastClickedId() || comicId;
            } else {
                comicId = lastClickedId() || comicId;
            }
        } catch (e) {}
    }
    var ID_URLS = ["id-comic.json", "id-comic2.json", "id-comic3.json",
        "id-comic4.json", "id-comic5.json"];
    return Promise.all(ID_URLS.map(function(u) {
        return fetch(u + "?t=" + Date.now())
            .then(function(res) { if (!res.ok) throw new Error("skip"); return res.json(); })
            .then(function(data) {
                var l = (data && data["raw-links"]) || (data && data.pages) || data || [];
                return Array.isArray(l) ? l : [];
            })
            .catch(function() { return []; });
    })).then(function(all) {
            var seenId = {};
            var list = [];
            all.forEach(function(items) {
                items.forEach(function(e) {
                    var k = ((e && e.code) || "").trim();
                    if (k) {
                        if (seenId[k]) return;
                        seenId[k] = true;
                    }
                    list.push(e);
                });
            });
            var code = "#" + comicId;
            var found = null;
            var i;
            for (i = 0; i < list.length; i++) {
                var c = ((list[i] && list[i].code) || "").trim();
                if (c && (c === code || c === comicId)) { found = list[i]; break; }
            }
            // tidak ketemu & tanpa parameter: JANGAN tampilkan komik lain (menyesatkan)!
            // Biarkan gallery kosong + judul jujur. (Dulu: fallback entri pertama.)
            if (!found && !explicit) {
                try {
                    var ts0 = document.getElementById("pageTitleNumber");
                    if (ts0) ts0.textContent = "#?";
                    currentPageTitle = "#?";
                    try { document.title = "Komik tidak ditemukan"; } catch (e0) {}
                } catch (e) {}
            }
            if (found && found.picture) {
                var pic = Array.isArray(found.picture) ? found.picture.join(" ") : String(found.picture);
                if (!pic.trim()) return;
                var showId = (((found && found.code) || "").trim().replace(/^#/, "")) || comicId;
                try {
                    var ts = document.getElementById("pageTitleNumber");
                    var curT = ts ? ts.textContent : "";
                    if (!curT || curT === "#" + rawId || curT === "#" + comicId) {
                        if (ts) ts.textContent = "#" + showId;
                        currentPageTitle = "#" + showId;
                        try { document.title = "#" + showId; } catch (e2) {}
                    }
                } catch (e) {}
                var el = document.getElementById("raw-links");
                if (el) el.textContent = pic;
                rememberComicId(showId);
                beautifyUrl(showId, explicit);
            }
        })
        .catch(function() {});
}

function initGallery() {
    const rawLinksEl = document.getElementById('raw-links');
    const gallery = document.getElementById('comic-gallery');
    gallery.innerHTML = '';
    currentImages = rawLinksEl.innerText.split(/\s+/).filter(u => u.startsWith("http"));
    
    console.log('Total images loaded:', currentImages.length);
    
    galleryCurrentCount = 0;
    renderGalleryItems();
    
    const savedProgress = getProgress();
    if (savedProgress > 0 && savedProgress < currentImages.length) {
        setTimeout(() => {
            highlightGalleryImage(savedProgress);
        }, 500);
    }
}

function renderGalleryItems() {
    const gallery = document.getElementById('comic-gallery');
    const nextCount = Math.min(galleryCurrentCount + galleryItemsPerPage, currentImages.length);
    
    for (let i = galleryCurrentCount; i < nextCount; i++) {
        const img = document.createElement('img');
        img.src = proxied(currentImages[i]);
        img.loading = "lazy";
        img.setAttribute('data-index', i);
        img.alt = `Page ${i + 1}`;
        img.onclick = () => openReader(i);
        gallery.appendChild(img);
    }
    galleryCurrentCount = nextCount;
    
    const showMoreBtn = document.getElementById('showMoreBtn');
    const showAllBtn = document.getElementById('showAllBtn');
    if (showMoreBtn) showMoreBtn.style.display = galleryCurrentCount >= currentImages.length ? 'none' : 'inline-block';
    if (showAllBtn) showAllBtn.style.display = galleryCurrentCount >= currentImages.length ? 'none' : 'inline-block';
}

function showMore() {
    renderGalleryItems();
}

function showAll() {
    const gallery = document.getElementById('comic-gallery');
    for (let i = galleryCurrentCount; i < currentImages.length; i++) {
        const img = document.createElement('img');
        img.src = proxied(currentImages[i]);
        img.loading = "lazy";
        img.setAttribute('data-index', i);
        img.alt = `Page ${i + 1}`;
        img.onclick = () => openReader(i);
        gallery.appendChild(img);
    }
    galleryCurrentCount = currentImages.length;
    const showMoreBtn = document.getElementById('showMoreBtn');
    const showAllBtn = document.getElementById('showAllBtn');
    if (showMoreBtn) showMoreBtn.style.display = 'none';
    if (showAllBtn) showAllBtn.style.display = 'none';
}

// ========= MORE LIKE THIS =========
const TITLE_STOPWORDS = new Set(['english','translated','mtl','raw','japanese','chinese','spanish','french','korean','russian','digital','decensored','uncensored','censored','colored','colorized','complete','scans','scanlation','translation','dl','version','official','web','compilation','anthology']);

function getTitleTokens(title) {
    if (!title) return [];
    let t = title.toLowerCase();
    t = t.replace(/[\[\](){}]/g, ' ');
    t = t.replace(/\b(chapter|ch|volume|vol|part|episode|ep|omake|extra|side|special|pilot|prologue|epilogue|afterword)\b/g, ' ');
    t = t.replace(/\d+[a-z0-9]*/g, ' ');
    t = t.replace(/[^\p{L}\p{N}\s]/gu, ' ');
    const tokens = t.split(/\s+/).filter(w => w && w.length >= 2 && !TITLE_STOPWORDS.has(w));
    return [...new Set(tokens)];
}

function getTitleOverlap(a, b) {
    if (!a.length || !b.length) return 0;
    const count = a.filter(t => b.includes(t)).length;
    return count >= 2 ? count : 0;
}

function getLeadingBracket(title) {
    if (!title) return '';
    const m = title.match(/\[([^\]]+)\]/);
    if (!m) return '';
    let s = m[1].toLowerCase();
    s = s.replace(/[\[\](){}]/g, ' ').replace(/\s+/g, ' ').trim();
    return s;
}

function getBracketScore(currBracket, itemBracket) {
    if (!currBracket || !itemBracket) return 0;
    if (currBracket === itemBracket) return 10;
    const a = currBracket.split(' ').filter(w => w.length >= 2);
    const b = itemBracket.split(' ').filter(w => w.length >= 2);
    if (!a.length || !b.length) return 0;
    const shared = a.filter(t => b.includes(t)).length;
    return shared > 0 ? shared * 3 : 0;
}

function renderMoreLikeThis() {
    const container = document.getElementById('more-like-this-grid');
    if (!container) return;
    if (!allPages.length) { container.innerHTML = ''; return; }

    const pageId = window.location.pathname.split('/').pop().replace('.html','');
    let codeId = null;
    try {
        const q = new URLSearchParams(window.location.search);
        codeId = (q.get("id") || q.get("code") || "").trim().replace(/^#/, "");
    } catch (e) {}
    const normCode = function(s) { return ((s || "").trim()).replace(/^#/, ""); };
    const current = allPages.find(item =>
        ((item.link || "").split("?")[0]) === pageId + ".html" ||
        (codeId && normCode(item.code) === codeId) ||
        item.code === "#" + pageId ||
        item.title === currentPageTitle
    );
    if (!current) { container.innerHTML = ''; return; }

    const fields = ['Parodies','Characters','Tags','Artists','Groups','Languages','Categories'];
    const priorityFields = ['Groups','Artists','Parodies','Characters'];
    const minCheck = ['Tags'];
    const weights = {'Groups':6,'Artists':5,'Parodies':4,'Characters':4,'Tags':1,'Languages':1,'Categories':1};
    const titleWeight = 7;
    function getVals(s) { return (!s || s==='-') ? [] : s.split(',').map(v=>v.trim().toLowerCase()).filter(v=>v); }
    const curr = {};
    fields.forEach(f => { curr[f] = getVals(current[f]); });
    const tagCount = curr['Tags'].length;
    const minTagMatch = Math.min(5, tagCount);
    const currTitleTokens = getTitleTokens(current.title);
    const currBracket = getLeadingBracket(current.title);

    let scored = [];
    for (const item of allPages) {
        if (item.link === current.link && item.code === current.code) continue;
        let totalMatch = 0, score = 0, priScore = 0;
        for (const f of fields) {
            const a = curr[f], b = getVals(item[f]);
            if (!a.length || !b.length) continue;
            const matches = b.filter(v => a.includes(v));
            if (matches.length) {
                if (minCheck.includes(f)) totalMatch += matches.length;
                score += matches.length * (weights[f] || 1);
                if (priorityFields.includes(f)) priScore += matches.length * (weights[f] || 1);
            }
        }
        const bracketScore = getBracketScore(currBracket, getLeadingBracket(item.title));
        const titleScore = getTitleOverlap(currTitleTokens, getTitleTokens(item.title)) * titleWeight;
        if (priScore > 0 || totalMatch >= minTagMatch || titleScore > 0 || bracketScore > 0) scored.push({ item, totalMatch, score, priScore, titleScore, bracketScore });
    }

    scored.sort((a,b) => b.priScore - a.priScore || b.bracketScore - a.bracketScore || b.titleScore - a.titleScore || b.totalMatch - a.totalMatch || b.score - a.score);
    const selected = [];
    for (const s of scored) {
        if ((s.priScore > 0 || s.titleScore > 0 || s.bracketScore > 0) && selected.length < 12) selected.push(s.item);
    }
    for (const s of scored) {
        if (selected.length >= 12) break;
        if (!selected.includes(s.item)) selected.push(s.item);
    }
    if (selected.length === 0) {
        // tidak ada yang mirip (mis. metadata masih kosong) → tampilkan terbaru
        renderItems(container, allPages.filter(item => item.link !== current.link).slice(0, 12));
        return;
    }
    renderItems(container, selected);
}

function renderItems(container, items) {
    container.innerHTML = items.map(item => {
        const link = item.link.startsWith('http') ? item.link : BASE_URL + item.link;
        const imgUrl = proxied(item.image) || "https://placehold.co/400x600?text=No+Image";
        const title = item.title || "Untitled";
        return `<div class="comic-item">
            <a href="${link}" style="text-decoration:none;">
                <div class="comic-thumb-container">
                    <img class="comic-thumb" src="${imgUrl}" alt="${escapeHtml(title)}" loading="lazy" onerror="this.src='https://placehold.co/400x600?text=Error'">
                </div>
                <div class="comic-title">${escapeHtml(title)}</div>
            </a>
        </div>`;
    }).join('');
    enableMltSlider();
}

// Geser-drag slider More-Like-This (momentum + snap, klik dibatalkan jika drag).
function enableMltSlider() {
    var slider = document.getElementById("more-like-this-grid");
    if (!slider || slider.dataset.sliderOn) return;
    slider.dataset.sliderOn = "1";
    var isDown = false, startX = 0, scrollLeftPos = 0;
    var hasDragged = false, lastX = 0, lastTime = 0, velocity = 0, rafId = null;

    function stopAnim() {
        if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    }
    function snapToNearest(currentScroll) {
        var cards = slider.querySelectorAll(".comic-item");
        if (!cards.length) return currentScroll;
        var gap = parseInt(getComputedStyle(slider).gap) || 8;
        var cardWidth = cards[0].offsetWidth + gap;
        var index = Math.round(currentScroll / cardWidth);
        return Math.max(0, Math.min(index * cardWidth, slider.scrollWidth - slider.clientWidth));
    }
    function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
    function easeOutQuart(t) { return 1 - Math.pow(1 - t, 4); }
    function animateTo(target, duration, easing) {
        stopAnim();
        var start = slider.scrollLeft, diff = target - start, startTime = performance.now();
        function step(now) {
            var t = Math.min(1, (now - startTime) / duration);
            slider.scrollLeft = start + diff * easing(t);
            if (t < 1) rafId = requestAnimationFrame(step);
            else rafId = null;
        }
        rafId = requestAnimationFrame(step);
    }
    function release(e) {
        if (!isDown) return;
        isDown = false;
        slider.style.cursor = "grab";
        if (slider.releasePointerCapture) {
            try { slider.releasePointerCapture(e.pointerId); } catch (err) {}
        }
        var now = performance.now(), dt = now - lastTime;
        velocity = dt > 0 ? (slider.scrollLeft - lastX) / dt * 16.7 : 0;
        if (hasDragged && Math.abs(velocity) > 0.5) {
            var target = Math.max(0, Math.min(slider.scrollLeft - velocity * 12, slider.scrollWidth - slider.clientWidth));
            var snap = snapToNearest(target);
            animateTo(snap, Math.min(700, 350 + Math.abs(snap - slider.scrollLeft) * 0.35), easeOutQuart);
        } else if (hasDragged) {
            animateTo(snapToNearest(slider.scrollLeft), 300, easeOutCubic);
        }
    }

    slider.addEventListener("pointerdown", function(e) {
        if (e.pointerType === "mouse" && e.button !== 0) return;
        stopAnim();
        isDown = true;
        hasDragged = false;
        velocity = 0;
        startX = e.pageX - slider.offsetLeft;
        scrollLeftPos = slider.scrollLeft;
        lastX = slider.scrollLeft;
        lastTime = performance.now();
        slider.style.cursor = "grabbing";
        if (slider.setPointerCapture) {
            try { slider.setPointerCapture(e.pointerId); } catch (err) {}
        }
    });
    slider.addEventListener("pointermove", function(e) {
        if (!isDown) return;
        var walk = (e.pageX - slider.offsetLeft) - startX;
        if (Math.abs(walk) > 5) hasDragged = true;
        slider.scrollLeft = scrollLeftPos - walk;
        var now = performance.now(), dt = now - lastTime;
        if (dt > 0) velocity = ((slider.scrollLeft - lastX) / dt) * 16.7;
        lastX = slider.scrollLeft;
        lastTime = now;
    });
    slider.addEventListener("dragstart", function(e) { e.preventDefault(); });
    slider.addEventListener("pointerup", release);
    slider.addEventListener("pointercancel", release);
    slider.addEventListener("pointerleave", function(e) {
        if (isDown && e.pointerType === "mouse") release(e);
    });
    // Klik kartu: target klik sering jatuh ke wadah (pointer capture),
    // jadi cari kartu di bawah titik sentuh lalu navigasi manual.
    // Habis drag: klik dibatalkan biar tidak nyasar buka komik.
    slider.addEventListener("click", function(e) {
        if (hasDragged) {
            e.preventDefault();
            e.stopPropagation();
            hasDragged = false;
            return;
        }
        var el = null;
        try { el = document.elementFromPoint(e.clientX, e.clientY); } catch (err) {}
        var card = (el && el.closest) ? el.closest(".comic-item") : null;
        var link = card ? card.querySelector("a[href]") : null;
        if (link && link.href) {
            e.preventDefault();
            e.stopPropagation();
            window.location.href = link.href;
        }
        hasDragged = false;
    }, true);
}

// ========= NAVIGATION FUNCTIONS =========
function showRandomComic() {
    if (allPages.length === 0) return;
    let otherPages = allPages.filter(item => item.title !== currentPageTitle);
    if (otherPages.length === 0) otherPages = allPages;
    const randomIndex = Math.floor(Math.random() * otherPages.length);
    const randomItem = otherPages[randomIndex];
    const link = randomItem.link.startsWith('http') ? randomItem.link : BASE_URL + randomItem.link;
    window.location.href = link;
}

function openVideoSite() {
    window.open(VIDEO_URL, '_blank');
}

function goToSearchPage(query) {
    if (query && query.trim()) {
        window.location.href = `${SEARCH_PAGE_URL}?q=${encodeURIComponent(query.trim())}`;
    } else {
        window.location.href = SEARCH_PAGE_URL;
    }
}

// ========= UTILITY FUNCTIONS =========
function escapeHtml(str) { 
    if (!str) return ''; 
    return str.replace(/[&<>]/g, function(m){ 
        if(m==='&') return '&amp;'; 
        if(m==='<') return '&lt;'; 
        if(m==='>') return '&gt;'; 
        return m;
    }); 
}

// ========= LOAD DATA FROM JSON =========
async function loadData() {
    try {
        const allItems = await fetchAllPages();
        
        const uniquePages = [];
        const seenTitles = new Set();
        for (const page of allItems) {
            if (page.lengkap !== 'yes') continue;
            const t = (page.title || '').trim();
            if (t && seenTitles.has(t)) continue;
            if (t) seenTitles.add(t);
            uniquePages.push(page);
        }
        allPages = uniquePages;
        flushCatalogWaiters();
        
        allPages.sort((a, b) => {
            if (!a.date && !b.date) return 0;
            if (!a.date) return 1;
            if (!b.date) return -1;
            return new Date(b.date) - new Date(a.date);
        });
        
        console.log('Total unique comics loaded:', allPages.length);
        
        updatePageTitleFromData(allPages);
        
        const titleSpan = document.getElementById('pageTitleNumber');
        currentPageTitle = titleSpan ? titleSpan.innerText.trim() : '';
        console.log('Current page title:', currentPageTitle);
        
        renderMoreLikeThis();
        
    } catch (error) {
        console.error('Error:', error);
        const comicId = getComicIdFromUrl();
        document.getElementById('pageTitleNumber').textContent = `#${comicId}`;
        currentPageTitle = `#${comicId}`;
        flushCatalogWaiters();
        if (window.refreshComicCounts) window.refreshComicCounts();
    }
}

// ========= EVENT LISTENERS (DIPERBAIKI DENGAN EVENT DELEGATION) =========
function setupEventListeners() {
    // EVENT DELEGATION - untuk elemen yang dimuat secara dinamis
    document.body.addEventListener('click', function(e) {
        // Home button
        if (e.target.closest('#navHome')) {
            e.preventDefault();
            window.location.href = HOME_URL;
        }
        
        // Random button
        if (e.target.closest('#navRandom')) {
            e.preventDefault();
            if (allPages.length > 0) showRandomComic();
        }
        
        // Video button
        if (e.target.closest('#navVideo')) {
            e.preventDefault();
            openVideoSite();
        }
        
        // Logo click
        if (e.target.closest('#logoClick')) {
            window.location.href = HOME_URL;
        }
    });
    
    // SEARCH FUNCTIONALITY (event delegation - header dimuat dinamis)
    document.body.addEventListener('click', function(e) {
        if (e.target.closest('#searchBtnDesktop')) {
            const input = document.getElementById('searchInputDesktop');
            goToSearchPage(input ? input.value.trim() : '');
        }
        if (e.target.closest('#searchIconMobile')) {
            const overlay = document.getElementById('mobileSearchOverlay');
            const input = document.getElementById('searchInputMobile');
            if (overlay) overlay.style.display = 'block';
            if (input) setTimeout(() => input.focus(), 100);
        }
        if (e.target.closest('#closeSearchBtn')) {
            const overlay = document.getElementById('mobileSearchOverlay');
            const input = document.getElementById('searchInputMobile');
            if (overlay) overlay.style.display = 'none';
            if (input) input.value = '';
        }
        if (e.target.closest('#searchBtnMobile')) {
            const overlay = document.getElementById('mobileSearchOverlay');
            const input = document.getElementById('searchInputMobile');
            const q = input ? input.value.trim() : '';
            if (overlay) overlay.style.display = 'none';
            if (q) goToSearchPage(q);
        }
        
        // Dropdown click toggle
        const dropContent = document.querySelector('.dropdown-content-click');
        if (dropContent) {
            if (e.target.closest('.dropbtn-click')) {
                e.preventDefault();
                dropContent.classList.toggle('show');
            } else if (!dropContent.contains(e.target)) {
                dropContent.classList.remove('show');
            }
        }
    });
    
    document.body.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            if (e.target.closest && e.target.closest('#searchInputDesktop')) {
                goToSearchPage(e.target.value.trim());
            }
            if (e.target.closest && e.target.closest('#searchInputMobile')) {
                const overlay = document.getElementById('mobileSearchOverlay');
                if (overlay) overlay.style.display = 'none';
                const q = e.target.value.trim();
                if (q) goToSearchPage(q);
            }
        }
    });
    
    // Hamburger mobile nav + random mobile (DELEGASI).
    // Header dimuat async via fetch, jadi getElementById langsung saat init
    // sering dapat null (tombol mati selamanya). Delegasi di body jalan
    // kapan pun header tiba, dan urutannya aman terhadap closer di bawah.
    document.body.addEventListener('click', function(e) {
        var nav = document.getElementById('mobileNavOverlay');
        if (!nav) return;
        if (e.target.closest && e.target.closest('#hamburgerMenu')) {
            e.preventDefault();
            nav.classList.toggle('show');
            return;
        }
        if (e.target.closest && e.target.closest('#navRandomMobile')) {
            e.preventDefault();
            nav.classList.remove('show');
            if (allPages.length > 0) showRandomComic();
            return;
        }
        var ham = document.getElementById('hamburgerMenu');
        if (ham && !ham.contains(e.target) && !nav.contains(e.target)) {
            nav.classList.remove('show');
        }
    });
}

// ========= KEYBOARD SHORTCUTS =========
document.addEventListener('keydown', function(e) {
    if (document.getElementById('manga-reader').style.display !== 'flex') return;
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    const k = e.key;
    const lower = typeof k === 'string' ? k.toLowerCase() : '';

    if (lower === 'w' || k === 'ArrowUp') {
        e.preventDefault();
        scrollReader(-1, e.shiftKey);
    } else if (lower === 's' || k === 'ArrowDown') {
        e.preventDefault();
        scrollReader(1, e.shiftKey);
    } else if (lower === 'a' || k === 'ArrowLeft') {
        e.preventDefault();
        if (e.shiftKey) {
            currentIndex = Math.max(0, currentIndex - 3);
            showCurrentPage();
        } else {
            prevPage();
        }
    } else if (lower === 'd' || k === 'ArrowRight') {
        e.preventDefault();
        if (e.shiftKey) {
            currentIndex = Math.min(currentImages.length - 1, currentIndex + 3);
            showCurrentPage();
        } else {
            nextPage();
        }
    } else if (lower === 'f') {
        e.preventDefault();
        toggleImageScaling();
    } else if (k === '+' || k === '=') {
        e.preventDefault();
        zoomIn();
    } else if (k === '-' || k === '_') {
        e.preventDefault();
        zoomOut();
    } else if (k === 'Escape') {
        e.preventDefault();
        closeReader();
    }
});
// ========= INFOKOMIK AUTO INIT =========
function ensureInfoContainer() {
    if (document.getElementById('infocomic-container')) return;
    const gallery = document.getElementById('comic-gallery');
    if (!gallery) return;
    
    const container = document.createElement('div');
    container.className = 'infocomic-container';
    container.id = 'infocomic-container';
    container.innerHTML = `
      <div class="info-image">
        <img id="info-cover" src="https://placehold.co/200x300?text=No+Image" alt="Cover" loading="lazy">
        <div class="action-buttons" style="margin-top:10px; display:flex; flex-direction:column; gap:8px; width:100%;">
            <div style="display:flex; gap:8px; width:100%;">
                <button class="gallery-btn" id="like-btn" style="background:#1877f2; flex:1; margin:0; padding:8px; font-size:14px; box-sizing:border-box; transition: background 0.3s;"><i class="fa-regular fa-thumbs-up"></i> <span class="like-count" style="background:rgba(0,0,0,0.2); padding:2px 6px; border-radius:10px; margin-left:4px; font-size:12px;">0</span></button>
                <button class="gallery-btn" id="favorite-btn" style="background:#ff3b6f; flex:1; margin:0; padding:8px; font-size:14px; box-sizing:border-box;"><i class="fa-solid fa-heart"></i> Favorite</button>
            </div>
            <div class="share-container" style="display:flex; align-items:center; justify-content:space-between; margin-top:2px; width:100%; box-sizing:border-box;">
                <span class="share-label" style="color:#aaa; font-weight:bold; font-size:14px;">Share <span id="share-count">0</span></span>
                <div class="share-buttons" style="display:flex; gap:6px;">
                    <a href="#" id="share-facebook" target="_blank" rel="noopener" class="share-btn facebook"><i class="fab fa-facebook-f"></i></a>
                    <a href="#" id="share-x" target="_blank" rel="noopener" class="share-btn x"><i class="fab fa-x-twitter"></i></a>
                    <a href="#" id="share-telegram" target="_blank" rel="noopener" class="share-btn telegram"><i class="fab fa-telegram-plane"></i></a>
                    <button type="button" class="share-btn copy" onclick="copyLink()"><i class="fas fa-copy"></i></button>
                </div>
            </div>
        </div>
      </div>
      <div class="info-details">
        <div class="info-item"><span class="info-value" id="info-title" style="font-size:18px;font-weight:700;">-</span></div>
        <div class="info-item"><span class="info-value" id="info-code" style="cursor:pointer;color:#ffffff;">-</span></div>
        <div class="info-item"><span class="info-label">Parodies:</span><span class="info-value" id="info-parodies">-</span></div>
        <div class="info-item"><span class="info-label">Characters:</span><span class="info-value" id="info-characters">-</span></div>
        <div class="info-item"><span class="info-label">Tags:</span><span class="info-value" id="info-tags">-</span></div>
        <div class="info-item"><span class="info-label">Artists:</span><span class="info-value" id="info-artists">-</span></div>
        <div class="info-item"><span class="info-label">Groups:</span><span class="info-value" id="info-groups">-</span></div>
        <div class="info-item"><span class="info-label">Languages:</span><span class="info-value" id="info-languages">-</span></div>
        <div class="info-item"><span class="info-label">Categories:</span><span class="info-value" id="info-categories">-</span></div>
        <div class="info-item"><span class="info-label">Pages:</span><span class="info-value" id="info-pages">-</span></div>
        <div class="info-item"><span class="info-label">Uploaded:</span><span class="info-value" id="info-uploaded">-</span></div>
      </div>`;
    
    gallery.parentNode.insertBefore(container, gallery);
    
    // Update share links (URL halaman ini)
    const currentUrl = encodeURIComponent(window.location.href);
    const fbLink = container.querySelector('#share-facebook');
    const tgLink = container.querySelector('#share-telegram');
    const xLink = container.querySelector('#share-x');
    if (fbLink) fbLink.href = `https://www.facebook.com/sharer/sharer.php?u=${currentUrl}`;
    if (tgLink) tgLink.href = `https://t.me/share/url?url=${currentUrl}`;
    if (xLink) xLink.href = `https://x.com/intent/tweet?url=${currentUrl}`;
    
    const controls = document.createElement('div');
    controls.id = 'gallery-controls';
    controls.style.cssText = 'text-align:center;margin-bottom:20px;';
    controls.innerHTML = '<button id="showMoreBtn" class="gallery-btn" onclick="showMore()"><i class="fa-regular fa-eye"></i> Show More</button><button id="showAllBtn" class="gallery-btn" onclick="showAll()" style="background:#888;">Show All</button>';
    gallery.parentNode.insertBefore(controls, gallery.nextSibling);

    // Event listener untuk tombol Like & Favorite
    document.body.addEventListener('click', function(e) {
        // Handle Like Button
        var likeBtn = e.target.closest('#like-btn');
        if (likeBtn) {
            const comicId = getComicIdFromUrl();
            const isLiked = likeBtn.getAttribute('data-liked') === 'true'
                || localStorage.getItem('liked_' + comicId) === 'true';

            // Jika sudah pernah di-like, jangan hit server lagi
            if (isLiked) return;

            likeBtn.setAttribute('data-liked', 'true');
            likeBtn.style.background = '#1877f2';
            likeBtn.style.cursor = 'not-allowed';

            // Tampilkan angka lama + 1 dulu supaya mulus, lalu pakai angka asli server
            const oldSpan = likeBtn.querySelector('.like-count');
            const oldCount = oldSpan ? (parseInt(oldSpan.textContent, 10) || 0) : 0;
            likeBtn.innerHTML = '<i class="fa-solid fa-thumbs-up"></i> Like <span class="like-count" style="background:rgba(0,0,0,0.2); padding:2px 6px; border-radius:10px; margin-left:4px; font-size:12px;">' + (oldCount + 1) + '</span>';

            // Tambah like ke server (tunggu katalog agar slug = dashboard)
            whenCatalogReady(function() {
                if (!(window.VH && window.VH.hit && window.VH.keyOf)) return;
                window.VH.hit(window.VH.keyOf('like', getTrackSlug())).then(function(newCount) {
                    if (!newCount) return; // gagal jaringan: biarkan angka optimistis
                    likeBtn.innerHTML = '<i class="fa-solid fa-thumbs-up"></i> Like <span class="like-count" style="background:rgba(0,0,0,0.2); padding:2px 6px; border-radius:10px; margin-left:4px; font-size:12px;">' + newCount + '</span>';
                });
            });

            // Simpan status like (kunci per komik)
            localStorage.setItem('liked_' + comicId, 'true');
        }

        // Handle Share Buttons (increment global di server, sama seperti dashboard)
        var shareBtn = e.target.closest('#share-facebook, #share-x, #share-telegram, .share-btn.copy');
        if (shareBtn) {
            if (window.VH && window.VH.hit && window.VH.keyOf) {
                const counterEl = document.getElementById('share-count');
                // Optimistis: tampilkan angka lama + 1 dulu, lalu ditimpa angka asli server
                if (counterEl) {
                    const cur = parseInt(counterEl.textContent, 10) || 0;
                    counterEl.textContent = cur + 1;
                }
                whenCatalogReady(function() {
                    if (!(window.VH && window.VH.hit && window.VH.keyOf)) return;
                    window.VH.hit(window.VH.keyOf('share', getTrackSlug())).then(function(newCount) {
                        if (newCount && counterEl) counterEl.textContent = newCount;
                    });
                });
            }
        }

        // Handle Favorite Button
        var favBtn = e.target.closest('#favorite-btn');
        if (favBtn) {
            const isFav = favBtn.getAttribute('data-favorited') === 'true';
            const newFavState = !isFav;
            favBtn.setAttribute('data-favorited', newFavState);
            favBtn.innerHTML = newFavState ? '<i class="fa-solid fa-heart"></i> Unfavorite' : '<i class="fa-solid fa-heart"></i> Favorite';
            favBtn.style.background = '#ff3b6f';

            try {
                let favorites = JSON.parse(localStorage.getItem('comicFavorites')) || [];
                const comicId = getComicIdFromUrl();
                
                const comicData = allPages.find(p => ((p.code || "").trim().replace(/^#/, "")) === comicId || ((p.link || '').split('?')[0]).replace('.html', '') === comicId);
                const title = comicData ? comicData.title : (document.getElementById('info-title') ? document.getElementById('info-title').textContent : '');
                const coverImg = comicData ? comicData.image : (document.getElementById('info-cover') ? document.getElementById('info-cover').src : '');
                
                if (newFavState) {
                    if (!favorites.some(f => f.id === comicId)) {
                        favorites.push({ id: comicId, cover: coverImg, title: title });
                    }
                } else {
                    favorites = favorites.filter(f => f.id !== comicId);
                }
                localStorage.setItem('comicFavorites', JSON.stringify(favorites));
            } catch (err) {}
        }
    });

    // Cek status like, share, dan favorite saat halaman dimuat.
    // Dipanggil ulang setelah katalog termuat agar slug sama dengan dashboard.
    window.refreshComicCounts = function() {
        const comicId = getComicIdFromUrl();
        if (!comicId) return;
        const slugId = getTrackSlug();

        // Ambil data real-time dari server
        if (window.VH && window.VH.get && window.VH.keyOf) {
            // Like count - AMBIL DARI SERVER SAAT LOAD
            window.VH.get(window.VH.keyOf('like', slugId)).then(function(count) {
                const likeBtn = document.getElementById('like-btn');
                if (!likeBtn) return;
                const isLiked = localStorage.getItem('liked_' + comicId) === 'true';
                if (isLiked) {
                    // Sudah pernah di-like: jempol penuh + "Like" + jumlah
                    likeBtn.setAttribute('data-liked', 'true');
                    likeBtn.disabled = true;
                    likeBtn.style.background = '#1877f2';
                    likeBtn.style.cursor = 'not-allowed';
                    likeBtn.innerHTML = '<i class="fa-solid fa-thumbs-up"></i> Like <span class="like-count" style="background:rgba(0,0,0,0.2); padding:2px 6px; border-radius:10px; margin-left:4px; font-size:12px;">' + count + '</span>';
                } else {
                    // Belum di-like: jempol kosong + jumlah (tanpa tulisan "Like")
                    likeBtn.removeAttribute('data-liked');
                    likeBtn.disabled = false;
                    likeBtn.style.cursor = 'pointer';
                    likeBtn.innerHTML = '<i class="fa-regular fa-thumbs-up"></i> <span class="like-count" style="background:rgba(0,0,0,0.2); padding:2px 6px; border-radius:10px; margin-left:4px; font-size:12px;">' + count + '</span>';
                }
            });
            // Share count
            window.VH.get(window.VH.keyOf('share', slugId)).then(function(count) {
                const shareCountEl = document.getElementById('share-count');
                if (shareCountEl) shareCountEl.textContent = count;
            });
        }

        // Cek Favorite
        try {
            let favorites = JSON.parse(localStorage.getItem('comicFavorites')) || [];
            if (favorites.some(f => f.id === comicId)) {
                const favBtn = document.getElementById('favorite-btn');
                if (favBtn) {
                    favBtn.setAttribute('data-favorited', 'true');
                    favBtn.innerHTML = '<i class="fa-solid fa-heart"></i> Unfavorite';
                    favBtn.style.background = '#ff3b6f';
                }
            }
        } catch (err) {}
    };
}

function injectInfoCSS() {
    if (document.getElementById('info-css-injected')) return;
    const css = document.createElement('style');
    css.id = 'info-css-injected';
    css.textContent = `
      .gallery-container .page-title { display:none !important; }
      .infocomic-container { background:#1a1a1a; border:1px solid #333; border-radius:8px; padding:15px 20px; margin:0 auto 20px; display:flex; gap:20px; align-items:flex-start; max-width:1200px; flex-wrap:wrap; font-size:15px; position:relative; overflow:hidden; isolation:isolate; }
      .infocomic-container::before {
        content:""; position:absolute; inset:0;
        background-image:var(--cover-bg); background-size:cover; background-position:center;
        filter:grayscale(1); opacity:0.25; z-index:-1;
      }
      .infocomic-container .info-image { display:inline-block; width:25%; vertical-align:top; }
      .infocomic-container .info-image img { max-width:100%; height:auto; border-radius:6px; border:1px solid #333; }
      .infocomic-container .info-details { display:flex; flex-direction:column; gap:10px; flex:1; min-width: 300px; }
      .infocomic-container .info-item { display:flex; align-items:center; gap:6px; }
      .infocomic-container .info-label { color:#ffefef; white-space:nowrap; font-weight:900; min-width: 80px; }
      .infocomic-container .info-value { color:#fff; font-weight:700; flex:1; }
      .infocomic-container .upload-date { color:#999; font-weight:700; }
      .share-btn { width:36px; height:36px; border-radius:50%; display:flex; align-items:center; justify-content:center; text-decoration:none; color:#fff; transition:transform 0.2s, background 0.2s; border:1px solid #444; }
      .share-btn:hover { transform:translateY(-2px); }
      .share-btn.facebook { background: #3b5998; }
      .share-btn.telegram { background: #0088cc; }
      .share-btn.x { background: #000; }
      .share-btn.copy { background: #555; cursor: pointer; border: none; }
      .share-btn.copy:hover { background: #777; }
      .info-tag { display:inline-flex; align-items:stretch; background:#555; color:#fff; margin:2px 3px; border-radius:4px; font-weight:700; font-size:13px; overflow:hidden; border:1px solid #777; }
      .info-tag .tag-name, .info-tag a.tag-name { padding:3px 0 3px 8px; color:inherit; text-decoration:none; display:inline-block; }
      .info-tag a.tag-name:hover { background:#666; }
      .tag-count { display:flex; align-items:center; color:#fff; background:#000; padding:3px 7px; margin-left:6px; font-size:12px; }
      .gallery-btn { background:#f10000; border:none; color:#fff; padding:10px 25px; font-size:15px; font-weight:700; cursor:pointer; border-radius:6px; margin:0 5px; transition:opacity 0.2s; }
      .gallery-btn:hover { opacity:0.8; }
      #showAllBtn { background:#888; }
      #comic-gallery { background:#1a1a1a; border:1px solid #333; border-radius:8px; width:100%; max-width:1200px; padding:10px; margin:0 auto 20px; display:grid; grid-template-columns:repeat(5,1fr); gap:10px; }
      #comic-gallery img { display:block; border-top-left-radius:.3em; border-top-right-radius:.3em; max-width:100%; height:auto; background-color:#1f1f1f; color:transparent; }
      #comic-gallery img.highlight {
        border-color: #f10000;
        transition: all 0.3s ease;
      }
      /* MORE-LIKE-THIS SLIDER (ala videohen): geser horizontal + snap */
      #more-like-this-grid {
        position: relative;
        display: flex;
        overflow-x: auto;
        overflow-y: hidden;
        gap: 8px;
        padding: 10px 10px 14px;
        cursor: grab;
        user-select: none;
        -webkit-user-select: none;
        touch-action: pan-x pan-y;
        scrollbar-width: none;
        -ms-overflow-style: none;
      }
      #more-like-this-grid::-webkit-scrollbar { display: none; }
      #more-like-this-grid .comic-item {
        flex: 0 0 auto;
        width: 42%;
        scroll-snap-align: start;
        animation: mlSlideIn 0.55s cubic-bezier(0.22, 1, 0.36, 1) backwards;
        overflow: visible;
      }
      #more-like-this-grid .comic-item:hover .comic-title {
        max-height: 34px;
        background: #343535;
        box-shadow: none;
      }
      @media (min-width: 540px) {
        #more-like-this-grid .comic-item { width: 30%; }
      }
      @media (min-width: 768px) {
        #more-like-this-grid .comic-item { width: 23%; }
      }
      @media (min-width: 1000px) {
        #more-like-this-grid .comic-item { width: 15.5%; }
      }
      @keyframes mlSlideIn {
        from { opacity: 0; transform: translateY(25px) scale(0.95); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }
      .close-btn:hover {
        color: #f10000;
      }
      .nav-arrow:hover {
        color: #f10000;
      }
      .zoom-btn:hover {
        color: #f10000;
      }
      @media (max-width:1024px) { 
        #comic-gallery { grid-template-columns:repeat(3,1fr); } 
        .infocomic-container .info-image { width:35%; } 
        .infocomic-container { font-size: 14px; }
        .infocomic-container .info-item { font-size: 14px; }
      }
      @media (max-width:600px) { #comic-gallery { grid-template-columns:repeat(2,1fr); } .infocomic-container .info-image { width:100%; display:block; } }
      @media (max-width:410px) { .infocomic-container .info-image img { max-width:100%; } }
      #more-like-this-section { max-width:1200px; margin:20px auto; }
      #more-like-this-section .section-title { display:flex; align-items:center; margin:10px 0; font-size:20px; font-weight:bold; }
      #more-like-this-section .section-title::after { content:''; flex:1; height:3px; background:#b80006; margin-left:5px; }
      #more-like-this-section .title-ribbon { background:#b80006; color:#fff; padding:5px 25px 5px 10px; clip-path:polygon(0 0,100% 0,85% 100%,100% 100%,0 100%,0px 50%); white-space:nowrap; }
      .comic-grid { display:grid; grid-template-columns:repeat(5,1fr); gap:5px; background-color:#292b2b; padding:10px; border-radius:5px; }
      .comic-item { position:relative; margin-bottom:1em; }
      .comic-item:hover { border-color:#ff0008; border-radius:5px; z-index:100; color:#ff0008; background:#000000; }
      .comic-thumb-container { aspect-ratio:2/3; overflow:hidden; background:#222; border-radius:5px 5px 0 0; }
      .comic-thumb { max-width:100%; height:auto; display:block; }
      .comic-title { line-height:15px; font-size:12px; left:0; right:0; top:94%; position:absolute; z-index:10; overflow:hidden; width:100%; max-height:34px; padding:3px; background-color:#343535; font-weight:700; display:block; text-align:center; text-decoration:none; color:#ff0008; border-bottom-left-radius:.3em; border-bottom-right-radius:.3em; }
      .comic-item:hover .comic-title { max-height:100%; box-shadow:0 10px 20px var(--shadow); background:#3f3d3d; }
      @media (max-width:600px) { .comic-grid { grid-template-columns:repeat(2,1fr); gap:4px; padding:5px; } }
    `;
    document.head.appendChild(css);
}

// ========= HELPER FUNCTIONS =========
window.incrementShare = function() {
    if (window.VH && window.VH.hit && window.VH.keyOf) {
        window.VH.hit(window.VH.keyOf('share', getTrackSlug())).then(function(newCount) {
            const counterEl = document.getElementById('share-count');
            if (counterEl) counterEl.textContent = newCount;
        });
    }
};

// ========= INITIALIZATION =========
document.addEventListener("DOMContentLoaded", function() {
    // Event listener untuk tombol Favorite di header
    document.body.addEventListener('click', function(e) {
        var favBtn = e.target.closest('#navFavorite, #navFavoriteMobile');
        if (favBtn) {
            e.preventDefault();
            window.location.href = '../favorite.html';
        }
    });

    const initialComicId = getComicIdFromUrl();
    const titleSpan = document.getElementById('pageTitleNumber');
    if (titleSpan) titleSpan.textContent = `#${initialComicId}`;
    try { document.title = `#${initialComicId}`; } catch (e) {}
    currentPageTitle = `#${initialComicId}`;
    
    // Preconnect host gambar (hemat waktu handshake/TLS tiap koneksi baru)
    try {
        ["https://i.ibb.co.com", "https://images.weserv.nl"].forEach(function(h) {
            var pc = document.createElement("link");
            pc.rel = "preconnect";
            pc.href = h;
            pc.crossOrigin = "anonymous";
            document.head.appendChild(pc);
        });
    } catch (e) {}
    injectInfoCSS();
    ensureInfoContainer();
    loadData().then(function() {
        if (window.refreshComicCounts) window.refreshComicCounts();
        return loadIdPictures();
    }).then(function() { initGallery(); });
    setupEventListeners();
});

// (modul iklan mode baca dihapus)

// ========= PAUSE SOCIALBAR SAAT MODE BACA =========
// Hanya menyembunyikan wadah socialbar selama reader buka, dibalikkan saat tutup.
(function() {
    var HIDE_ATTR = "data-reader-hidden";

    function isReaderOpen() {
        var r = document.getElementById("manga-reader");
        if (!r) return false;
        try { return window.getComputedStyle(r).display !== "none"; }
        catch (e) { return r.style.display === "flex"; }
    }

    function isSocialBar(el) {
        if (!el || el.nodeType !== 1) return false;
        var tag = el.tagName;
        if (tag !== "DIV" && tag !== "IFRAME") return false;
        if (el.parentNode !== document.documentElement) return false;
        var id = el.id || "";
        if (id.indexOf("container-") === 0) return true;
        if (el.hasAttribute && el.hasAttribute(HIDE_ATTR)) return true;
        try { if (el.querySelector && el.querySelector("iframe")) return true; }
        catch (e) {}
        return false;
    }
    function hideSocialBars() {
        try {
            var kids = document.documentElement.children;
            for (var i = 0; i < kids.length; i++) {
                var el = kids[i];
                if (isSocialBar(el)) {
                    if (!el.hasAttribute(HIDE_ATTR)) {
                        el.setAttribute(HIDE_ATTR, "1");
                        el.setAttribute("data-rd-visibility", el.style.visibility || "");
                        el.setAttribute("data-rd-pointer", el.style.pointerEvents || "");
                    }
                    // JANGAN pakai display:none — iframe iklan bisa gagal render
                    // (gambar rusak) setelah dipaksa display:none lalu dimunculkan lagi.
                    el.style.visibility = "hidden";
                    el.style.pointerEvents = "none";
                }
            }
        } catch (e) {}
    }    function showSocialBars() {
        try {
            var list = document.querySelectorAll("[" + HIDE_ATTR + "]");
            for (var i = 0; i < list.length; i++) {
                list[i].style.visibility = list[i].getAttribute("data-rd-visibility") || "";
                list[i].style.pointerEvents = list[i].getAttribute("data-rd-pointer") || "";
                list[i].removeAttribute(HIDE_ATTR);
                list[i].removeAttribute("data-rd-visibility");
                list[i].removeAttribute("data-rd-pointer");
            }
        } catch (e) {}
    }

    var socialEnforcer = null;
    function startEnforce() {
        hideSocialBars();
        if (!window.MutationObserver || socialEnforcer) return;
        socialEnforcer = new MutationObserver(function(muts) {
            if (!isReaderOpen()) return;
            for (var i = 0; i < muts.length; i++) {
                var m = muts[i];
                if (m.type === "childList") {
                    for (var j = 0; j < m.addedNodes.length; j++) {
                        var n = m.addedNodes[j];
                        if (n && n.nodeType === 1 && isSocialBar(n)) {
                            if (!n.hasAttribute(HIDE_ATTR)) {
                                n.setAttribute(HIDE_ATTR, "1");
                                n.setAttribute("data-rd-visibility", n.style.visibility || "");
                                n.setAttribute("data-rd-pointer", n.style.pointerEvents || "");
                            }
                            n.style.visibility = "hidden";
                            n.style.pointerEvents = "none";
                        }
                    }
                }
            }
        });
        try {
            // Cukup pantau elemen baru. Jangan pantau atribut style:
            // dulu kode ini "berkelahi" dengan script iklan dan merusak tampilannya.
            socialEnforcer.observe(document.documentElement, { childList: true });
        } catch (e) {}
    }

    function stopEnforce() {
        if (socialEnforcer) {
            try { socialEnforcer.disconnect(); } catch (e) {}
            socialEnforcer = null;
        }
        showSocialBars();
    }

    var readerEl = document.getElementById("manga-reader");
    if (readerEl && window.MutationObserver) {
        var lastOpen = isReaderOpen();
        if (lastOpen) startEnforce();
        new MutationObserver(function() {
            var open = isReaderOpen();
            if (open === lastOpen) return;
            lastOpen = open;
            if (open) startEnforce(); else stopEnforce();
        }).observe(readerEl, { attributes: true, attributeFilter: ["style", "class"] });
    }

    // Dipakai langsung oleh openReader()/closeReader() supaya tidak menunggu observer.
    window.__vhHideSocialBars = startEnforce;
    window.__vhShowSocialBars = stopEnforce;
})();
