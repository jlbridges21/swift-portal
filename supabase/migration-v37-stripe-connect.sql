-- Swift Portal V37: Stripe Connect Standard — per-business connected accounts
--
-- Each non-platform business collects via DIRECT charges on its own Standard
-- account (Stripe-Account header, no application fee). Swift Aerial Media
-- stays on the PLATFORM account: business_integrations.stripe_account_id IS
-- NULL means "do not send Stripe-Account" — byte-identical to pre-Connect.
--
-- NEVER store another business's secret keys here. Connect uses account ids.
--
-- IDEMPOTENT: DROP POLICY IF EXISTS for every policy this file creates.
--
-- HOW TO RUN:
-- 1. Open Supabase Dashboard → SQL Editor → New query
-- 2. Paste this entire file and click Run
--
-- VERIFICATION:
--   business_integrations has a Swift row (…0001) with status 'active' and
--   NULL stripe_account_id. payments.stripe_account_id and
--   processed_stripe_events.business_id exist. Re-running this file is a no-op.

-- ---------------------------------------------------------------------------
-- 1. business_integrations
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS business_integrations (
  business_id UUID PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE,
  stripe_account_id TEXT UNIQUE,
  stripe_account_status TEXT NOT NULL DEFAULT 'not_connected'
    CHECK (stripe_account_status IN ('not_connected','pending','active','restricted','disabled')),
  stripe_charges_enabled BOOLEAN NOT NULL DEFAULT false,
  stripe_payouts_enabled BOOLEAN NOT NULL DEFAULT false,
  stripe_connected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS business_integrations_updated_at ON business_integrations;
CREATE TRIGGER business_integrations_updated_at
  BEFORE UPDATE ON business_integrations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ---------------------------------------------------------------------------
-- 2. payments.stripe_account_id — which Stripe account processed the charge.
--    NULL = platform account (Swift). Never rewrite historical rows.
-- ---------------------------------------------------------------------------
ALTER TABLE payments ADD COLUMN IF NOT EXISTS stripe_account_id TEXT;

-- ---------------------------------------------------------------------------
-- 3. processed_stripe_events.business_id — attribution for Connect + platform
--    events. Nullable so existing idempotency rows stay valid.
-- ---------------------------------------------------------------------------
ALTER TABLE processed_stripe_events
  ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES businesses(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_processed_stripe_events_business_id
  ON processed_stripe_events (business_id);

-- ---------------------------------------------------------------------------
-- 4. Seed Swift: platform account, no Stripe-Account header
-- ---------------------------------------------------------------------------
INSERT INTO business_integrations (
  business_id,
  stripe_account_id,
  stripe_account_status,
  stripe_charges_enabled,
  stripe_payouts_enabled
)
VALUES (
  '00000000-0000-0000-0000-000000000001'::uuid,
  NULL,
  'active',
  true,
  true
)
ON CONFLICT (business_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 5. RLS — v32 admin style, no client access
-- ---------------------------------------------------------------------------
ALTER TABLE business_integrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins full access business_integrations" ON business_integrations;
CREATE POLICY "Admins full access business_integrations" ON business_integrations
  FOR ALL
  USING (is_super_admin() OR (is_admin() AND business_id = current_business_id()))
  WITH CHECK (is_super_admin() OR (is_admin() AND business_id = current_business_id()));

GRANT SELECT, INSERT, UPDATE, DELETE ON business_integrations TO authenticated;
GRANT ALL ON business_integrations TO service_role;

-- processed_stripe_events stays RLS-on with no policies (service role only).
-- Do not add authenticated policies.

-- ---------------------------------------------------------------------------
-- 6. Copy check
-- ---------------------------------------------------------------------------
SELECT
  business_id,
  stripe_account_id,
  stripe_account_status,
  stripe_charges_enabled,
  stripe_payouts_enabled
FROM business_integrations
WHERE business_id = '00000000-0000-0000-0000-000000000001';
