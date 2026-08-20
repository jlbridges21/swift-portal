-- ShootPortal V45 — subscription plans (entitlements only; no billing)
--
-- PLATFORM-LEVEL table: plans has NO business_id on purpose.
-- Plans are ShootPortal catalog rows shared across every tenant (like
-- platform_audit_log / processed_stripe_events). Tenant-lint and the
-- standing “every new table gets business_id” rule do NOT apply here —
-- documented exception. See docs/TENANT-ARCHITECTURE.md.
--
-- Idempotent: DROP POLICY IF EXISTS before each CREATE POLICY.
-- HOW TO RUN: SQL Editor → paste → Run. Re-runnable.

-- ---------------------------------------------------------------------------
-- 1. plans
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  price_monthly_cents INTEGER,
  price_annual_cents INTEGER,
  entitlements JSONB NOT NULL DEFAULT '{}'::jsonb,
  limits JSONB NOT NULL DEFAULT '{}'::jsonb,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_public BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS plans_updated_at ON plans;
CREATE TRIGGER plans_updated_at BEFORE UPDATE ON plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX IF NOT EXISTS idx_plans_display_order ON plans (display_order, key);
CREATE INDEX IF NOT EXISTS idx_plans_active ON plans (is_active) WHERE is_active = true;

ALTER TABLE plans ENABLE ROW LEVEL SECURITY;

-- Super_admin: full CRUD
DROP POLICY IF EXISTS "Super admins manage plans" ON plans;
CREATE POLICY "Super admins manage plans"
  ON plans
  FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- Authenticated: read active plans only (for business UI / pricing display)
DROP POLICY IF EXISTS "Authenticated read active plans" ON plans;
CREATE POLICY "Authenticated read active plans"
  ON plans
  FOR SELECT
  USING (is_active = true);

GRANT SELECT ON plans TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON plans TO service_role;

-- ---------------------------------------------------------------------------
-- 2. Seed four plans (upsert by key so re-runs stay idempotent)
--
-- Entitlements that EXIST today (enforced in app): custom_branding,
-- custom_services, custom_domain.
-- Everything else is DEFINED FOR FUTURE USE and must not be sold as live.
-- ---------------------------------------------------------------------------
INSERT INTO plans (
  key, name, description,
  price_monthly_cents, price_annual_cents,
  entitlements, limits, display_order, is_active, is_public
) VALUES
(
  'founding',
  'Founding',
  'Early-customer pricing with the same live entitlements as Studio. Future-gated features listed below are not yet enforced.',
  1900,
  NULL,
  jsonb_build_object(
    'custom_branding', true,
    'custom_services', true,
    'custom_domain', true,
    'custom_stages', true,
    'automations', true,
    'remove_platform_branding', false,
    'white_label', false,
    'advanced_reporting', false,
    'priority_support', true
  ),
  jsonb_build_object(
    'admin_seats', 3,
    'storage_gb', 100,
    'projects_per_month', null
  ),
  10,
  true,
  true
),
(
  'solo',
  'Solo',
  'For single-operator shops. Custom domain requires Studio. Future-gated features are not yet enforced.',
  2900,
  2400,
  jsonb_build_object(
    'custom_branding', true,
    'custom_services', true,
    'custom_domain', false,
    'custom_stages', false,
    'automations', false,
    'remove_platform_branding', false,
    'white_label', false,
    'advanced_reporting', false,
    'priority_support', false
  ),
  jsonb_build_object(
    'admin_seats', 1,
    'storage_gb', 25,
    'projects_per_month', 10
  ),
  20,
  true,
  true
),
(
  'studio',
  'Studio',
  'Recommended. Full live branding, services catalog, and custom domain. Future-gated features listed below are not yet enforced.',
  5900,
  4900,
  jsonb_build_object(
    'custom_branding', true,
    'custom_services', true,
    'custom_domain', true,
    'custom_stages', true,
    'automations', true,
    'remove_platform_branding', false,
    'white_label', false,
    'advanced_reporting', true,
    'priority_support', false
  ),
  jsonb_build_object(
    'admin_seats', 3,
    'storage_gb', 100,
    'projects_per_month', null
  ),
  30,
  true,
  true
),
(
  'agency',
  'Agency',
  'Multi-seat agency tier. Live entitlements match Studio today; white-label and related flags are reserved for future enforcement.',
  9900,
  7900,
  jsonb_build_object(
    'custom_branding', true,
    'custom_services', true,
    'custom_domain', true,
    'custom_stages', true,
    'automations', true,
    'remove_platform_branding', true,
    'white_label', true,
    'advanced_reporting', true,
    'priority_support', true
  ),
  jsonb_build_object(
    'admin_seats', 10,
    'storage_gb', 500,
    'projects_per_month', null
  ),
  40,
  true,
  true
)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_monthly_cents = EXCLUDED.price_monthly_cents,
  price_annual_cents = EXCLUDED.price_annual_cents,
  entitlements = EXCLUDED.entitlements,
  limits = EXCLUDED.limits,
  display_order = EXCLUDED.display_order,
  is_active = EXCLUDED.is_active,
  is_public = EXCLUDED.is_public,
  updated_at = now();

-- ---------------------------------------------------------------------------
-- 3. businesses.plan → plans.key (FK-style). Backfill existing rows to studio.
-- ---------------------------------------------------------------------------
-- Drop prior free-text default before we reject unknown keys.
ALTER TABLE businesses ALTER COLUMN plan SET DEFAULT 'studio';

-- Backfill every existing business onto studio (they already use branding /
-- services / domains that studio grants). Report via NOTICE.
DO $$
DECLARE
  v_updated int;
BEGIN
  UPDATE businesses
  SET plan = 'studio', updated_at = now()
  WHERE plan IS DISTINCT FROM 'studio';
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RAISE NOTICE 'v45 backfill: % business(es) set to plan=studio', v_updated;
END $$;

-- Reject unknown plan keys (FK to plans.key). Drop any prior constraint first.
ALTER TABLE businesses DROP CONSTRAINT IF EXISTS businesses_plan_fkey;
ALTER TABLE businesses
  ADD CONSTRAINT businesses_plan_fkey
  FOREIGN KEY (plan) REFERENCES plans(key);

-- Extra clear rejection for direct SQL updates (FK already blocks; trigger
-- surfaces a readable message before the FK fires on empty/null).
CREATE OR REPLACE FUNCTION enforce_business_plan_key()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.plan IS NULL OR btrim(NEW.plan) = '' THEN
    RAISE EXCEPTION 'businesses.plan must be a known plans.key (got empty)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM plans WHERE key = NEW.plan) THEN
    RAISE EXCEPTION 'businesses.plan % is not a known plans.key', NEW.plan;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_businesses_plan_key ON businesses;
CREATE TRIGGER trg_businesses_plan_key
  BEFORE INSERT OR UPDATE OF plan ON businesses
  FOR EACH ROW EXECUTE FUNCTION enforce_business_plan_key();

-- ---------------------------------------------------------------------------
-- 4. Verification
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM plans WHERE key = 'studio') THEN
    RAISE EXCEPTION 'v45: studio plan missing';
  END IF;
  IF EXISTS (
    SELECT 1 FROM businesses b
    WHERE NOT EXISTS (SELECT 1 FROM plans p WHERE p.key = b.plan)
  ) THEN
    RAISE EXCEPTION 'v45: businesses.plan has unknown key(s)';
  END IF;
END $$;
