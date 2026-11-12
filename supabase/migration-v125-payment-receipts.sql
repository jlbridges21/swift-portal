-- V125 — Permanent ShootPortal payment receipts
--
-- Why: View Receipt used to redirect to the Stripe-hosted receipt_url stored on payments.
-- Stripe expires those links, so old receipts showed "Receipt URL Expired". Receipts are now
-- rendered inside ShootPortal from the payment row + a live Stripe lookup.
--
-- This table keeps a frozen copy of what a receipt showed the first time it was built
-- (business name/address, project name, client name) and the last Stripe-verified details
-- (amount charged, currency, card brand + last 4, refunds). Later edits to the project or
-- business settings do not rewrite an old receipt, and a receipt still renders if the
-- business's Stripe account is later disconnected.
--
-- Additive and server-only. payments, Stripe checkout, webhooks, payment status, refunds,
-- download permissions and Marketing Kit entitlements are unchanged. The app works without
-- this table (receipts are then rebuilt on every view and nothing is frozen).
--
-- Never stores full card numbers or credentials: only brand, last 4 and bank name.

CREATE TABLE IF NOT EXISTS payment_receipts (
  payment_id UUID PRIMARY KEY REFERENCES payments(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  stripe_verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_receipts_business ON payment_receipts (business_id);

DROP TRIGGER IF EXISTS trg_payment_receipts_payment_same_business ON payment_receipts;
CREATE TRIGGER trg_payment_receipts_payment_same_business
  BEFORE INSERT OR UPDATE ON payment_receipts
  FOR EACH ROW
  EXECUTE FUNCTION enforce_same_business('payments', 'payment_id');

ALTER TABLE payment_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON payment_receipts FROM PUBLIC, anon, authenticated;
GRANT ALL ON payment_receipts TO service_role;

COMMENT ON TABLE payment_receipts IS
  'Frozen receipt details per paid payment (first-view business/project/client, last Stripe-verified charge). Server-only.';
