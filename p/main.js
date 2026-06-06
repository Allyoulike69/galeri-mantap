// ========= KONFIGURASI URL =========
const DATA_URL = "https://allyoulike69.github.io/galeri-mantap/p/daftar.json";
const BASE_URL = "https://allyoulike69.github.io/galeri-mantap/p/";
const HOME_URL = "https://allyoulike69.github.io/galeri-mantap/";
const VIDEO_URL = "https://alyoulikevideo.pages.dev/";
const SEARCH_PAGE_URL = "https://allyoulike69.github.io/galeri-mantap/search";

// ========= KONSTANTA UNTUK 24 JAM =========
const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

// ========= GLOBAL VARIABLES =========
let allPages = [];
let currentImages = [];
let currentIndex = 0;
let zoomLevel = 1.0;
let maxZoom = 3.0;
let currentPageTitle = '';
let currentPos = 0, popCurrentPos = 0;
let RECOMMENDED_KEY = '';
let RECOMMENDED_TIMESTAMP_KEY = '';

// ========= FUNGSI UNTUK MENDAPATKAN ID KOMIK DARI URL =========
function getComicIdFromUrl() {
    const path = window.location.pathname;
    const fileName = path.split('/').pop();
    const comicId = fileName.replace('.html', '');
    return comicId;
}

// ========= FUNGSI UNTUK MENGUPDATE PAGE TITLE =========
function updatePageTitleFromData(allPages) {
    const comicId = getComicIdFromUrl();
    const titleSpan = document.getElementById('pageTitleNumber');
    
    const comicData = allPages.find(page => {
        const linkFileName = page.link.replace('.html', '');
        return linkFileName === comicId || page.title === `#${comicId}` || page.title === comicId;
    });
    
    if (comicData) {
        let displayTitle = comicData.title;
        if (!displayTitle.startsWith('#')) {
            displayTitle = '#' + displayTitle;
        }
        titleSpan.textContent = displayTitle;
        console.log(`Page title updated to: ${displayTitle} from JSON data`);
    } else {
        titleSpan.textContent = `#${comicId}`;
        console.log(`Page title fallback to: #${comicId} (not found in JSON)`);
    }
}

// ========= FUNGSI UNTUK STORAGE KEYS =========
function updateRecommendedKeys() {
    RECOMMENDED_KEY = `recommended_slider_${currentPageTitle.replace(/[^a-zA-Z0-9]/g, '_')}`;
    RECOMMENDED_TIMESTAMP_KEY = RECOMMENDED_KEY + '_timestamp';
}

function getComicIdForStorage() {
    return window.location.pathname + currentPageTitle;
}

// ========= PROGRESS FUNCTIONS =========
function saveProgress(pageIndex) {
    const comicId = getComicIdForStorage();
    localStorage.setItem(`reader_progress_${comicId}`, pageIndex.toString());
    console.log('Progress saved to localStorage:', pageIndex);
}

function getProgress() {
    const comicId = getComicIdForStorage();
    const saved = localStorage.getItem(`reader_progress_${comicId}`);
    if (saved && !isNaN(parseInt(saved))) {
        return parseInt(saved);
    }
    return 0;
}

