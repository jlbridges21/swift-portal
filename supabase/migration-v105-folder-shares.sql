-- Swift Portal V105 — folder sharing on media_shares
--
-- A share's subject is now either ONE photo (media_asset_id, v104) or ONE folder
-- (media_folder_id). Same tokens, hashing, expiry, link/email kinds and revocation.
--
-- Folder membership is evaluated at access time by the resolver, never stored:
-- photos added to the folder later are included, photos moved out or deleted are not.
-- project_id snapshots the folder's project so the v104 project-delete trigger
-- revokes folder shares too.
--
-- Fail closed on folder delete: a BEFORE DELETE trigger revokes the folder's shares
-- (reason 'folder_deleted') before the FK sets media_folder_id to NULL. The photos
-- move to General Photos and are no longer reachable through the folder share.
--
-- Safe to run before deploying the app: additive only; every existing row is a photo
-- share and satisfies the new subject check.

ALTER TABLE media_shares ALTER COLUMN media_asset_id DROP NOT NULL;

ALTER TABLE media_shares
  ADD COLUMN IF NOT EXISTS media_folder_id UUID REFERENCES media_folders(id) ON DELETE SET NULL;

ALTER TABLE media_shares DROP CONSTRAINT IF EXISTS media_shares_one_subject;
ALTER TABLE media_shares
  ADD CONSTRAINT media_shares_one_subject CHECK (
    num_nonnulls(media_asset_id, media_folder_id) = 1
    OR (revoked_at IS NOT NULL AND media_asset_id IS NULL)
  );

CREATE INDEX IF NOT EXISTS idx_media_shares_media_folder_id ON media_shares (media_folder_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_media_shares_one_active_folder_link
  ON media_shares (media_folder_id)
  WHERE kind = 'link' AND revoked_at IS NULL AND media_folder_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_media_shares_one_active_folder_email
  ON media_shares (media_folder_id, lower(email))
  WHERE kind = 'email' AND revoked_at IS NULL AND media_folder_id IS NOT NULL;

-- Tenant integrity (v30 pattern): the folder must belong to business_id.
DROP TRIGGER IF EXISTS trg_media_shares_media_folder_same_business ON media_shares;
CREATE TRIGGER trg_media_shares_media_folder_same_business
  BEFORE INSERT OR UPDATE ON media_shares
  FOR EACH ROW
  EXECUTE FUNCTION enforce_same_business('media_folders', 'media_folder_id');

CREATE OR REPLACE FUNCTION revoke_media_shares_on_folder_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE media_shares
     SET revoked_at = now(),
         revoked_reason = 'folder_deleted'
   WHERE media_folder_id = OLD.id
     AND revoked_at IS NULL;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_media_folders_revoke_shares_on_delete ON media_folders;
CREATE TRIGGER trg_media_folders_revoke_shares_on_delete
  BEFORE DELETE ON media_folders
  FOR EACH ROW
  EXECUTE FUNCTION revoke_media_shares_on_folder_delete();

REVOKE ALL ON FUNCTION revoke_media_shares_on_folder_delete() FROM PUBLIC, anon, authenticated;

ALTER TYPE activity_type ADD VALUE IF NOT EXISTS 'folder_shared';
ALTER TYPE activity_type ADD VALUE IF NOT EXISTS 'folder_share_revoked';
ALTER TYPE activity_type ADD VALUE IF NOT EXISTS 'folder_share_link_enabled';
ALTER TYPE activity_type ADD VALUE IF NOT EXISTS 'folder_share_link_disabled';
ALTER TYPE activity_type ADD VALUE IF NOT EXISTS 'folder_share_link_rotated';
ALTER TYPE activity_type ADD VALUE IF NOT EXISTS 'folder_share_updated';
