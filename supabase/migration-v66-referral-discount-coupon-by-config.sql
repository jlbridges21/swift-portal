-- Key partner referral Stripe coupons by full discount configuration so per-partner
-- overrides can share or create distinct coupons without clobbering the program default.
-- Re-runnable: drops legacy mode×interval uniqueness (full and truncated constraint names).

ALTER TABLE partner_referral_discount_stripe_coupons
  DROP CONSTRAINT IF EXISTS partner_referral_discount_stripe_coupons_mode_billing_interval_key;

ALTER TABLE partner_referral_discount_stripe_coupons
  DROP CONSTRAINT IF EXISTS partner_referral_discount_stripe_coup_mode_billing_interval_key;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'partner_referral_discount_stripe_coupons_config_key'
  ) THEN
    ALTER TABLE partner_referral_discount_stripe_coupons
      ADD CONSTRAINT partner_referral_discount_stripe_coupons_config_key
      UNIQUE (mode, billing_interval, amount_off_cents, duration_months);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'partner_referral_discount_stripe_coupons_config_key'
  ) THEN
    ALTER TABLE partner_referral_discount_stripe_coupons
      ADD CONSTRAINT partner_referral_discount_stripe_coupons_config_key
      UNIQUE (mode, billing_interval, amount_off_cents, duration_months);
  END IF;
END $$;

COMMENT ON TABLE partner_referral_discount_stripe_coupons IS
  'PLATFORM: Stripe Coupon ids for partner referral discount, keyed by mode, billing interval, amount_off_cents, and duration_months. Multiple configs per interval are allowed (program default + partner overrides).';
