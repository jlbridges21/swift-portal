-- V82 — Durable reusable project share access tokens + expiry windows

ALTER TABLE project_shares
  ADD COLUMN IF NOT EXISTS access_token_hash TEXT,
  ADD COLUMN IF NOT EXISTS access_mode TEXT NOT NULL DEFAULT 'reusable',
  ADD COLUMN IF NOT EXISTS access_starts_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS access_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS one_time_used_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS expiry_preset TEXT NOT NULL DEFAULT '30days';

CREATE UNIQUE INDEX IF NOT EXISTS idx_project_shares_access_token_hash
  ON project_shares (access_token_hash)
  WHERE access_token_hash IS NOT NULL AND revoked_at IS NULL;

ALTER TABLE project_shares
  DROP CONSTRAINT IF EXISTS project_shares_access_mode_check;
ALTER TABLE project_shares
  ADD CONSTRAINT project_shares_access_mode_check
  CHECK (access_mode IN ('one_time', 'reusable'));

ALTER TABLE project_shares
  DROP CONSTRAINT IF EXISTS project_shares_expiry_preset_check;
ALTER TABLE project_shares
  ADD CONSTRAINT project_shares_expiry_preset_check
  CHECK (
    expiry_preset IN ('one_time', '24h', '1week', '30days', '60days', 'indefinite', 'custom')
  );

CREATE TABLE IF NOT EXISTS project_share_exchange_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  share_id UUID NOT NULL REFERENCES project_shares(id) ON DELETE CASCADE,
  exchanged_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address TEXT,
  user_agent TEXT
);

CREATE INDEX IF NOT EXISTS idx_project_share_exchange_log_share_id
  ON project_share_exchange_log (share_id, exchanged_at DESC);

ALTER TABLE project_share_exchange_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON project_share_exchange_log FROM PUBLIC, anon, authenticated;
GRANT ALL ON project_share_exchange_log TO service_role;

-- Backfill: existing active shares get 30-day reusable window (no token until next email send)
UPDATE project_shares
SET
  access_mode = 'reusable',
  expiry_preset = '30days',
  access_starts_at = COALESCE(access_starts_at, invited_at),
  access_expires_at = COALESCE(access_expires_at, invited_at + INTERVAL '30 days')
WHERE revoked_at IS NULL
  AND access_expires_at IS NULL
  AND expiry_preset = '30days';

CREATE OR REPLACE FUNCTION user_has_active_project_share(p_project_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  caller_email TEXT;
BEGIN
  SELECT lower(trim(email)) INTO caller_email
  FROM profiles
  WHERE id = auth.uid();

  IF caller_email IS NULL OR caller_email = '' THEN
    RETURN FALSE;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM project_shares ps
    JOIN projects p ON p.id = ps.project_id
    WHERE ps.project_id = p_project_id
      AND ps.revoked_at IS NULL
      AND ps.email = caller_email
      AND p.deleted_at IS NULL
      AND (ps.access_starts_at IS NULL OR ps.access_starts_at <= now())
      AND (ps.access_expires_at IS NULL OR ps.access_expires_at > now())
      AND (
        ps.access_mode <> 'one_time'
        OR ps.one_time_used_at IS NULL
      )
  );
END;
$$;
