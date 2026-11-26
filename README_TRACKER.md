# Tracker D1 — versi GitHub Pages

Deploy dari GitHub. **Tidak perlu wrangler, tidak perlu migrasi, tidak perlu tukar domain.**

## A. Sekali saja di Cloudflare

1. **Storage & Databases → D1 → Create database**
   - Nama: `comichen-counter`

2. Buka database itu → tab **Console** → jalankan SQL:

```sql
CREATE TABLE IF NOT EXISTS counters (
    key TEXT PRIMARY KEY,
    value INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

3. **Pages → allyoulikecomic → Settings → Functions → D1 database bindings**
   - Add binding
   - Variable name: `DB`
   - D1 database: `comichen-counter`
   - Save

## B. Setiap kali ada perubahan kode

- Push ke GitHub. Pastikan ikut ter-push:
  - `tracker.js`
  - semua `.html`
  - `functions/api/count.js`
  - `functions/api/_counter.js`
  - `dash/comic.html`, `dash/stats.js`
- Tunggu deploy di tab **Deployments** selesai.
- Hard refresh (`Ctrl+F5`).

## C. Cek

Buka:

```
https://allyoulikecomic.pages.dev/api/count?get=comichen_total
```

Harus balas:

```json
{"ok":true,"values":{"comichen_total":0}}
```

Kalau masih 404, berarti `functions/api/` belum ikut ke GitHub atau binding `DB` belum dipasang.

## Endpoint otomatis

- Di `https://allyoulikecomic.pages.dev` → `/api/count`
- Di `localhost` → otomatis ke `https://allyoulikecomic.pages.dev/api/count`

Tidak ada yang perlu diedit saat pindah domain.
