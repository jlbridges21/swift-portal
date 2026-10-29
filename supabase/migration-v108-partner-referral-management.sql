-- ShootPortal V108 — partner commission eligibility + super-admin referral removal.
--
-- Additive only. No referral, commission, payout, business or Stripe object is deleted or
-- rewritten by this migration. The app runs without it: commission eligibility reads default
-- to "eligible", the Remove Referral action reports that this migration is required, and the
-- promo/cookie paths behave exactly as before.
--
-- 1. partners.commission_eligible (+ who/when/why). Ineligible partners stay fully enrolled
--    (dashboard, links, landing page, promo code, referral discount) but can never accrue a
--    commission or receive a payout. Enforced here in the database (insert trigger + payout
--    RPC) and again in the app (commission + payout code paths).
--
-- 2. Swift Aerial Media's partner records are set ineligible, by verified id:
--      140ccbea-1c16-4b76-9412-a95ad4f5311c  code swift-aerial-media — user_id is the owner of the
--                                            legacy business 00000000-0000-0000-0000-000000000001
--      683726a2-56e6-4376-93ef-ef06adf0d0c7  code jackson — the owner's second (test) partner record
--    Every other partner keeps commission_eligible = true (the column default).
--
-- 3. partner_referral_removals — append-only archive of removed attributions (who, when, why,
--    commissions voided, Stripe discount outcome). The live partner_referrals row is deleted on
--    removal so every existing reader (commission, discount, dashboards, metrics) stops treating
--    the business as referred, with no reader changes needed.
--
-- 4. remove_partner_referral() — one transaction: lock the referral, void UNPAID commissions with
--    append-only reversal rows (paid commissions are never touched or clawed back), archive,
--    delete the attribution, clear businesses.referred_by_partner_id, log an attribution event.
--    Idempotent: a repeat call returns already_removed and changes nothing.
--
-- 5. attribute_partner_referral() refuses to re-attribute a business to a partner it was removed
--    from (signup cookie path). A different partner can still be attributed. Super-admin manual
--    attribution (source = manual) is still allowed.
--
-- Rollback: drop the trigger and partner_referral_removals; restore attribute_partner_referral /
-- record_partner_payout from V87 / V75; drop the partners.commission_* columns.

-- ── 1. Commission eligibility ────────────────────────────────────────────────

ALTER TABLE partners
  ADD COLUMN IF NOT EXISTS commission_eligible BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS commission_eligibility_note TEXT
    CHECK (commission_eligibility_note IS NULL OR char_length(commission_eligibility_note) <= 500),
  ADD COLUMN IF NOT EXISTS commission_eligibility_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS commission_eligibility_updated_by UUID
    REFERENCES auth.users (id) ON DELETE SET NULL;

COMMENT ON COLUMN partners.commission_eligible IS
  'false = partner stays enrolled (dashboard, links, discount) but accrues no commissions and receives no payouts. Enforced by trigger partner_commissions_eligibility_guard and record_partner_payout.';

-- ── 2. Swift Aerial Media (owner demo partner records) ───────────────────────

UPDATE partners
SET commission_eligible = false,
    commission_eligibility_note =
      'Owner-operated demo partner account (Swift Aerial Media). Commissions disabled so demo referrals never accrue or pay out.',
    commission_eligibility_updated_at = now()
WHERE id IN (
    '140ccbea-1c16-4b76-9412-a95ad4f5311c',
    '683726a2-56e6-4376-93ef-ef06adf0d0c7'
  )
  AND commission_eligible = true;

INSERT INTO platform_audit_log (actor_user_id, actor_email, action, target_type, target_id, metadata)
SELECT NULL, 'migration-v108', 'partner.commission_eligibility', 'partner', p.id::text,
       jsonb_build_object('commission_eligible', false, 'reason', p.commission_eligibility_note)
