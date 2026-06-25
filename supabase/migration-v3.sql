-- Swift Portal v3 Migration
-- Run in Supabase SQL Editor

-- Shoot confirmed status
ALTER TYPE project_status ADD VALUE IF NOT EXISTS 'shoot_confirmed' AFTER 'scheduled';

-- Project deliverables approval
ALTER TABLE projects ADD COLUMN IF NOT EXISTS deliverables_approved_at TIMESTAMPTZ;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS deliverables_approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Many-to-many: projects <-> clients
CREATE TABLE IF NOT EXISTS project_clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(project_id, client_id)
);

CREATE INDEX IF NOT EXISTS idx_project_clients_project ON project_clients(project_id);
CREATE INDEX IF NOT EXISTS idx_project_clients_client ON project_clients(client_id);

-- Backfill from projects.client_id
INSERT INTO project_clients (project_id, client_id, is_primary)
SELECT id, client_id, true FROM projects
WHERE client_id IS NOT NULL
ON CONFLICT (project_id, client_id) DO NOTHING;

-- Shoot scheduling proposals
CREATE TYPE shoot_proposal_status AS ENUM ('pending', 'accepted', 'countered', 'confirmed', 'declined');

CREATE TABLE IF NOT EXISTS shoot_proposals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  proposed_by TEXT NOT NULL CHECK (proposed_by IN ('admin', 'client')),
  proposed_at TIMESTAMPTZ NOT NULL,
  message TEXT,
  status shoot_proposal_status NOT NULL DEFAULT 'pending',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shoot_proposals_project ON shoot_proposals(project_id);
CREATE INDEX IF NOT EXISTS idx_shoot_proposals_status ON shoot_proposals(status);
CREATE INDEX IF NOT EXISTS idx_shoot_proposals_proposed_at ON shoot_proposals(proposed_at);

-- RLS for new tables
ALTER TABLE project_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE shoot_proposals ENABLE ROW LEVEL SECURITY;

-- Helper: client has access to project via junction or legacy client_id
CREATE OR REPLACE FUNCTION client_has_project_access(p_project_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM project_clients
    WHERE project_id = p_project_id AND client_id = get_user_client_id()
  ) OR EXISTS (
    SELECT 1 FROM projects
    WHERE id = p_project_id AND client_id = get_user_client_id()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- project_clients policies
CREATE POLICY "Admins full access project_clients" ON project_clients FOR ALL USING (is_admin());
CREATE POLICY "Clients view own project_clients" ON project_clients
  FOR SELECT USING (client_id = get_user_client_id());

-- shoot_proposals policies
CREATE POLICY "Admins full access shoot_proposals" ON shoot_proposals FOR ALL USING (is_admin());
CREATE POLICY "Clients view own shoot_proposals" ON shoot_proposals
  FOR SELECT USING (client_has_project_access(project_id));
CREATE POLICY "Clients create shoot_proposals" ON shoot_proposals
  FOR INSERT WITH CHECK (client_has_project_access(project_id) AND proposed_by = 'client');
CREATE POLICY "Clients update own counter proposals" ON shoot_proposals
  FOR UPDATE USING (client_has_project_access(project_id));

-- Update projects RLS for junction table
DROP POLICY IF EXISTS "Clients view own projects" ON projects;
CREATE POLICY "Clients view own projects" ON projects
  FOR SELECT USING (
    client_id = get_user_client_id()
    OR client_has_project_access(id)
  );

-- Update media/tours/payments RLS to use junction
DROP POLICY IF EXISTS "Clients view own media" ON media_assets;
CREATE POLICY "Clients view own media" ON media_assets
  FOR SELECT USING (client_has_project_access(project_id));

DROP POLICY IF EXISTS "Clients view own tours" ON tours;
CREATE POLICY "Clients view own tours" ON tours
  FOR SELECT USING (client_has_project_access(project_id));

DROP POLICY IF EXISTS "Clients view own revisions" ON revisions;
CREATE POLICY "Clients view own revisions" ON revisions
  FOR SELECT USING (client_id = get_user_client_id());

DROP POLICY IF EXISTS "Clients create revisions" ON revisions;
CREATE POLICY "Clients create revisions" ON revisions
  FOR INSERT WITH CHECK (client_id = get_user_client_id());

-- Storage policy update for junction
DROP POLICY IF EXISTS "Clients can view own media files" ON storage.objects;
CREATE POLICY "Clients can view own media files" ON storage.objects
  FOR SELECT USING (
    bucket_id IN ('project-media', 'project-documents') AND
    (storage.foldername(name))[1] IN (
      SELECT id::text FROM projects p
      WHERE p.client_id = get_user_client_id()
         OR EXISTS (
           SELECT 1 FROM project_clients pc
           WHERE pc.project_id = p.id AND pc.client_id = get_user_client_id()
         )
    )
  );

CREATE TRIGGER shoot_proposals_updated_at BEFORE UPDATE ON shoot_proposals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
