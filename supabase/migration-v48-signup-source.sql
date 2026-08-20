-- ShootPortal V48 — self-serve signup metadata
--
-- created_via distinguishes platform-console onboarding from shootportal.app
-- signup. Idempotent.
--
-- handle_new_user already stamps profiles.business_id from user_metadata
-- (v31b). Signup must create the business BEFORE the auth user so the
-- trigger can attach the profile. No change to the trigger in this file.

ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS created_via TEXT;

UPDATE businesses
SET created_via = 'platform'
WHERE created_via IS NULL;

ALTER TABLE businesses
  ALTER COLUMN created_via SET DEFAULT 'platform';

ALTER TABLE businesses
  ALTER COLUMN created_via SET NOT NULL;

ALTER TABLE businesses DROP CONSTRAINT IF EXISTS businesses_created_via_check;
ALTER TABLE businesses
  ADD CONSTRAINT businesses_created_via_check
  CHECK (created_via IN ('platform', 'signup'));

COMMENT ON COLUMN businesses.created_via IS
  'How the tenant was provisioned: platform = super_admin console; signup = self-serve /signup.';

CREATE INDEX IF NOT EXISTS idx_businesses_created_via
  ON businesses (created_via);
