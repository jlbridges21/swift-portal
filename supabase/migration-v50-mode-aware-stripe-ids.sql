-- ShootPortal V50 — mode-aware Stripe billing catalog + customer ids
--
-- One Supabase DB serves both Stripe TEST and LIVE. Stripe object ids are
-- mode-specific, so a single plans.stripe_price_* column cannot work.
--
-- Choice: plan_stripe_prices keyed by (plan_id, mode, interval) — avoids six
-- near-duplicate columns and extends to new intervals without a migration.
--
-- Existing plans.stripe_* values were created with TEST keys → migrate into
-- mode='test' rows. Legacy columns on plans are KEPT (not dropped) until the
-- new path is verified in production.
--
-- businesses also get mode-specific customer/subscription columns. Legacy
-- stripe_customer_id / stripe_subscription_id are kept and synced to the
-- active mode at write time for webhook lookups.
--
-- Idempotent. HOW TO RUN: SQL Editor → paste → Run. Re-runnable.

-- ---------------------------------------------------------------------------
-- 1. plan_stripe_prices
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS plan_stripe_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  mode TEXT NOT NULL CHECK (mode IN ('test', 'live')),
  billing_interval TEXT NOT NULL CHECK (billing_interval IN ('monthly', 'annual')),
  stripe_product_id TEXT NOT NULL,
  stripe_price_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (plan_id, mode, billing_interval)
);

CREATE UNIQUE INDEX IF NOT EXISTS plan_stripe_prices_price_id_key
  ON plan_stripe_prices (stripe_price_id);

CREATE INDEX IF NOT EXISTS idx_plan_stripe_prices_plan_mode
  ON plan_stripe_prices (plan_id, mode);

DROP TRIGGER IF EXISTS plan_stripe_prices_updated_at ON plan_stripe_prices;
CREATE TRIGGER plan_stripe_prices_updated_at BEFORE UPDATE ON plan_stripe_prices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE plan_stripe_prices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admins manage plan_stripe_prices" ON plan_stripe_prices;
CREATE POLICY "Super admins manage plan_stripe_prices"
  ON plan_stripe_prices
  FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS "Authenticated read plan_stripe_prices" ON plan_stripe_prices;
CREATE POLICY "Authenticated read plan_stripe_prices"
  ON plan_stripe_prices
  FOR SELECT
  USING (true);

GRANT SELECT ON plan_stripe_prices TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON plan_stripe_prices TO service_role;

COMMENT ON TABLE plan_stripe_prices IS
  'PLATFORM catalog: Stripe Product/Price ids per plan × Stripe mode (test|live) × interval. Not tenant-scoped.';

-- ---------------------------------------------------------------------------
-- 2. Migrate legacy plans.stripe_* → test slots (created with test keys)
-- ---------------------------------------------------------------------------
INSERT INTO plan_stripe_prices (plan_id, mode, billing_interval, stripe_product_id, stripe_price_id)
SELECT p.id, 'test', 'monthly', p.stripe_product_id, p.stripe_price_monthly_id
FROM plans p
WHERE p.stripe_product_id IS NOT NULL
  AND p.stripe_price_monthly_id IS NOT NULL
ON CONFLICT (plan_id, mode, billing_interval) DO UPDATE SET
  stripe_product_id = EXCLUDED.stripe_product_id,
  stripe_price_id = EXCLUDED.stripe_price_id,
  updated_at = now();

INSERT INTO plan_stripe_prices (plan_id, mode, billing_interval, stripe_product_id, stripe_price_id)
SELECT p.id, 'test', 'annual', p.stripe_product_id, p.stripe_price_annual_id
FROM plans p
WHERE p.stripe_product_id IS NOT NULL
  AND p.stripe_price_annual_id IS NOT NULL
ON CONFLICT (plan_id, mode, billing_interval) DO UPDATE SET
  stripe_product_id = EXCLUDED.stripe_product_id,
  stripe_price_id = EXCLUDED.stripe_price_id,
  updated_at = now();

-- Legacy columns KEPT intentionally (see header). Do not DROP here.

-- ---------------------------------------------------------------------------
-- 3. businesses — mode-specific customer / subscription ids
-- ---------------------------------------------------------------------------
ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS stripe_customer_id_test TEXT;

ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS stripe_customer_id_live TEXT;

ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS stripe_subscription_id_test TEXT;

ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS stripe_subscription_id_live TEXT;

COMMENT ON COLUMN businesses.stripe_customer_id_test IS
  'ShootPortal SaaS Stripe Customer id in TEST mode. Legacy stripe_customer_id may mirror the active mode.';

COMMENT ON COLUMN businesses.stripe_customer_id_live IS
  'ShootPortal SaaS Stripe Customer id in LIVE mode.';

COMMENT ON COLUMN businesses.stripe_subscription_id_test IS
  'ShootPortal SaaS Stripe Subscription id in TEST mode.';

COMMENT ON COLUMN businesses.stripe_subscription_id_live IS
  'ShootPortal SaaS Stripe Subscription id in LIVE mode.';

CREATE UNIQUE INDEX IF NOT EXISTS businesses_stripe_customer_id_test_key
  ON businesses (stripe_customer_id_test)
  WHERE stripe_customer_id_test IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS businesses_stripe_customer_id_live_key
  ON businesses (stripe_customer_id_live)
  WHERE stripe_customer_id_live IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS businesses_stripe_subscription_id_test_key
  ON businesses (stripe_subscription_id_test)
  WHERE stripe_subscription_id_test IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS businesses_stripe_subscription_id_live_key
  ON businesses (stripe_subscription_id_live)
  WHERE stripe_subscription_id_live IS NOT NULL;
