-- V89 — External 3D model embeds (third-party viewer URLs, not stored media)
-- Mirrors tours: per-project / per-business rows with client_visible + section toggle.
-- Links only — never included in ZIP / download gate / media library.

-- ---------------------------------------------------------------------------
-- 1. project_3d_models
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS project_3d_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses (id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  embed_url TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (
    provider IN (
      'polycam',
      'agisoft',
      'pix4d',
      'sketchfab',
      'matterport',
      'dronedeploy',
      'cesium',
      'arcgis'
    )
  ),
  description TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  client_visible BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_3d_models_business_id ON project_3d_models (business_id);
CREATE INDEX IF NOT EXISTS idx_project_3d_models_project_id ON project_3d_models (project_id);
CREATE INDEX IF NOT EXISTS idx_project_3d_models_display_order
  ON project_3d_models (project_id, display_order);
CREATE INDEX IF NOT EXISTS idx_project_3d_models_client_visible
  ON project_3d_models (project_id, client_visible);

DROP TRIGGER IF EXISTS project_3d_models_updated_at ON project_3d_models;
CREATE TRIGGER project_3d_models_updated_at
  BEFORE UPDATE ON project_3d_models
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Cross-tenant integrity (same pattern as tours → projects)
DROP TRIGGER IF EXISTS trg_project_3d_models_project_id_same_business ON project_3d_models;
CREATE TRIGGER trg_project_3d_models_project_id_same_business
  BEFORE INSERT OR UPDATE ON project_3d_models
  FOR EACH ROW
  EXECUTE FUNCTION enforce_same_business('projects', 'project_id');

-- ---------------------------------------------------------------------------
-- 2. Per-project section visibility (default ON)
-- ---------------------------------------------------------------------------
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS client_section_models BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN projects.client_section_models IS
  'When false, clients/shared/anonymous do not see the 3D Models section.';

UPDATE projects SET client_section_models = COALESCE(client_section_models, true);

ALTER TYPE activity_type ADD VALUE IF NOT EXISTS 'model_added';

-- ---------------------------------------------------------------------------
-- 3. RLS (match tours)
-- ---------------------------------------------------------------------------
ALTER TABLE project_3d_models ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins full access project_3d_models" ON project_3d_models;
CREATE POLICY "Admins full access project_3d_models" ON project_3d_models
  FOR ALL
  USING (is_super_admin() OR (is_admin() AND business_id = current_business_id()))
  WITH CHECK (is_super_admin() OR (is_admin() AND business_id = current_business_id()));

DROP POLICY IF EXISTS "Clients view own project_3d_models" ON project_3d_models;
CREATE POLICY "Clients view own project_3d_models" ON project_3d_models
  FOR SELECT USING (
    client_has_project_access(project_id)
    AND (
      business_id = current_business_id()
      OR user_has_active_project_share(project_id)
    )
  );
