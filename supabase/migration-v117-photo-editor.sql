-- ShootPortal V117 — Built-in Photo Editor (LightCraft engine) + photo versions
--
-- Replaces the retired Property Line tool (v21). A photo stays ONE media_assets row
-- everywhere in the app. Editing never overwrites the original file:
--
--   media_asset_versions   Every file a photo has had. version 1 = the original upload
--                          (snapshotted the first time the photo is edited), then one row
--                          per "Save to Project". Rows are business-private.
--   media_assets           Still the single delivery record. On "Save to Project" the row's
--                          file_path / thumbnail_url / file_size / mime_type / width / height
--                          are pointed at the new edited file, so every existing consumer
--                          (client portal, downloads, ZIPs, shares, embeds, covers, thumbnails)
--                          delivers the finished version without per-feature changes.
--                          "Restore original" points them back at version 1.
--   media_edit_drafts      In-progress adjustments (small JSON recipe, no rendered pixels).
--                          Auto-saved from the editor; never visible to clients and never
--                          touches media_assets until the business saves to the project.
--   photo_edit_sessions    Which photos were opened together (selection / folder) so a batch
--                          can be reopened later, from any device.
--
-- Property Line (v21): the columns property_line_base_media_id / property_line_data are no
-- longer read or written by the app. Existing Property Line images remain ordinary photos.
-- The columns are intentionally left in place (no data loss); they can be dropped later with:
--   ALTER TABLE media_assets DROP COLUMN property_line_base_media_id, DROP COLUMN property_line_data;
--
-- Additive only. The app runs without this migration: the editor shows a setup notice and
-- every other media feature behaves exactly as before.
-- Rollback: DROP TABLE photo_edit_sessions, media_edit_drafts, media_asset_versions;
--           ALTER TABLE media_assets DROP COLUMN edit_status, DROP COLUMN current_version_id,
--             DROP COLUMN edited_at; and re-run migration-v115-project-storage-usage.sql.

