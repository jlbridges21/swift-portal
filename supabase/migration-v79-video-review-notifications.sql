-- ShootPortal V79 — Video review notification batching (phase 4)
-- Idempotent / re-runnable.

CREATE TABLE IF NOT EXISTS video_review_notification_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses (id) ON DELETE CASCADE,
  review_id UUID NOT NULL REFERENCES video_reviews (id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
  version_id UUID REFERENCES video_review_versions (id) ON DELETE SET NULL,
  comment_id UUID REFERENCES video_review_comments (id) ON DELETE SET NULL,
  event_key TEXT NOT NULL,
  recipient_kind TEXT NOT NULL CHECK (recipient_kind IN ('admin', 'client')),
  recipient_user_id UUID REFERENCES auth.users (id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'push')),
  event_count INTEGER NOT NULL DEFAULT 1 CHECK (event_count >= 1),
  review_title TEXT NOT NULL,
  project_name TEXT,
  actor_user_id UUID NOT NULL,
  flush_after TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vr_notification_batches_flush
  ON video_review_notification_batches (business_id, flush_after)
  WHERE sent_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_vr_notification_batches_pending_unique
  ON video_review_notification_batches (
    business_id,
    review_id,
    event_key,
    recipient_kind,
    channel,
    COALESCE(recipient_user_id, '00000000-0000-0000-0000-000000000000'::uuid)
  )
  WHERE sent_at IS NULL;

CREATE TABLE IF NOT EXISTS video_review_notification_sends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses (id) ON DELETE CASCADE,
  batch_id UUID REFERENCES video_review_notification_batches (id) ON DELETE SET NULL,
  idempotency_key TEXT NOT NULL,
  channel TEXT NOT NULL,
  recipient_kind TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT video_review_notification_sends_idempotency_unique UNIQUE (idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_vr_notification_sends_business
  ON video_review_notification_sends (business_id);

DROP TRIGGER IF EXISTS video_review_notification_batches_updated_at ON video_review_notification_batches;
CREATE TRIGGER video_review_notification_batches_updated_at
  BEFORE UPDATE ON video_review_notification_batches
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE video_review_notification_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_review_notification_sends ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins full access video_review_notification_batches" ON video_review_notification_batches;
CREATE POLICY "Admins full access video_review_notification_batches" ON video_review_notification_batches
  FOR ALL
  USING (is_super_admin() OR (is_admin() AND business_id = current_business_id()))
  WITH CHECK (is_super_admin() OR (is_admin() AND business_id = current_business_id()));

DROP POLICY IF EXISTS "Admins full access video_review_notification_sends" ON video_review_notification_sends;
CREATE POLICY "Admins full access video_review_notification_sends" ON video_review_notification_sends
  FOR ALL
  USING (is_super_admin() OR (is_admin() AND business_id = current_business_id()))
  WITH CHECK (is_super_admin() OR (is_admin() AND business_id = current_business_id()));