function clearProgress() {
    const comicId = getComicIdForStorage();
    localStorage.removeItem(`reader_progress_${comicId}`);
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

// ========= READER FUNCTIONS =========
function openReader(index) {
    currentIndex = index;
    zoomLevel = 1.0;
    updateMaxZoom();
    document.getElementById('manga-reader').style.display = 'flex';
    showCurrentPage();
    console.log('Reader opened at page:', index + 1);
}

function showCurrentPage() {
    const img = document.getElementById('reader-image');
    img.src = currentImages[currentIndex];
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
function initGallery() {
    const rawLinksEl = document.getElementById('raw-links');
    const gallery = document.getElementById('comic-gallery');
    gallery.innerHTML = '';
    currentImages = rawLinksEl.innerText.split(/\s+/).filter(u => u.startsWith("http"));
    
    console.log('Total images loaded:', currentImages.length);
    
    currentImages.forEach((url, index) => {
        const img = document.createElement('img');
        img.src = url;
        img.loading = "lazy";
        img.setAttribute('data-index', index);
        img.alt = `Page ${index + 1}`;
        img.onclick = () => openReader(index);
        gallery.appendChild(img);
    });
    
    const savedProgress = getProgress();
    if (savedProgress > 0 && savedProgress < currentImages.length) {
        setTimeout(() => {
            highlightGalleryImage(savedProgress);
        }, 500);
    }
}

// ========= RECOMMENDED SLIDER FUNCTIONS =========
function getSavedRecommendedSlider() {
    const now = Date.now();
    const savedTimestamp = localStorage.getItem(RECOMMENDED_TIMESTAMP_KEY);
    const savedSlider = localStorage.getItem(RECOMMENDED_KEY);
    
    if (savedTimestamp && savedSlider && (now - parseInt(savedTimestamp)) < TWENTY_FOUR_HOURS) {
        try {
            return JSON.parse(savedSlider);
        } catch(e) {
            console.log('Gagal parse saved slider untuk halaman ini');
            return null;
        }
    }
    return null;
}

function saveRecommendedSlider(sliderData) {
    localStorage.setItem(RECOMMENDED_KEY, JSON.stringify(sliderData));
    localStorage.setItem(RECOMMENDED_TIMESTAMP_KEY, Date.now().toString());
    console.log(`Slider tersimpan untuk halaman dengan key: ${RECOMMENDED_KEY}`);
}

function renderRecommendedSlider() {
    const container = document.getElementById('random-slider-inner');
    if (!container) return;
    
    let selected = getSavedRecommendedSlider();
    
    if (!selected && allPages.length > 0) {
        console.log(`Membuat slider baru untuk halaman: ${currentPageTitle}`);
        
        let filteredPagesForSlider = allPages.filter(item => item.title !== currentPageTitle);
        if (filteredPagesForSlider.length === 0) filteredPagesForSlider = allPages;
        
        let shuffled = [...filteredPagesForSlider];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        selected = shuffled.slice(0, 5);
        saveRecommendedSlider(selected);
    }
    
    if (!selected || selected.length === 0) {
        container.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:50px;">📭 No other comics available</div>';
        return;
    }
    
    container.innerHTML = '';
    selected.forEach((item) => {
        let link = item.link.startsWith('http') ? item.link : BASE_URL + item.link;
        let imgUrl = item.image || "https://placehold.co/400x600?text=No+Image";
        let title = item.title || "Untitled";
        container.innerHTML += `
            <div class="slider-item">
                <a href="${link}"><img src="${imgUrl}" onerror="this.src='https://placehold.co/400x600?text=Error'" loading="lazy"></a>
                <a class="slider-title" href="${link}">${escapeHtml(title)}</a>
            </div>
        `;
    });
    currentPos = 0;
    const inner = document.getElementById('random-slider-inner');
    if(inner) inner.style.transform = 'translateX(0px)';
}

function renderNewUpdateSlider() {
    const container = document.getElementById('pop-inner-slider');
    container.innerHTML = "";
    if (!allPages.length) return;
    
    let filteredPagesForSlider = allPages.filter(item => item.title !== currentPageTitle);
    const itemsToShow = filteredPagesForSlider.slice(0, 20);
    
    if (itemsToShow.length === 0) {
        container.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:50px;">📭 No other comics available</div>';
        return;
    }
    
    itemsToShow.forEach((item) => {
        let link = item.link.startsWith('http') ? item.link : BASE_URL + item.link;
        let imgUrl = item.image || "https://placehold.co/400x600?text=No+Image";
        let title = item.title || "Untitled";
        container.innerHTML += `
            <div class="pop-slide-item">
                <div class="pop-view-badge"><i class="fa-regular fa-clock"></i> NEW</div>
                <a href="${link}"><img src="${imgUrl}" onerror="this.src='https://placehold.co/400x600?text=Error'" loading="lazy"></a>
                <a class="pop-slide-title" href="${link}">${escapeHtml(title)}</a>
            </div>
        `;
    });
    popCurrentPos = 0;
    const inner = document.getElementById('pop-inner-slider');
    if(inner) inner.style.transform = 'translateX(0px)';
}

// ========= SLIDER CONTROLS =========
function moveSlide(dir) {
    const inner = document.getElementById('random-slider-inner');
    const item = document.querySelector('.slider-item');
    if(!item || !inner) return;
    const itemWidth = item.offsetWidth + 12;
    currentPos -= (dir * itemWidth);
    if (currentPos > 0) currentPos = 0;
    const max = inner.scrollWidth - document.getElementById('slider-viewport').offsetWidth;
    if (Math.abs(currentPos) > max) currentPos = -max;
    inner.style.transform = 'translateX(' + currentPos + 'px)';
}

function movePopSlide(dir) {
    const inner = document.getElementById('pop-inner-slider');
    const item = document.querySelector('.pop-slide-item');
    if(!item || !inner) return;
    const itemWidth = item.offsetWidth + 12;
    popCurrentPos -= (dir * itemWidth);
    if (popCurrentPos > 0) popCurrentPos = 0;
    const max = inner.scrollWidth - document.getElementById('pop-viewport').offsetWidth;
    if (Math.abs(popCurrentPos) > max) popCurrentPos = -max;
    inner.style.transform = 'translateX(' + popCurrentPos + 'px)';
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
        document.getElementById('pop-inner-slider').innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:50px;">⏳ Loading data...</div>';
        document.getElementById('random-slider-inner').innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:50px;">⏳ Loading data...</div>';
        
        const response = await fetch(DATA_URL);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        
        const uniquePages = [];
        const seenTitles = new Set();
        for (const page of (data.pages || [])) {
            if (!seenTitles.has(page.title)) {
                seenTitles.add(page.title);
                uniquePages.push(page);
            }
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
        
        updateRecommendedKeys();
        console.log('Key localStorage yang digunakan:', RECOMMENDED_KEY);
        
        if (allPages.length === 0) {
            document.getElementById('pop-inner-slider').innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:50px;">📭 No data available</div>';
            document.getElementById('random-slider-inner').innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:50px;">📭 No data available</div>';
            return;
        }
        
        renderNewUpdateSlider();
        renderRecommendedSlider();
        
    } catch (error) {
        console.error('Error:', error);
        document.getElementById('pop-inner-slider').innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:50px;">❌ Failed to load data</div>`;
        const comicId = getComicIdFromUrl();
        document.getElementById('pageTitleNumber').textContent = `#${comicId}`;
        currentPageTitle = `#${comicId}`;
        updateRecommendedKeys();
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
    
    // SEARCH FUNCTIONALITY (tetap sama)
    const searchBtnDesktop = document.getElementById('searchBtnDesktop');
    const searchInputDesktop = document.getElementById('searchInputDesktop');
    const searchIconMobile = document.getElementById('searchIconMobile');
    const mobileOverlay = document.getElementById('mobileSearchOverlay');
    const closeSearchBtn = document.getElementById('closeSearchBtn');
    const searchBtnMobile = document.getElementById('searchBtnMobile');
    const searchInputMobile = document.getElementById('searchInputMobile');
    
    if(searchBtnDesktop) { 
        searchBtnDesktop.onclick = () => goToSearchPage(searchInputDesktop.value.trim());
    }
    if(searchInputDesktop) { 
        searchInputDesktop.onkeypress = (e) => { 
            if(e.key === 'Enter') goToSearchPage(e.target.value.trim());
        };
    }
    if(searchIconMobile) { 
        searchIconMobile.onclick = () => { 
            mobileOverlay.style.display = 'block'; 
            setTimeout(() => searchInputMobile.focus(), 100); 
        };
    }
    if(closeSearchBtn) { 
        closeSearchBtn.onclick = () => { 
            mobileOverlay.style.display = 'none'; 
            searchInputMobile.value = ''; 
        };
    }
    if(searchBtnMobile) { 
        searchBtnMobile.onclick = () => { 
            const q = searchInputMobile.value.trim(); 
            mobileOverlay.style.display = 'none'; 
            if(q) goToSearchPage(q);
        };
    }
    if(searchInputMobile) { 
        searchInputMobile.onkeypress = (e) => { 
            if(e.key === 'Enter') { 
                const q = e.target.value.trim(); 
                mobileOverlay.style.display = 'none'; 
                if(q) goToSearchPage(q);
            }
        };
    }
}

// ========= KEYBOARD SHORTCUTS =========
document.addEventListener('keydown', function(e) { 
    if (document.getElementById('manga-reader').style.display === 'flex') { 
        if (e.key === "ArrowRight") nextPage(); 
        if (e.key === "ArrowLeft") prevPage(); 
        if (e.key === "Escape") closeReader(); 
    } 
});

// ========= INITIALIZATION =========
document.addEventListener("DOMContentLoaded", function() {
    const initialComicId = getComicIdFromUrl();
    document.getElementById('pageTitleNumber').textContent = `#${initialComicId}`;
    currentPageTitle = `#${initialComicId}`;
    updateRecommendedKeys();
    
    loadData();
    initGallery();
    setupEventListeners();
});
