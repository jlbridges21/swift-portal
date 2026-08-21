-- ShootPortal V54 — platform subscription revenue + setup checklist persistence
--
-- platform_subscription_payments: PLATFORM ledger of what businesses pay
-- ShootPortal (SaaS invoices). No tenant writes. Distinct from payments
-- (tenant→client GMV).
--
-- businesses.setup_checklist_completed_at: once every setup checklist item
-- is done, stamp this so the admin banner never returns.

CREATE TABLE IF NOT EXISTS platform_subscription_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  stripe_invoice_id TEXT NOT NULL,
  stripe_subscription_id TEXT,
  amount_paid_cents INTEGER NOT NULL CHECK (amount_paid_cents >= 0),
  currency TEXT NOT NULL DEFAULT 'usd',
  paid_at TIMESTAMPTZ NOT NULL,
  stripe_mode TEXT NOT NULL CHECK (stripe_mode IN ('test', 'live')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT platform_subscription_payments_invoice_unique UNIQUE (stripe_invoice_id)
);

CREATE INDEX IF NOT EXISTS platform_subscription_payments_business_idx
  ON platform_subscription_payments (business_id);
CREATE INDEX IF NOT EXISTS platform_subscription_payments_paid_at_idx
  ON platform_subscription_payments (paid_at DESC);

ALTER TABLE platform_subscription_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admins read platform_subscription_payments" ON platform_subscription_payments;
CREATE POLICY "Super admins read platform_subscription_payments"
  ON platform_subscription_payments FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'));

ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS setup_checklist_completed_at TIMESTAMPTZ;
