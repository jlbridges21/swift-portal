-- Allow media assets without a project (global / unassigned library uploads)
ALTER TABLE media_assets ALTER COLUMN project_id DROP NOT NULL;

-- Idempotent saves by storage path
CREATE UNIQUE INDEX IF NOT EXISTS idx_media_assets_file_path_unique ON media_assets (file_path);

-- Fast lookup for unassigned media
CREATE INDEX IF NOT EXISTS idx_media_assets_unassigned ON media_assets (created_at DESC) WHERE project_id IS NULL;
