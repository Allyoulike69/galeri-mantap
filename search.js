// ========= KONFIGURASI =========
const DATA_URL = "https://allyoulike69.github.io/galeri-mantap/p/daftar.json";
const BASE_URL = "https://allyoulike69.github.io/galeri-mantap/p/";
const HOME_URL = "https://allyoulike69.github.io/galeri-mantap/";
const VIDEO_URL = "https://www.youtube.com";
const ITEMS_PER_PAGE = 30;
const PAGE_KEY = 'search_current_page';

let allComics = [];
let currentQuery = "";
let currentPageNum = 1;
let currentFilteredResults = [];

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

function openVideo() {
    window.open(VIDEO_URL, '_blank');
}

// ========= AMBIL DATA DARI JSON =========
async function loadData() {
    try {
        const response = await fetch(DATA_URL);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        
        allComics = data.pages || [];
        
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
            const infoBar = document.getElementById('searchInfoBar');
            if (infoBar) infoBar.style.display = 'none';
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
                    <div class="thumb-box">
                        <img src="${imgUrl}" alt="${escapeHtml(title)}" loading="lazy" 
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
    localStorage.setItem(PAGE_KEY, page.toString());
}

function getLastPage() {
    const savedPage = localStorage.getItem(PAGE_KEY);
    if (savedPage && !isNaN(parseInt(savedPage))) {
        return parseInt(savedPage);
    }
    return 1;
}

// ========= UPDATE INFO BAR =========
function updateInfoBar(resultCount) {
    const infoBar = document.getElementById('searchInfoBar');
    const resultCountText = document.getElementById('resultCountText');
    
    if (!infoBar || !resultCountText) return;
    
    if (currentQuery && currentQuery.trim() !== "") {
        infoBar.style.display = 'flex';
        resultCountText.innerHTML = `Search results for "${escapeHtml(currentQuery)}" - Found ${resultCount} comic${resultCount !== 1 ? 's' : ''}`;
    } else {
        infoBar.style.display = 'none';
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
    
    const infoBar = document.getElementById('searchInfoBar');
    if (infoBar) infoBar.style.display = 'none';
    
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
    
    currentFilteredResults = allComics.filter(comic => {
        const title = (comic.title || "").toLowerCase();
        return title.includes(searchTerm);
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
