// ========= KONFIGURASI =========
const DATA_URL = "https://allyoulike69.github.io/galeri-mantap/p/daftar.json";
const BASE_URL = "https://allyoulike69.github.io/galeri-mantap/p/";
const HOME_URL = "https://allyoulike69.github.io/galeri-mantap/";
const VIDEO_URL = "https://www.youtube.com";
const SEARCH_PAGE_URL = "https://allyoulike69.github.io/galeri-mantap/search";

let allPages = [];
let currentPageNum = 1;
const itemsPerPage = 25;
const RECOMMENDED_KEY = 'allyoulike_recommended';
const RECOMMENDED_TIMESTAMP_KEY = 'allyoulike_recommended_timestamp';
const PAGE_KEY = 'allyoulike_current_page';
const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

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
    localStorage.setItem(PAGE_KEY, page.toString());
}

function getLastPage() {
    const savedPage = localStorage.getItem(PAGE_KEY);
    if (savedPage && !isNaN(parseInt(savedPage))) return parseInt(savedPage);
    return 1;
}

async function loadData() {
    try {
        const randomGrid = document.getElementById('random-grid');
        const newUploadsGrid = document.getElementById('new-uploads-grid');
        
        if (randomGrid) randomGrid.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:50px;">⏳ Loading data...</div>';
        if (newUploadsGrid) newUploadsGrid.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:50px;">⏳ Loading data...</div>';
        
        const response = await fetch(DATA_URL);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        allPages = data.pages || [];
        allPages.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        if (allPages.length === 0) {
            if (randomGrid) randomGrid.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:50px;">📭 No data</div>';
            if (newUploadsGrid) newUploadsGrid.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:50px;">📭 No data</div>';
            return;
        }
        
        const recommendedComics = getRecommendedComics();
        renderGrid(recommendedComics, 'random-grid', false);
        
        const lastPage = getLastPage();
        currentPageNum = lastPage;
        const totalPages = Math.ceil(allPages.length / itemsPerPage);
        if (currentPageNum > totalPages) currentPageNum = 1;
        goToPage(currentPageNum);
    } catch (err) {
        console.error('Error loading data:', err);
        const randomGrid = document.getElementById('random-grid');
        const newUploadsGrid = document.getElementById('new-uploads-grid');
        if (randomGrid) randomGrid.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:50px; color:#ff8888;">❌ Failed: ${err.message}</div>`;
        if (newUploadsGrid) newUploadsGrid.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:50px;">Gagal memuat data.</div>';
    }
}

function renderGrid(data, gridId, showNewBadge = false) {
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
        if (showNewBadge && idx < 5) badge = '<span class="badge badge-new">NEW</span>';
        grid.innerHTML += `
            <div class="comic-item">
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
    renderGrid(paginatedData, 'new-uploads-grid', true);
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
    
    // Navigation
    const navHome = document.getElementById('navHome');
    const navRandom = document.getElementById('navRandom');
    const navVideo = document.getElementById('navVideo');
    const logoClick = document.getElementById('logoClick');
    if (navHome) navHome.onclick = (e) => { e.preventDefault(); window.location.href = HOME_URL; };
    if (navRandom) navRandom.onclick = (e) => { e.preventDefault(); if (allPages.length) showRandomComic(); };
    if (navVideo) navVideo.onclick = (e) => { e.preventDefault(); openVideoSite(); };
    if (logoClick) logoClick.onclick = () => { window.location.href = HOME_URL; };
    
    console.log('Header events attached');
}

// Tunggu hingga DOM siap dan header sudah dimuat
document.addEventListener('DOMContentLoaded', function() {
    // Gunakan MutationObserver untuk mendeteksi ketika header sudah dimuat
    const observer = new MutationObserver(function(mutations) {
        const header = document.getElementById('header-placeholder');
        if (header && header.innerHTML.trim() !== '') {
            // Header sudah dimuat, attach events
            attachHeaderEvents();
            observer.disconnect();
        }
    });
    
    observer.observe(document.getElementById('header-placeholder'), { childList: true, subtree: true });
    
    // Fallback: jika dalam 2 detik header belum muncul, tetap coba attach
    setTimeout(function() {
        const header = document.getElementById('header-placeholder');
        if (header && header.innerHTML.trim() !== '') {
            attachHeaderEvents();
        } else {
            console.warn('Header not loaded after timeout, retrying...');
            // Coba lagi setelah 1 detik
            setTimeout(() => attachHeaderEvents(), 1000);
        }
        observer.disconnect();
    }, 2000);
    
    // Load data comics
    loadData();
});
