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
const SEARCH_PAGE_URL = SITE_ROOT + "search.html";
const VIDEO_URL = "https://alyoulikevideo.pages.dev/";
const ITEMS_PER_PAGE = 30;
const PAGE_KEY = 'search_current_page';

let allComics = [];
let currentQuery = "";
let currentPageNum = 1;
let currentFilteredResults = [];

function parseUploadedDate(v) {
    if (!v || v === '-' || v === '') return -Infinity;
    const d = new Date(v);
    return isNaN(d.getTime()) ? -Infinity : d.getTime();
}

// ========= FUNGSI NAVIGASI =========
function getRandomComic() {
    if (!allComics.length) return;
    const randomIndex = Math.floor(Math.random() * allComics.length);
    const randomItem = allComics[randomIndex];
    const link = randomItem.link.startsWith('http') ? randomItem.link : BASE_URL + randomItem.link;
    window.location.href = link;
}

function goHome() {
    window.location.href = HOME_URL;
}

function goToSearchPage(query) {
    if (query && query.trim()) {
        window.location.href = `${SEARCH_PAGE_URL}?q=${encodeURIComponent(query.trim())}`;
    } else {
        window.location.href = SEARCH_PAGE_URL;
    }
}

function openVideo() {
    window.open(VIDEO_URL, '_blank');
}

// ========= AMBIL DATA DARI JSON =========
async function loadData() {
    try {
        const allItems = await fetchAllPages();
        
        allComics = allItems.filter(p => p.lengkap === 'yes');
        allComics.sort((a, b) => parseUploadedDate(b.Uploaded) - parseUploadedDate(a.Uploaded));
        
        console.log('Data loaded successfully. Total comics:', allComics.length);
        
        if (allComics.length === 0) {
            showEmptyState('no-data', 'No comics found in database');
            return;
        }
        
        // Cek parameter URL untuk pencarian
        const urlParams = new URLSearchParams(window.location.search);
        const queryParam = urlParams.get('q');
        
        if (queryParam && queryParam.trim() !== "") {
            const searchInput = document.getElementById('mainSearchInput');
            if (searchInput) searchInput.value = queryParam;
            performSearch(queryParam);
        } else {
            // Tampilkan semua komik
            currentFilteredResults = [...allComics];
            renderPaginatedGrid();
            updateInfoBar(allComics.length);
        }
        
    } catch (err) {
        console.error('Error loading data:', err);
        showEmptyState('error', `Failed to load data: ${err.message}`);
    }
}

// ========= RENDER GRID DENGAN PAGINATION =========
function renderPaginatedGrid() {
    const start = (currentPageNum - 1) * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;
    const paginatedData = currentFilteredResults.slice(start, end);
    
    renderGrid(paginatedData);
    renderPagination(currentPageNum, currentFilteredResults.length);
}

function renderGrid(comics) {
    const grid = document.getElementById('resultGrid');
    if (!grid) return;
    
    if (!comics || comics.length === 0) {
        showEmptyState('no-results', `No comics found with title "${escapeHtml(currentQuery)}"`);
        return;
    }
    
    grid.style.display = 'grid';
    
    grid.innerHTML = comics.map(comic => {
        const link = comic.link.startsWith('http') ? comic.link : BASE_URL + comic.link;
        const imgUrl = comic.image || "https://placehold.co/400x600?text=No+Image";
        const title = comic.title || "Untitled";
        
        return `
            <div class="comic-item">
                <a href="${link}" style="text-decoration: none;">
                    <div class="comic-thumb-container">
                        <img src="${imgUrl}" class="comic-thumb" alt="${escapeHtml(title)}" loading="lazy" 
                             onerror="this.src='https://placehold.co/400x600?text=Error'">
                    </div>
                    <div class="comic-title">${escapeHtml(title)}</div>
                </a>
            </div>
        `;
    }).join('');
}

