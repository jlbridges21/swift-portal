-- ShootPortal V75 — Partner Connect Express (payouts) + partner_payouts automated actor
--
-- PHASE 1 of automated partner payouts (no transfer run yet).
--
-- THREE MONEY FLOWS — NEVER MIXED:
--   A. Platform bills businesses  → businesses.stripe_customer_id (platform account)
--   B. Businesses bill clients    → business_integrations.stripe_account_id (Standard, charges)
--   C. Platform pays partners     → partners.stripe_connect_account_id (Express, transfers)
--
-- A photographer who is also a partner has a B account AND a C account. They are
-- different Stripe accounts for different purposes and must never be interchangeable.
--
-- Also: partner_payouts.created_by becomes nullable + source ('manual'|'automated') so
-- Phase 2 automated runs have no human actor. Manual path stays fully working.
--
-- Idempotent / re-runnable. Next unused after v74.

-- ---------------------------------------------------------------------------
-- 1. partners — Connect Express for RECEIVING payouts (flow C)
-- ---------------------------------------------------------------------------
ALTER TABLE partners
  ADD COLUMN IF NOT EXISTS stripe_connect_account_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_connect_account_status TEXT
    CHECK (
      stripe_connect_account_status IS NULL
      OR stripe_connect_account_status IN (
        'not_connected', 'pending', 'action_required', 'restricted', 'ready', 'disabled'
      )
    ),
  ADD COLUMN IF NOT EXISTS stripe_connect_payouts_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stripe_connect_details_submitted BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stripe_connect_requirements_due BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stripe_connect_requirements_summary TEXT,
  ADD COLUMN IF NOT EXISTS stripe_connect_mode TEXT
    CHECK (stripe_connect_mode IS NULL OR stripe_connect_mode IN ('test', 'live')),
  ADD COLUMN IF NOT EXISTS stripe_connect_connected_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS stripe_connect_updated_at TIMESTAMPTZ;

COMMENT ON COLUMN partners.stripe_connect_account_id IS
  'FLOW C ONLY: Express Connect account for ShootPortal→partner TRANSFERS. Never use business_integrations.stripe_account_id here, and never use this id for client charges.';

CREATE UNIQUE INDEX IF NOT EXISTS idx_partners_stripe_connect_account_id
  ON partners (stripe_connect_account_id)
  WHERE stripe_connect_account_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 2. partner_payouts — support automated actor (Phase 2)
-- ---------------------------------------------------------------------------
ALTER TABLE partner_payouts
  ALTER COLUMN created_by DROP NOT NULL;

ALTER TABLE partner_payouts
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual', 'automated'));

ALTER TABLE partner_payouts
  DROP CONSTRAINT IF EXISTS partner_payouts_source_actor_check;

ALTER TABLE partner_payouts
  ADD CONSTRAINT partner_payouts_source_actor_check
  CHECK (
    (source = 'manual' AND created_by IS NOT NULL)
    OR (source = 'automated')
  );

COMMENT ON COLUMN partner_payouts.created_by IS
  'Human actor for manual payouts. NULL allowed when source=automated (Phase 2 cron / system).';
COMMENT ON COLUMN partner_payouts.source IS
  'manual = super-admin recorded; automated = Phase 2 transfer run (no human actor).';

-- ---------------------------------------------------------------------------
-- 3. record_partner_payout — accept nullable created_by + source
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS record_partner_payout(uuid, integer, text, timestamptz, text, text, text, uuid, text, text);

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

COMMENT ON FUNCTION record_partner_payout IS
  'Atomically inserts partner_payouts and stamps payout_id on open payable ledger rows. source=manual requires created_by; source=automated allows NULL actor (Phase 2).';

REVOKE ALL ON FUNCTION record_partner_payout(uuid, integer, text, timestamptz, text, text, text, uuid, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION record_partner_payout(uuid, integer, text, timestamptz, text, text, text, uuid, text, text, text) FROM anon;
REVOKE ALL ON FUNCTION record_partner_payout(uuid, integer, text, timestamptz, text, text, text, uuid, text, text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION record_partner_payout(uuid, integer, text, timestamptz, text, text, text, uuid, text, text, text) TO service_role;

DO $$
BEGIN
  RAISE NOTICE 'v75: partners.stripe_connect_* (Express transfers) + partner_payouts.source/nullable created_by';
END $$;
