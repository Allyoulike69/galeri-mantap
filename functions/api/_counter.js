/* ============================================================
   _counter.js — logika bersama Count API (Cloudflare Workers / Pages Functions)
   Binding D1 wajib bernama: DB

   Endpoint: /api/count
     GET  /api/count?hit=k1&hit=k2&get=k3&get=k4
     POST /api/count   { "hit": ["k1","k2"], "get": ["k3"] }

   Balasan: { "ok": true, "values": { "k1": 3, "k2": 1, "k3": 0 } }
   ============================================================ */

const MAX_KEYS = 200;
const KEY_RE = /^[A-Za-z0-9_-]{1,160}$/;

const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400'
};

function json(body, status) {
    return new Response(JSON.stringify(body), {
        status: status || 200,
        headers: Object.assign({
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'no-store, max-age=0'
        }, CORS)
    });
}

function cleanKeys(list, dedupe) {
    if (!Array.isArray(list)) return [];
    const out = [];
    const seen = new Set();
    for (const raw of list) {
        const key = String(raw == null ? '' : raw).trim();
        if (!KEY_RE.test(key)) continue;
        if (dedupe && seen.has(key)) continue;
        seen.add(key);
        out.push(key);
        if (out.length >= MAX_KEYS) break;
    }
    return out;
}

async function parsePayload(request) {
    if (request.method === 'POST') {
        let body = {};
        try { body = await request.json(); } catch (e) { body = {}; }
        return {
            hit: cleanKeys(body.hit, false),   // duplikat = 2 kali hit, sengaja dipertahankan
            get: cleanKeys(body.get, true)
        };
    }
    const url = new URL(request.url);
    return {
        hit: cleanKeys(url.searchParams.getAll('hit'), false),
        get: cleanKeys(url.searchParams.getAll('get'), true)
    };
}

export async function handleCountRequest(request, env) {
    if (request.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: CORS });
    }
    if (request.method !== 'GET' && request.method !== 'POST') {
        return json({ ok: false, error: 'Method not allowed' }, 405);
    }

    const db = env && env.DB;
    if (!db) {
        return json({ ok: false, error: 'D1 binding "DB" belum terpasang.' }, 500);
    }

    let payload;
    try { payload = await parsePayload(request); }
    catch (e) { return json({ ok: false, error: 'Body tidak valid.' }, 400); }

    const { hit, get } = payload;
    if (!hit.length && !get.length) {
        return json({ ok: true, values: {} }); // health check
    }

    const now = new Date().toISOString();

    try {
        if (hit.length) {
            const stmts = hit.map((key) => db.prepare(
                'INSERT INTO counters (key, value, updated_at) VALUES (?, 1, ?) ' +
                'ON CONFLICT(key) DO UPDATE SET ' +
                'value = counters.value + 1, updated_at = excluded.updated_at'
            ).bind(key, now));
            await db.batch(stmts);
        }

        const keys = Array.from(new Set(hit.concat(get)));
        const values = {};
        for (let i = 0; i < keys.length; i += MAX_KEYS) {
            const chunk = keys.slice(i, i + MAX_KEYS);
            const marks = chunk.map(() => '?').join(',');
            const res = await db.prepare(
                'SELECT key, value FROM counters WHERE key IN (' + marks + ')'
            ).bind(...chunk).all();
            for (const row of (res.results || [])) {
                values[row.key] = Number(row.value) || 0;
            }
        }
        for (const key of keys) {
            if (!(key in values)) values[key] = 0;
        }

        return json({ ok: true, values });
    } catch (e) {
        console.error('[counter] D1 error', e);
        return json({ ok: false, error: String((e && e.message) || e) }, 500);
    }
}
