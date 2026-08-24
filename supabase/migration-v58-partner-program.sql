-- ShootPortal V58 — Partner Program foundation (applications + partners)
--
-- PLATFORM-LEVEL tables: partner_applications and partners have NO business_id
-- on purpose. Partners are ShootPortal-wide (like plans / platform_audit_log),
-- not tenant-owned. Tenant-lint and the standing “every new table gets
-- business_id” rule do NOT apply — documented exception.
-- See docs/TENANT-ARCHITECTURE.md, scripts/tenant-lint.ts, and
-- supabase/tests/tenant-sql-audit.sql.
--
-- Phase 1 only: schema, applications, partner accounts, super-admin review.
-- No attribution, commissions, or money in this migration (phases 2–3).
-- commission_rate_pct is stored on partners now so phase 3 can snapshot it
-- onto each commission row.
--
-- Idempotent: DROP POLICY IF EXISTS before each CREATE POLICY.
-- HOW TO RUN: SQL Editor → paste → Run. Re-runnable.

-- ---------------------------------------------------------------------------
-- 1. partner_applications
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS partner_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  brand_name TEXT NOT NULL,
  website TEXT,
  social_links JSONB NOT NULL DEFAULT '{}'::jsonb,
  audience_size TEXT,
  promotion_plan TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'declined', 'withdrawn')),
  reviewed_by UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  review_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE partner_applications IS
  'PLATFORM-SCOPED: ShootPortal partner applications. No business_id — intentional exception (not tenant data).';

CREATE INDEX IF NOT EXISTS idx_partner_applications_status_created
  ON partner_applications (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_partner_applications_email_lower
  ON partner_applications (lower(email));

DROP TRIGGER IF EXISTS partner_applications_updated_at ON partner_applications;
CREATE TRIGGER partner_applications_updated_at
  BEFORE UPDATE ON partner_applications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE partner_applications ENABLE ROW LEVEL SECURITY;

-- Super_admin only. Public submit uses service-role API (bypasses RLS).
DROP POLICY IF EXISTS "Super admins manage partner applications" ON partner_applications;
CREATE POLICY "Super admins manage partner applications"
  ON partner_applications
  FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON partner_applications TO service_role;
GRANT SELECT ON partner_applications TO authenticated;

-- ---------------------------------------------------------------------------
-- 2. partners
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  application_id UUID REFERENCES partner_applications (id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  brand_name TEXT NOT NULL,
  website TEXT,
  social_links JSONB NOT NULL DEFAULT '{}'::jsonb,
  referral_code TEXT NOT NULL,
  commission_rate_pct NUMERIC(5, 2) NOT NULL DEFAULT 30
    CHECK (commission_rate_pct >= 0 AND commission_rate_pct <= 100),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'suspended')),
  approved_by UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT partners_email_unique UNIQUE (email),
  CONSTRAINT partners_referral_code_unique UNIQUE (referral_code)
);

COMMENT ON TABLE partners IS
  'PLATFORM-SCOPED: ShootPortal partner accounts. No business_id — intentional exception. Linked via user_id; not a profiles.role. commission_rate_pct is snapshotted onto commission rows in phase 3.';

CREATE UNIQUE INDEX IF NOT EXISTS idx_partners_user_id_unique
  ON partners (user_id)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_partners_status ON partners (status);
CREATE INDEX IF NOT EXISTS idx_partners_referral_code ON partners (referral_code);

DROP TRIGGER IF EXISTS partners_updated_at ON partners;
CREATE TRIGGER partners_updated_at
  BEFORE UPDATE ON partners
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE partners ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admins manage partners" ON partners;
CREATE POLICY "Super admins manage partners"
  ON partners
  FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- Partner may read only their own row (match auth.uid).
DROP POLICY IF EXISTS "Partners read own row" ON partners;
CREATE POLICY "Partners read own row"
  ON partners
  FOR SELECT
  USING (user_id IS NOT NULL AND user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON partners TO service_role;
GRANT SELECT ON partners TO authenticated;
