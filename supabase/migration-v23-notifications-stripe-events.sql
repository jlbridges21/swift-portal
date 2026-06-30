-- Stripe webhook idempotency + payment notification deduplication

CREATE TABLE IF NOT EXISTS processed_stripe_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_processed_stripe_events_processed_at
  ON processed_stripe_events (processed_at DESC);

ALTER TABLE processed_stripe_events ENABLE ROW LEVEL SECURITY;

ALTER TABLE notifications ADD COLUMN IF NOT EXISTS payment_id UUID REFERENCES payments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_payment_dedup
  ON notifications (type, payment_id, user_id)
  WHERE payment_id IS NOT NULL;
