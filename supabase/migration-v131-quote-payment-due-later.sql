-- Proposal payment terms: allow "later" (no payment due when the client approves).
-- Additive: widens the existing check constraint from migration v99. Existing rows are untouched.
--   NULL    = terms never captured (legacy), fall back to the business setting
--   none    = full total due on approval
--   percent = percent deposit due on approval
--   amount  = fixed deposit due on approval
--   later   = nothing due on approval; the business sends an invoice later
-- Until this runs, the app rejects "later" with a friendly message and every other option keeps working.

ALTER TABLE project_quotes
  DROP CONSTRAINT IF EXISTS project_quotes_deposit_mode_check;

ALTER TABLE project_quotes
  ADD CONSTRAINT project_quotes_deposit_mode_check
  CHECK (deposit_mode IS NULL OR deposit_mode IN ('none', 'percent', 'amount', 'later'));

COMMENT ON COLUMN project_quotes.deposit_mode IS
  'Payment terms captured for this proposal. NULL = never captured, fall back to the business setting. none = full total due on approval. percent/amount = deposit due on approval. later = no payment due on approval.';
