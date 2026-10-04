// ========= KONFIGURASI =========
const SITE_ROOT = window.location.pathname.split("/").slice(0, -1).join("/") + "/";
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

let allPages = [];
let currentPageNum = 1;
const itemsPerPage = 20;
const RECOMMENDED_KEY = 'allyoulike_recommended';
const RECOMMENDED_TIMESTAMP_KEY = 'allyoulike_recommended_timestamp';
const PAGE_KEY = 'allyoulike_current_page';
const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

function parseUploadedDate(v) {
    if (!v || v === '-' || v === '') return -Infinity;
    const d = new Date(v);
    return isNaN(d.getTime()) ? -Infinity : d.getTime();
}

function goToSearchPage(query) {
    if (query && query.trim()) {
        window.location.href = `${SEARCH_PAGE_URL}?q=${encodeURIComponent(query.trim())}`;
    } else {
        window.location.href = SEARCH_PAGE_URL;
    }
}

function showRandomComic() {
    if (allPages.length === 0) return;
    const randomIndex = Math.floor(Math.random() * allPages.length);
    const randomItem = allPages[randomIndex];
    const link = randomItem.link.startsWith('http') ? randomItem.link : BASE_URL + randomItem.link;
    window.location.href = link;
}

function openVideoSite() {
    window.open(VIDEO_URL, '_blank');
}

function getRecommendedComics() {
    const now = Date.now();
    const savedTimestamp = localStorage.getItem(RECOMMENDED_TIMESTAMP_KEY);
    const savedRecommended = localStorage.getItem(RECOMMENDED_KEY);
    
    if (savedTimestamp && savedRecommended && (now - parseInt(savedTimestamp)) < TWENTY_FOUR_HOURS) {
        try {
            return JSON.parse(savedRecommended);
        } catch(e) { console.log(e); }
    }
    
    if (allPages.length > 0) {
        const shuffled = [...allPages];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        const newRecommended = shuffled.slice(0, 5);
        localStorage.setItem(RECOMMENDED_KEY, JSON.stringify(newRecommended));
        localStorage.setItem(RECOMMENDED_TIMESTAMP_KEY, now.toString());
        return newRecommended;
    }
    return [];
}

function saveCurrentPage(page) {
    sessionStorage.setItem(PAGE_KEY, page.toString());
}

function getLastPage() {
    const savedPage = sessionStorage.getItem(PAGE_KEY);
    if (savedPage && !isNaN(parseInt(savedPage))) return parseInt(savedPage);
    return 1;
}

async function loadData() {
    try {
        const recomendGrid = document.getElementById('recomend-grid');
        const newUploadsGrid = document.getElementById('new-uploads-grid');
        
        if (recomendGrid) recomendGrid.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:50px;">⏳ Loading data...</div>';
        if (newUploadsGrid) newUploadsGrid.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:50px;">⏳ Loading data...</div>';
        
        const allItems = await fetchAllPages();
        allPages = allItems.filter(p => p.lengkap === 'yes');
        allPages.sort((a, b) => parseUploadedDate(b.Uploaded) - parseUploadedDate(a.Uploaded));
        
        if (allPages.length === 0) {
            if (recomendGrid) recomendGrid.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:50px;">📭 No data</div>';
            if (newUploadsGrid) newUploadsGrid.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:50px;">📭 No data</div>';
            return;
        }
        
        const recommendedComics = getRecommendedComics();
        renderGrid(recommendedComics, 'recomend-grid', false, 1);
        
        const lastPage = getLastPage();
        currentPageNum = lastPage;
        const totalPages = Math.ceil(allPages.length / itemsPerPage);
        if (currentPageNum > totalPages) currentPageNum = 1;
        goToPage(currentPageNum);
    } catch (err) {
        console.error('Error loading data:', err);
        const recomendGrid = document.getElementById('recomend-grid');
        const newUploadsGrid = document.getElementById('new-uploads-grid');
        if (recomendGrid) recomendGrid.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:50px; color:#ff8888;">❌ Failed: ${err.message}</div>`;
        if (newUploadsGrid) newUploadsGrid.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:50px;">Gagal memuat data.</div>';
    }
}

