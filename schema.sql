-- schema.sql — D1 database untuk counter Comichen
-- Jalankan: wrangler d1 execute comichen-counter --remote --file=schema.sql

CREATE TABLE IF NOT EXISTS counters (
    key        TEXT PRIMARY KEY,
    value      INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_counters_updated_at ON counters(updated_at);
