-- Swift Portal V10: Email analytics (Resend webhooks)

CREATE TABLE IF NOT EXISTS email_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resend_email_id TEXT,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  notification_id UUID REFERENCES notifications(id) ON DELETE SET NULL,
  recipient TEXT NOT NULL,
  email_type TEXT NOT NULL,
  event_type TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_events_project_id ON email_events(project_id);
CREATE INDEX IF NOT EXISTS idx_email_events_resend_email_id ON email_events(resend_email_id);
CREATE INDEX IF NOT EXISTS idx_email_events_occurred_at ON email_events(occurred_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_events_dedupe
  ON email_events(resend_email_id, event_type)
  WHERE resend_email_id IS NOT NULL;

ALTER TABLE email_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins view email events" ON email_events;
CREATE POLICY "Admins view email events" ON email_events
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

-- Activity timeline entries for email lifecycle
ALTER TYPE activity_type ADD VALUE IF NOT EXISTS 'email_sent';
ALTER TYPE activity_type ADD VALUE IF NOT EXISTS 'email_delivered';
ALTER TYPE activity_type ADD VALUE IF NOT EXISTS 'email_opened';
ALTER TYPE activity_type ADD VALUE IF NOT EXISTS 'email_clicked';
ALTER TYPE activity_type ADD VALUE IF NOT EXISTS 'email_bounced';
ALTER TYPE activity_type ADD VALUE IF NOT EXISTS 'email_complained';
