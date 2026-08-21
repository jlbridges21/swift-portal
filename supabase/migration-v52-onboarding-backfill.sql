-- ShootPortal V52 — onboarding wizard backfill
--
-- Sets onboarding_completed_at for businesses that already pass required setup
-- (name, contact email, ≥1 active priced service) so they never see the wizard.
-- Always force-completes Swift + Test Pilot (protected production tenants).
--
-- Idempotent / re-runnable: only touches rows where onboarding_completed_at IS NULL.
-- HOW TO RUN: SQL Editor → paste → Run. Inspect the RETURNING list for the backfill report.

-- 1) Force-complete protected production businesses
UPDATE businesses
SET
  onboarding_completed_at = COALESCE(onboarding_completed_at, created_at, now()),
  onboarding_state = CASE
    WHEN onboarding_completed_at IS NOT NULL THEN onboarding_state
    ELSE jsonb_build_object(
      'version', 1,
      'currentStep', 'finish',
      'completedSteps', '["welcome","identity","branding","services","payments","landing","finish"]'::jsonb,
      'skippedSteps', '[]'::jsonb,
      'startedAt', COALESCE(created_at, now()),
      'lastActiveAt', now(),
      'backfilled', true,
      'backfillReason', 'protected_production'
    )
  END
WHERE id IN (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-0000000000aa'
)
  AND onboarding_completed_at IS NULL
  AND deleted_at IS NULL;

-- 2) Backfill any business whose required items already pass
WITH ready AS (
  SELECT b.id
  FROM businesses b
  INNER JOIN business_settings bs ON bs.business_id = b.id
  WHERE b.onboarding_completed_at IS NULL
    AND b.deleted_at IS NULL
    AND NULLIF(TRIM(COALESCE(bs.settings->'business'->>'businessName', '')), '') IS NOT NULL
    AND TRIM(COALESCE(bs.settings->'business'->>'businessName', '')) <> 'ShootPortal'
    AND NULLIF(TRIM(COALESCE(bs.settings->'business'->>'primaryContactEmail', '')), '') IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM business_services s
      WHERE s.business_id = b.id
        AND s.is_active IS DISTINCT FROM FALSE
        AND (
          COALESCE(s.hide_pricing, FALSE) = TRUE
          OR (
            s.preliminary_estimate_cents IS NOT NULL
            AND s.preliminary_estimate_cents > 0
          )
        )
    )
)
UPDATE businesses b
SET
  onboarding_completed_at = COALESCE(b.created_at, now()),
  onboarding_state = jsonb_build_object(
    'version', 1,
    'currentStep', 'finish',
    'completedSteps', '["welcome","identity","branding","services","payments","landing","finish"]'::jsonb,
    'skippedSteps', '[]'::jsonb,
    'startedAt', COALESCE(b.created_at, now()),
    'lastActiveAt', now(),
    'backfilled', true,
    'backfillReason', 'required_setup_already_complete'
  )
FROM ready r
WHERE b.id = r.id
RETURNING b.id, b.slug, b.name, b.onboarding_completed_at;

COMMENT ON COLUMN businesses.onboarding_completed_at IS
  'Set when required onboarding steps are done (or backfilled). NULL = wizard may still apply.';

COMMENT ON COLUMN businesses.onboarding_state IS
  'Wizard progress: { version, currentStep, completedSteps, skippedSteps, startedAt, lastActiveAt, deferred? }. Version bumps never re-prompt completed businesses.';
