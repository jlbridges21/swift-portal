-- Swift Portal v2 Migration
-- Run in Supabase SQL Editor after initial schema.sql

-- Media assets: ordering, YouTube support
ALTER TABLE media_assets ADD COLUMN IF NOT EXISTS display_order INTEGER NOT NULL DEFAULT 0;
ALTER TABLE media_assets ADD COLUMN IF NOT EXISTS media_source TEXT NOT NULL DEFAULT 'upload';
ALTER TABLE media_assets ADD COLUMN IF NOT EXISTS youtube_url TEXT;
ALTER TABLE media_assets ADD COLUMN IF NOT EXISTS embed_url TEXT;

-- Tours: ordering and notes
ALTER TABLE tours ADD COLUMN IF NOT EXISTS display_order INTEGER NOT NULL DEFAULT 0;
ALTER TABLE tours ADD COLUMN IF NOT EXISTS notes TEXT;

-- Projects: cover image reference
ALTER TABLE projects ADD COLUMN IF NOT EXISTS cover_image_id UUID REFERENCES media_assets(id) ON DELETE SET NULL;

-- Leads: link to auto-created project
ALTER TABLE leads ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE SET NULL;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_media_assets_display_order ON media_assets(project_id, display_order);
CREATE INDEX IF NOT EXISTS idx_tours_display_order ON tours(project_id, display_order);

-- Increase storage bucket limits (2GB for media bucket)
UPDATE storage.buckets
SET file_size_limit = 2147483648
WHERE id = 'project-media';

UPDATE storage.buckets
SET file_size_limit = 524288000
WHERE id = 'project-documents';

-- Backfill display_order from created_at order
WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY project_id ORDER BY created_at) - 1 AS ord
  FROM media_assets
)
UPDATE media_assets m SET display_order = o.ord FROM ordered o WHERE m.id = o.id;

WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY project_id ORDER BY created_at) - 1 AS ord
  FROM tours
)
UPDATE tours t SET display_order = o.ord FROM ordered o WHERE t.id = o.id;
