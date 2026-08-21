-- ShootPortal V51 — editable free-trial length on plans
--
-- trial_days is per-plan catalog data (not a global setting). New signups read
-- the assigned plan's value at insert time and write businesses.trial_ends_at
-- once. Editing plans.trial_days never updates existing businesses.
--
-- DEFAULT 14. 0 = no trial (signup starts paywalled / trial_expired).
-- Idempotent. HOW TO RUN: SQL Editor → paste → Run. Re-runnable.

ALTER TABLE plans
  ADD COLUMN IF NOT EXISTS trial_days INTEGER;

UPDATE plans
SET trial_days = 14
WHERE trial_days IS NULL;

ALTER TABLE plans
  ALTER COLUMN trial_days SET DEFAULT 14;

ALTER TABLE plans
  ALTER COLUMN trial_days SET NOT NULL;

ALTER TABLE plans DROP CONSTRAINT IF EXISTS plans_trial_days_check;
ALTER TABLE plans
  ADD CONSTRAINT plans_trial_days_check
  CHECK (trial_days >= 0 AND trial_days <= 365);

COMMENT ON COLUMN plans.trial_days IS
  'Free-trial length in days for NEW signups on this plan. 0 = no trial (subscribe immediately). Does not change existing businesses.trial_ends_at.';
