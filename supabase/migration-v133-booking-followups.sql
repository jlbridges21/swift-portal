-- v133 — Instant Booking follow-ups. Run after v132. Additive and safe to re-run.
--
--   1. Activity types Instant Booking logs (cancel, reassign, override, skipped scheduling).
--      Without them the booking still succeeds but the history entry is dropped.
--   2. Shoot reminders: when the reminder went out (one per appointment row; a reschedule
--      creates a new row, so the new time gets its own reminder).
--   3. Offered times: proposals the business offers the client, checked by the booking engine.
--   4. Per-photographer Google Calendar connections: each team member can connect their own
--      Google account for busy times and for their confirmed shoots.

-- ---------------------------------------------------------------------------
-- 1. Activity types
-- ---------------------------------------------------------------------------

ALTER TYPE activity_type ADD VALUE IF NOT EXISTS 'shoot_cancelled';
ALTER TYPE activity_type ADD VALUE IF NOT EXISTS 'shoot_reassigned';
ALTER TYPE activity_type ADD VALUE IF NOT EXISTS 'shoot_override';
ALTER TYPE activity_type ADD VALUE IF NOT EXISTS 'scheduling_skipped';
ALTER TYPE activity_type ADD VALUE IF NOT EXISTS 'shoot_times_offered';

-- ---------------------------------------------------------------------------
-- 2. Reminders
-- ---------------------------------------------------------------------------

ALTER TABLE shoot_proposals
  ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ;

COMMENT ON COLUMN shoot_proposals.reminder_sent_at IS
  'When the pre-shoot reminder was sent (or skipped because the shoot was booked inside the reminder window).';

-- The reminder cron scans upcoming confirmed shoots that haven't been reminded.
CREATE INDEX IF NOT EXISTS idx_shoot_proposals_reminder_due
  ON shoot_proposals (proposed_at)
  WHERE status = 'confirmed' AND reminder_sent_at IS NULL;

-- ---------------------------------------------------------------------------
-- 3. Offered times
-- ---------------------------------------------------------------------------

ALTER TABLE shoot_proposals DROP CONSTRAINT IF EXISTS shoot_proposals_booking_source_check;
ALTER TABLE shoot_proposals
  ADD CONSTRAINT shoot_proposals_booking_source_check
  CHECK (booking_source IS NULL OR booking_source IN ('instant', 'manual', 'proposal', 'offer'));

COMMENT ON COLUMN shoot_proposals.booking_source IS
  'instant = client self-booked; manual = business scheduled through the booking engine; offer = time the business offered (pending until the client picks it); proposal = legacy propose/confirm flow.';

-- ---------------------------------------------------------------------------
-- 4. Per-photographer Google Calendar connections
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS team_google_calendar_connections (
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  connected_email TEXT,
  access_token_ciphertext TEXT NOT NULL,
  refresh_token_ciphertext TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ,
  -- Their calendars whose busy times block their availability.
  busy_calendar_ids TEXT[] NOT NULL DEFAULT '{}',
  -- Where their confirmed shoots are written (their own calendar).
  destination_calendar_id TEXT NOT NULL DEFAULT 'primary',
  destination_calendar_summary TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'needs_reconnect')),
  last_error TEXT,
  connected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (business_id, user_id)
);

DROP TRIGGER IF EXISTS team_google_calendar_connections_updated_at ON team_google_calendar_connections;
CREATE TRIGGER team_google_calendar_connections_updated_at
  BEFORE UPDATE ON team_google_calendar_connections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Tokens are ciphertext only. Service role only, like google_calendar_connections.
ALTER TABLE team_google_calendar_connections ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON team_google_calendar_connections FROM PUBLIC, anon, authenticated;
GRANT ALL ON team_google_calendar_connections TO service_role;

-- Which Google account wrote a shoot's event: NULL = the business connection, otherwise the
-- team member whose own connection holds it. Updates and deletes use the same account.
ALTER TABLE shoot_proposals
  ADD COLUMN IF NOT EXISTS google_owner_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL;
