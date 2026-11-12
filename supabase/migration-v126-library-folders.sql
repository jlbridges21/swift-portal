-- ShootPortal V126 — Media Library folders (organizational collections) + sharing
--
-- 1. library_folders        One row per business-defined folder ("Aerial Shots", "Website Assets").
--                           Independent of projects. Name is unique per business (case-insensitive).
-- 2. library_folder_items   Membership only: (folder, asset) pairs. An asset is referenced, never
--                           copied — no storage is duplicated, the asset keeps its project, and an
--                           asset may sit in any number of folders. Exactly one of media_asset_id /
--                           tour_id / model_id is set (photos, videos and files live in media_assets;
--                           360° tours and 3D models in their own tables).
--                           Deleting a folder deletes only its membership rows (CASCADE). Deleting an
--                           asset removes it from every folder (CASCADE). Nothing here can delete media.
-- 3. media_shares           Two new share subjects, same tokens / hashing / expiry / revocation as v104:
--                             library_folder_id  "share a Media Library folder" — membership evaluated
--                                                live at access time; no project is granted.
--                             tour_id / model_id "share one 360° tour / 3D model" (videos and files
--                                                use the existing media_asset_id subject).
--                           Fail closed: deleting a library folder revokes its shares (BEFORE DELETE,
--                           reason 'folder_deleted'); moving a tour / 3D model to another project
--                           revokes its shares (reason 'moved'); the v104 project-delete trigger already
--                           revokes item shares through their project_id snapshot.
--
-- Additive only: no existing row changes, the Classic interface never reads these tables, and the app
-- runs without this migration (folders show a "setup required" notice; sharing for the new subjects 404s).
--
-- HOW TO RUN: Supabase SQL Editor → paste → Run. Re-runnable.
-- Rollback:
--   ALTER TABLE media_shares DROP COLUMN library_folder_id, DROP COLUMN tour_id, DROP COLUMN model_id;
--   (then restore the v105 media_shares_one_subject constraint)
--   DROP TABLE library_folder_items; DROP TABLE library_folders;
--   DROP FUNCTION library_folder_summaries(UUID);

-- ---------------------------------------------------------------------------
-- 1. Folders
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS library_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 80),
  -- Manually chosen cover. NULL = automatic (most recently added photo). A deleted cover photo
  -- falls back to automatic.
  cover_media_asset_id UUID REFERENCES media_assets(id) ON DELETE SET NULL,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_library_folders_business ON library_folders (business_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_library_folders_business_name
  ON library_folders (business_id, lower(btrim(name)));

DROP TRIGGER IF EXISTS trg_library_folders_cover_same_business ON library_folders;
CREATE TRIGGER trg_library_folders_cover_same_business
  BEFORE INSERT OR UPDATE ON library_folders
  FOR EACH ROW
  EXECUTE FUNCTION enforce_same_business('media_assets', 'cover_media_asset_id');

-- ---------------------------------------------------------------------------
-- 2. Membership
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS library_folder_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  folder_id UUID NOT NULL REFERENCES library_folders(id) ON DELETE CASCADE,
  media_asset_id UUID REFERENCES media_assets(id) ON DELETE CASCADE,
  tour_id UUID REFERENCES tours(id) ON DELETE CASCADE,
  model_id UUID REFERENCES project_3d_models(id) ON DELETE CASCADE,
  added_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT library_folder_items_one_subject CHECK (num_nonnulls(media_asset_id, tour_id, model_id) = 1)
);

CREATE INDEX IF NOT EXISTS idx_library_folder_items_business ON library_folder_items (business_id);
CREATE INDEX IF NOT EXISTS idx_library_folder_items_folder_added ON library_folder_items (folder_id, added_at DESC);
CREATE INDEX IF NOT EXISTS idx_library_folder_items_media ON library_folder_items (media_asset_id) WHERE media_asset_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_library_folder_items_tour ON library_folder_items (tour_id) WHERE tour_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_library_folder_items_model ON library_folder_items (model_id) WHERE model_id IS NOT NULL;

-- Adding the same asset twice is a no-op (the app upserts with ON CONFLICT DO NOTHING).
CREATE UNIQUE INDEX IF NOT EXISTS idx_library_folder_items_unique_media
  ON library_folder_items (folder_id, media_asset_id) WHERE media_asset_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_library_folder_items_unique_tour
  ON library_folder_items (folder_id, tour_id) WHERE tour_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_library_folder_items_unique_model
  ON library_folder_items (folder_id, model_id) WHERE model_id IS NOT NULL;