function renderGrid(data, gridId, showNewBadge = false, startIndex = 0) {
    const grid = document.getElementById(gridId);
    if (!grid) return;
    grid.innerHTML = "";
    if (!data || data.length === 0) {
        grid.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:50px;">📭 Tidak ada konten.</div>';
        return;
    }
    data.forEach((item, idx) => {
        let link = item.link.startsWith('http') ? item.link : BASE_URL + item.link;
        let imgUrl = item.image || "https://placehold.co/400x600?text=No+Image";
        let title = item.title || "Untitled";
        let badge = '';
        if (showNewBadge && (startIndex + idx) < 30) {
            badge = '<span class="badge badge-new">NEW</span>';
        }
        grid.innerHTML += `
            <div class="comic-item" >
                ${badge}
                <a href="${link}" style="text-decoration: none;">
                    <div class="comic-thumb-container">
                        <img src="${imgUrl}" class="comic-thumb" loading="lazy" 
                             onerror="this.src='https://placehold.co/400x600?text=Error'">
                    </div>
                    <div class="comic-title">${escapeHtml(title)}</div>
                </a>
            </div>
        `;
    });

}

function renderPagination(currentPage) {
    const container = document.getElementById('pagination');
    if (!container) return;
    container.innerHTML = "";
    const totalPages = Math.ceil(allPages.length / itemsPerPage);
    if (totalPages <= 1) return;
    
    const createBtn = (text, onClick, isDisabled = false, extraClass = 'pagination-arrow') => {
        const btn = document.createElement('button');
        btn.innerHTML = text;
        btn.className = extraClass;
        if (isDisabled) btn.classList.add('disabled');
        btn.onclick = onClick;
        return btn;
    };
    
    container.appendChild(createBtn('<<', () => { if (currentPage > 1) goToPage(1); }, currentPage === 1));
    container.appendChild(createBtn('<', () => { if (currentPage > 1) goToPage(currentPage - 1); }, currentPage === 1));
    
    let startPage = 1, endPage = totalPages;
    const maxVisible = 5;
    if (totalPages > maxVisible + 2) {
        if (currentPage <= 3) { startPage = 1; endPage = maxVisible; }
        else if (currentPage >= totalPages - 2) { startPage = totalPages - maxVisible + 1; endPage = totalPages; }
        else { startPage = currentPage - 2; endPage = currentPage + 2; }
    }
    for (let i = startPage; i <= endPage; i++) {
        const pageBtn = document.createElement('button');
        pageBtn.innerText = i;
        pageBtn.className = `pagination-btn ${i === currentPage ? 'active' : ''}`;
        pageBtn.onclick = () => goToPage(i);
        container.appendChild(pageBtn);
    }
    if (endPage < totalPages - 1) {
        const dots = document.createElement('span');
        dots.innerText = '...';
        dots.className = 'pagination-dots';
        container.appendChild(dots);
    }
    if (endPage < totalPages) {
        const lastBtn = document.createElement('button');
        lastBtn.innerText = totalPages;
        lastBtn.className = `pagination-btn ${totalPages === currentPage ? 'active' : ''}`;
        lastBtn.onclick = () => goToPage(totalPages);
        container.appendChild(lastBtn);
    }
    container.appendChild(createBtn('>', () => { if (currentPage < totalPages) goToPage(currentPage + 1); }, currentPage === totalPages));
    container.appendChild(createBtn('>>', () => { if (currentPage < totalPages) goToPage(totalPages); }, currentPage === totalPages));
}

