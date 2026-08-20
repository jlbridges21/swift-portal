-- ShootPortal V44 — platform console
-- platform_audit_log (append-only) + impersonation GUC helper for current_business_id().
--
-- v43 is already projects.service_id integrity. This is the next migration.
-- Idempotent: DROP POLICY IF EXISTS before each CREATE POLICY.
--
-- HOW TO RUN: SQL Editor → paste → Run. Re-runnable.

-- ---------------------------------------------------------------------------
-- 1. platform_audit_log
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS platform_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_email TEXT,
  action TEXT NOT NULL,
  target_business_id UUID REFERENCES businesses(id) ON DELETE SET NULL,
  target_type TEXT,
  target_id TEXT,
  metadata JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_platform_audit_log_created
  ON platform_audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_platform_audit_log_business_created
  ON platform_audit_log (target_business_id, created_at DESC);

ALTER TABLE platform_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admins read platform audit log" ON platform_audit_log;
CREATE POLICY "Super admins read platform audit log"
  ON platform_audit_log
  FOR SELECT
  USING (is_super_admin());

-- No INSERT / UPDATE / DELETE policies. Application writes use the service role.
-- Super_admin JWT UPDATE/DELETE must fail.

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON platform_audit_log FROM authenticated, anon;
REVOKE ALL ON platform_audit_log FROM anon;
GRANT SELECT ON platform_audit_log TO authenticated;

-- ---------------------------------------------------------------------------
-- 2. peek_impersonated_current_business_id
--    Sets app.impersonated_business_id (SET LOCAL) then returns current_business_id()
--    in the same statement so the v31b GUC hook can be proven.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION peek_impersonated_current_business_id(p_business_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
VOLATILE
SET search_path = public
AS $$
BEGIN
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF p_business_id IS NULL THEN
    PERFORM set_config('app.impersonated_business_id', '', true);
    RETURN current_business_id();
  END IF;
  PERFORM set_config('app.impersonated_business_id', p_business_id::text, true);
  RETURN current_business_id();
END;
$$;

GRANT EXECUTE ON FUNCTION peek_impersonated_current_business_id(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. Verification
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'platform_audit_log'
  ) THEN
    RAISE EXCEPTION 'v44: platform_audit_log missing';
  END IF;
END $$;