-- Tenant integrity (v30 pattern): the folder and the asset must belong to business_id.
DROP TRIGGER IF EXISTS trg_library_folder_items_folder_same_business ON library_folder_items;
CREATE TRIGGER trg_library_folder_items_folder_same_business
  BEFORE INSERT OR UPDATE ON library_folder_items
  FOR EACH ROW EXECUTE FUNCTION enforce_same_business('library_folders', 'folder_id');

DROP TRIGGER IF EXISTS trg_library_folder_items_media_same_business ON library_folder_items;
CREATE TRIGGER trg_library_folder_items_media_same_business
  BEFORE INSERT OR UPDATE ON library_folder_items
  FOR EACH ROW EXECUTE FUNCTION enforce_same_business('media_assets', 'media_asset_id');

DROP TRIGGER IF EXISTS trg_library_folder_items_tour_same_business ON library_folder_items;
CREATE TRIGGER trg_library_folder_items_tour_same_business
  BEFORE INSERT OR UPDATE ON library_folder_items
  FOR EACH ROW EXECUTE FUNCTION enforce_same_business('tours', 'tour_id');

DROP TRIGGER IF EXISTS trg_library_folder_items_model_same_business ON library_folder_items;
CREATE TRIGGER trg_library_folder_items_model_same_business
  BEFORE INSERT OR UPDATE ON library_folder_items
  FOR EACH ROW EXECUTE FUNCTION enforce_same_business('project_3d_models', 'model_id');

-- Folder cards: item count + automatic cover (newest photo added) in one round trip.
CREATE OR REPLACE FUNCTION library_folder_summaries(p_business_id UUID)
RETURNS TABLE (folder_id UUID, item_count BIGINT, auto_cover_id UUID)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    f.id,
    (SELECT count(*) FROM library_folder_items i WHERE i.folder_id = f.id),
    (
      SELECT i.media_asset_id
        FROM library_folder_items i
        JOIN media_assets m ON m.id = i.media_asset_id
       WHERE i.folder_id = f.id
         AND m.media_type = 'photo'
         AND m.media_source IS DISTINCT FROM 'youtube'
       ORDER BY i.added_at DESC
       LIMIT 1
    )
  FROM library_folders f
  WHERE f.business_id = p_business_id;
$$;

