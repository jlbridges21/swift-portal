-- V127 — Multiple services per project + duplicate-safe project requests
--
-- 1. project_services  one row per (project, service) link. A project can now link several
--    Settings → Services entries. These links are SEPARATE from the estimate: they never
--    rewrite project_quotes. service_name is a snapshot of the name when it was linked, so a
--    renamed or deactivated service still reads correctly on historical work.
--    projects.service_id / projects.service_type are kept and still written (primary service /
--    display list), so every existing reader keeps working unchanged.
--    Read and written only by server code with the service role (RLS on, no policies),
--    tenant-checked by enforce_same_business triggers.
-- 2. Backfill: every existing project with a service_id gets its single link (position 0).
--    Nothing is renamed, no estimate or proposal is touched.
-- 3. projects.request_key  idempotency key sent by the request forms. A repeated submission
--    (double click, network retry) with the same key returns the first project instead of
--    creating another. Unique per business, NULL for every existing and admin-created project.
--
-- Additive only. Until this runs the app still creates multi-service projects: links fall back
-- to projects.service_type ("A + B") and duplicate protection falls back to a short time window.
--
-- HOW TO RUN: SQL Editor → paste → Run. Re-runnable.
-- Rollback: DROP TABLE project_services; DROP INDEX IF EXISTS uq_projects_request_key;
--           ALTER TABLE projects DROP COLUMN IF EXISTS request_key;

CREATE TABLE IF NOT EXISTS project_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  -- No ON DELETE: a service used on a project cannot be deleted (deactivate it instead).
  service_id UUID NOT NULL REFERENCES business_services(id),
  service_name TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, service_id)
);

CREATE INDEX IF NOT EXISTS idx_project_services_project
  ON project_services (business_id, project_id, position);
CREATE INDEX IF NOT EXISTS idx_project_services_service
  ON project_services (business_id, service_id);

DROP TRIGGER IF EXISTS trg_project_services_project_same_business ON project_services;
CREATE TRIGGER trg_project_services_project_same_business
  BEFORE INSERT OR UPDATE ON project_services
  FOR EACH ROW
  EXECUTE FUNCTION enforce_same_business('projects', 'project_id');

DROP TRIGGER IF EXISTS trg_project_services_service_same_business ON project_services;
CREATE TRIGGER trg_project_services_service_same_business
  BEFORE INSERT OR UPDATE ON project_services
  FOR EACH ROW
  EXECUTE FUNCTION enforce_same_business('business_services', 'service_id');

ALTER TABLE project_services ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON project_services FROM anon, authenticated;
GRANT ALL ON project_services TO service_role;

-- Backfill the existing single-service links (same business only; triggers re-check).
INSERT INTO project_services (business_id, project_id, service_id, service_name, position)
SELECT p.business_id, p.id, p.service_id, coalesce(nullif(trim(p.service_type), ''), s.name), 0
FROM projects p
JOIN business_services s ON s.id = p.service_id AND s.business_id = p.business_id
WHERE p.service_id IS NOT NULL
ON CONFLICT (project_id, service_id) DO NOTHING;

ALTER TABLE projects ADD COLUMN IF NOT EXISTS request_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS uq_projects_request_key
  ON projects (business_id, request_key)
  WHERE request_key IS NOT NULL;

SELECT
  (SELECT count(*) FROM project_services) AS project_service_links,
  (SELECT count(*) FROM projects WHERE service_id IS NOT NULL AND deleted_at IS NULL) AS projects_with_service_id;