FROM partners p
WHERE p.id IN (
    '140ccbea-1c16-4b76-9412-a95ad4f5311c',
    '683726a2-56e6-4376-93ef-ef06adf0d0c7'
  )
  AND NOT EXISTS (
    SELECT 1 FROM platform_audit_log a
    WHERE a.action = 'partner.commission_eligibility'
      AND a.target_id = p.id::text
      AND a.actor_email = 'migration-v108'
  );

-- Backend guard: no commission row for an ineligible partner, or for a business that is not
-- (or no longer) attributed to that partner. Reversals and adjustments are unaffected.
CREATE OR REPLACE FUNCTION partner_commissions_eligibility_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.kind <> 'commission' THEN
    RETURN NEW;
  END IF;
  IF EXISTS (
    SELECT 1 FROM partners WHERE id = NEW.partner_id AND commission_eligible = false
  ) THEN
    RAISE EXCEPTION 'partner_commission_ineligible' USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.business_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM partner_referrals
    WHERE business_id = NEW.business_id AND partner_id = NEW.partner_id
  ) THEN
    RAISE EXCEPTION 'partner_commission_no_active_referral' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS partner_commissions_eligibility_guard ON partner_commissions;
CREATE TRIGGER partner_commissions_eligibility_guard
  BEFORE INSERT ON partner_commissions
  FOR EACH ROW EXECUTE FUNCTION partner_commissions_eligibility_guard();

-- ── 3. Removal archive ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS partner_referral_removals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Original partner_referrals.id (that row is deleted on removal, so no FK).
  referral_id UUID NOT NULL,
  partner_id UUID NOT NULL REFERENCES partners (id) ON DELETE RESTRICT,
  business_id UUID REFERENCES businesses (id) ON DELETE SET NULL,
  business_name TEXT,
  referral_code_used TEXT NOT NULL,
  source TEXT NOT NULL,
  attributed_at TIMESTAMPTZ NOT NULL,
  removed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  removed_by UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  removed_by_email TEXT,
  reason TEXT CHECK (reason IS NULL OR char_length(reason) <= 500),
  voided_commission_count INTEGER NOT NULL DEFAULT 0,
  voided_commission_cents INTEGER NOT NULL DEFAULT 0,
  paid_commission_cents INTEGER NOT NULL DEFAULT 0,
  -- Stripe referral-coupon cleanup (done in the app right after the transaction).
  stripe_discount_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (stripe_discount_status IN ('pending', 'none', 'removed', 'failed')),
  stripe_discount_detail TEXT,
  stripe_subscription_id TEXT,
  stripe_discount_effective_at TIMESTAMPTZ,
  stripe_discount_updated_at TIMESTAMPTZ,
  CONSTRAINT partner_referral_removals_referral_unique UNIQUE (referral_id)
);

COMMENT ON TABLE partner_referral_removals IS
  'PLATFORM LEDGER: append-only archive of partner attributions removed by a super admin. Only the stripe_discount_* columns are updated after insert.';

CREATE INDEX IF NOT EXISTS idx_partner_referral_removals_partner
  ON partner_referral_removals (partner_id, removed_at DESC);
CREATE INDEX IF NOT EXISTS idx_partner_referral_removals_business
  ON partner_referral_removals (business_id, partner_id);

ALTER TABLE partner_referral_removals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admins read partner referral removals" ON partner_referral_removals;
CREATE POLICY "Super admins read partner referral removals"
  ON partner_referral_removals
  FOR SELECT
  USING (is_super_admin());

REVOKE ALL ON partner_referral_removals FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON partner_referral_removals FROM authenticated;
GRANT SELECT ON partner_referral_removals TO authenticated;
GRANT SELECT, INSERT, UPDATE ON partner_referral_removals TO service_role;

ALTER TABLE partner_referral_attribution_events
  DROP CONSTRAINT IF EXISTS partner_referral_attribution_events_outcome_check;
