-- ShootPortal V67 — remove unused Google Calendar integration
--
-- Prerequisites: refresh tokens revoked (2026-08-25) before first apply.
-- Idempotent: safe if tables/column are already gone.
--
-- Drops:
--   google_calendar_connections_v2 (v34)
--   google_calendar_connections (v17 singleton)
--   shoot_proposals.google_calendar_event_id + idx_shoot_proposals_gcal
-- CASCADE removes associated RLS policies and updated_at triggers with the tables.
-- (Do not DROP TRIGGER/POLICY ON a missing relation — Postgres still errors 42P01.)

-- ---------------------------------------------------------------------------
-- 1. shoot_proposals column + index
-- ---------------------------------------------------------------------------
DROP INDEX IF EXISTS idx_shoot_proposals_gcal;
ALTER TABLE shoot_proposals DROP COLUMN IF EXISTS google_calendar_event_id;

-- ---------------------------------------------------------------------------
-- 2. Per-business connections (v34) + legacy singleton (v17)
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS google_calendar_connections_v2 CASCADE;
DROP TABLE IF EXISTS google_calendar_connections CASCADE;
