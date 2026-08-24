-- ShootPortal V60 — Partner Program phase 3: commission ledger
--
-- APPEND-ONLY: never UPDATE amount/rate/kind rows; reversals are new negative rows.
-- RATE SNAPSHOT: commission_rate_pct copied at insert; partner rate changes never
-- rewrite history. HOLD: payable_at = earned_at + 30 days (payability computed at
-- read time — no cron status flip).
--
-- Classification (tenant guards):
--   partner_commissions is a PLATFORM financial ledger. It HAS nullable business_id
--   (ON DELETE SET NULL so history survives tenant hard-delete) and FK to
--   platform_subscription_payments. Same family as platform_subscription_payments /
--   platform_email_sends — NOT tenant CRM, NOT in BUSINESS_OWNED_TABLES.
--   Nullable business_id is an intentional audit exception (like profiles).
--   partners / partner_applications remain without business_id.
--
-- Idempotency (DB-level):
--   UNIQUE (subscription_payment_id) WHERE kind = 'commission'
--   UNIQUE (stripe_refund_id) WHERE kind = 'reversal' AND stripe_refund_id IS NOT NULL
--   Void reversals (no refund id): UNIQUE (subscription_payment_id)
--     WHERE kind = 'reversal' AND stripe_refund_id IS NULL
--
-- No dashboards, payouts UI, or landing pages in this migration.
-- Idempotent / re-runnable.

-- ---------------------------------------------------------------------------
-- 1. partner_commissions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS partner_commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES partners (id) ON DELETE RESTRICT,
  -- Nullable: history survives a deleted business (ON DELETE SET NULL).
  business_id UUID REFERENCES businesses (id) ON DELETE SET NULL,
  subscription_payment_id UUID NOT NULL
    REFERENCES platform_subscription_payments (id) ON DELETE RESTRICT,
  kind TEXT NOT NULL
    CHECK (kind IN ('commission', 'reversal', 'adjustment')),
  commission_rate_pct NUMERIC(5, 2) NOT NULL
    CHECK (commission_rate_pct >= 0 AND commission_rate_pct <= 100),
  source_amount_cents INTEGER NOT NULL,
  -- Signed: positive commissions / adjustments; negative reversals.
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'usd',
  stripe_mode TEXT NOT NULL CHECK (stripe_mode IN ('test', 'live')),
  reverses_commission_id UUID REFERENCES partner_commissions (id) ON DELETE RESTRICT,
  stripe_event_id TEXT,
  -- Refund reversals: Stripe refund id (re_…). Partial unique index below.
  stripe_refund_id TEXT,
  payable_at TIMESTAMPTZ,
  payout_id UUID, -- phase 5
  note TEXT,
  created_by UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  earned_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT partner_commissions_reversal_requires_parent CHECK (
    (kind = 'reversal' AND reverses_commission_id IS NOT NULL)
    OR (kind <> 'reversal')
  ),
  CONSTRAINT partner_commissions_commission_positive CHECK (
    kind <> 'commission' OR amount_cents >= 0
  ),
  CONSTRAINT partner_commissions_reversal_negative CHECK (
    kind <> 'reversal' OR amount_cents <= 0
  )
);

COMMENT ON TABLE partner_commissions IS
  'PLATFORM LEDGER: append-only partner commissions. Nullable business_id (SET NULL). UNIQUE commission per subscription_payment; UNIQUE reversal per stripe_refund_id. Not tenant CRM.';

COMMENT ON COLUMN partner_commissions.commission_rate_pct IS
  'SNAPSHOT of partners.commission_rate_pct at row creation. Never rewrite when the partner rate changes.';

COMMENT ON COLUMN partner_commissions.payable_at IS
  'earned_at + 30 days hold. Payability is computed at read time from this timestamp — never a cron-flipped status.';

COMMENT ON COLUMN partner_commissions.stripe_refund_id IS
  'For kind=reversal from charge.refunded: Stripe refund id. Partial unique index prevents double-reverse on webhook retry. Void reversals leave this NULL and use the void unique index.';

CREATE INDEX IF NOT EXISTS idx_partner_commissions_partner_earned
  ON partner_commissions (partner_id, earned_at DESC);

CREATE INDEX IF NOT EXISTS idx_partner_commissions_business
  ON partner_commissions (business_id)
  WHERE business_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_partner_commissions_payment
  ON partner_commissions (subscription_payment_id);

CREATE INDEX IF NOT EXISTS idx_partner_commissions_payable
  ON partner_commissions (partner_id, payable_at)
  WHERE payout_id IS NULL AND kind = 'commission';

-- One earning row per collected payment (webhook retries / upsert races).
CREATE UNIQUE INDEX IF NOT EXISTS partner_commissions_one_commission_per_payment
  ON partner_commissions (subscription_payment_id)
  WHERE kind = 'commission';

-- One reversal per Stripe refund id (retried charge.refunded cannot double-reverse).
CREATE UNIQUE INDEX IF NOT EXISTS partner_commissions_one_reversal_per_refund
  ON partner_commissions (stripe_refund_id)
  WHERE kind = 'reversal' AND stripe_refund_id IS NOT NULL;

-- At most one void-style reversal (no refund id) per payment.
CREATE UNIQUE INDEX IF NOT EXISTS partner_commissions_one_void_reversal_per_payment
  ON partner_commissions (subscription_payment_id)
  WHERE kind = 'reversal' AND stripe_refund_id IS NULL;

ALTER TABLE partner_commissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admins manage partner commissions" ON partner_commissions;
CREATE POLICY "Super admins manage partner commissions"
  ON partner_commissions
  FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS "Partners read own commissions" ON partner_commissions;
CREATE POLICY "Partners read own commissions"
  ON partner_commissions
  FOR SELECT
  USING (
    partner_id IN (
      SELECT id FROM partners WHERE user_id IS NOT NULL AND user_id = auth.uid()
    )
  );

REVOKE ALL ON partner_commissions FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON partner_commissions FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON partner_commissions TO service_role;
GRANT SELECT ON partner_commissions TO authenticated;
