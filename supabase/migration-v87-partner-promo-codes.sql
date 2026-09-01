-- V87 — Partner promo codes (third attribution path)
-- Promo codes are collected in ShootPortal UI and resolved to the same referral
-- coupon path (discounts). Never use Stripe allow_promotion_codes with discounts.
-- Idempotent / re-runnable.

-- ---------------------------------------------------------------------------
-- 1. partners.promo_code (optional, case-insensitive unique)
-- ---------------------------------------------------------------------------
ALTER TABLE partners
  ADD COLUMN IF NOT EXISTS promo_code TEXT;

COMMENT ON COLUMN partners.promo_code IS
  'Optional short checkout promo code (e.g. SWIFT5). Distinct from referral_code URL slug. NULL = links/landing only.';

CREATE UNIQUE INDEX IF NOT EXISTS idx_partners_promo_code_lower
  ON partners (lower(promo_code))
  WHERE promo_code IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 2. partner_applications.requested_promo_code (optional, chosen at apply)
-- ---------------------------------------------------------------------------
ALTER TABLE partner_applications
  ADD COLUMN IF NOT EXISTS requested_promo_code TEXT;

COMMENT ON COLUMN partner_applications.requested_promo_code IS
  'Optional promo code requested at application. Copied to partners.promo_code on approve when still unique.';

-- ---------------------------------------------------------------------------
-- 3. Expand partner_referrals.source to include promo_code
-- ---------------------------------------------------------------------------
ALTER TABLE partner_referrals DROP CONSTRAINT IF EXISTS partner_referrals_source_check;
ALTER TABLE partner_referrals
  ADD CONSTRAINT partner_referrals_source_check
  CHECK (source IN ('link', 'landing_page', 'manual', 'promo_code'));

-- Update attribute_partner_referral to accept promo_code source
CREATE OR REPLACE FUNCTION attribute_partner_referral(
  p_business_id uuid,
  p_partner_id uuid,
  p_referral_code_used text,
  p_source text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_business_id IS NULL OR p_partner_id IS NULL THEN
    RETURN false;
  END IF;
  IF p_referral_code_used IS NULL OR length(trim(p_referral_code_used)) = 0 THEN
    RETURN false;
  END IF;
  IF p_source IS NULL OR p_source NOT IN ('link', 'landing_page', 'manual', 'promo_code') THEN
    RETURN false;
  END IF;

  UPDATE businesses
  SET referred_by_partner_id = p_partner_id
  WHERE id = p_business_id
    AND referred_by_partner_id IS NULL;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  INSERT INTO partner_referrals (partner_id, business_id, referral_code_used, source)
  VALUES (p_partner_id, p_business_id, trim(p_referral_code_used), p_source);

  RETURN true;
EXCEPTION
  WHEN unique_violation THEN
    RETURN false;
END;
$$;

-- ---------------------------------------------------------------------------
-- 4. Attribution change events (append-only audit for reassignment)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS partner_referral_attribution_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses (id) ON DELETE CASCADE,
  referral_id UUID REFERENCES partner_referrals (id) ON DELETE SET NULL,
  before_partner_id UUID REFERENCES partners (id) ON DELETE SET NULL,
  after_partner_id UUID REFERENCES partners (id) ON DELETE SET NULL,
  before_source TEXT,
  after_source TEXT,
  before_code_used TEXT,
  after_code_used TEXT,
  actor_user_id UUID,
  actor_email TEXT,
  reason TEXT NOT NULL,
  outcome TEXT NOT NULL
    CHECK (outcome IN (
      'created',
      'reassigned',
      'refused_commission_accrued',
      'refused_self_referral',
      'refused_partner_inactive',
      'refused_invalid_code',
      'noop'
    )),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE partner_referral_attribution_events IS
  'Append-only audit of partner attribution creates/reassignments/refusals at checkout. Never rewrite partner_commissions.';

CREATE INDEX IF NOT EXISTS idx_partner_referral_attr_events_business
  ON partner_referral_attribution_events (business_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_partner_referral_attr_events_outcome
  ON partner_referral_attribution_events (outcome, created_at DESC);

ALTER TABLE partner_referral_attribution_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admins manage partner referral attribution events"
  ON partner_referral_attribution_events;
CREATE POLICY "Super admins manage partner referral attribution events"
  ON partner_referral_attribution_events
  FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

REVOKE ALL ON partner_referral_attribution_events FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON partner_referral_attribution_events FROM authenticated;
GRANT SELECT, INSERT ON partner_referral_attribution_events TO service_role;
GRANT SELECT ON partner_referral_attribution_events TO authenticated;
