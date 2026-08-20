-- ShootPortal V46 — subscription status on businesses (no Stripe wiring yet)
--
-- Adds trial / subscription lifecycle columns so middleware can paywall expired
-- trials. Status is set manually (platform console or SQL) until billing ships.
--
-- CRITICAL: stripe_customer_id / stripe_subscription_id are ShootPortal → business
-- billing identifiers. They are NOT business_integrations.stripe_account_id (Connect
-- account the business uses to charge its own clients). Do not conflate them.
--
-- Idempotent. HOW TO RUN: SQL Editor → paste → Run. Re-runnable.

-- ---------------------------------------------------------------------------
-- 1. Columns
-- ---------------------------------------------------------------------------
ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;

ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS subscription_status TEXT;

ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;

ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;

ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS onboarding_state JSONB;

-- Comments: billing vs Connect (do not confuse)
COMMENT ON COLUMN businesses.stripe_customer_id IS
  'ShootPortal billing: Stripe Customer for THIS business''s ShootPortal subscription. NOT business_integrations.stripe_account_id (Connect — how the business charges its clients).';

COMMENT ON COLUMN businesses.stripe_subscription_id IS
  'ShootPortal billing: Stripe Subscription for THIS business''s ShootPortal plan. NOT business_integrations.stripe_account_id (Connect — how the business charges its clients).';

COMMENT ON COLUMN businesses.subscription_status IS
  'ShootPortal subscription lifecycle: trialing|active|past_due|canceled|trial_expired. Gate access from trial_ends_at live — do not rely on a cron flip.';

COMMENT ON COLUMN businesses.trial_ends_at IS
  'When a trialing business loses full access. Middleware computes expiry live from this timestamp.';

COMMENT ON COLUMN businesses.onboarding_completed_at IS
  'Set when the business finishes the onboarding wizard (future). NULL until then.';

COMMENT ON COLUMN businesses.onboarding_state IS
  'Wizard progress JSON for onboarding (future). Empty object until used.';

-- Defaults / NOT NULL for new and existing rows
UPDATE businesses
SET subscription_status = 'active'
WHERE subscription_status IS NULL;

UPDATE businesses
SET onboarding_state = '{}'::jsonb
WHERE onboarding_state IS NULL;

ALTER TABLE businesses
  ALTER COLUMN subscription_status SET DEFAULT 'active';

ALTER TABLE businesses
  ALTER COLUMN subscription_status SET NOT NULL;

ALTER TABLE businesses
  ALTER COLUMN onboarding_state SET DEFAULT '{}'::jsonb;

ALTER TABLE businesses
  ALTER COLUMN onboarding_state SET NOT NULL;

-- CHECK constraint (idempotent drop/add)
ALTER TABLE businesses DROP CONSTRAINT IF EXISTS businesses_subscription_status_check;
ALTER TABLE businesses
  ADD CONSTRAINT businesses_subscription_status_check
  CHECK (subscription_status IN ('trialing', 'active', 'past_due', 'canceled', 'trial_expired'));

-- Unique Stripe ids (multiple NULLs allowed)
CREATE UNIQUE INDEX IF NOT EXISTS businesses_stripe_customer_id_key
  ON businesses (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS businesses_stripe_subscription_id_key
  ON businesses (stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_businesses_subscription_status_trial
  ON businesses (subscription_status, trial_ends_at);

-- ---------------------------------------------------------------------------
-- 2. CRITICAL BACKFILL — live tenants must stay fully accessible
--
-- ADD COLUMN … DEFAULT 'active' already fills existing rows. Explicit UPDATE
-- catches any NULL left by a partial prior run. Re-runs do NOT reset intentional
-- platform/SQL test statuses (trialing, past_due, etc.) — only NULL → active.
-- At first apply, every existing business becomes active with NULL trial_ends_at.
-- ---------------------------------------------------------------------------
UPDATE businesses
SET subscription_status = 'active'
WHERE subscription_status IS NULL;

UPDATE businesses
SET onboarding_state = '{}'::jsonb
WHERE onboarding_state IS NULL;

-- First-apply safety: active rows must not carry a leftover trial clock.
-- (Does not touch non-active statuses set later for testing.)
UPDATE businesses
SET trial_ends_at = NULL
WHERE subscription_status = 'active'
  AND trial_ends_at IS NOT NULL
  AND stripe_customer_id IS NULL
  AND stripe_subscription_id IS NULL;

-- Report after apply:
--   SELECT subscription_status, (trial_ends_at IS NULL) AS trial_null, count(*)
--   FROM businesses GROUP BY 1, 2;
