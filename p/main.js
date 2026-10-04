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
let currentPageTitle = '';

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
    showCurrentPage();
    try { if (window.VH_hitRead) window.VH_hitRead(); } catch (e) {}
    console.log('Reader opened at page:', index + 1);
}

function showCurrentPage() {
    const img = document.getElementById('reader-image');
    img.src = proxied(currentImages[currentIndex]);
    img.style.transform = `scale(${zoomLevel})`;
    const pageText = `${currentIndex + 1} of ${currentImages.length}`;
    document.getElementById('page-counter').textContent = pageText;
    document.getElementById('page-counter-bottom').textContent = pageText;
    document.getElementById('zoom-level').textContent = zoomLevel.toFixed(1) + "x";
    document.getElementById('zoom-level-bottom').textContent = zoomLevel.toFixed(1) + "x";
    saveProgress(currentIndex);
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
    zoomLevel = Math.min(maxZoom, zoomLevel + 0.25); 
    document.getElementById('reader-image').style.transform = `scale(${zoomLevel})`; 
    document.getElementById('zoom-level').textContent = zoomLevel.toFixed(1) + "x"; 
    document.getElementById('zoom-level-bottom').textContent = zoomLevel.toFixed(1) + "x"; 
}

function zoomOut() { 
    zoomLevel = Math.max(1.0, zoomLevel - 0.25); 
    document.getElementById('reader-image').style.transform = `scale(${zoomLevel})`; 
    document.getElementById('zoom-level').textContent = zoomLevel.toFixed(1) + "x"; 
    document.getElementById('zoom-level-bottom').textContent = zoomLevel.toFixed(1) + "x"; 
}

function closeReader() { 
    document.getElementById('manga-reader').style.display = 'none';
    const lastPageRead = getProgress();
    if (lastPageRead > 0) {
        setTimeout(() => {
            highlightGalleryImage(lastPageRead);
        }, 100);
    }
}

