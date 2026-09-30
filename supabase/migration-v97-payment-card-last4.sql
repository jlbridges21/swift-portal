-- Last four of the card, captured with the Stripe receipt. Null when Stripe does not expose it.
ALTER TABLE payments ADD COLUMN IF NOT EXISTS card_last4 TEXT;

COMMENT ON COLUMN payments.card_last4 IS
  'Card last four from the Stripe charge, when the charge exposes one. Not a full card number.';
