// favorite.js — komponen bersama + daftar komik favorit.

// Memuat partial HTML ke container. Script di dalam banner harus dijalankan
// ulang karena innerHTML tidak mengeksekusi <script>.
function loadComponent(containerId, fileUrl) {
    fetch(fileUrl + '?t=' + Date.now())
        .then(function (response) {
            if (!response.ok) throw new Error('HTTP error! status: ' + response.status);
            return response.text();
        })
        .then(function (data) {
            const container = document.getElementById(containerId);
            if (!container) return;
            container.innerHTML = data;

            if (fileUrl === 'topbanner.html' || fileUrl === 'middlebanner.html' || fileUrl === 'bottombanner.html') {
                runPartialScripts(container);
            }
        })
        .catch(function (error) {
            console.error('Error loading ' + fileUrl + ':', error);
        });
}

function runPartialScripts(container) {
    const scripts = container.querySelectorAll('script');
    scripts.forEach(function (oldScript) {
        const newScript = document.createElement('script');
        if (oldScript.src) {
            newScript.src = oldScript.src;
        } else {
            newScript.textContent = oldScript.textContent;
        }
        document.body.appendChild(newScript);
        if (oldScript.parentNode) oldScript.remove();
    });
}

function loadSocialBar() {
    fetch('sosialbar.html?t=' + Date.now())
        .then(function (response) {
            if (!response.ok) throw new Error('HTTP error! status: ' + response.status);
            return response.text();
        })
        .then(function (data) {
            const container = document.getElementById('socialbar-container');
            if (!container) return;
            container.innerHTML = data;
            runPartialScripts(container);
        })
        .catch(function (error) {
            console.error('Error loading sosialbar.html:', error);
        });
}

function updateFavoriteCount(count) {
    const el = document.getElementById('favoriteTotalCount');
    if (el) el.textContent = count;
}

const FAVORITES_PER_PAGE = 10;
let favoriteCurrentPage = 1;
let allFavorites = [];

function renderFavoriteGrid() {
    const grid = document.getElementById('favorite-grid');
    if (!grid) return;

    const totalPages = Math.max(1, Math.ceil(allFavorites.length / FAVORITES_PER_PAGE));
    if (favoriteCurrentPage > totalPages) favoriteCurrentPage = totalPages;

    const start = (favoriteCurrentPage - 1) * FAVORITES_PER_PAGE;
    const pageItems = allFavorites.slice(start, start + FAVORITES_PER_PAGE);

    grid.innerHTML = '';
    pageItems.forEach(function (fav) {
        const item = document.createElement('div');
        item.className = 'comic-item';
        item.innerHTML =
            '<div class="comic-thumb-container">' +
                '<a href="p/base.html?id=' + fav.id + '">' +
                    '<img src="' + (fav.cover || 'https://placehold.co/200x300?text=No+Image') + '" alt="Cover" class="comic-thumb" loading="lazy">' +
                '</a>' +
            '</div>' +
            '<a href="p/base.html?id=' + fav.id + '" class="comic-title">' + (fav.title || '#' + fav.id) + '</a>';
        grid.appendChild(item);
    });

    renderFavoritePagination(totalPages);
}

