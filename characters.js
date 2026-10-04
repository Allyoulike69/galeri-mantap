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
const SEARCH_PAGE_URL = SITE_ROOT + "character.html";
const SEARCH_RESULT_URL = SITE_ROOT + "search.html";

function goToSearchPage(query) {
    if (query && query.trim()) {
        window.location.href = `${SEARCH_RESULT_URL}?q=${encodeURIComponent(query.trim())}`;
    } else {
        window.location.href = SEARCH_RESULT_URL;
    }
}

function loadComponent(containerId, fileUrl) {
    return fetch(fileUrl)
        .then(res => { if (!res.ok) throw new Error('Gagal memuat ' + fileUrl); return res.text(); })
        .then(html => {
            const c = document.getElementById(containerId);
            if (!c) return;
            c.innerHTML = html;
            if (fileUrl === 'topbanner.html' || fileUrl === 'middlebanner.html' || fileUrl === 'bottombanner.html' || fileUrl === 'sosialbar.html') {
                c.querySelectorAll('script').forEach(s => {
                    const ns = document.createElement('script');
                    if (s.src) ns.src = s.src; else ns.textContent = s.textContent;
                    document.body.appendChild(ns);
                    if (s.parentNode) s.remove();
                });
            }
        })
        .catch(err => console.warn(err.message));
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

let allCharacters = [];
let allComicsData = [];
let sortMode = 'popular';
let currentPage = 1;
let letterFilter = '';
const perPage = 120;
const PAGE_KEY = "last_page_" + location.pathname.split('/').pop().replace('.html', '');
const letters = ['#', 'A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T','U','V','W','X','Y','Z'];

function loadData() {
    fetchAllPages()
        .then(data => {
            const pages = data.filter(p => p.lengkap === 'yes');
            allComicsData = pages;
            const tagMap = {};
            pages.forEach(comic => {
                const raw = comic.Characters;
                if (raw && raw !== '-' && typeof raw === 'string') {
                    raw.split(',').forEach(tag => {
                        const key = tag.trim().toLowerCase();
                        if (key) tagMap[key] = (tagMap[key] || 0) + 1;
                    });
                }
            });
            allCharacters = Object.entries(tagMap);
            const savedPage = sessionStorage.getItem(PAGE_KEY);
            currentPage = (savedPage && !isNaN(parseInt(savedPage))) ? parseInt(savedPage) : 1;
            renderCharacters();
        })
        .catch(err => {
            document.getElementById('characters-container').innerHTML = '<div class="loading">Failed to load characters.</div>';
            console.error(err);
        });
}

function renderCharacters() {
    const container = document.getElementById('characters-container');
    if (!allCharacters.length) {
        container.innerHTML = '<div class="loading">No characters found.</div>';
        document.getElementById('characters-pagination').innerHTML = '';
        return;
    }
    let filtered = allCharacters;
    if (letterFilter) {
        filtered = allCharacters.filter(([tag]) => {
            const first = tag.charAt(0);
            if (letterFilter === '#') return !(/[a-zA-Z]/.test(first));
            return first === letterFilter.toLowerCase();
        });
    }
    const sorted = sortMode === 'popular'
        ? filtered.sort((a, b) => b[1] - a[1])
        : filtered.sort((a, b) => a[0].localeCompare(b[0]));
    const totalPages = Math.ceil(sorted.length / perPage);
    if (currentPage > totalPages) currentPage = totalPages;
    const start = (currentPage - 1) * perPage;
    const pageItems = sorted.slice(start, start + perPage);
    container.innerHTML = '';
    if (sortMode === 'az') {
        let currentLetter = '';
        pageItems.forEach(([tag, count]) => {
            const firstChar = tag.charAt(0).toUpperCase();
            const groupKey = /[a-zA-Z]/.test(firstChar) ? firstChar : '#';
            if (!letterFilter && groupKey !== currentLetter) {
                currentLetter = groupKey;
                const header = document.createElement('div');
                header.className = 'tag-letter-header';
                header.textContent = currentLetter;
                container.appendChild(header);
            }
            const a = document.createElement('a');
            a.href = `${SEARCH_PAGE_URL}?q=${encodeURIComponent(tag)}`;
            a.className = 'tag-item';
            a.innerHTML = `<span class="tag-name">${escapeHtml(tag)}</span><span class="tag-count">${count}</span>`;
            container.appendChild(a);
        });
    } else {
        container.innerHTML = pageItems.map(([tag, count]) =>
            `<a href="${SEARCH_PAGE_URL}?q=${encodeURIComponent(tag)}" class="tag-item"><span class="tag-name">${escapeHtml(tag)}</span><span class="tag-count">${count}</span></a>`
        ).join('');
    }
    renderPagination(totalPages);
}

function buildLetterFilter() {
    const container = document.getElementById('letterFilter');
    container.innerHTML = '';
    letters.forEach(letter => {
        const span = document.createElement('span');
        span.textContent = letter;
        if (letter === letterFilter) span.classList.add('active');
        span.addEventListener('click', () => {
            if (letterFilter === letter) {
                letterFilter = '';
            } else {
                letterFilter = letter;
                sortMode = 'az';
                document.getElementById('sortAZ').classList.add('active');
                document.getElementById('sortPopuler').classList.remove('active');
                document.getElementById('letterFilter').style.display = 'flex';
            }
            currentPage = 1;
            renderCharacters();
            container.querySelectorAll('span').forEach(s => s.classList.remove('active'));
            if (letterFilter) span.classList.add('active');
        });
        container.appendChild(span);
    });
}

function renderPagination(totalPages) {
    const pag = document.getElementById('characters-pagination');
    if (!pag) return;
    pag.innerHTML = '';
    if (totalPages <= 1) return;

    const createBtn = (text, onClick, isDisabled = false, extraClass = 'pagination-arrow') => {
        const btn = document.createElement('button');
        btn.innerHTML = text;
        btn.className = extraClass;
        if (isDisabled) btn.classList.add('disabled');
        btn.onclick = onClick;
        return btn;
    };

    const goPage = (page) => {
        if (page >= 1 && page <= totalPages) {
            currentPage = page;
            sessionStorage.setItem(PAGE_KEY, page.toString());
            renderCharacters();
            window.scrollTo({ top: document.getElementById('characters-container').offsetTop - 80, behavior: 'smooth' });
        }
    };

    pag.appendChild(createBtn('<<', () => goPage(1), currentPage === 1));
    pag.appendChild(createBtn('<', () => goPage(currentPage - 1), currentPage === 1));

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
        pageBtn.onclick = () => goPage(i);
        pag.appendChild(pageBtn);
    }
    if (endPage < totalPages - 1) {
        const dots = document.createElement('span');
        dots.innerText = '...';
        dots.className = 'pagination-dots';
        pag.appendChild(dots);
    }
    if (endPage < totalPages) {
        const lastBtn = document.createElement('button');
        lastBtn.innerText = totalPages;
        lastBtn.className = `pagination-btn ${totalPages === currentPage ? 'active' : ''}`;
        lastBtn.onclick = () => goPage(totalPages);
        pag.appendChild(lastBtn);
    }
    pag.appendChild(createBtn('>', () => goPage(currentPage + 1), currentPage === totalPages));
    pag.appendChild(createBtn('>>', () => goPage(totalPages), currentPage === totalPages));
}

