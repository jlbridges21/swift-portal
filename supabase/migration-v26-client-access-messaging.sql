-- Swift Portal V26: fix multi-client portal access + per-client messaging

-- ---------------------------------------------------------------------------
-- 1. get_user_client_id: fall back to clients.user_id when profile.client_id is null
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_user_client_id()
RETURNS UUID AS $$
DECLARE
  cid UUID;
BEGIN
  SELECT client_id INTO cid
  FROM profiles
  WHERE id = auth.uid();

  IF cid IS NOT NULL THEN
    RETURN cid;
  END IF;

  SELECT id INTO cid
  FROM clients
  WHERE user_id = auth.uid()
    AND deleted_at IS NULL
  LIMIT 1;

  RETURN cid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Backfill: link profiles.client_id from clients.user_id
UPDATE profiles p
SET client_id = c.id
FROM clients c
WHERE c.user_id = p.id
  AND p.client_id IS NULL
  AND c.deleted_at IS NULL;

-- Backfill: link clients.user_id from profiles with matching email (when unique)
UPDATE clients c
SET user_id = p.id
FROM profiles p
WHERE lower(p.email) = lower(c.email)
  AND p.role = 'client'
  AND c.user_id IS NULL
  AND c.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM clients c2
    WHERE c2.user_id = p.id AND c2.id <> c.id
  );

-- After email link, set profile.client_id
UPDATE profiles p
SET client_id = c.id
FROM clients c
WHERE c.user_id = p.id
  AND (p.client_id IS NULL OR p.client_id <> c.id)
  AND c.deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- 2. Per-client messages (privacy: each client only sees their own thread)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS client_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  sender_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  sender_role TEXT NOT NULL CHECK (sender_role IN ('admin', 'client')),
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_client_messages_client_created
  ON client_messages (client_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_client_messages_project
  ON client_messages (project_id)
  WHERE project_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS client_message_reads (
  message_id UUID NOT NULL REFERENCES client_messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (message_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_client_message_reads_user
  ON client_message_reads (user_id);

ALTER TABLE client_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_message_reads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins full access client_messages" ON client_messages;
CREATE POLICY "Admins full access client_messages" ON client_messages
  FOR ALL USING (is_admin());

DROP POLICY IF EXISTS "Clients view own client_messages" ON client_messages;
CREATE POLICY "Clients view own client_messages" ON client_messages
  FOR SELECT USING (client_id = get_user_client_id());

DROP POLICY IF EXISTS "Clients insert own client_messages" ON client_messages;
CREATE POLICY "Clients insert own client_messages" ON client_messages
  FOR INSERT WITH CHECK (
    client_id = get_user_client_id()
    AND sender_user_id = auth.uid()
    AND sender_role = 'client'
  );

DROP POLICY IF EXISTS "Admins full access client_message_reads" ON client_message_reads;
CREATE POLICY "Admins full access client_message_reads" ON client_message_reads
  FOR ALL USING (is_admin());

DROP POLICY IF EXISTS "Users manage own client_message_reads" ON client_message_reads;
CREATE POLICY "Users manage own client_message_reads" ON client_message_reads
  FOR ALL USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Migrate existing project_messages → client_messages (attribute to primary project client)
INSERT INTO client_messages (id, client_id, project_id, sender_user_id, sender_role, body, created_at)
SELECT
  pm.id,
  COALESCE(p.client_id, pc.client_id),
  pm.project_id,
  pm.sender_user_id,
  pm.sender_role,
  pm.body,
  pm.created_at
FROM project_messages pm
JOIN projects p ON p.id = pm.project_id
LEFT JOIN LATERAL (
  SELECT client_id FROM project_clients
  WHERE project_id = pm.project_id AND is_primary = true
  LIMIT 1
) pc ON true
WHERE COALESCE(p.client_id, pc.client_id) IS NOT NULL
ON CONFLICT (id) DO NOTHING;

-- Migrate reads when possible
INSERT INTO client_message_reads (message_id, user_id, read_at)
SELECT r.message_id, r.user_id, r.read_at
FROM project_message_reads r
WHERE EXISTS (SELECT 1 FROM client_messages cm WHERE cm.id = r.message_id)
ON CONFLICT DO NOTHING;
