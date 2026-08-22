-- Business protection flag (replaces hardcoded UUID set for hard/soft delete).
-- Stripe catalog↔Price remap outcome persisted on plans for platform UI.

ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS is_protected BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN businesses.is_protected IS
  'When true, soft-delete / hard-delete / restore from platform console are blocked. Set for owner production businesses (e.g. Swift).';

UPDATE businesses
SET is_protected = true
WHERE id = '00000000-0000-0000-0000-000000000001';

UPDATE businesses
SET is_protected = false
WHERE id = '00000000-0000-0000-0000-0000000000aa';

ALTER TABLE plans
  ADD COLUMN IF NOT EXISTS stripe_price_sync_ok BOOLEAN,
  ADD COLUMN IF NOT EXISTS stripe_price_sync_message TEXT,
  ADD COLUMN IF NOT EXISTS stripe_price_sync_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS stripe_price_sync_mode TEXT;

COMMENT ON COLUMN plans.stripe_price_sync_ok IS
  'Last catalog→Stripe Price remap result. false = billing integrity problem until remapped.';
COMMENT ON COLUMN plans.stripe_price_sync_message IS
  'Human-readable remap summary or failure detail, including Stripe Price ids.';
