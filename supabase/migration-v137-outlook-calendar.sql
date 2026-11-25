-- ShootPortal V137 — Outlook / Microsoft 365 calendar (business connection)
--
-- Lives entirely beside the Google Calendar tables; nothing Google-related changes.
-- A business can connect Google, Outlook, or both — each works on its own.
--
-- 1. outlook_calendar_connections  One Microsoft account per business. Tokens are ciphertext
--                                  only (AES-256-GCM, purpose "sp-outlook-token").
--                                  calendar_id       = where shoots are written
--                                  busy_calendar_ids = calendars whose busy times block the
--                                                      owner's Instant Booking availability
-- 2. outlook_calendar_events       Which Outlook event belongs to which shoot (one row per
--                                  shoot_proposals row). Kept out of shoot_proposals so the
--                                  Google columns and every existing query stay untouched.
--
-- RLS is enabled with no policies (service role only), exactly like google_calendar_connections.
--
-- Additive only. The app runs without this migration: the Outlook card shows a setup notice
-- and every Outlook sync is skipped.
--
-- HOW TO RUN: Supabase SQL Editor → paste → Run. Re-runnable.
-- Rollback:
--   DROP TABLE IF EXISTS outlook_calendar_events;
--   DROP TABLE IF EXISTS outlook_calendar_connections;

CREATE TABLE IF NOT EXISTS outlook_calendar_connections (
  business_id UUID PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE,
  connected_email TEXT,
  access_token_ciphertext TEXT NOT NULL,
  refresh_token_ciphertext TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ,
  calendar_id TEXT,
  calendar_name TEXT,
  busy_calendar_ids TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'needs_reconnect')),
  last_error TEXT,
  connected_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  connected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS outlook_calendar_connections_updated_at ON outlook_calendar_connections;
CREATE TRIGGER outlook_calendar_connections_updated_at
  BEFORE UPDATE ON outlook_calendar_connections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE outlook_calendar_connections ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON outlook_calendar_connections FROM PUBLIC;
REVOKE ALL ON outlook_calendar_connections FROM anon;
REVOKE ALL ON outlook_calendar_connections FROM authenticated;
GRANT ALL ON outlook_calendar_connections TO service_role;

CREATE TABLE IF NOT EXISTS outlook_calendar_events (
  proposal_id UUID PRIMARY KEY REFERENCES shoot_proposals(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  project_id UUID,
  event_id TEXT,
  calendar_id TEXT,
  sync_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (sync_status IN ('pending', 'synced', 'error')),
  sync_error TEXT,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS outlook_calendar_events_business_status
  ON outlook_calendar_events (business_id, sync_status);
CREATE INDEX IF NOT EXISTS outlook_calendar_events_project
  ON outlook_calendar_events (business_id, project_id);

ALTER TABLE outlook_calendar_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON outlook_calendar_events FROM PUBLIC;
REVOKE ALL ON outlook_calendar_events FROM anon;
REVOKE ALL ON outlook_calendar_events FROM authenticated;
GRANT ALL ON outlook_calendar_events TO service_role;
