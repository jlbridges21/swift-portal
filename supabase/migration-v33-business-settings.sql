-- Swift Portal V33: per-business settings (do not alter app_settings in place)
--
-- app_settings is `id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1)`. Adding
-- business_id to that table is impossible without dropping the singleton
-- constraint. This file creates business_settings and copies Swift's live
-- JSONB blob VERBATIM.
--
-- app_settings is LEFT IN PLACE as a rollback safety net. Drop it in a later
-- cleanup migration once business_settings is proven in production.
--
-- HOW TO RUN:
-- 1. Open Supabase Dashboard → SQL Editor → New query
-- 2. Paste this entire file and click Run
--
-- VERIFICATION:
--   The final SELECT (a.settings = b.settings) MUST return identical = true.

-- ---------------------------------------------------------------------------
-- 1. Table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS business_settings (
  business_id UUID PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL
);

DROP TRIGGER IF EXISTS business_settings_updated_at ON business_settings;
CREATE TRIGGER business_settings_updated_at
  BEFORE UPDATE ON business_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ---------------------------------------------------------------------------
-- 2. Copy app_settings id=1 VERBATIM onto the Swift tenant
--    No transformation, no re-keying, no merge with defaults.
-- ---------------------------------------------------------------------------
INSERT INTO business_settings (business_id, settings, updated_at, updated_by)
SELECT
  '00000000-0000-0000-0000-000000000001'::uuid,
  settings,
  updated_at,
  updated_by
FROM app_settings
WHERE id = 1
ON CONFLICT (business_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 3. Empty '{}' for any other business that has no row yet
--    so getAppSettings never 404s.
-- ---------------------------------------------------------------------------
INSERT INTO business_settings (business_id, settings)
SELECT b.id, '{}'::jsonb
FROM businesses b
WHERE b.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM business_settings s WHERE s.business_id = b.id
  );

-- ---------------------------------------------------------------------------
-- 4. RLS — defense-in-depth (app reads/writes via service role)
--    Match v32 admin policy style.
-- ---------------------------------------------------------------------------
ALTER TABLE business_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins full access business_settings" ON business_settings;
CREATE POLICY "Admins full access business_settings" ON business_settings
  FOR ALL
  USING (is_super_admin() OR (is_admin() AND business_id = current_business_id()))
  WITH CHECK (is_super_admin() OR (is_admin() AND business_id = current_business_id()));

GRANT SELECT, INSERT, UPDATE, DELETE ON business_settings TO authenticated;
GRANT ALL ON business_settings TO service_role;

-- ---------------------------------------------------------------------------
-- 5. app_settings is untouched. Drop in a later cleanup migration.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 6. Identity check — MUST return true
-- ---------------------------------------------------------------------------
SELECT (a.settings = b.settings) AS identical
FROM app_settings a, business_settings b
WHERE a.id = 1
  AND b.business_id = '00000000-0000-0000-0000-000000000001';