// ========= PAGINATION =========
function renderPagination(currentPage, totalItems) {
    const container = document.getElementById('pagination');
    if (!container) return;
    container.innerHTML = "";
    
    const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
    if (totalPages <= 1) return;
    
    const firstBtn = document.createElement('button');
    firstBtn.innerHTML = '<<';
    firstBtn.className = 'pagination-arrow';
    if (currentPage === 1) firstBtn.classList.add('disabled');
    firstBtn.onclick = () => { if (currentPage > 1) goToPage(1); };
    container.appendChild(firstBtn);
    
    const prevBtn = document.createElement('button');
    prevBtn.innerHTML = '<';
    prevBtn.className = 'pagination-arrow';
    if (currentPage === 1) prevBtn.classList.add('disabled');
    prevBtn.onclick = () => { if (currentPage > 1) goToPage(currentPage - 1); };
    container.appendChild(prevBtn);
    
    let startPage, endPage;
    const maxVisible = 5;
    
    if (totalPages <= maxVisible + 2) {
        startPage = 1;
        endPage = totalPages;
    } else {
        if (currentPage <= 3) {
            startPage = 1;
            endPage = maxVisible;
        } else if (currentPage >= totalPages - 2) {
            startPage = totalPages - maxVisible + 1;
            endPage = totalPages;
        } else {
            startPage = currentPage - 2;
            endPage = currentPage + 2;
        }
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
    
    const nextBtn = document.createElement('button');
    nextBtn.innerHTML = '>';
    nextBtn.className = 'pagination-arrow';
    if (currentPage === totalPages) nextBtn.classList.add('disabled');
    nextBtn.onclick = () => { if (currentPage < totalPages) goToPage(currentPage + 1); };
    container.appendChild(nextBtn);
    
    const lastBtnLast = document.createElement('button');
    lastBtnLast.innerHTML = '>>';
    lastBtnLast.className = 'pagination-arrow';
    if (currentPage === totalPages) lastBtnLast.classList.add('disabled');
    lastBtnLast.onclick = () => { if (currentPage < totalPages) goToPage(totalPages); };
    container.appendChild(lastBtnLast);
}

function goToPage(page) {
    currentPageNum = page;
    renderPaginatedGrid();
    saveCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ========= SAVE & LOAD PAGE =========
function saveCurrentPage(page) {
    sessionStorage.setItem(PAGE_KEY, page.toString());
}

function getLastPage() {
    const savedPage = sessionStorage.getItem(PAGE_KEY);
    if (savedPage && !isNaN(parseInt(savedPage))) {
        return parseInt(savedPage);
    }
    return 1;
}

// ========= UPDATE INFO BAR =========
function updateInfoBar(resultCount) {
    const totalCount = document.getElementById('searchTotalCount');
    
    if (totalCount) {
        totalCount.textContent = resultCount;
    }
}

// ========= TAMPILAN EMPTY STATE =========
function showEmptyState(type, message) {
    const grid = document.getElementById('resultGrid');
    const pagination = document.getElementById('pagination');
    if (!grid) return;
    
    if (pagination) pagination.innerHTML = '';
    grid.style.display = 'block';
    grid.innerHTML = `
        <div class="empty-state">
            <div class="empty-icon">
                <i class="fa-regular fa-face-frown"></i>
            </div>
            <div class="empty-title">${escapeHtml(message)}</div>
        </div>
    `;
}

// ========= CLEAR SEARCH =========
function clearSearch() {
    currentQuery = "";
    currentPageNum = 1;
    currentFilteredResults = [...allComics];
    
    const mainSearchInput = document.getElementById('mainSearchInput');
    
    if (mainSearchInput) mainSearchInput.value = "";
    
    renderPaginatedGrid();
    
    const newUrl = window.location.pathname;
    window.history.pushState({}, '', newUrl);
    saveCurrentPage(1);
}

// ========= FUNGSI PENCARIAN =========
function performSearch(query) {
    const searchTerm = query.trim().toLowerCase();
    currentQuery = searchTerm;
    currentPageNum = 1;
    
    if (!searchTerm) {
        clearSearch();
        return;
    }
    
    // Jika query persis sama dengan code (# boleh pakai/tidak) atau title,
    // langsung buka halamannya
    const qCode = searchTerm.replace(/^#+/, "");
    const exactMatch = allComics.find(comic => {
        const comicCode = ((comic.code || "").trim().toLowerCase()).replace(/^#+/, "");
        const comicTitle = ((comic.title || "").trim().toLowerCase());
        return (comicCode !== "" && comicCode === qCode) || (comicTitle !== "" && comicTitle === searchTerm);
    });
    if (exactMatch) {
        const link = exactMatch.link.startsWith('http') ? exactMatch.link : BASE_URL + exactMatch.link;
        window.location.href = link;
        return;
    }
    
    currentFilteredResults = allComics.filter(comic => {
        const searchFields = [
            comic.title,
            comic.code,
            comic.Parodies,
            comic.Characters,
            comic.Tags,
            comic.Artists,
            comic.Groups,
            comic.Languages,
            comic.Categories
        ];
        return searchFields.some(field =>
            (field || "").toLowerCase().includes(searchTerm)
        );
    });
    
    renderPaginatedGrid();
    updateInfoBar(currentFilteredResults.length);
    
    const newUrl = `${window.location.pathname}?q=${encodeURIComponent(searchTerm)}`;
    window.history.pushState({ search: searchTerm }, '', newUrl);
    saveCurrentPage(1);
}

// ========= UTILITY =========
function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

// ========= EVENT HANDLERS (DIPERBAIKI DENGAN EVENT DELEGATION) =========
function initEventListeners() {
    // EVENT DELEGATION untuk elemen yang dimuat secara dinamis
    document.body.addEventListener('click', function(e) {
        // Home button
        if (e.target.closest('#navHome')) {
            e.preventDefault();
            goHome();
        }
        
        // Random button
        if (e.target.closest('#navRandom')) {
            e.preventDefault();
            getRandomComic();
        }
        
        // Video button
        if (e.target.closest('#navVideo')) {
            e.preventDefault();
            openVideo();
        }
        
        // Logo click
        if (e.target.closest('#logoClick')) {
            goHome();
        }
        
        // Desktop search button
        if (e.target.closest('#searchBtnDesktop')) {
            const input = document.getElementById('searchInputDesktop');
            goToSearchPage(input ? input.value : '');
        }
        
        // Mobile search button
        if (e.target.closest('#searchBtnMobile')) {
            const overlay = document.getElementById('mobileSearchOverlay');
            if (overlay) overlay.style.display = 'none';
            const input = document.getElementById('searchInputMobile');
            goToSearchPage(input ? input.value : '');
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
    
    // Search inputs (Enter key) - delegated
    document.body.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            if (e.target && e.target.id === 'searchInputDesktop') {
                goToSearchPage(e.target.value);
            } else if (e.target && e.target.id === 'searchInputMobile') {
                const overlay = document.getElementById('mobileSearchOverlay');
                if (overlay) overlay.style.display = 'none';
                goToSearchPage(e.target.value);
            }
        }
    });
    
    // ELEMEN YANG SUDAH PASTI ADA (tidak perlu event delegation)
    const mainSearchInput = document.getElementById('mainSearchInput');
    const mainSearchBtn = document.getElementById('mainSearchBtn');
    const clearBtn = document.getElementById('clearSearchBtn');
    
    if (mainSearchBtn) {
        mainSearchBtn.onclick = () => {
            const val = mainSearchInput ? mainSearchInput.value : '';
            performSearch(val);
        };
    }
    
    if (mainSearchInput) {
        mainSearchInput.onkeypress = (e) => {
            if (e.key === 'Enter') {
                const val = mainSearchInput.value;
                performSearch(val);
            }
        };
    }
    
    if (clearBtn) {
        clearBtn.onclick = () => {
            clearSearch();
        };
    }
}

// ========= NAVIGASI MENU (TIDAK PERLU LAGI KARENA SUDAH PAKAI EVENT DELEGATION) =========
// function initNavigation() { ... } -> SUDAH TIDAK DIPERLUKAN

// ========= POPSTATE =========
window.addEventListener('popstate', function() {
    const urlParams = new URLSearchParams(window.location.search);
    const q = urlParams.get('q');
    const mainSearchInput = document.getElementById('mainSearchInput');
    
    if (q && q.trim()) {
        if (mainSearchInput) mainSearchInput.value = q;
        performSearch(q);
    } else {
        clearSearch();
    }
});

// ========= INIT =========
document.addEventListener("DOMContentLoaded", () => {
    loadData();
    initEventListeners(); // Hanya ini yang dipanggil (tanpa initNavigation)
});