ALTER TABLE partner_referral_attribution_events
  ADD CONSTRAINT partner_referral_attribution_events_outcome_check
  CHECK (outcome IN (
    'created',
    'reassigned',
    'refused_commission_accrued',
    'refused_self_referral',
    'refused_partner_inactive',
    'refused_invalid_code',
    'refused_removed_by_admin',
    'removed',
    'skipped_admin_demo',
    'noop'
  ));

-- ── 4. Remove (transactional, idempotent) ────────────────────────────────────

CREATE OR REPLACE FUNCTION remove_partner_referral(
  p_business_id uuid,
  p_partner_id uuid,
  p_actor_user_id uuid,
  p_actor_email text,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ref partner_referrals%ROWTYPE;
  v_removal_id uuid;
  v_business_name text;
  v_voided_count integer := 0;
  v_voided_cents integer := 0;
  v_paid_cents integer := 0;
  v_reversed integer;
  v_remaining integer;
  c record;
BEGIN
  IF p_business_id IS NULL OR p_partner_id IS NULL THEN
    RAISE EXCEPTION 'business_id and partner_id are required';
  END IF;

  SELECT * INTO v_ref
  FROM partner_referrals
  WHERE business_id = p_business_id
  FOR UPDATE;

  IF NOT FOUND OR v_ref.partner_id <> p_partner_id THEN
    SELECT id INTO v_removal_id
    FROM partner_referral_removals
    WHERE business_id = p_business_id AND partner_id = p_partner_id
    ORDER BY removed_at DESC
    LIMIT 1;
    RETURN jsonb_build_object(
      'status', CASE WHEN v_removal_id IS NULL THEN 'not_found' ELSE 'already_removed' END,
      'removal_id', v_removal_id
    );
  END IF;

  SELECT name INTO v_business_name FROM businesses WHERE id = p_business_id;

  -- Paid commissions stay exactly as they are (no clawback). Snapshot the total for the record.
  SELECT COALESCE(SUM(amount_cents), 0) INTO v_paid_cents
  FROM partner_commissions
  WHERE partner_id = p_partner_id
    AND business_id = p_business_id
    AND payout_id IS NOT NULL;

  -- Void what is still unpaid: append a reversal for the unreversed remainder of each
  -- unpaid commission. The commission rows themselves are never modified.
  FOR c IN
    SELECT *
    FROM partner_commissions
    WHERE partner_id = p_partner_id
      AND business_id = p_business_id
      AND kind = 'commission'
      AND payout_id IS NULL
    FOR UPDATE
  LOOP
    SELECT COALESCE(SUM(ABS(amount_cents)), 0) INTO v_reversed
    FROM partner_commissions
    WHERE reverses_commission_id = c.id AND kind = 'reversal';
    v_remaining := c.amount_cents - v_reversed;
    CONTINUE WHEN v_remaining <= 0;
    CONTINUE WHEN EXISTS (
      SELECT 1 FROM partner_commissions
      WHERE subscription_payment_id = c.subscription_payment_id
        AND kind = 'reversal'
        AND stripe_refund_id IS NULL
    );

    INSERT INTO partner_commissions (
      partner_id, business_id, subscription_payment_id, kind, commission_rate_pct,
      source_amount_cents, amount_cents, currency, stripe_mode, reverses_commission_id,
      payable_at, note, created_by, earned_at
    ) VALUES (
      c.partner_id, c.business_id, c.subscription_payment_id, 'reversal', c.commission_rate_pct,
      c.source_amount_cents, -v_remaining, c.currency, c.stripe_mode, c.id,
      NULL,
      'Voided (unpaid): referral attribution removed by super admin.'
        || COALESCE(' Reason: ' || NULLIF(trim(p_reason), ''), ''),
      p_actor_user_id, now()
    );
    v_voided_count := v_voided_count + 1;
    v_voided_cents := v_voided_cents + v_remaining;
  END LOOP;

  INSERT INTO partner_referral_removals (
    referral_id, partner_id, business_id, business_name, referral_code_used, source,
    attributed_at, removed_by, removed_by_email, reason,
    voided_commission_count, voided_commission_cents, paid_commission_cents
  ) VALUES (
    v_ref.id, v_ref.partner_id, v_ref.business_id, v_business_name, v_ref.referral_code_used,
    v_ref.source, v_ref.attributed_at, p_actor_user_id, NULLIF(trim(p_actor_email), ''),
    NULLIF(trim(p_reason), ''), v_voided_count, v_voided_cents, v_paid_cents
  )
  RETURNING id INTO v_removal_id;

  DELETE FROM partner_referrals WHERE id = v_ref.id;

  UPDATE businesses
  SET referred_by_partner_id = NULL
  WHERE id = p_business_id
    AND referred_by_partner_id = p_partner_id;

  INSERT INTO partner_referral_attribution_events (
    business_id, referral_id, before_partner_id, after_partner_id, before_source,
    before_code_used, actor_user_id, actor_email, reason, outcome, metadata
  ) VALUES (
    p_business_id, NULL, v_ref.partner_id, NULL, v_ref.source,
    v_ref.referral_code_used, p_actor_user_id, NULLIF(trim(p_actor_email), ''),
    COALESCE(NULLIF(trim(p_reason), ''), 'Referral attribution removed by super admin'),
    'removed',
    jsonb_build_object(
      'removal_id', v_removal_id,
      'referral_id', v_ref.id,
      'attributed_at', v_ref.attributed_at,
      'voided_commission_count', v_voided_count,
      'voided_commission_cents', v_voided_cents,
      'paid_commission_cents', v_paid_cents
    )
  );

  RETURN jsonb_build_object(
    'status', 'removed',
    'removal_id', v_removal_id,
    'voided_commission_count', v_voided_count,
    'voided_commission_cents', v_voided_cents,
    'paid_commission_cents', v_paid_cents
  );
END;
$$;

COMMENT ON FUNCTION remove_partner_referral(uuid, uuid, uuid, text, text) IS
  'Super-admin referral removal: voids unpaid commissions (append-only reversals), archives to partner_referral_removals, deletes the attribution. Idempotent. Service-role only.';

REVOKE ALL ON FUNCTION remove_partner_referral(uuid, uuid, uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION remove_partner_referral(uuid, uuid, uuid, text, text) FROM anon;
REVOKE ALL ON FUNCTION remove_partner_referral(uuid, uuid, uuid, text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION remove_partner_referral(uuid, uuid, uuid, text, text) TO service_role;

-- ── 5. No automatic re-attribution to a partner the business was removed from ─

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

  IF p_source <> 'manual' AND EXISTS (
    SELECT 1 FROM partner_referral_removals
    WHERE business_id = p_business_id AND partner_id = p_partner_id
  ) THEN
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

REVOKE ALL ON FUNCTION attribute_partner_referral(uuid, uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION attribute_partner_referral(uuid, uuid, text, text) FROM anon;
REVOKE ALL ON FUNCTION attribute_partner_referral(uuid, uuid, text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION attribute_partner_referral(uuid, uuid, text, text) TO service_role;

-- ── 6. Payouts: never to a commission-ineligible partner ─────────────────────
-- Same body as V75 plus the eligibility check after the partner row lock.

CREATE OR REPLACE FUNCTION record_partner_payout(
  p_partner_id uuid,
  p_amount_cents integer,
  p_currency text,
  p_paid_at timestamptz,
  p_method text,
  p_reference text,
  p_note text,
  p_created_by uuid,
  p_idempotency_key text,
  p_stripe_mode text,
  p_source text DEFAULT 'manual'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing uuid;
  v_payout_id uuid;
  v_open_net integer;
  v_stamped integer;
  v_source text;
  v_eligible boolean;
BEGIN
  v_source := COALESCE(NULLIF(trim(p_source), ''), 'manual');
  IF v_source NOT IN ('manual', 'automated') THEN
    RAISE EXCEPTION 'invalid source';
  END IF;
  IF p_partner_id IS NULL THEN
    RAISE EXCEPTION 'partner_id is required';
  END IF;
  IF v_source = 'manual' AND p_created_by IS NULL THEN
    RAISE EXCEPTION 'created_by is required for manual payouts';
  END IF;
  IF p_stripe_mode IS NULL OR p_stripe_mode NOT IN ('test', 'live') THEN
    RAISE EXCEPTION 'invalid stripe_mode';
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_existing FROM partner_payouts WHERE idempotency_key = p_idempotency_key;
    IF v_existing IS NOT NULL THEN
      RETURN v_existing;
    END IF;
  END IF;

  SELECT commission_eligible INTO v_eligible FROM partners WHERE id = p_partner_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'partner not found';
  END IF;
  IF v_eligible = false THEN
    RAISE EXCEPTION 'partner_commission_ineligible';
  END IF;

  SELECT COALESCE(SUM(amount_cents), 0) INTO v_open_net
  FROM partner_commissions
  WHERE partner_id = p_partner_id
    AND stripe_mode = p_stripe_mode
    AND payout_id IS NULL
    AND (
      (kind = 'commission' AND payable_at IS NOT NULL AND payable_at <= now())
      OR kind IN ('reversal', 'adjustment')
    );

  IF v_open_net <= 0 THEN
    RAISE EXCEPTION 'payable_balance_not_positive:%', v_open_net;
  END IF;
  IF p_amount_cents IS DISTINCT FROM v_open_net THEN
    RAISE EXCEPTION 'amount_mismatch:expected=%:got=%', v_open_net, p_amount_cents;
  END IF;

  INSERT INTO partner_payouts (
    partner_id, amount_cents, currency, paid_at, method, reference, note,
    stripe_mode, idempotency_key, created_by, source
  ) VALUES (
    p_partner_id, p_amount_cents, COALESCE(NULLIF(trim(p_currency), ''), 'usd'),
    COALESCE(p_paid_at, now()), NULLIF(trim(p_method), ''), NULLIF(trim(p_reference), ''),
    NULLIF(trim(p_note), ''), p_stripe_mode, p_idempotency_key, p_created_by, v_source
  )
  RETURNING id INTO v_payout_id;

  UPDATE partner_commissions
  SET payout_id = v_payout_id
  WHERE partner_id = p_partner_id
    AND stripe_mode = p_stripe_mode
    AND payout_id IS NULL
    AND (
      (kind = 'commission' AND payable_at IS NOT NULL AND payable_at <= now())
      OR kind IN ('reversal', 'adjustment')
    );

  GET DIAGNOSTICS v_stamped = ROW_COUNT;
  IF v_stamped < 1 THEN
    RAISE EXCEPTION 'no_ledger_rows_to_stamp';
  END IF;

  RETURN v_payout_id;
EXCEPTION
  WHEN unique_violation THEN
    IF p_idempotency_key IS NOT NULL THEN
      SELECT id INTO v_existing FROM partner_payouts WHERE idempotency_key = p_idempotency_key;
      IF v_existing IS NOT NULL THEN
        RETURN v_existing;
      END IF;
    END IF;
    RAISE;
END;
$$;

REVOKE ALL ON FUNCTION record_partner_payout(uuid, integer, text, timestamptz, text, text, text, uuid, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION record_partner_payout(uuid, integer, text, timestamptz, text, text, text, uuid, text, text, text) FROM anon;
REVOKE ALL ON FUNCTION record_partner_payout(uuid, integer, text, timestamptz, text, text, text, uuid, text, text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION record_partner_payout(uuid, integer, text, timestamptz, text, text, text, uuid, text, text, text) TO service_role;

DO $$
BEGIN
  RAISE NOTICE 'v108: partners.commission_eligible (Swift Aerial Media off), partner_referral_removals, remove_partner_referral(), re-attribution + payout guards';
END $$;
