-- ShootPortal V65 — Persist Stripe coupon sync status on partner program settings
-- (mirrors plans.stripe_price_sync_* from migration-v56).
-- Idempotent / re-runnable.

ALTER TABLE partner_program_settings
  ADD COLUMN IF NOT EXISTS stripe_coupon_sync_ok BOOLEAN,
  ADD COLUMN IF NOT EXISTS stripe_coupon_sync_message TEXT,
  ADD COLUMN IF NOT EXISTS stripe_coupon_sync_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS stripe_coupon_sync_mode TEXT;

COMMENT ON COLUMN partner_program_settings.stripe_coupon_sync_ok IS
  'Last automatic Stripe Coupon remap for the deploy mode succeeded.';
COMMENT ON COLUMN partner_program_settings.stripe_coupon_sync_message IS
  'Human-readable result of last coupon sync (success or mismatch warning).';
