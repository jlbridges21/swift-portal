-- ShootPortal V49 — Stripe Billing (platform → photography business)
--
-- Adds Stripe Product/Price ids on plans, subscription period fields on
-- businesses, and documents webhook idempotency for the dual Stripe flows.
--
-- CRITICAL SEPARATION (do not conflate):
--   A) ShootPortal bills a business: businesses.stripe_customer_id /
--      stripe_subscription_id (this migration). Platform Stripe account only.
--   B) A business bills its clients: business_integrations.stripe_account_id
--      (Connect / platform charges). Unchanged.
--
-- IDEMPOTENCY DECISION — reuse processed_stripe_events:
--   Stripe event ids (evt_…) are globally unique across event types. A Connect
--   payment event and a ShootPortal subscription event therefore cannot collide
--   on event_id. We reuse the existing table for both webhook routes.
--
--   SAME event delivered to BOTH endpoints shares one evt_ id. Handlers MUST
--   only mark an event processed when they actually handle it. Cross-flow
--   skips (subscription sessions on the payments webhook, payment sessions on
--   the billing webhook) must NOT call markStripeEventProcessed — otherwise
--   the correct endpoint would see a false duplicate.
--
-- Idempotent. HOW TO RUN: SQL Editor → paste → Run. Re-runnable.

-- ---------------------------------------------------------------------------
-- 1. plans — Stripe catalog ids (nullable = not sellable via Checkout)
-- ---------------------------------------------------------------------------
ALTER TABLE plans
  ADD COLUMN IF NOT EXISTS stripe_product_id TEXT;

ALTER TABLE plans
  ADD COLUMN IF NOT EXISTS stripe_price_monthly_id TEXT;

ALTER TABLE plans
  ADD COLUMN IF NOT EXISTS stripe_price_annual_id TEXT;

COMMENT ON COLUMN plans.stripe_product_id IS
  'Stripe Product id on the PLATFORM account for ShootPortal SaaS billing. NULL = not wired for Checkout.';

COMMENT ON COLUMN plans.stripe_price_monthly_id IS
  'Stripe Price id (monthly) on the PLATFORM account. NULL = monthly Checkout unavailable.';

COMMENT ON COLUMN plans.stripe_price_annual_id IS
  'Stripe Price id (annual) on the PLATFORM account. NULL = annual Checkout unavailable.';

CREATE UNIQUE INDEX IF NOT EXISTS plans_stripe_product_id_key
  ON plans (stripe_product_id)
  WHERE stripe_product_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS plans_stripe_price_monthly_id_key
  ON plans (stripe_price_monthly_id)
  WHERE stripe_price_monthly_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS plans_stripe_price_annual_id_key
  ON plans (stripe_price_annual_id)
  WHERE stripe_price_annual_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 2. businesses — subscription period + billing email
-- ---------------------------------------------------------------------------
ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS subscription_current_period_end TIMESTAMPTZ;

ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS subscription_cancel_at_period_end BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS billing_email TEXT;

COMMENT ON COLUMN businesses.subscription_current_period_end IS
  'End of the current ShootPortal subscription period (from Stripe). Used for cancel-at-period-end access.';

COMMENT ON COLUMN businesses.subscription_cancel_at_period_end IS
  'True when the customer canceled via Portal but retains access until subscription_current_period_end.';

COMMENT ON COLUMN businesses.billing_email IS
  'Optional billing contact email for the Stripe Customer (ShootPortal SaaS). Not Connect.';

CREATE INDEX IF NOT EXISTS idx_businesses_subscription_period_end
  ON businesses (subscription_current_period_end)
  WHERE subscription_current_period_end IS NOT NULL;
