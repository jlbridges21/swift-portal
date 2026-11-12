-- V124 — Per-project client download override
--   NULL       = use the business default (Admin Settings › Payments › Download Access)
--   'allow'    = clients may download available media now (no Delivered / payment wait)
--   'restrict' = clients must wait until the project is Delivered
-- Download timing only: project access, file visibility, section visibility, invoices,
-- payments and project status are unchanged. Existing rows stay NULL, so every project
-- keeps its current effective behavior until a business picks an override.

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS client_download_access TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'projects_client_download_access_check'
  ) THEN
    ALTER TABLE projects
      ADD CONSTRAINT projects_client_download_access_check
      CHECK (client_download_access IS NULL OR client_download_access IN ('allow', 'restrict'));
  END IF;
END $$;

COMMENT ON COLUMN projects.client_download_access IS
  'Client download override: NULL = business default, allow = downloads open now, restrict = wait for Delivered.';
