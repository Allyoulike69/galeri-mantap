(function () {
    'use strict';

    const API = 'https://countapi.mileshilliard.com/api/v1';
    const PREFIX = 'comichen';
    const CACHE_TTL = 30000;
    const API_TIMEOUT = 5000;

    const cache = new Map();
    let overviewCache = { ts: 0, data: null };
    let currentRange = '24jam'; // default: 24 Jam Terakhir
    let refreshTimer = null;
    let isLoading = false;

    // Rentang ala Blogger: Sekarang, Hari ini, Kemarin, 7/30/90 hari terakhir, Bulan ini/lalu, Tahun ini/lalu, Sepanjang waktu
    const RANGES = {
        '24jam':   { label: '24 Jam Terakhir', type: 'hour' },
        'today':   { label: 'Hari Ini', type: 'today' },
        'yesterday': { label: 'Kemarin', type: 'yesterday' },
        'week':    { label: '7 Hari Terakhir', type: 'week' },
        '30days':  { label: '30 Hari Terakhir', type: '30days' },
        '90days':  { label: '90 Hari Terakhir', type: '90days' },
        'month':   { label: 'Bulan Ini', type: 'month' },
        'prevmonth': { label: 'Bulan Lalu', type: 'prevmonth' },
        'year':    { label: 'Tahun Ini', type: 'year' },
        'prevyear': { label: 'Tahun Lalu', type: 'prevyear' },
        'alltime': { label: 'Sepanjang Waktu', type: 'alltime' },
        'custom':  { label: 'Kustom…', type: 'custom' }
    };

    function slug(str) {
        return String(str == null ? '' : str).toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 100);
    }

    function keyOf(...args) {
        return [PREFIX, ...args.map(slug).filter(Boolean)].join('_');
    }

    function zeroPad(n) { return n < 10 ? '0' + n : String(n); }

    function isoFor(daysAgo) {
        const d = new Date();
        d.setDate(d.getDate() - (daysAgo || 0));
        return d.getFullYear() + '-' + zeroPad(d.getMonth() + 1) + '-' + zeroPad(d.getDate());
    }

    function isoHourOf(d) {
        return d.getFullYear() + '-' + zeroPad(d.getMonth() + 1) + '-' + zeroPad(d.getDate()) + '-' + zeroPad(d.getHours());
    }

    function fmt(n) {
        n = parseInt(n, 10) || 0;
        return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    }

    async function fetchWithTimeout(url, ms = API_TIMEOUT) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), ms);
        try {
            const res = await fetch(url, { signal: controller.signal, cache: 'no-store' });
            if (!res.ok) {
                console.warn('[stats] fetch fail', url, res.status);
                return null;
            }
            return await res.json();
        } catch (e) {
            console.warn('[stats] fetch error', url, e.message);
            return null;
        } finally {
            clearTimeout(timeout);
        }
    }

    async function apiGet(key) {
        const now = Date.now();
        const cached = cache.get(key);
        if (cached && now - cached.ts < CACHE_TTL) return cached.val;

        const data = await fetchWithTimeout(`${API}/get/${encodeURIComponent(key)}`);
        const val = data && data.value ? parseInt(data.value, 10) || 0 : 0;
        cache.set(key, { ts: now, val });
        return val;
    }

    async function apiGetBatch(keys) {
        const uniqueKeys = [...new Set(keys)];
        const results = await Promise.all(uniqueKeys.map(k => apiGet(k)));
        const map = new Map(uniqueKeys.map((k, i) => [k, results[i]]));
        return keys.map(k => map.get(k));
    }

    function $(sel) { return document.querySelector(sel); }
    function $$(sel) { return document.querySelectorAll(sel); }

    function setText(id, val) {
        const el = $(`#${id}`);
        if (el) el.textContent = val;
    }

    function buildRangePicker() {
        const sel = $('#rangeSelect');
        if (!sel) return;
        Object.entries(RANGES).forEach(([k, v]) => {
            const o = document.createElement('option');
            o.value = k;
            o.textContent = v.label;
            sel.appendChild(o);
        });
        sel.value = currentRange;
        sel.addEventListener('change', () => {
            const val = sel.value;
            if (val === 'custom') {
                openCustomModal();
                sel.value = currentRange;
            } else {
                currentRange = val;
                loadRange(val);
            }
        });

        const modal = $('#customRangeModal');
        const closeBtn = modal.querySelector('.modal-close');
        const cancelBtn = $('#customCancel');
        const applyBtn = $('#customApply');
        const startInput = $('#customStartDate');
        const endInput = $('#customEndDate');

        [closeBtn, cancelBtn, modal.querySelector('.modal-backdrop')].forEach(btn => {
            btn?.addEventListener('click', closeCustomModal);
        });

        applyBtn.addEventListener('click', () => {
            const start = startInput.value;
            const end = endInput.value;
            if (start && end) {
                currentRange = 'custom';
                loadCustomRange(start, end);
                closeCustomModal();
            }
        });

        modal.querySelectorAll('.quick-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const days = parseInt(btn.dataset.days, 10);
                const end = new Date();
                const start = new Date(); start.setDate(start.getDate() - days + 1);
                startInput.value = start.toISOString().split('T')[0];
                endInput.value = end.toISOString().split('T')[0];
            });
        });
    }

    function openCustomModal() {
        const modal = $('#customRangeModal');
        const today = new Date().toISOString().split('T')[0];
        const weekAgo = new Date(Date.now() - 6*864e5).toISOString().split('T')[0];
        $('#customStartDate').value = weekAgo;
        $('#customEndDate').value = today;
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }

    function closeCustomModal() {
        $('#customRangeModal').style.display = 'none';
        document.body.style.overflow = '';
    }

    function getRangeKeys(rangeKey) {
        const range = RANGES[rangeKey];
        const now = new Date();
        const keys = [];
        const labels = [];

        if (range.type === 'hour') {
            // 24 hours: same hour yesterday to same hour today
            // e.g. now 15:00 -> 15:00 yesterday to 15:00 today
            // Table: newest first (current hour at top)
            // Chart: left-to-right oldest to newest
            for (let i = 23; i >= 0; i--) {
                const d = new Date(now.getTime() - i * 60 * 60 * 1000);
                keys.push(keyOf('hour', isoHourOf(d)));
                const hourStr = zeroPad(d.getHours()) + ':00';
                const dateStr = zeroPad(d.getDate()) + '/' + zeroPad(d.getMonth() + 1);
                labels.push(hourStr + '\n' + dateStr);
            }
        } else if (range.type === 'today') {
            // Today's hours: 00:00 -> currentHour (oldest -> newest), table nanti dibalik
            const today = new Date();
            const currentHour = today.getHours();
            for (let h = 0; h <= currentHour; h++) {
                const d = new Date(today.getFullYear(), today.getMonth(), today.getDate(), h);
                keys.push(keyOf('hour', isoHourOf(d)));
                labels.push(zeroPad(h) + ':00');
            }
        } else if (range.type === 'week') {
            for (let i = 6; i >= 0; i--) {
                const d = new Date(); d.setDate(d.getDate() - i);
                keys.push(keyOf('day', isoFor(i)));
                labels.push(['Min','Sen','Sel','Rab','Kam','Jum','Sab'][d.getDay()]);
            }
        } else if (range.type === 'month') {
            // Bulan Ini: hanya 1 s/d hari ini (biar Total/Avg tidak ketambahan hari masa depan = 0) ala Blogger
            const endDay = now.getDate();
            for (let i = 1; i <= endDay; i++) {
                const d = new Date(now.getFullYear(), now.getMonth(), i);
                keys.push(keyOf('day', d.getFullYear() + '-' + zeroPad(d.getMonth()+1) + '-' + zeroPad(d.getDate())));
                labels.push(zeroPad(d.getDate()));
            }
        } else if (range.type === 'prevmonth') {
            const d = new Date(now.getFullYear(), now.getMonth(), 0);
            const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
            for (let i = 1; i <= daysInMonth; i++) {
                const day = new Date(d.getFullYear(), d.getMonth(), i);
                keys.push(keyOf('day', day.getFullYear() + '-' + zeroPad(day.getMonth()+1) + '-' + zeroPad(day.getDate())));
                labels.push(zeroPad(day.getDate()));
            }
        } else if (range.type === 'yesterday') {
            const y = new Date(); y.setDate(y.getDate() - 1);
            for (let h = 0; h < 24; h++) {
                const d = new Date(y.getFullYear(), y.getMonth(), y.getDate(), h);
                keys.push(keyOf('hour', isoHourOf(d)));
                labels.push(zeroPad(h) + ':00');
            }
        } else if (range.type === '30days') {
            for (let i = 29; i >= 0; i--) {
                const d = new Date(); d.setDate(d.getDate() - i);
                keys.push(keyOf('day', isoFor(i)));
                labels.push(zeroPad(d.getDate()) + '/' + zeroPad(d.getMonth()+1));
            }
        } else if (range.type === '90days' || range.type === '3month') {
            for (let i = 89; i >= 0; i--) {
                const d = new Date(); d.setDate(d.getDate() - i);
                keys.push(keyOf('day', isoFor(i)));
                labels.push(zeroPad(d.getDate()) + '/' + zeroPad(d.getMonth()+1));
            }
        } else if (range.type === 'alltime') {
            // Sepanjang waktu: tampil per bulan, 24 bulan terakhir (2 tahun)
            for (let i = 23; i >= 0; i--) {
                const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
                keys.push(keyOf('month', d.getFullYear() + '-' + zeroPad(d.getMonth()+1)));
                labels.push(['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'][d.getMonth()] + ' ' + String(d.getFullYear()).slice(-2));
            }
        } else if (range.type === 'year') {
            // Tahun Ini: Jan s/d bulan sekarang saja (Blogger tidak hitung bulan depan)
            const curM = now.getMonth();
            for (let m = 0; m <= curM; m++) {
                const d = new Date(now.getFullYear(), m);
                keys.push(keyOf('month', d.getFullYear() + '-' + zeroPad(m+1)));
                labels.push(['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'][m]);
            }
        } else if (range.type === 'prevyear') {
            for (let m = 0; m < 12; m++) {
                const d = new Date(now.getFullYear() - 1, m);
                keys.push(keyOf('month', d.getFullYear() + '-' + zeroPad(m+1)));
                labels.push(['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'][m]);
            }
        }
        return { keys, labels, range };
    }

    async function loadRange(rangeKey) {
        if (rangeKey === 'custom') return;
        const { keys, labels, range } = getRangeKeys(rangeKey);
        const values = await apiGetBatch(keys);

        $('#rngTitle').textContent = range.label;
        renderBarChart(labels, values);

        // Untuk Sepanjang Waktu, total = total global (ala Blogger), bukan sum 24 bulan
        let total, avg;
        if (range.type === 'alltime') {
            total = await apiGet(keyOf('total'));
            avg = values.length ? Math.round(total / values.length) : 0;
        } else {
            total = values.reduce((a, b) => a + b, 0);
            avg = values.length ? Math.round(total / values.length) : 0;
        }
        const peakIdx = values.indexOf(Math.max(...values));
        const peakLabel = labels[peakIdx] || '-';
        const peakVal = values[peakIdx] || 0;

        setText('rngTotal', fmt(total));
        setText('rngAvg', fmt(avg));
        $('#rngPeak').textContent = `${peakLabel} (${fmt(peakVal)})`;

        const tbody = $('#dayTable');
        if (tbody) {
            // SELALU terbaru di atas (jam/hari/tgl sekarang di baris pertama)
            const displayValues = [...values].reverse();
            const displayLabels = [...labels].reverse();
            tbody.innerHTML = displayValues.map((v, i) =>
                `<tr><td>${displayLabels[i].replace('\n',' ')}</td><td class="num">${fmt(v)}</td></tr>`
            ).join('');
        }

        // Cache to localStorage
        localStorage.setItem('vh_range_' + rangeKey, JSON.stringify({
            ts: Date.now(),
            data: { labels, values, total, avg, peakLabel, peakVal }
        }));
    }

    async function loadCustomRange(startStr, endStr) {
        const start = new Date(startStr);
        const end = new Date(endStr);
        const diffDays = Math.ceil((end - start) / 864e5) + 1;

        const keys = [];
        const labels = [];
        for (let i = 0; i < diffDays; i++) {
            const d = new Date(start);
            d.setDate(d.getDate() + i);
            keys.push(keyOf('day', d.getFullYear() + '-' + zeroPad(d.getMonth()+1) + '-' + zeroPad(d.getDate())));
            if (diffDays <= 31) labels.push(zeroPad(d.getDate()) + '/' + zeroPad(d.getMonth()+1));
            else if (i % 7 === 0) labels.push(zeroPad(d.getDate()) + '/' + zeroPad(d.getMonth()+1));
            else labels.push('');
        }

        const values = await apiGetBatch(keys);
        const rangeLabel = `${zeroPad(start.getDate())}/${zeroPad(start.getMonth()+1)}/${start.getFullYear()} - ${zeroPad(end.getDate())}/${zeroPad(end.getMonth()+1)}/${end.getFullYear()}`;

        $('#rngTitle').textContent = rangeLabel;
        renderBarChart(labels, values);

        const total = values.reduce((a, b) => a + b, 0);
        const avg = values.length ? Math.round(total / values.length) : 0;
        const peakIdx = values.indexOf(Math.max(...values));
        const peakLabel = labels[peakIdx] || '-';
        const peakVal = values[peakIdx] || 0;

        setText('rngTotal', fmt(total));
        setText('rngAvg', fmt(avg));
        $('#rngPeak').textContent = `${peakLabel} (${fmt(peakVal)})`;

        const tbody = $('#dayTable');
        if (tbody) {
            const revVals = [...values].reverse();
            const revLabs = [...labels].reverse();
            tbody.innerHTML = revVals.map((v, i) =>
                `<tr><td>${revLabs[i] || zeroPad(new Date(end).getDate() - i) + '/' + zeroPad(new Date(end).getMonth()+1)}</td><td class="num">${fmt(v)}</td></tr>`
            ).join('');
        }
    }

    async function loadOverview() {
        // Load from localStorage immediately
        loadCachedOverview();

        const today = isoFor(0);
        const yesterday = isoFor(1);

        // Fetch individually so UI updates as each completes
        const keys = [
            { id: 'statTotal', key: keyOf('total') },
            { id: 'statToday', key: keyOf('day', today) },
            { id: 'statYesterday', key: keyOf('day', yesterday) },
            { id: 'statOnline', key: keyOf('online') },
        ];

        const weekKeys = [];
        for (let i = 0; i < 7; i++) weekKeys.push(keyOf('day', isoFor(i)));

        const results = await Promise.allSettled([
            apiGet(keyOf('total')),
            apiGet(keyOf('day', today)),
            apiGet(keyOf('day', yesterday)),
            apiGetBatch(weekKeys),
            apiGet(keyOf('online'))
        ]);

        const total = results[0].status === 'fulfilled' ? results[0].value : 0;
        const todayVal = results[1].status === 'fulfilled' ? results[1].value : 0;
        const yesterdayVal = results[2].status === 'fulfilled' ? results[2].value : 0;
        const weekVals = results[3].status === 'fulfilled' ? results[3].value : Array(7).fill(0);
        const online = results[4].status === 'fulfilled' ? results[4].value : 0;

        const weekTotal = weekVals.reduce((a, b) => a + b, 0);

        const data = { total, todayVal, yesterdayVal, weekTotal, online };
        overviewCache = { ts: Date.now(), data };
        localStorage.setItem('vh_overview', JSON.stringify(overviewCache));

        setText('statTotal', fmt(total));
        setText('statToday', fmt(todayVal));
        setText('statYesterday', fmt(yesterdayVal));
        setText('statWeek', fmt(weekTotal));
    }

    function loadCachedOverview() {
        try {
            const cached = JSON.parse(localStorage.getItem('vh_overview') || 'null');
            if (cached && cached.data) {
                overviewCache = cached;
                const { total, todayVal, yesterdayVal, weekTotal } = cached.data;
                setText('statTotal', fmt(total));
                setText('statToday', fmt(todayVal));
                setText('statYesterday', fmt(yesterdayVal));
                setText('statWeek', fmt(weekTotal));
            }
        } catch (e) {}
    }

    let lastChart = { labels: null, values: null };
    function renderBarChart(labels, values) {
        const container = $('#chart');
        if (!container) return;
        lastChart = { labels: [...labels], values: [...values] };

        const height = 220;
        const padding = { top: 24, right: 16, bottom: 44, left: 48 };
        const maxVal = Math.max(...values, 1);

        // width: untuk rentang panjang (90 hari) perlu scroll, untuk rentang pendek full width
        const wrapWidth = container.parentElement.clientWidth || 900;
        const minBar = 22; // px per bar minimal agar tidak gepeng
        const needed = labels.length * minBar + padding.left + padding.right;
        const contentWidth = Math.max(wrapWidth, needed);
        // jika label sedikit, pakai wrapWidth agar bar memenuhi container

        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', `0 0 ${contentWidth} ${height}`);
        svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
        svg.style.cssText = `width:${contentWidth}px;height:${height}px;display:block;background:#000;border-radius:6px;min-width:100%;`;

        const innerW = contentWidth - padding.left - padding.right;
        const innerH = height - padding.top - padding.bottom;
        const step = innerW / Math.max(labels.length, 1);
        const barW = Math.max(6, Math.min(28, step * 0.62));
        const yScale = (val) => padding.top + innerH - (val / maxVal) * innerH;

        const yTicks = 4;
        let grid = '';
        for (let i = 0; i <= yTicks; i++) {
            const y = padding.top + (i / yTicks) * innerH;
            const val = Math.round(maxVal * (1 - i / yTicks));
            grid += `<line x1="${padding.left}" y1="${y}" x2="${contentWidth - padding.right}" y2="${y}" stroke="#2a2a2a" stroke-width="0.5" stroke-dasharray="${i===0?'0':'3 4'}"/>`;
            grid += `<text x="${padding.left - 8}" y="${y + 4}" fill="#888" font-size="11" text-anchor="end" font-weight="600">${fmt(val)}</text>`;
        }

        // bars
        let bars = '';
        let topLabels = '';
        values.forEach((v, i) => {
            const xCenter = padding.left + step * i + step / 2;
            const x = xCenter - barW / 2;
            const y = yScale(v);
            const h = innerH - (y - padding.top);
            const barH = Math.max(0, h);
            const isPeak = v === maxVal && v > 0;
            const fill = isPeak ? '#ffa74e' : (v === 0 ? '#2a2a2a' : '#f10000');
            const radius = barW > 10 ? 4 : 2;
            // bar dengan sudut atas rounded
            bars += `<rect x="${x}" y="${y}" width="${barW}" height="${barH}" rx="${radius}" ry="${radius}" fill="${fill}" opacity="${v===0?0.5:0.95}" style="filter:${isPeak?'drop-shadow(0 0 6px #ffa74e)':''}">`
                 + `<title>${(labels[i]||'').replace('\n',' ')}: ${fmt(v)}</title></rect>`;
            if (v > 0 && labels.length <= 31) {
                topLabels += `<text x="${xCenter}" y="${y - 6}" fill="#fff" font-size="10" text-anchor="middle" font-weight="700">${fmt(v)}</text>`;
            }
        });

        // x labels
        const labelStep = labels.length > 60 ? 7 : labels.length > 31 ? 3 : labels.length > 14 ? 2 : 1;
        let xLabels = '';
        labels.forEach((label, i) => {
            if (!label) return;
            if (i % labelStep !== 0) return;
            const xCenter = padding.left + step * i + step / 2;
            const clean = label.replace('\n',' ');
            // untuk 24jam yang ada \n, pisah dua baris
            if (label.includes('\n')) {
                const [a,b] = label.split('\n');
                xLabels += `<text x="${xCenter}" y="${height - padding.bottom + 14}" fill="#aaa" font-size="10" text-anchor="middle"><tspan x="${xCenter}" dy="0">${a}</tspan><tspan x="${xCenter}" dy="11">${b}</tspan></text>`;
            } else {
                xLabels += `<text x="${xCenter}" y="${height - padding.bottom + 16}" fill="#aaa" font-size="10" text-anchor="middle">${clean}</text>`;
            }
        });

        // jika semua 0, tampilkan pesan
        const allZero = values.every(v => v === 0);
        const emptyNote = allZero ? `<text x="${contentWidth/2}" y="${padding.top + innerH/2}" fill="#666" font-size="12" text-anchor="middle">Belum ada data di rentang ini</text>` : '';

        svg.innerHTML = `
            <defs>
                <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="#f10000" stop-opacity="0.95"/>
                    <stop offset="100%" stop-color="#8a0000" stop-opacity="0.9"/>
                </linearGradient>
            </defs>
            ${grid}
            ${bars}
            ${topLabels}
            ${xLabels}
            ${emptyNote}
        `;
        container.innerHTML = '';
        container.appendChild(svg);
        // sesuaikan lebar wrapper agar scroll muncul hanya jika needed > wrapWidth
        container.style.width = contentWidth + 'px';
        container.style.minWidth = '100%';
    }
    // re-render saat resize
    let resizeTimer = null;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            if (lastChart.labels) renderBarChart(lastChart.labels, lastChart.values);
        }, 150);
    });

    function loadCachedRange() {
        try {
            const cached = JSON.parse(localStorage.getItem('vh_range_' + currentRange) || 'null');
            if (cached && cached.data) {
                const { labels, values, total, avg, peakLabel, peakVal } = cached.data;
                renderBarChart(labels, values);
                setText('rngTotal', fmt(total));
                setText('rngAvg', fmt(avg));
                $('#rngPeak').textContent = `${peakLabel} (${fmt(peakVal)})`;
                const tbody = $('#dayTable');
                if (tbody) {
                    const revVals = [...values].reverse();
                    const revLabs = [...labels].reverse();
                    tbody.innerHTML = revVals.map((v, i) =>
                        `<tr><td>${revLabs[i]}</td><td class="num">${fmt(v)}</td></tr>`
                    ).join('');
                        }
            }
        } catch (e) {}
    }
    async function refresh() {
        if (isLoading) return;
        isLoading = true;

        try {
            await Promise.all([
                loadOverview(),
                loadRange(currentRange)
            ]);
        } catch (err) {
            console.error('Dashboard error:', err);
        } finally {
            isLoading = false;
        }
    }

    function updateLastUpdateLabel() {
        const el = $('#lastUpdate');
        if (el) el.innerHTML = '<i class="fa-solid fa-circle" style="color:#22c55e;font-size:8px;animation:pulse 1.5s infinite;"></i> Auto-update 30s - ' + new Date().toLocaleTimeString('id-ID');
    }

    async function forceRefresh() {
        console.log('[stats] forceRefresh - clear cache');
        cache.clear();
        try {
            localStorage.removeItem('vh_overview');
            // hapus semua vh_range_*
            Object.keys(localStorage).forEach(k => { if (k.startsWith('vh_range_')) localStorage.removeItem(k); });
            sessionStorage.clear();
        } catch (e) {}
        // tampilkan loading
        const tbs = ['#statToday','#statYesterday','#statWeek','#statTotal','#rngTotal','#rngAvg'];
        // jangan hapus, biarkan refresh yang isi
        await refresh();
        updateLastUpdateLabel();
    }

    buildRangePicker();
    loadCachedOverview();
    loadCachedRange();
    refresh().then(updateLastUpdateLabel);
    refreshTimer = setInterval(() => {
        cache.clear();
        refresh().then(updateLastUpdateLabel);
    }, 30000);
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            clearInterval(refreshTimer);
        } else {
            cache.clear();
            refresh().then(updateLastUpdateLabel);
            refreshTimer = setInterval(() => {
                cache.clear();
                refresh().then(updateLastUpdateLabel);
            }, 30000);
        }
    });
    window.addEventListener('beforeunload', () => clearInterval(refreshTimer));

    // tombol refresh manual - bypass cache 60s
    const frBtn = document.getElementById('forceRefreshBtn');
    if (frBtn) {
        frBtn.addEventListener('click', async () => {
            frBtn.disabled = true;
            const old = frBtn.innerHTML;
            frBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> ...';
            await forceRefresh();
            frBtn.innerHTML = old;
            frBtn.disabled = false;
        });
    }
    // expose untuk console debug
    window.VH_forceRefresh = forceRefresh;
    window.VH_statsDebug = () => ({ cache: [...cache.entries()], overviewCache, currentRange });
})();