function goToPage(page) {
    currentPageNum = page;
    const start = (page - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const paginatedData = allPages.slice(start, end);
    renderGrid(paginatedData, 'new-uploads-grid', true, start);
    renderPagination(page);
    saveCurrentPage(page);
    const newSection = document.getElementById('new-section');
    if (newSection) newSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

function attachHeaderEvents() {
    // Delegated events for navigation
    document.body.addEventListener('click', function(e) {
        if (e.target.closest('#navRandom')) {
            e.preventDefault();
            if (allPages.length > 0) showRandomComic();
        }
        if (e.target.closest('#navHome')) {
            e.preventDefault();
            window.location.href = HOME_URL;
        }
        if (e.target.closest('#navVideo')) {
            e.preventDefault();
            openVideoSite();
        }
        if (e.target.closest('#logoClick')) {
            window.location.href = HOME_URL;
        }
    });
    
    // Mobile random
    const navRandomMobile = document.getElementById('navRandomMobile');
    if (navRandomMobile) {
        navRandomMobile.onclick = function(e) {
            e.preventDefault();
            const nav = document.getElementById('mobileNavOverlay');
            if (nav) nav.classList.remove('show');
            if (allPages.length > 0) showRandomComic();
        };
    }
    
    // Search functionality
    const searchBtnDesktop = document.getElementById('searchBtnDesktop');
    const searchInputDesktop = document.getElementById('searchInputDesktop');
    if (searchBtnDesktop) searchBtnDesktop.onclick = () => goToSearchPage(searchInputDesktop?.value);
    if (searchInputDesktop) searchInputDesktop.onkeypress = (e) => { if (e.key === 'Enter') goToSearchPage(e.target.value); };
    
    const searchIconMobile = document.getElementById('searchIconMobile');
    const mobileOverlay = document.getElementById('mobileSearchOverlay');
    const closeSearchBtn = document.getElementById('closeSearchBtn');
    const searchBtnMobile = document.getElementById('searchBtnMobile');
    const searchInputMobile = document.getElementById('searchInputMobile');
    
    if (searchIconMobile) searchIconMobile.onclick = () => { if (mobileOverlay) mobileOverlay.style.display = 'block'; setTimeout(() => searchInputMobile?.focus(), 100); };
    if (closeSearchBtn) closeSearchBtn.onclick = () => { if (mobileOverlay) mobileOverlay.style.display = 'none'; if (searchInputMobile) searchInputMobile.value = ''; };
    if (searchBtnMobile) searchBtnMobile.onclick = () => { const q = searchInputMobile?.value.trim(); if (mobileOverlay) mobileOverlay.style.display = 'none'; goToSearchPage(q); };
    if (searchInputMobile) searchInputMobile.onkeypress = (e) => { if (e.key === 'Enter') { const q = e.target.value.trim(); if (mobileOverlay) mobileOverlay.style.display = 'none'; goToSearchPage(q); } };
    if (mobileOverlay) mobileOverlay.addEventListener('click', (e) => { if (e.target === mobileOverlay) { mobileOverlay.style.display = 'none'; if (searchInputMobile) searchInputMobile.value = ''; } });
    
    // Dropdown click toggle (event delegation - header dimuat dinamis)
    document.body.addEventListener('click', function(e) {
        const dropContent = document.querySelector('.dropdown-content-click');
        if (!dropContent) return;
        if (e.target.closest('.dropbtn-click')) {
            e.preventDefault();
            dropContent.classList.toggle('show');
        } else if (!dropContent.contains(e.target)) {
            dropContent.classList.remove('show');
        }
    });
    
    // Hamburger mobile nav
    const hamburger = document.getElementById('hamburgerMenu');
    const mobileNavOverlay = document.getElementById('mobileNavOverlay');
    if (hamburger && mobileNavOverlay) {
        hamburger.onclick = (e) => {
            e.stopPropagation();
            mobileNavOverlay.classList.toggle('show');
        };
        document.addEventListener('click', (e) => {
            if (!hamburger.contains(e.target) && !mobileNavOverlay.contains(e.target)) {
                mobileNavOverlay.classList.remove('show');
            }
        });
        mobileNavOverlay.querySelectorAll('a').forEach(function(link) {
            link.addEventListener('click', function() {
                mobileNavOverlay.classList.remove('show');
            });
        });
    }
    
    console.log('Header events attached');
}

// Tunggu hingga DOM siap dan header sudah dimuat
document.addEventListener('DOMContentLoaded', function() {
    // Attach events langsung setelah render
    setTimeout(function() {
        attachHeaderEvents();
    }, 500);
    
    // Load data comics
    loadData();
});
