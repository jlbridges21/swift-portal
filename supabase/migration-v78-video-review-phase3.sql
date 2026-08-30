-- ShootPortal V78 — Video review phase 3: reopen attribution + activity types
-- Idempotent / re-runnable.

ALTER TABLE video_review_comments
  ADD COLUMN IF NOT EXISTS reopened_by UUID REFERENCES auth.users (id) ON DELETE SET NULL;

ALTER TABLE video_review_comments
  ADD COLUMN IF NOT EXISTS reopened_at TIMESTAMPTZ;

ALTER TYPE activity_type ADD VALUE IF NOT EXISTS 'video_review_comment_resolved';
ALTER TYPE activity_type ADD VALUE IF NOT EXISTS 'video_review_comment_reopened';