function renderFavoritePagination(totalPages) {
    const container = document.getElementById('favorite-pagination');
    if (!container) return;
    container.innerHTML = '';
    if (totalPages <= 1) return;

    const addBtn = function (html, onClick, disabled) {
        const btn = document.createElement('button');
        btn.innerHTML = html;
        btn.className = 'pagination-arrow';
        if (disabled) btn.classList.add('disabled');
        btn.onclick = onClick;
        container.appendChild(btn);
    };

    const goPage = function (page) {
        if (page < 1 || page > totalPages || page === favoriteCurrentPage) return;
        favoriteCurrentPage = page;
        renderFavoriteGrid();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    addBtn('<span class="pagination-bar"></span><i class="fa-solid fa-angle-left"></i>', function () { goPage(1); }, favoriteCurrentPage === 1);
    addBtn('<i class="fa-solid fa-angle-left"></i>', function () { goPage(favoriteCurrentPage - 1); }, favoriteCurrentPage === 1);

    const info = document.createElement('span');
    info.className = 'pagination-info';
    const label = document.createElement('span');
    label.className = 'pagination-label';
    label.textContent = favoriteCurrentPage + ' / ' + totalPages;
    const jump = document.createElement('input');
    jump.type = 'number';
    jump.min = '1';
    jump.max = String(totalPages);
    jump.value = String(favoriteCurrentPage);
    jump.className = 'pagination-jump';
    jump.setAttribute('aria-label', 'Jump to page');
    let editing = false;
    const showInput = function () {
        if (editing) return;
        editing = true;
        info.innerHTML = '';
        info.appendChild(jump);
        jump.focus();
        jump.select();
    };
    const showLabel = function () {
        editing = false;
        label.textContent = favoriteCurrentPage + ' / ' + totalPages;
        info.innerHTML = '';
        info.appendChild(label);
    };
    const commitJump = function () {
        if (!editing) return;
        editing = false;
        let page = parseInt(jump.value, 10);
        if (isNaN(page) || page < 1) page = 1;
        if (page > totalPages) page = totalPages;
        jump.value = String(page);
        goPage(page);
        showLabel();
    };
    info.addEventListener('click', showInput);
    jump.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); commitJump(); }
        if (e.key === 'Escape') { e.preventDefault(); showLabel(); }
    });
    jump.addEventListener('blur', commitJump);
    info.appendChild(label);
    container.appendChild(info);

    addBtn('<i class="fa-solid fa-angle-right"></i>', function () { goPage(favoriteCurrentPage + 1); }, favoriteCurrentPage === totalPages);
    addBtn('<i class="fa-solid fa-angle-right"></i><span class="pagination-bar"></span>', function () { goPage(totalPages); }, favoriteCurrentPage === totalPages);
}

function loadFavorites() {
    const grid = document.getElementById('favorite-grid');
    if (!grid) return;

    try {
        allFavorites = JSON.parse(localStorage.getItem('comicFavorites')) || [];
    } catch (e) {
        allFavorites = [];
    }
    favoriteCurrentPage = 1;

    updateFavoriteCount(allFavorites.length);

    if (allFavorites.length === 0) {
        grid.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; padding: 50px; color: #888;">No favorite comics added yet.</div>';
        const pagination = document.getElementById('favorite-pagination');
        if (pagination) pagination.innerHTML = '';
        return;
    }

    renderFavoriteGrid();
}

// ===== Event header (header.html hanya HTML; handler-nya ada di JS) =====
// Halaman lain memakai script.js. favorite.html hanya memuat favorite.js,
// jadi handler header harus dipasang di sini juga.
const FAV_SITE_ROOT = window.location.pathname.split('/').slice(0, -1).join('/') + '/';
const FAV_COMIC_BASE = FAV_SITE_ROOT + 'p/';
const FAV_SEARCH_URL = FAV_SITE_ROOT + 'search.html';
const FAV_VIDEO_URL = 'https://alyoulikevideo.pages.dev/';
let favComics = [];
let favComicsLoaded = false;

function favHideMobileNav() {
    const nav = document.getElementById('mobileNavOverlay');
    if (nav) nav.classList.remove('show');
}

function favHideMobileSearch() {
    const overlay = document.getElementById('mobileSearchOverlay');
    if (overlay) overlay.style.display = 'none';
    const input = document.getElementById('searchInputMobile');
    if (input) input.value = '';
}

function favGoSearch(query) {
    if (query && query.trim()) {
        window.location.href = FAV_SEARCH_URL + '?q=' + encodeURIComponent(query.trim());
    } else {
        window.location.href = FAV_SEARCH_URL;
    }
}

