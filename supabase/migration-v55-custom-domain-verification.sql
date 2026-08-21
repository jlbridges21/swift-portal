-- Custom domain self-serve: verification state alongside businesses.custom_domain.
-- Existing rows with custom_domain are backfilled as connected (Swift stays untouched).

ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS custom_domain_status TEXT,
  ADD COLUMN IF NOT EXISTS custom_domain_vercel_verified BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS custom_domain_misconfigured BOOLEAN,
  ADD COLUMN IF NOT EXISTS custom_domain_last_checked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS custom_domain_error TEXT,
  ADD COLUMN IF NOT EXISTS custom_domain_verification JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN businesses.custom_domain_status IS
  'null | pending | verifying | connected | error | manual — self-serve custom domain setup state';
COMMENT ON COLUMN businesses.custom_domain_verification IS
  'Cached Vercel verification challenges and DNS instructions for the UI';

UPDATE businesses
SET
  custom_domain_status = 'connected',
  custom_domain_vercel_verified = true,
  custom_domain_misconfigured = false,
  custom_domain_error = NULL
WHERE custom_domain IS NOT NULL
  AND custom_domain <> ''
  AND (custom_domain_status IS NULL OR custom_domain_status = '');

ALTER TABLE businesses
  DROP CONSTRAINT IF EXISTS businesses_custom_domain_status_check;

ALTER TABLE businesses
  ADD CONSTRAINT businesses_custom_domain_status_check
  CHECK (
    custom_domain_status IS NULL
    OR custom_domain_status IN ('pending', 'verifying', 'connected', 'error', 'manual')
  );
