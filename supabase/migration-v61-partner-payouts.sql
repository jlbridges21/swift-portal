-- ShootPortal V61 — Partner Program phase 5: manual payouts + adjustments
--
-- partner_payouts: append-only payout records (no automated/Stripe Connect payouts).
-- partner_commissions.payout_id gains FK. subscription_payment_id becomes nullable
-- so kind='adjustment' rows can exist without a payment anchor.
--
-- Classification: partner_payouts is PLATFORM-scoped (has partner_id, no business_id).
-- Same family as partners — intentional no-business_id exception. RLS: super_admin
-- manage; partners SELECT own rows. tenant-lint / SQL audit updated accordingly.
--
-- Idempotent / re-runnable.

-- ---------------------------------------------------------------------------
-- 1. Allow adjustments without a subscription payment
-- ---------------------------------------------------------------------------
ALTER TABLE partner_commissions
  ALTER COLUMN subscription_payment_id DROP NOT NULL;

ALTER TABLE partner_commissions
  DROP CONSTRAINT IF EXISTS partner_commissions_payment_required_for_non_adjustment;

ALTER TABLE partner_commissions
  ADD CONSTRAINT partner_commissions_payment_required_for_non_adjustment
  CHECK (
    kind = 'adjustment'
    OR subscription_payment_id IS NOT NULL
  );

COMMENT ON COLUMN partner_commissions.subscription_payment_id IS
  'Required for commission/reversal. NULL allowed only for kind=adjustment (manual corrections).';

ALTER TABLE partner_commissions
  DROP CONSTRAINT IF EXISTS partner_commissions_adjustment_requires_note;

ALTER TABLE partner_commissions
  ADD CONSTRAINT partner_commissions_adjustment_requires_note
  CHECK (
    kind <> 'adjustment'
    OR (
      created_by IS NOT NULL
      AND note IS NOT NULL
      AND length(trim(note)) > 0
    )
  );

-- ---------------------------------------------------------------------------
-- 2. partner_payouts
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS partner_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES partners (id) ON DELETE RESTRICT,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'usd',
  paid_at TIMESTAMPTZ NOT NULL,
  method TEXT,
  reference TEXT,
  note TEXT,
  stripe_mode TEXT NOT NULL DEFAULT 'test'
    CHECK (stripe_mode IN ('test', 'live')),
  idempotency_key TEXT,
  created_by UUID NOT NULL REFERENCES auth.users (id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT partner_payouts_idempotency_key_unique UNIQUE (idempotency_key)
);

COMMENT ON TABLE partner_payouts IS
  'PLATFORM-SCOPED: manual partner payouts (no business_id). Super_admin writes; partners read own. V1 covers all currently-payable ledger rows — no partial payouts.';

CREATE INDEX IF NOT EXISTS idx_partner_payouts_partner_paid
  ON partner_payouts (partner_id, paid_at DESC);

ALTER TABLE partner_payouts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admins manage partner payouts" ON partner_payouts;
CREATE POLICY "Super admins manage partner payouts"
  ON partner_payouts
  FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS "Partners read own payouts" ON partner_payouts;
CREATE POLICY "Partners read own payouts"
  ON partner_payouts
  FOR SELECT
  USING (
    partner_id IN (
      SELECT id FROM partners WHERE user_id IS NOT NULL AND user_id = auth.uid()
    )
  );

REVOKE ALL ON partner_payouts FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON partner_payouts FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON partner_payouts TO service_role;
GRANT SELECT ON partner_payouts TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. FK partner_commissions.payout_id → partner_payouts
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'partner_commissions_payout_id_fkey'
  ) THEN
    ALTER TABLE partner_commissions
      ADD CONSTRAINT partner_commissions_payout_id_fkey
      FOREIGN KEY (payout_id) REFERENCES partner_payouts (id) ON DELETE RESTRICT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_partner_commissions_payout_id
  ON partner_commissions (payout_id)
  WHERE payout_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 4. Atomic payout: insert payout + stamp all open payable ledger rows
-- ---------------------------------------------------------------------------
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
  p_stripe_mode text
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
BEGIN
  IF p_partner_id IS NULL OR p_created_by IS NULL THEN
    RAISE EXCEPTION 'partner_id and created_by are required';
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

  -- Lock partner row to serialize concurrent payout attempts.
  PERFORM 1 FROM partners WHERE id = p_partner_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'partner not found';
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
    stripe_mode, idempotency_key, created_by
  ) VALUES (
    p_partner_id, p_amount_cents, COALESCE(NULLIF(trim(p_currency), ''), 'usd'),
    COALESCE(p_paid_at, now()), NULLIF(trim(p_method), ''), NULLIF(trim(p_reference), ''),
    NULLIF(trim(p_note), ''), p_stripe_mode, p_idempotency_key, p_created_by
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
    -- Race on idempotency_key
    IF p_idempotency_key IS NOT NULL THEN
      SELECT id INTO v_existing FROM partner_payouts WHERE idempotency_key = p_idempotency_key;
      IF v_existing IS NOT NULL THEN
        RETURN v_existing;
      END IF;
    END IF;
    RAISE;
END;
$$;

COMMENT ON FUNCTION record_partner_payout IS
  'Atomically inserts partner_payouts and stamps payout_id on all open payable ledger rows. Idempotent via idempotency_key. Service-role only.';

REVOKE ALL ON FUNCTION record_partner_payout(uuid, integer, text, timestamptz, text, text, text, uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION record_partner_payout(uuid, integer, text, timestamptz, text, text, text, uuid, text, text) FROM anon;
REVOKE ALL ON FUNCTION record_partner_payout(uuid, integer, text, timestamptz, text, text, text, uuid, text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION record_partner_payout(uuid, integer, text, timestamptz, text, text, text, uuid, text, text) TO service_role;