function loadFavComicList() {
    const files = [
        'daftar-comic.json',
        'daftar-comic2.json',
        'daftar-comic3.json',
        'daftar-comic4.json',
        'daftar-comic5.json'
    ];
    return Promise.all(files.map(function (file) {
        return fetch(FAV_COMIC_BASE + file)
            .then(function (res) { return res.ok ? res.json() : []; })
            .catch(function () { return []; });
    })).then(function (lists) {
        const seen = {};
        const merged = [];
        lists.forEach(function (items) {
            (Array.isArray(items) ? items : (items.pages || [])).forEach(function (p) {
                if (!p || !p.link || seen[p.link]) return;
                seen[p.link] = true;
                merged.push(p);
            });
        });
        favComics = merged.filter(function (p) { return p.lengkap === 'yes'; });
        favComicsLoaded = true;
        return favComics;
    });
}

function favRandom() {
    if (!favComics.length) {
        if (!favComicsLoaded) loadFavComicList().then(favRandom);
        return;
    }
    const item = favComics[Math.floor(Math.random() * favComics.length)];
    const link = String(item.link || '');
    window.location.href = /^https?:/i.test(link) ? link : FAV_COMIC_BASE + link;
}

function attachFavoriteHeaderEvents() {
    document.addEventListener('click', function (e) {
        const t = e.target;

        if (t.closest('#navRandom, #navRandomMobile')) {
            e.preventDefault();
            favHideMobileNav();
            favRandom();
            return;
        }
        if (t.closest('#navHome, #logoClick')) {
            e.preventDefault();
            window.location.href = FAV_SITE_ROOT;
            return;
        }
        if (t.closest('#navVideo')) {
            e.preventDefault();
            window.open(FAV_VIDEO_URL, '_blank');
            return;
        }
        if (t.closest('#searchBtnDesktop')) {
            e.preventDefault();
            const input = document.getElementById('searchInputDesktop');
            favGoSearch(input ? input.value : '');
            return;
        }
        if (t.closest('#searchBtnMobile')) {
            e.preventDefault();
            const input = document.getElementById('searchInputMobile');
            favHideMobileSearch();
            favGoSearch(input ? input.value : '');
            return;
        }
        if (t.closest('#searchIconMobile')) {
            e.preventDefault();
            const overlay = document.getElementById('mobileSearchOverlay');
            if (overlay) overlay.style.display = 'block';
            setTimeout(function () {
                const input = document.getElementById('searchInputMobile');
                if (input) input.focus();
            }, 100);
            return;
        }
        if (t.closest('#closeSearchBtn') || t.id === 'mobileSearchOverlay') {
            favHideMobileSearch();
            return;
        }
        if (t.closest('.dropbtn-click')) {
            e.preventDefault();
            const drop = document.querySelector('.dropdown-content-click');
            if (drop) drop.classList.toggle('show');
            return;
        }
        if (t.closest('#hamburgerMenu')) {
            e.preventDefault();
            const nav = document.getElementById('mobileNavOverlay');
            if (nav) nav.classList.toggle('show');
            return;
        }
        if (t.closest('#mobileNavOverlay a')) {
            favHideMobileNav();
            return;
        }
        const drop = document.querySelector('.dropdown-content-click');
        if (drop && !t.closest('.dropdown-content-click')) drop.classList.remove('show');
        const nav = document.getElementById('mobileNavOverlay');
        if (nav && !t.closest('#mobileNavOverlay')) nav.classList.remove('show');
    });

    document.addEventListener('keypress', function (e) {
        if (e.key !== 'Enter') return;
        if (e.target.id === 'searchInputDesktop') {
            favGoSearch(e.target.value);
        } else if (e.target.id === 'searchInputMobile') {
            favHideMobileSearch();
            favGoSearch(e.target.value);
        }
    });
}

// Path relatif terhadap favorite.html yang ada di root.
loadComponent('topbanner-container', 'topbanner.html');
loadComponent('middlebanner-container', 'middlebanner.html');
loadComponent('bottombanner-container', 'bottombanner.html');
loadComponent('header-placeholder', 'header.html');
loadComponent('footer-placeholder', 'footer.html');
loadSocialBar();
loadFavorites();
attachFavoriteHeaderEvents();
loadFavComicList();