REVOKE ALL ON FUNCTION library_folder_summaries(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION library_folder_summaries(UUID) TO service_role;

-- RLS: server-only tables (service role + explicit business_id, tenant-lint enforced).
ALTER TABLE library_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE library_folder_items ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON library_folders FROM PUBLIC, anon, authenticated;
REVOKE ALL ON library_folder_items FROM PUBLIC, anon, authenticated;
GRANT ALL ON library_folders TO service_role;
GRANT ALL ON library_folder_items TO service_role;

-- ---------------------------------------------------------------------------
-- 3. Sharing: new media_shares subjects
-- ---------------------------------------------------------------------------

ALTER TABLE media_shares
  ADD COLUMN IF NOT EXISTS library_folder_id UUID REFERENCES library_folders(id) ON DELETE SET NULL;
ALTER TABLE media_shares
  ADD COLUMN IF NOT EXISTS tour_id UUID REFERENCES tours(id) ON DELETE CASCADE;
ALTER TABLE media_shares
  ADD COLUMN IF NOT EXISTS model_id UUID REFERENCES project_3d_models(id) ON DELETE CASCADE;

-- Exactly one subject while live. A revoked row may lose its subject (folder deleted → SET NULL).
ALTER TABLE media_shares DROP CONSTRAINT IF EXISTS media_shares_one_subject;
ALTER TABLE media_shares
  ADD CONSTRAINT media_shares_one_subject CHECK (
    num_nonnulls(media_asset_id, media_folder_id, library_folder_id, tour_id, model_id) = 1
    OR (
      revoked_at IS NOT NULL
      AND num_nonnulls(media_asset_id, media_folder_id, library_folder_id, tour_id, model_id) = 0
    )
  );

CREATE INDEX IF NOT EXISTS idx_media_shares_library_folder_id ON media_shares (library_folder_id) WHERE library_folder_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_media_shares_tour_id ON media_shares (tour_id) WHERE tour_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_media_shares_model_id ON media_shares (model_id) WHERE model_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_media_shares_one_active_library_folder_link
  ON media_shares (library_folder_id)
  WHERE kind = 'link' AND revoked_at IS NULL AND library_folder_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_media_shares_one_active_library_folder_email
  ON media_shares (library_folder_id, lower(email))
  WHERE kind = 'email' AND revoked_at IS NULL AND library_folder_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_media_shares_one_active_tour_link
  ON media_shares (tour_id)
  WHERE kind = 'link' AND revoked_at IS NULL AND tour_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_media_shares_one_active_tour_email
  ON media_shares (tour_id, lower(email))
  WHERE kind = 'email' AND revoked_at IS NULL AND tour_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_media_shares_one_active_model_link
  ON media_shares (model_id)
  WHERE kind = 'link' AND revoked_at IS NULL AND model_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_media_shares_one_active_model_email
  ON media_shares (model_id, lower(email))
  WHERE kind = 'email' AND revoked_at IS NULL AND model_id IS NOT NULL;

DROP TRIGGER IF EXISTS trg_media_shares_library_folder_same_business ON media_shares;
CREATE TRIGGER trg_media_shares_library_folder_same_business
  BEFORE INSERT OR UPDATE ON media_shares
  FOR EACH ROW EXECUTE FUNCTION enforce_same_business('library_folders', 'library_folder_id');

DROP TRIGGER IF EXISTS trg_media_shares_tour_same_business ON media_shares;
CREATE TRIGGER trg_media_shares_tour_same_business
  BEFORE INSERT OR UPDATE ON media_shares
  FOR EACH ROW EXECUTE FUNCTION enforce_same_business('tours', 'tour_id');

DROP TRIGGER IF EXISTS trg_media_shares_model_same_business ON media_shares;
CREATE TRIGGER trg_media_shares_model_same_business
  BEFORE INSERT OR UPDATE ON media_shares
  FOR EACH ROW EXECUTE FUNCTION enforce_same_business('project_3d_models', 'model_id');

-- Deleting a library folder ends every share of it before the FK nulls the column.
CREATE OR REPLACE FUNCTION revoke_media_shares_on_library_folder_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE media_shares
     SET revoked_at = now(),
         revoked_reason = 'folder_deleted'
   WHERE library_folder_id = OLD.id
     AND revoked_at IS NULL;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_library_folders_revoke_shares_on_delete ON library_folders;
CREATE TRIGGER trg_library_folders_revoke_shares_on_delete
  BEFORE DELETE ON library_folders
  FOR EACH ROW
  EXECUTE FUNCTION revoke_media_shares_on_library_folder_delete();

-- Moving a tour / 3D model to another project ends its item shares (mirrors v104 for photos).
CREATE OR REPLACE FUNCTION revoke_media_shares_on_link_item_move()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.project_id IS DISTINCT FROM NEW.project_id THEN
    IF TG_TABLE_NAME = 'tours' THEN
      UPDATE media_shares SET revoked_at = now(), revoked_reason = 'moved'
       WHERE tour_id = NEW.id AND revoked_at IS NULL;
    ELSE
      UPDATE media_shares SET revoked_at = now(), revoked_reason = 'moved'
       WHERE model_id = NEW.id AND revoked_at IS NULL;
    END IF;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_tours_revoke_shares_on_move ON tours;
CREATE TRIGGER trg_tours_revoke_shares_on_move
  AFTER UPDATE OF project_id ON tours
  FOR EACH ROW EXECUTE FUNCTION revoke_media_shares_on_link_item_move();

DROP TRIGGER IF EXISTS trg_project_3d_models_revoke_shares_on_move ON project_3d_models;
CREATE TRIGGER trg_project_3d_models_revoke_shares_on_move
  AFTER UPDATE OF project_id ON project_3d_models
  FOR EACH ROW EXECUTE FUNCTION revoke_media_shares_on_link_item_move();

REVOKE ALL ON FUNCTION revoke_media_shares_on_library_folder_delete() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION revoke_media_shares_on_link_item_move() FROM PUBLIC, anon, authenticated;

-- Activity types for project-attached item shares (videos, files, tours, 3D models).
ALTER TYPE activity_type ADD VALUE IF NOT EXISTS 'item_shared';
ALTER TYPE activity_type ADD VALUE IF NOT EXISTS 'item_share_revoked';
ALTER TYPE activity_type ADD VALUE IF NOT EXISTS 'item_share_link_enabled';
ALTER TYPE activity_type ADD VALUE IF NOT EXISTS 'item_share_link_disabled';
ALTER TYPE activity_type ADD VALUE IF NOT EXISTS 'item_share_link_rotated';
ALTER TYPE activity_type ADD VALUE IF NOT EXISTS 'item_share_updated';
