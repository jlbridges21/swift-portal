-- Swift Portal V4: Activity timeline, notifications, scheduling polish
-- Run after migration-v3.sql

-- Project status: shoot rescheduled
ALTER TYPE project_status ADD VALUE IF NOT EXISTS 'shoot_rescheduled';

-- Extended activity types for project timeline
ALTER TYPE activity_type ADD VALUE IF NOT EXISTS 'proposal_submitted';
ALTER TYPE activity_type ADD VALUE IF NOT EXISTS 'account_created';
ALTER TYPE activity_type ADD VALUE IF NOT EXISTS 'shoot_proposed';
ALTER TYPE activity_type ADD VALUE IF NOT EXISTS 'shoot_confirmed';
ALTER TYPE activity_type ADD VALUE IF NOT EXISTS 'shoot_rescheduled';
ALTER TYPE activity_type ADD VALUE IF NOT EXISTS 'shoot_completed';
ALTER TYPE activity_type ADD VALUE IF NOT EXISTS 'photos_uploaded';
ALTER TYPE activity_type ADD VALUE IF NOT EXISTS 'videos_uploaded';
ALTER TYPE activity_type ADD VALUE IF NOT EXISTS 'tour_added';
ALTER TYPE activity_type ADD VALUE IF NOT EXISTS 'documents_uploaded';
ALTER TYPE activity_type ADD VALUE IF NOT EXISTS 'invoice_sent';
ALTER TYPE activity_type ADD VALUE IF NOT EXISTS 'payment_received';
ALTER TYPE activity_type ADD VALUE IF NOT EXISTS 'revision_completed';
ALTER TYPE activity_type ADD VALUE IF NOT EXISTS 'deliverables_approved';

-- Shoot proposal superseded status for rescheduling
ALTER TYPE shoot_proposal_status ADD VALUE IF NOT EXISTS 'superseded';

-- Payment receipt URL from Stripe
ALTER TABLE payments ADD COLUMN IF NOT EXISTS stripe_receipt_url TEXT;

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id) WHERE read_at IS NULL;

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own notifications" ON notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users update own notifications" ON notifications
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Service can insert notifications" ON notifications
  FOR INSERT WITH CHECK (true);

-- Activity logs: clients with junction access can view
DROP POLICY IF EXISTS "Clients view own activity" ON activity_logs;
CREATE POLICY "Clients view own activity" ON activity_logs
  FOR SELECT USING (
    project_id IS NOT NULL AND client_has_project_access(project_id)
  );
