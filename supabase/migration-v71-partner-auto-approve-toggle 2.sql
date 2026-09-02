-- ShootPortal V71 — Partner program auto-approve applications toggle
--
-- Super-admins can turn instant partner approval on/off from /platform/partners.
-- Default true (current product behavior). When false, applications stay pending
-- until a super-admin approves or declines.
--
-- Idempotent / re-runnable.

ALTER TABLE partner_program_settings
  ADD COLUMN IF NOT EXISTS auto_approve_applications BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN partner_program_settings.auto_approve_applications IS
  'When true, public and in-app partner applications create an active partner immediately. When false, applications stay pending for super-admin review.';
