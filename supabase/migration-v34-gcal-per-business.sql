-- Swift Portal V34: per-business Google Calendar connections
--
-- google_calendar_connections is `id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1)`.
-- Adding business_id to that table is impossible without dropping the singleton
-- constraint. This file creates google_calendar_connections_v2 keyed by
-- business_id and copies the id=1 row onto the Swift tenant.
--
-- The old table is LEFT IN PLACE as a rollback safety net.
--
-- HOW TO RUN:
-- 1. Open Supabase Dashboard → SQL Editor → New query
-- 2. Paste this entire file and click Run
--
-- VERIFICATION:
--   If an id=1 row exists, the final SELECT must show it copied onto
--   business_id = 00000000-0000-0000-0000-000000000001.

-- ---------------------------------------------------------------------------
-- 1. Table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS google_calendar_connections_v2 (
  business_id UUID PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE,
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

DROP TRIGGER IF EXISTS google_calendar_connections_v2_updated_at ON google_calendar_connections_v2;
CREATE TRIGGER google_calendar_connections_v2_updated_at
  BEFORE UPDATE ON google_calendar_connections_v2
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ---------------------------------------------------------------------------
-- 2. Copy id=1 onto the Swift tenant
-- ---------------------------------------------------------------------------
INSERT INTO google_calendar_connections_v2 (
  business_id,
  connected_email,
  access_token,
  refresh_token,
  token_expires_at,
  calendar_id,
  calendar_summary,
  connected_by,
  connected_at,
  updated_at
)
SELECT
  '00000000-0000-0000-0000-000000000001'::uuid,
  connected_email,
  access_token,
  refresh_token,
  token_expires_at,
  calendar_id,
  calendar_summary,
  connected_by,
  connected_at,
  updated_at
FROM google_calendar_connections
WHERE id = 1
ON CONFLICT (business_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 3. RLS — match v32 admin policy style
-- ---------------------------------------------------------------------------
ALTER TABLE google_calendar_connections_v2 ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins full access google_calendar_v2" ON google_calendar_connections_v2;
CREATE POLICY "Admins full access google_calendar_v2" ON google_calendar_connections_v2
  FOR ALL
  USING (is_super_admin() OR (is_admin() AND business_id = current_business_id()))
  WITH CHECK (is_super_admin() OR (is_admin() AND business_id = current_business_id()));

GRANT SELECT, INSERT, UPDATE, DELETE ON google_calendar_connections_v2 TO authenticated;
GRANT ALL ON google_calendar_connections_v2 TO service_role;

-- ---------------------------------------------------------------------------
-- 4. Old google_calendar_connections is untouched. Drop in a later cleanup.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 5. Copy check — true when id=1 existed and landed on Swift, or both empty
-- ---------------------------------------------------------------------------
SELECT
  (v1.id IS NOT NULL) AS had_legacy_row,
  (v2.business_id IS NOT NULL) AS has_swift_row,
  (v1.id IS NULL OR (
    v2.connected_email IS NOT DISTINCT FROM v1.connected_email
    AND v2.calendar_id IS NOT DISTINCT FROM v1.calendar_id
    AND v2.access_token = v1.access_token
  )) AS copied_ok
FROM (SELECT 1) AS seed
LEFT JOIN google_calendar_connections v1 ON v1.id = 1
LEFT JOIN google_calendar_connections_v2 v2
  ON v2.business_id = '00000000-0000-0000-0000-000000000001';
