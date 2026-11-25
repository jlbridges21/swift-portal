-- ShootPortal V139 — Calendar events (Shoot Calendar click-to-create)
--
-- Events created on the Shoot Calendar that are NOT a project's shoot: personal blocks, errands,
-- meetings ("use ShootPortal as my calendar"). Shoots tied to a project keep living in
-- shoot_proposals; this table is only for events without a project.
--
-- Each event is written to the business's Google and/or Outlook calendar (the calendar chosen
-- for shoots), and blocks the assigned team member in Instant Booking.
--
-- RLS is enabled with no policies (service role only), like the calendar connection tables.
-- Additive only. Without it, the Shoot Calendar still works; creating an event without a
-- project says to apply this migration.
--
-- HOW TO RUN: Supabase SQL Editor → paste → Run. Re-runnable.
-- Rollback:
--   DROP TABLE IF EXISTS calendar_events;

CREATE TABLE IF NOT EXISTS calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT '',
  description TEXT,
  location TEXT,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  assigned_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  service_id UUID,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  google_event_id TEXT,
  google_calendar_id TEXT,
  outlook_event_id TEXT,
  outlook_calendar_id TEXT,
  sync_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (end_at > start_at)
);

CREATE INDEX IF NOT EXISTS calendar_events_business_start
  ON calendar_events (business_id, start_at);
CREATE INDEX IF NOT EXISTS calendar_events_business_user_start
  ON calendar_events (business_id, assigned_user_id, start_at);

DROP TRIGGER IF EXISTS calendar_events_updated_at ON calendar_events;
CREATE TRIGGER calendar_events_updated_at
  BEFORE UPDATE ON calendar_events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON calendar_events FROM PUBLIC;
REVOKE ALL ON calendar_events FROM anon;
REVOKE ALL ON calendar_events FROM authenticated;
GRANT ALL ON calendar_events TO service_role;
