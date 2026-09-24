-- Phase 1 Google Calendar: per-business connection + shoot event ids.
-- Tokens are ciphertext only. RLS is enabled with no policies — service role
-- bypasses RLS; anon and authenticated are revoked.

CREATE TABLE IF NOT EXISTS google_calendar_connections (
  business_id UUID PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE,
  connected_email TEXT,
  access_token_ciphertext TEXT NOT NULL,
  refresh_token_ciphertext TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ,
  calendar_id TEXT NOT NULL DEFAULT 'primary',
  calendar_summary TEXT,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'needs_reconnect')),
  last_error TEXT,
  connected_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  connected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS google_calendar_connections_updated_at ON google_calendar_connections;
CREATE TRIGGER google_calendar_connections_updated_at
  BEFORE UPDATE ON google_calendar_connections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE google_calendar_connections ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON google_calendar_connections FROM PUBLIC;
REVOKE ALL ON google_calendar_connections FROM anon;
REVOKE ALL ON google_calendar_connections FROM authenticated;
GRANT ALL ON google_calendar_connections TO service_role;

ALTER TABLE shoot_proposals
  ADD COLUMN IF NOT EXISTS google_event_id TEXT,
  ADD COLUMN IF NOT EXISTS google_sync_status TEXT,
  ADD COLUMN IF NOT EXISTS google_sync_error TEXT,
  ADD COLUMN IF NOT EXISTS google_sync_at TIMESTAMPTZ;

ALTER TABLE shoot_proposals
  DROP CONSTRAINT IF EXISTS shoot_proposals_google_sync_status_check;
ALTER TABLE shoot_proposals
  ADD CONSTRAINT shoot_proposals_google_sync_status_check
  CHECK (
    google_sync_status IS NULL
    OR google_sync_status IN ('pending', 'synced', 'error')
  );
