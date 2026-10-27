-- Swift Portal V106 — bank (ACH) payments and optional card-fee pass-through
--
-- Clients can pay a payment request by US bank account (Stripe ACH Direct Debit) on the
-- business's own connected Stripe account, alongside cards. ACH settles in a few business
-- days, so a payment can now be 'processing': the client has authorized the debit and
-- Stripe is collecting it. Processing payments count toward the quote balance and unlock
-- delivery; they become 'paid' when Stripe confirms the funds, or return to 'pending'
-- (payable again) if the bank rejects the debit.
--
-- Safe to run before deploying the app: additive only. Existing rows keep their status;
-- new columns are nullable or default to "nothing happened".
--
-- HOW TO RUN:
-- 1. Open Supabase Dashboard → SQL Editor → New query
-- 2. Paste this entire file and click Run
--
-- VERIFICATION:
--   SELECT unnest(enum_range(NULL::payment_status));  -- includes 'processing'
--   payments has payment_method_type, processing_started_at, client_fee_cents.
--   business_integrations has stripe_ach_enabled. Re-running this file is a no-op.

-- 1. New payment status. (ADD VALUE cannot run inside a transaction block together with
--    statements that use the new value; nothing below uses it.)
ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'processing';

-- 2. How the client paid, when the debit started, and any card fee the client paid on top.
ALTER TABLE payments ADD COLUMN IF NOT EXISTS payment_method_type TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS processing_started_at TIMESTAMPTZ;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS client_fee_cents INTEGER NOT NULL DEFAULT 0;

ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_payment_method_type_check;
ALTER TABLE payments
  ADD CONSTRAINT payments_payment_method_type_check
  CHECK (payment_method_type IS NULL OR payment_method_type IN ('card', 'us_bank_account', 'manual', 'other'));

ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_client_fee_cents_check;
ALTER TABLE payments ADD CONSTRAINT payments_client_fee_cents_check CHECK (client_fee_cents >= 0);

COMMENT ON COLUMN payments.payment_method_type IS
  'How the client paid: card, us_bank_account (ACH), manual (marked paid by the business), or other.';
COMMENT ON COLUMN payments.processing_started_at IS
  'When a delayed-settlement payment (ACH) was authorized and began processing.';
COMMENT ON COLUMN payments.client_fee_cents IS
  'Card processing fee the client paid on top of amount (business setting). amount is never changed by it.';

-- 3. Whether the business's Stripe account can accept ACH Direct Debit. Mirrored from
--    the account's us_bank_account_ach_payments capability on every status refresh and
--    account.updated webhook.
ALTER TABLE business_integrations ADD COLUMN IF NOT EXISTS stripe_ach_enabled BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN business_integrations.stripe_ach_enabled IS
  'Stripe account capability us_bank_account_ach_payments is active (bank payments can be offered).';
