-- Swift Portal V25: project messaging + multi-client RLS fixes

-- ---------------------------------------------------------------------------
-- 1. Project messages (admin ↔ client conversation threads)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS project_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  sender_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  sender_role TEXT NOT NULL CHECK (sender_role IN ('admin', 'client')),
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_messages_project_created
  ON project_messages (project_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_project_messages_sender
  ON project_messages (sender_user_id);

-- Per-user read receipts (supports multiple clients on one project)
CREATE TABLE IF NOT EXISTS project_message_reads (
  message_id UUID NOT NULL REFERENCES project_messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (message_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_project_message_reads_user
  ON project_message_reads (user_id);

ALTER TABLE project_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_message_reads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins full access project_messages" ON project_messages;
CREATE POLICY "Admins full access project_messages" ON project_messages
  FOR ALL USING (is_admin());

DROP POLICY IF EXISTS "Clients view project messages" ON project_messages;
CREATE POLICY "Clients view project messages" ON project_messages
  FOR SELECT USING (client_has_project_access(project_id));

DROP POLICY IF EXISTS "Clients insert project messages" ON project_messages;
CREATE POLICY "Clients insert project messages" ON project_messages
  FOR INSERT WITH CHECK (
    client_has_project_access(project_id)
    AND sender_user_id = auth.uid()
    AND sender_role = 'client'
  );

DROP POLICY IF EXISTS "Admins full access project_message_reads" ON project_message_reads;
CREATE POLICY "Admins full access project_message_reads" ON project_message_reads
  FOR ALL USING (is_admin());

DROP POLICY IF EXISTS "Users manage own message reads" ON project_message_reads;
CREATE POLICY "Users manage own message reads" ON project_message_reads
  FOR ALL USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 2. Multi-client access: payments + revisions via project access helper
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Clients view own payments" ON payments;
CREATE POLICY "Clients view own payments" ON payments
  FOR SELECT USING (
    client_id = get_user_client_id()
    OR (project_id IS NOT NULL AND client_has_project_access(project_id))
  );

DROP POLICY IF EXISTS "Clients view own revisions" ON revisions;
CREATE POLICY "Clients view own revisions" ON revisions
  FOR SELECT USING (
    client_id = get_user_client_id()
    OR (project_id IS NOT NULL AND client_has_project_access(project_id))
  );

DROP POLICY IF EXISTS "Clients create revisions" ON revisions;
CREATE POLICY "Clients create revisions" ON revisions
  FOR INSERT WITH CHECK (
    client_id = get_user_client_id()
    AND (
      project_id IS NULL
      OR client_has_project_access(project_id)
    )
  );

-- Ensure every project with a primary client_id has a junction row
INSERT INTO project_clients (project_id, client_id, is_primary)
SELECT p.id, p.client_id, true
FROM projects p
WHERE p.client_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM project_clients pc
    WHERE pc.project_id = p.id AND pc.client_id = p.client_id
  )
ON CONFLICT (project_id, client_id) DO NOTHING;
