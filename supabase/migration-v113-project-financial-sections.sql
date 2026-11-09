-- V113 — Per-project client visibility for Estimates & Proposals and Payments
-- Same model as V88 (client_section_photos, ...): when false, clients do not see
-- the section or its contents in the client portal. Admins always see both.
-- Visibility only: quotes, proposals, payments, payment links and Stripe are unchanged.
-- Defaults ON for existing and new rows (matches current behavior).
-- Business defaults for NEW projects live in business_settings JSON (app code).

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS client_section_estimates BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS client_section_payments BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN projects.client_section_estimates IS
  'When false, clients do not see Estimates & Proposals in the client portal.';
COMMENT ON COLUMN projects.client_section_payments IS
  'When false, clients do not see Payments in the client portal.';
