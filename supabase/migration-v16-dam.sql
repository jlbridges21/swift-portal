-- Swift Portal V16 — Digital Asset Management (DAM)

-- ---------------------------------------------------------------------------
-- 1. Extended media metadata
-- ---------------------------------------------------------------------------
ALTER TABLE media_assets ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE media_assets ADD COLUMN IF NOT EXISTS alt_text TEXT;
ALTER TABLE media_assets ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE media_assets ADD COLUMN IF NOT EXISTS captured_at TIMESTAMPTZ;
ALTER TABLE media_assets ADD COLUMN IF NOT EXISTS camera_model TEXT;
ALTER TABLE media_assets ADD COLUMN IF NOT EXISTS orientation TEXT;
ALTER TABLE media_assets ADD COLUMN IF NOT EXISTS width INTEGER;
ALTER TABLE media_assets ADD COLUMN IF NOT EXISTS height INTEGER;
ALTER TABLE media_assets ADD COLUMN IF NOT EXISTS duration_seconds INTEGER;
ALTER TABLE media_assets ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE media_assets ADD COLUMN IF NOT EXISTS download_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE media_assets ADD COLUMN IF NOT EXISTS last_downloaded_at TIMESTAMPTZ;
ALTER TABLE media_assets ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;

UPDATE media_assets SET title = file_name WHERE title IS NULL OR title = '';
UPDATE media_assets SET storage_path = file_path WHERE storage_path IS NULL OR storage_path = '';

-- ---------------------------------------------------------------------------
-- 2. Tags
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS media_asset_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  media_asset_id UUID NOT NULL REFERENCES media_assets(id) ON DELETE CASCADE,
  tag TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (media_asset_id, tag)
);

CREATE INDEX IF NOT EXISTS idx_media_asset_tags_tag ON media_asset_tags (LOWER(tag));
CREATE INDEX IF NOT EXISTS idx_media_asset_tags_asset ON media_asset_tags (media_asset_id);

-- ---------------------------------------------------------------------------
-- 3. Download analytics (admin-only)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS media_downloads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  media_asset_id UUID NOT NULL REFERENCES media_assets(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  downloaded_by_email TEXT,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_media_downloads_asset ON media_downloads (media_asset_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- 4. Asset timeline events
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS media_asset_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  media_asset_id UUID NOT NULL REFERENCES media_assets(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  description TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_media_asset_events_asset ON media_asset_events (media_asset_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- 5. Tour metadata
-- ---------------------------------------------------------------------------
ALTER TABLE tours ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE tours ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE tours ADD COLUMN IF NOT EXISTS download_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE tours ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

DROP TRIGGER IF EXISTS tours_updated_at ON tours;
CREATE TRIGGER tours_updated_at BEFORE UPDATE ON tours
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ---------------------------------------------------------------------------
-- 6. Search indexes
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_media_assets_created_at ON media_assets (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_media_assets_type_source ON media_assets (media_type, media_source);
CREATE INDEX IF NOT EXISTS idx_media_assets_favorite ON media_assets (is_favorite) WHERE is_favorite = true;

-- Trigram indexes (skip if columns missing — created after ALTER above)
DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_media_assets_title_trgm ON media_assets USING gin (title gin_trgm_ops);
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_media_assets_file_name_trgm ON media_assets USING gin (file_name gin_trgm_ops);
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- 7. RLS
-- ---------------------------------------------------------------------------
ALTER TABLE media_asset_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_downloads ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_asset_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins full access media_asset_tags" ON media_asset_tags;
CREATE POLICY "Admins full access media_asset_tags" ON media_asset_tags
  FOR ALL USING (is_admin());

DROP POLICY IF EXISTS "Admins full access media_downloads" ON media_downloads;
CREATE POLICY "Admins full access media_downloads" ON media_downloads
  FOR ALL USING (is_admin());

DROP POLICY IF EXISTS "Admins full access media_asset_events" ON media_asset_events;
CREATE POLICY "Admins full access media_asset_events" ON media_asset_events
  FOR ALL USING (is_admin());

DROP POLICY IF EXISTS "Clients view tags on accessible media" ON media_asset_tags;
CREATE POLICY "Clients view tags on accessible media" ON media_asset_tags
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM media_assets m
      WHERE m.id = media_asset_tags.media_asset_id
        AND client_has_project_access(m.project_id)
    )
  );