function updateMaxZoom() { 
    maxZoom = window.innerWidth <= 1280 ? 2.0 : 3.0; 
}

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
    if (document.getElementById('manga-reader').style.display === 'flex') { 
        if (e.key === "ArrowRight") nextPage(); 
        if (e.key === "ArrowLeft") prevPage(); 
        if (e.key === "Escape") closeReader(); 
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
        <img id="info-cover" src="https://placehold.co/200x300?text=No+Image" alt="Cover">
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
    
    const controls = document.createElement('div');
    controls.id = 'gallery-controls';
    controls.style.cssText = 'text-align:center;margin-bottom:20px;';
    controls.innerHTML = '<button id="showMoreBtn" class="gallery-btn" onclick="showMore()"><i class="fa-regular fa-eye"></i> Show More</button><button id="showAllBtn" class="gallery-btn" onclick="showAll()" style="background:#888;">Show All</button>';
    gallery.parentNode.insertBefore(controls, gallery.nextSibling);
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
      .infocomic-container .info-image { flex-shrink:0; }
      .infocomic-container .info-image img { width:350px; height:auto; border-radius:6px; border:1px solid #333; }
      .infocomic-container .info-details { display:flex; flex-direction:column; gap:10px; flex:1; }
      .infocomic-container .info-item { display:flex; align-items:flex-start; gap:6px; }
      .infocomic-container .info-label { color:#ffefef; white-space:nowrap; font-weight:900; }
      .infocomic-container .info-value { color:#fff; font-weight:700; flex:1; }
      .infocomic-container .upload-date { color:#999; font-weight:700; }
      .info-tag { display:inline-flex; align-items:stretch; background:#555; color:#fff; margin:2px 3px; border-radius:4px; font-weight:700; font-size:13px; overflow:hidden; border:1px solid #777; }
      .info-tag .tag-name, .info-tag a.tag-name { padding:3px 0 3px 8px; color:inherit; text-decoration:none; display:inline-block; }
      .info-tag a.tag-name:hover { background:#666; }
      .tag-count { display:flex; align-items:center; color:#fff; background:#000; padding:3px 7px; margin-left:6px; font-size:12px; }
      .gallery-btn { background:#f10000; border:none; color:#fff; padding:10px 25px; font-size:15px; font-weight:700; cursor:pointer; border-radius:6px; margin:0 5px; transition:opacity 0.2s; }
      .gallery-btn:hover { opacity:0.8; }
      #showAllBtn { background:#888; }
      #comic-gallery { background:#1a1a1a; border:1px solid #333; border-radius:8px; width:100%; max-width:1200px; padding:10px; margin:0 auto 20px; display:grid; grid-template-columns:repeat(5,1fr); gap:10px; }
      #comic-gallery img { width:100% !important; aspect-ratio:2/3; object-fit:cover; border-radius:6px; cursor:pointer; border:2px solid transparent; transition:transform 0.2s, border-color 0.2s; }
      #comic-gallery img:hover {
        transform: scale(1.02);
        border-color: #f10000;
      }
      #comic-gallery img.highlight {
        border-color: #f10000;
        box-shadow: 0 0 20px rgba(255, 167, 78, 0.8);
        transition: all 0.3s ease;
      }
      /* MORE-LIKE-THIS SLIDER (ala videohen): geser horizontal + snap */
      #more-like-this-grid {
        display: flex;
        overflow-x: auto;
        gap: 8px;
        padding: 10px 10px 14px;
        cursor: grab;
        user-select: none;
        -webkit-user-select: none;
        touch-action: pan-y;
        scrollbar-width: none;
        -ms-overflow-style: none;
      }
      #more-like-this-grid::-webkit-scrollbar { display: none; }
      #more-like-this-grid .comic-item {
        flex: 0 0 auto;
        width: 42%;
        scroll-snap-align: start;
        animation: mlSlideIn 0.55s cubic-bezier(0.22, 1, 0.36, 1) backwards;
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
      @media (max-width:1024px) { #comic-gallery { grid-template-columns:repeat(3,1fr); } }
      @media (max-width:600px) { #comic-gallery { grid-template-columns:repeat(2,1fr); } }
      @media (max-width:410px) { .infocomic-container .info-image img { width:300px; } }
      #more-like-this-section { max-width:1200px; margin:20px auto; }
      #more-like-this-section .section-title { display:flex; align-items:center; margin:10px 0; font-size:20px; font-weight:bold; }
      #more-like-this-section .section-title::after { content:''; flex:1; height:3px; background:#b80006; margin-left:5px; }
      #more-like-this-section .title-ribbon { background:#b80006; color:#fff; padding:5px 25px 5px 10px; clip-path:polygon(0 0,100% 0,85% 100%,100% 100%,0 100%,0px 50%); white-space:nowrap; }
      .comic-grid { display:grid; grid-template-columns:repeat(5,1fr); gap:5px; background-color:#292b2b; padding:10px; border-radius:5px; }
      .comic-item { background:#000000; border-radius:5px; border:1px solid #333; transition:transform 0.2s,border-color 0.2s; position:relative; padding-bottom:30px; }
      .comic-item:hover { border-color:#ff0008; border-radius:5px; z-index:100; color:#ff0008; background:#000000; }
      .comic-thumb-container { aspect-ratio:2/3; overflow:hidden; background:#222; border-radius:5px 5px 0 0; }
      .comic-thumb { width:100%; height:100%; object-fit:cover; display:block; }
      .comic-title { position:absolute; background-color:#000000; border-radius:0 0 5px 5px; left:0; right:0; bottom:0; padding:0 3px 3px; text-align:center; color:#ff0008; text-decoration:none; font-size:12px; font-weight:bold; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
      .comic-item:hover .comic-title { color:#ff0008; background:#1a1a1a; border:1px solid #ff0008; border-top:none; border-radius:0 0 5px 5px; padding:0 3px 3px; margin:0 -1px; }
      @media (max-width:600px) { .comic-grid { grid-template-columns:repeat(2,1fr); gap:4px; padding:5px; } }
    `;
    document.head.appendChild(css);
}

// ========= INITIALIZATION =========
document.addEventListener("DOMContentLoaded", function() {
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
    loadData().then(function() { return loadIdPictures(); }).then(function() { initGallery(); });
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
                    if (!el.hasAttribute(HIDE_ATTR)) el.setAttribute(HIDE_ATTR, "1");
                    el.style.display = "none";
                    el.style.visibility = "hidden";
                }
            }
        } catch (e) {}
    }

    function showSocialBars() {
        try {
            var list = document.querySelectorAll("[" + HIDE_ATTR + "]");
            for (var i = 0; i < list.length; i++) {
                list[i].style.display = "";
                list[i].style.visibility = "";
                list[i].removeAttribute(HIDE_ATTR);
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
                            if (!n.hasAttribute(HIDE_ATTR)) n.setAttribute(HIDE_ATTR, "1");
                            n.style.display = "none";
                            n.style.visibility = "hidden";
                        }
                    }
                } else if (m.type === "attributes" && m.target && m.target.nodeType === 1) {
                    if (isSocialBar(m.target)) {
                        if (!m.target.hasAttribute(HIDE_ATTR)) m.target.setAttribute(HIDE_ATTR, "1");
                        m.target.style.display = "none";
                        m.target.style.visibility = "hidden";
                    }
                }
            }
        });
        try {
            socialEnforcer.observe(document.documentElement, {
                childList: true, attributes: true, subtree: true, attributeFilter: ["style"]
            });
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
})();
