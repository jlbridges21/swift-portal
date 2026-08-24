-- ShootPortal V63 — Partner referral signup discount (program + Stripe coupons)
--
-- Referred businesses may receive a time-limited subscription discount (configurable).
-- Stripe coupon ids are stored per mode × billing_interval (like plan_stripe_prices).
-- Commissions remain on revenue COLLECTED (discounted invoice → lower commission).
--
-- Idempotent / re-runnable.

-- ---------------------------------------------------------------------------
-- 1. Program defaults (singleton)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS partner_program_settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  referral_discount_enabled BOOLEAN NOT NULL DEFAULT true,
  referral_discount_amount_cents INTEGER NOT NULL DEFAULT 500
    CHECK (referral_discount_amount_cents >= 0),
  referral_discount_duration_months INTEGER NOT NULL DEFAULT 3
    CHECK (referral_discount_duration_months >= 0 AND referral_discount_duration_months <= 36),
  -- Annual: disabled by default — repeating monthly coupons do not map cleanly to annual invoices.
  referral_discount_annual_enabled BOOLEAN NOT NULL DEFAULT false,
  referral_discount_annual_amount_cents INTEGER NOT NULL DEFAULT 1500
    CHECK (referral_discount_annual_amount_cents >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE partner_program_settings IS
  'PLATFORM singleton: partner referral signup discount defaults. Amounts in cents (USD).';

INSERT INTO partner_program_settings (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

DROP TRIGGER IF EXISTS partner_program_settings_updated_at ON partner_program_settings;
CREATE TRIGGER partner_program_settings_updated_at
  BEFORE UPDATE ON partner_program_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE partner_program_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admins manage partner program settings" ON partner_program_settings;
CREATE POLICY "Super admins manage partner program settings"
  ON partner_program_settings
  FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

GRANT SELECT ON partner_program_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON partner_program_settings TO service_role;

-- ---------------------------------------------------------------------------
-- 2. Per-partner overrides (NULL = inherit program default)
-- ---------------------------------------------------------------------------
ALTER TABLE partners
  ADD COLUMN IF NOT EXISTS referral_discount_enabled BOOLEAN,
  ADD COLUMN IF NOT EXISTS referral_discount_amount_cents INTEGER
    CHECK (referral_discount_amount_cents IS NULL OR referral_discount_amount_cents >= 0),
  ADD COLUMN IF NOT EXISTS referral_discount_duration_months INTEGER
    CHECK (
      referral_discount_duration_months IS NULL
      OR (
        referral_discount_duration_months >= 0
        AND referral_discount_duration_months <= 36
      )
    );

COMMENT ON COLUMN partners.referral_discount_enabled IS
  'Override program referral_discount_enabled when non-null.';
COMMENT ON COLUMN partners.referral_discount_amount_cents IS
  'Override monthly discount amount (cents) when non-null.';
COMMENT ON COLUMN partners.referral_discount_duration_months IS
  'Override discount duration in paid billing periods when non-null.';

-- ---------------------------------------------------------------------------
-- 3. Stripe coupon ids per mode × interval
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS partner_referral_discount_stripe_coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mode TEXT NOT NULL CHECK (mode IN ('test', 'live')),
  billing_interval TEXT NOT NULL CHECK (billing_interval IN ('monthly', 'annual')),
  stripe_coupon_id TEXT NOT NULL,
  amount_off_cents INTEGER NOT NULL,
  duration_months INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (mode, billing_interval)
);

CREATE UNIQUE INDEX IF NOT EXISTS partner_referral_discount_stripe_coupons_coupon_key
  ON partner_referral_discount_stripe_coupons (stripe_coupon_id);

DROP TRIGGER IF EXISTS partner_referral_discount_stripe_coupons_updated_at
  ON partner_referral_discount_stripe_coupons;
CREATE TRIGGER partner_referral_discount_stripe_coupons_updated_at
  BEFORE UPDATE ON partner_referral_discount_stripe_coupons
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE partner_referral_discount_stripe_coupons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admins manage partner referral discount coupons"
  ON partner_referral_discount_stripe_coupons;
CREATE POLICY "Super admins manage partner referral discount coupons"
  ON partner_referral_discount_stripe_coupons
  FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

GRANT SELECT ON partner_referral_discount_stripe_coupons TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON partner_referral_discount_stripe_coupons TO service_role;

COMMENT ON TABLE partner_referral_discount_stripe_coupons IS
  'PLATFORM: Stripe Coupon ids for partner referral discount, keyed by mode and billing interval.';
