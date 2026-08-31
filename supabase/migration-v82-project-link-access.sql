-- Swift Portal V82 — "Anyone with link" public project access
-- Default RESTRICTED for all projects (including existing rows via DEFAULT).

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS link_access_mode TEXT NOT NULL DEFAULT 'restricted'
    CHECK (link_access_mode IN ('restricted', 'anyone_with_link'));

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS link_access_token TEXT;

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS link_access_enabled_at TIMESTAMPTZ;

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS link_access_enabled_by UUID REFERENCES profiles(id);

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS link_access_view_count BIGINT NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_link_access_token
  ON projects (link_access_token)
  WHERE link_access_token IS NOT NULL;

COMMENT ON COLUMN projects.link_access_mode IS
  'restricted = admins, assigned client, email shares only; anyone_with_link = anonymous URL access';
COMMENT ON COLUMN projects.link_access_token IS
  'Secret token embedded in public URL; NULL when restricted or before first enable';

-- Verify migration default (run after apply):
-- SELECT link_access_mode, count(*) FROM projects GROUP BY 1;