-- ---------------------------------------------------------------------------
-- Versions
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS media_asset_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  media_asset_id UUID NOT NULL REFERENCES media_assets(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL CHECK (version_number >= 1),
  kind TEXT NOT NULL CHECK (kind IN ('original', 'edit')),
  file_name TEXT,
  file_path TEXT NOT NULL,
  thumbnail_url TEXT,
  file_size BIGINT,
  mime_type TEXT,
  width INTEGER,
  height INTEGER,
  -- Editor recipe that produced this file (NULL for the original). Lets "Edit again"
  -- start from exactly what was delivered.
  edit_settings JSONB,
  editor TEXT NOT NULL DEFAULT 'lightcraft' CHECK (char_length(editor) <= 40),
  editor_version TEXT CHECK (char_length(editor_version) <= 40),
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_media_asset_versions_number
  ON media_asset_versions (media_asset_id, version_number);
CREATE UNIQUE INDEX IF NOT EXISTS idx_media_asset_versions_one_original
  ON media_asset_versions (media_asset_id) WHERE kind = 'original';
CREATE INDEX IF NOT EXISTS idx_media_asset_versions_business
  ON media_asset_versions (business_id);

DROP TRIGGER IF EXISTS trg_media_asset_versions_media_same_business ON media_asset_versions;
CREATE TRIGGER trg_media_asset_versions_media_same_business
  BEFORE INSERT OR UPDATE ON media_asset_versions
  FOR EACH ROW
  EXECUTE FUNCTION enforce_same_business('media_assets', 'media_asset_id');

ALTER TABLE media_assets
  ADD COLUMN IF NOT EXISTS edit_status TEXT NOT NULL DEFAULT 'unedited'
    CHECK (edit_status IN ('unedited', 'edited')),
  ADD COLUMN IF NOT EXISTS current_version_id UUID REFERENCES media_asset_versions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ;

-- ---------------------------------------------------------------------------
-- Drafts (auto-saved progress — private to the business)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS media_edit_drafts (
  media_asset_id UUID PRIMARY KEY REFERENCES media_assets(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  settings JSONB NOT NULL,
  -- Monotonic counter for optimistic concurrency (two tabs / two devices).
  revision INTEGER NOT NULL DEFAULT 1,
  updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (pg_column_size(settings) <= 262144)
);

CREATE INDEX IF NOT EXISTS idx_media_edit_drafts_business ON media_edit_drafts (business_id);

DROP TRIGGER IF EXISTS trg_media_edit_drafts_media_same_business ON media_edit_drafts;
CREATE TRIGGER trg_media_edit_drafts_media_same_business
  BEFORE INSERT OR UPDATE ON media_edit_drafts
  FOR EACH ROW
  EXECUTE FUNCTION enforce_same_business('media_assets', 'media_asset_id');

-- ---------------------------------------------------------------------------
-- Editing sessions (a batch the user opened together)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS photo_edit_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  folder_id UUID REFERENCES media_folders(id) ON DELETE SET NULL,
  scope TEXT NOT NULL CHECK (scope IN ('single', 'selection', 'folder', 'unfiled')),
  media_ids UUID[] NOT NULL CHECK (cardinality(media_ids) BETWEEN 1 AND 500),
  active_media_id UUID,
  return_to TEXT CHECK (char_length(return_to) <= 300),
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_photo_edit_sessions_business ON photo_edit_sessions (business_id, updated_at DESC);

DROP TRIGGER IF EXISTS trg_photo_edit_sessions_project_same_business ON photo_edit_sessions;
CREATE TRIGGER trg_photo_edit_sessions_project_same_business
  BEFORE INSERT OR UPDATE ON photo_edit_sessions
  FOR EACH ROW
  EXECUTE FUNCTION enforce_same_business('projects', 'project_id');

-- ---------------------------------------------------------------------------
-- RLS: server-only tables. Every read/write goes through the service role with an explicit
-- business_id filter (tenant-lint enforced); browsers never read these directly, and
-- clients/share viewers have no path to versions or drafts.
-- ---------------------------------------------------------------------------

ALTER TABLE media_asset_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_edit_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE photo_edit_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON media_asset_versions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON media_edit_drafts FROM PUBLIC, anon, authenticated;
REVOKE ALL ON photo_edit_sessions FROM PUBLIC, anon, authenticated;
GRANT ALL ON media_asset_versions TO service_role;
GRANT ALL ON media_edit_drafts TO service_role;
GRANT ALL ON photo_edit_sessions TO service_role;

-- ---------------------------------------------------------------------------
-- Storage usage: also count version files that are not the photo's current file
-- (the preserved original and earlier edits). Replaces the v115 definition.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION project_storage_usage(p_business_id UUID, p_project_ids UUID[])
RETURNS TABLE (project_id UUID, bytes BIGINT, assets BIGINT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, storage, pg_temp
AS $$
  SELECT ma.project_id,
         COALESCE(SUM(
           COALESCE(ma.file_size, NULLIF(orig.metadata->>'size', '')::bigint, 0)
           + COALESCE(NULLIF(thumb.metadata->>'size', '')::bigint, 0)
           + COALESCE(extra.bytes, 0)
         ), 0)::bigint AS bytes,
         COUNT(*)::bigint AS assets
  FROM public.media_assets ma
  LEFT JOIN storage.objects orig
    ON ma.file_size IS NULL
   AND orig.bucket_id = 'project-media'
   AND orig.name = ma.file_path
  LEFT JOIN storage.objects thumb
    ON ma.thumbnail_url IS NOT NULL
   AND thumb.bucket_id = 'project-media'
   AND thumb.name = ma.thumbnail_url
  LEFT JOIN LATERAL (
    SELECT SUM(COALESCE(v.file_size, 0))::bigint AS bytes
    FROM public.media_asset_versions v
    WHERE v.media_asset_id = ma.id
      AND v.business_id = p_business_id
      AND v.file_path IS DISTINCT FROM ma.file_path
  ) extra ON true
  WHERE ma.business_id = p_business_id
    AND ma.project_id = ANY (p_project_ids)
  GROUP BY ma.project_id;
$$;

REVOKE ALL ON FUNCTION project_storage_usage(UUID, UUID[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION project_storage_usage(UUID, UUID[]) TO service_role;
