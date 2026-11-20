-- ShootPortal V135 — "Can upload" access for shared Media Library folders
--
-- A business can share a Media Library folder (v126) with a collaborator — another drone pilot or
-- photographer — who uploads their own files into it without an account, a password, or a staff
-- seat. Same tokens / hashing / expiry / revocation as every other media share.
--
-- 1. media_shares.allow_upload            The share may add files to its folder. Library-folder shares
--                                         only (CHECK). Upload access always includes viewing; the app
--                                         also turns on downloads for it (like an editor in Drive).
-- 2. library_folder_items.added_via_share_id
--                                         Which share uploaded an item (attribution in the portal; the
--                                         uploader has no profile). SET NULL keeps the item if the share
--                                         row is ever removed.
--
-- Uploaded files become ordinary unassigned Media Library assets (project_id NULL) owned by the
-- business: turning the share off or deleting the folder never deletes them.
--
-- Additive only. The app runs without this migration: "Can upload" is hidden from the share dialog
-- and guest uploads are refused until it is applied.
--
-- HOW TO RUN: Supabase SQL Editor → paste → Run. Re-runnable.
-- Rollback:
--   ALTER TABLE library_folder_items DROP COLUMN added_via_share_id;
--   ALTER TABLE media_shares DROP CONSTRAINT media_shares_upload_library_folder_only;
--   ALTER TABLE media_shares DROP COLUMN allow_upload;

ALTER TABLE media_shares
  ADD COLUMN IF NOT EXISTS allow_upload BOOLEAN NOT NULL DEFAULT false;

-- Only folder shares can receive uploads (photos, project folders and single items never can).
-- A revoked folder share loses its subject when the folder is deleted, so allow that too.
ALTER TABLE media_shares DROP CONSTRAINT IF EXISTS media_shares_upload_library_folder_only;
ALTER TABLE media_shares
  ADD CONSTRAINT media_shares_upload_library_folder_only CHECK (
    allow_upload = false
    OR library_folder_id IS NOT NULL
    OR revoked_at IS NOT NULL
  );

ALTER TABLE library_folder_items
  ADD COLUMN IF NOT EXISTS added_via_share_id UUID REFERENCES media_shares(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_library_folder_items_added_via_share
  ON library_folder_items (added_via_share_id) WHERE added_via_share_id IS NOT NULL;