document.addEventListener('DOMContentLoaded', function() {
        loadData();
        buildLetterFilter();
        document.getElementById('letterFilter').style.display = 'none';

        document.getElementById('sortPopuler').addEventListener('click', function() {
            sortMode = 'popular';
            currentPage = 1;
            letterFilter = '';
            document.getElementById('sortPopuler').classList.add('active');
            document.getElementById('sortAZ').classList.remove('active');
            document.getElementById('letterFilter').style.display = 'none';
            renderCharacters();
            buildLetterFilter();
        });
        document.getElementById('sortAZ').addEventListener('click', function() {
            sortMode = 'az';
            currentPage = 1;
            letterFilter = '';
            document.getElementById('sortAZ').classList.add('active');
            document.getElementById('sortPopuler').classList.remove('active');
            document.getElementById('letterFilter').style.display = 'flex';
            renderCharacters();
            buildLetterFilter();
        });
        Promise.all([
            loadComponent('header-placeholder', 'header.html'),
        loadComponent('topbanner-container', 'topbanner.html'),
        loadComponent('middlebanner-container', 'middlebanner.html'),
        loadComponent('bottombanner-container', 'bottombanner.html'),
        loadComponent('socialbar-container', 'sosialbar.html'),
        loadComponent('footer-placeholder', 'footer.html')
        ]).then(() => {
            setupHeaderEvents();
        });
    });

function setupHeaderEvents() {
    document.body.addEventListener('click', function(e) {
        if (e.target.closest('#navRandom')) {
            e.preventDefault();
            if (allComicsData.length > 0) {
                const randomIndex = Math.floor(Math.random() * allComicsData.length);
                const item = allComicsData[randomIndex];
                const link = item.link.startsWith('http') ? item.link : BASE_URL + item.link;
                window.location.href = link;
            }
        }
        if (e.target.closest('#navHome')) {
            e.preventDefault();
            window.location.href = HOME_URL;
        }
        if (e.target.closest('#logoClick')) {
            window.location.href = HOME_URL;
        }
        if (e.target.closest('#searchBtnDesktop')) {
            const input = document.getElementById('searchInputDesktop');
            goToSearchPage(input ? input.value : '');
        }
        if (e.target.closest('#searchBtnMobile')) {
            const overlay = document.getElementById('mobileSearchOverlay');
            if (overlay) overlay.style.display = 'none';
            const input = document.getElementById('searchInputMobile');
            goToSearchPage(input ? input.value : '');
        }
    });
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
    const navRandomMobile = document.getElementById('navRandomMobile');
    if (navRandomMobile) {
        navRandomMobile.onclick = function(e) {
            e.preventDefault();
            const nav = document.getElementById('mobileNavOverlay');
            if (nav) nav.classList.remove('show');
            if (allComicsData.length > 0) {
                const randomIndex = Math.floor(Math.random() * allComicsData.length);
                const item = allComicsData[randomIndex];
                const link = item.link.startsWith('http') ? item.link : BASE_URL + item.link;
                window.location.href = link;
            }
        };
    }
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
    // Search mobile overlay
    const searchIconMobile = document.getElementById('searchIconMobile');
    const mobileSearchOverlay = document.getElementById('mobileSearchOverlay');
    if (searchIconMobile && mobileSearchOverlay) {
        searchIconMobile.onclick = () => {
            mobileSearchOverlay.style.display = 'block';
            setTimeout(() => document.getElementById('searchInputMobile')?.focus(), 100);
        };
    }
    if (mobileSearchOverlay) {
        mobileSearchOverlay.addEventListener('click', (e) => {
            if (e.target === mobileSearchOverlay) {
                mobileSearchOverlay.style.display = 'none';
            }
        });
    }
    const closeSearchBtn = document.getElementById('closeSearchBtn');
    if (closeSearchBtn) {
        closeSearchBtn.onclick = () => {
            if (mobileSearchOverlay) mobileSearchOverlay.style.display = 'none';
        };
    }
}



