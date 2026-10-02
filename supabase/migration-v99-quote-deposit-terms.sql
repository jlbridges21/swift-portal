-- Deposit terms captured on the official proposal.
-- NULL deposit_mode means terms were never captured (existing quotes). Approval
-- falls back to the business setting. 'none' means this proposal charges the full total.
-- Do not backfill.

ALTER TABLE project_quotes
  ADD COLUMN IF NOT EXISTS deposit_mode text,
  ADD COLUMN IF NOT EXISTS deposit_percent integer,
  ADD COLUMN IF NOT EXISTS deposit_amount_cents integer;

ALTER TABLE project_quotes
  DROP CONSTRAINT IF EXISTS project_quotes_deposit_mode_check;

ALTER TABLE project_quotes
  ADD CONSTRAINT project_quotes_deposit_mode_check
  CHECK (deposit_mode IS NULL OR deposit_mode IN ('none', 'percent', 'amount'));

COMMENT ON COLUMN project_quotes.deposit_mode IS
  'Deposit terms captured for this proposal. NULL = never captured, fall back to the business setting. none = charge the full total. Not the same as NULL.';
COMMENT ON COLUMN project_quotes.deposit_percent IS
  'Percent deposit (1–99) when deposit_mode is percent. Ignored otherwise.';
COMMENT ON COLUMN project_quotes.deposit_amount_cents IS
  'Fixed deposit in cents when deposit_mode is amount. Ignored otherwise.';
