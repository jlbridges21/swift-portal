-- ShootPortal V47 — comped (complimentary) subscription access
--
-- DESIGN: subscription_status answers "do they pay"; plan answers "what can
-- they do". A comped business keeps a real plan for entitlements and simply
-- never pays. Do NOT zero out plan prices — plans are shared catalog rows.
--
-- Constraint mechanism (from v46): CHECK constraint named
--   businesses_subscription_status_check
-- CHECK constraints cannot be extended in place — DROP and recreate.
--
-- FORWARD GUARDS (billing / cron land in later prompts):
--   * Trial-expiry cron (prompt 6) MUST skip rows where
--     subscription_status = 'comped' (active or expired — do not flip status).
--   * Comped businesses must NEVER receive dunning or upgrade emails.
--   * Stripe webhooks (prompt 3) must NEVER overwrite subscription_status when
--     the current value is 'comped' — see shouldApplyStripeSubscriptionUpdate()
--     in src/lib/subscription.ts.
--
-- Idempotent. HOW TO RUN: SQL Editor → paste → Run. Re-runnable.

-- ---------------------------------------------------------------------------
-- 1. Extend subscription_status CHECK to include 'comped'
-- ---------------------------------------------------------------------------
ALTER TABLE businesses DROP CONSTRAINT IF EXISTS businesses_subscription_status_check;
ALTER TABLE businesses
  ADD CONSTRAINT businesses_subscription_status_check
  CHECK (subscription_status IN (
    'trialing',
    'active',
    'past_due',
    'canceled',
    'trial_expired',
    'comped'
  ));

-- ---------------------------------------------------------------------------
-- 2. Comp metadata columns
-- ---------------------------------------------------------------------------
ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS comped_until TIMESTAMPTZ;

ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS comped_reason TEXT;

ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS comped_by UUID REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS comped_at TIMESTAMPTZ;

COMMENT ON COLUMN businesses.comped_until IS
  'When complimentary access ends. NULL = permanent (never expires). Expiry is computed LIVE in app code — do not rely on a cron.';

COMMENT ON COLUMN businesses.comped_reason IS
  'Why this business is comped (e.g. Platform owner, Beta tester). Shown on /billing.';

COMMENT ON COLUMN businesses.comped_by IS
  'profiles.id of the super_admin who granted the comp (NULL if seeded).';

COMMENT ON COLUMN businesses.comped_at IS
  'When complimentary access was granted.';

-- Index from v46 (subscription_status, trial_ends_at) already covers equality
-- lookups on subscription_status = 'comped'. No new index required for that.
-- Optional helper for time-limited comps:
CREATE INDEX IF NOT EXISTS idx_businesses_comped_until
  ON businesses (comped_until)
  WHERE subscription_status = 'comped' AND comped_until IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 3. Swift Aerial Media — platform owner, never billable
-- ---------------------------------------------------------------------------
UPDATE businesses
SET
  subscription_status = 'comped',
  comped_until = NULL,
  comped_reason = 'Platform owner',
  comped_at = COALESCE(comped_at, now()),
  comped_by = COALESCE(
    comped_by,
    (SELECT id FROM profiles WHERE email = 'jackson@swiftaerialmedia.com' LIMIT 1)
  )
WHERE id = '00000000-0000-0000-0000-000000000001';

-- Report after apply:
--   SELECT name, subscription_status, comped_until, comped_reason
--   FROM businesses WHERE id = '00000000-0000-0000-0000-000000000001';
