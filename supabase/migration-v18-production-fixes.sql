-- Swift Portal V18 — Production fixes: tour visibility

ALTER TABLE tours ADD COLUMN IF NOT EXISTS client_visible BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_tours_client_visible ON tours (project_id, client_visible);
