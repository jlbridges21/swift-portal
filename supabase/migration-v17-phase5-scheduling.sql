-- Swift Portal V17 — Phase 5: Google Calendar sync + shoot event tracking
--
-- HOW TO RUN (if Supabase shows "Unable to find snippet"):
-- 1. Open Supabase Dashboard → SQL Editor → New query
-- 2. Paste this entire file and click Run (do not use saved snippets)
-- Requires: schema.sql (or prior migrations) for update_updated_at() and is_admin()

-- Store Google Calendar event id on confirmed shoot proposals for sync updates
ALTER TABLE shoot_proposals ADD COLUMN IF NOT EXISTS google_calendar_event_id TEXT;

CREATE INDEX IF NOT EXISTS idx_shoot_proposals_gcal ON shoot_proposals (google_calendar_event_id)
  WHERE google_calendar_event_id IS NOT NULL;

-- Admin Google Calendar OAuth connection (single business account)
CREATE TABLE IF NOT EXISTS google_calendar_connections (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  connected_email TEXT,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ NOT NULL,
  calendar_id TEXT,
  calendar_summary TEXT,
  connected_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  connected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS google_calendar_connections_updated_at ON google_calendar_connections;
CREATE TRIGGER google_calendar_connections_updated_at BEFORE UPDATE ON google_calendar_connections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE google_calendar_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins full access google_calendar" ON google_calendar_connections;
CREATE POLICY "Admins full access google_calendar" ON google_calendar_connections
  FOR ALL USING (is_admin());
