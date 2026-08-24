-- ShootPortal V59 — Partner Program phase 2: referral attribution
--
-- Core rule: attribution is written EXACTLY ONCE at business creation and never
-- changes. partner_referrals.business_id is UNIQUE; businesses.referred_by_partner_id
-- is the denormalized join for fast reads. Keep both consistent via
-- attribute_partner_referral() (single transaction).
--
-- Classification (tenant guards):
--   partner_referrals HAS business_id NOT NULL (FK to businesses) — it is a
--   platform-operated attribution join, NOT a tenant-scoped CRM table and NOT
--   a platform catalog without business_id (unlike partners / partner_applications).
--   Same family as platform_email_sends: RLS super_admin only; service_role writes
--   at create time. Do NOT add to BUSINESS_OWNED_TABLES (queries are by partner_id
--   or via RPC). Do NOT treat as 2b "must not have business_id".
--
-- No commissions, dashboards, or landing pages in this migration.
--
-- Idempotent: DROP POLICY IF EXISTS / CREATE OR REPLACE. Re-runnable.

-- ---------------------------------------------------------------------------
-- 1. businesses.referred_by_partner_id (denormalized; partner_referrals authoritative)
-- ---------------------------------------------------------------------------
ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS referred_by_partner_id UUID
    REFERENCES partners (id) ON DELETE SET NULL;

COMMENT ON COLUMN businesses.referred_by_partner_id IS
  'Denormalized partner attribution. Written once at create; partner_referrals is authoritative.';

CREATE INDEX IF NOT EXISTS idx_businesses_referred_by_partner_id
  ON businesses (referred_by_partner_id)
  WHERE referred_by_partner_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 2. partner_referrals
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS partner_referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES partners (id) ON DELETE RESTRICT,
  business_id UUID NOT NULL UNIQUE REFERENCES businesses (id) ON DELETE CASCADE,
  referral_code_used TEXT NOT NULL,
  attributed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  source TEXT NOT NULL
    CHECK (source IN ('link', 'landing_page', 'manual')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE partner_referrals IS
  'ATTRIBUTION JOIN: one partner per business (UNIQUE business_id). Has business_id FK — not tenant CRM, not platform-catalog-without-business_id. ON DELETE RESTRICT on partner_id so partners with referrals cannot be deleted (suspend instead).';

CREATE INDEX IF NOT EXISTS idx_partner_referrals_partner_id
  ON partner_referrals (partner_id, attributed_at DESC);

CREATE INDEX IF NOT EXISTS idx_partner_referrals_attributed_at
  ON partner_referrals (attributed_at DESC);

ALTER TABLE partner_referrals ENABLE ROW LEVEL SECURITY;

-- Super_admin read/manage only. Writes normally go through service_role RPC at create.
DROP POLICY IF EXISTS "Super admins manage partner referrals" ON partner_referrals;
CREATE POLICY "Super admins manage partner referrals"
  ON partner_referrals
  FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

REVOKE ALL ON partner_referrals FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON partner_referrals FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON partner_referrals TO service_role;
GRANT SELECT ON partner_referrals TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. attribute_partner_referral — single-transaction write of both sides
-- ---------------------------------------------------------------------------
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
  IF p_source IS NULL OR p_source NOT IN ('link', 'landing_page', 'manual') THEN
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
    -- Concurrent signup race or already attributed — do not 500 the caller.
    RETURN false;
END;
$$;

COMMENT ON FUNCTION attribute_partner_referral(uuid, uuid, text, text) IS
  'Writes partner_referrals + businesses.referred_by_partner_id atomically. Returns false if already attributed or race. Service-role only.';

REVOKE ALL ON FUNCTION attribute_partner_referral(uuid, uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION attribute_partner_referral(uuid, uuid, text, text) FROM anon;
REVOKE ALL ON FUNCTION attribute_partner_referral(uuid, uuid, text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION attribute_partner_referral(uuid, uuid, text, text) TO service_role;
