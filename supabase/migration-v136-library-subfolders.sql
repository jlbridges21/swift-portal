-- ShootPortal V136 — Subfolders in the Media Library
--
-- Any Media Library folder (v126) can hold folders, nested as deep as needed (guarded at 32
-- levels so a bad write can never loop).
--
-- 1. library_folders.parent_id   NULL = top-level. Deleting a folder deletes its subfolders
--                                (CASCADE) — membership rows only; media is never deleted. Each
--                                deleted subfolder's own shares are revoked by the v126
--                                BEFORE DELETE trigger, which fires for cascaded rows too.
-- 2. Names are unique among siblings (same parent), case-insensitive — "Raw" can exist inside
--    several folders. Replaces the v126 business-wide unique index.
-- 3. Guards: the parent must belong to the same business; a folder can't be moved inside itself
--    or one of its own subfolders.
-- 4. library_folders.created_via_share_id
--                                Folders made by a guest through a "Can upload" share (v135) —
--                                attribution only; the guest has no profile. SET NULL keeps the
--                                folder if the share row is ever removed.
--
-- Sharing: a folder share grants the folder and everything beneath it, evaluated live (the app
-- walks the tree on each request). Subfolders added later are included automatically.
--
-- Additive only. The app runs without this migration: every folder is treated as top-level and
-- "New subfolder" is hidden.
--
-- HOW TO RUN: Supabase SQL Editor → paste → Run. Re-runnable.
-- Rollback (only once no folder has a parent):
--   ALTER TABLE library_folders DROP COLUMN created_via_share_id;
--   DROP TRIGGER trg_library_folders_guard_parent ON library_folders;
--   DROP TRIGGER trg_library_folders_parent_same_business ON library_folders;
--   DROP FUNCTION library_folders_guard_parent();
--   DROP INDEX idx_library_folders_sibling_name;
--   CREATE UNIQUE INDEX idx_library_folders_business_name ON library_folders (business_id, lower(btrim(name)));
--   ALTER TABLE library_folders DROP COLUMN parent_id;

ALTER TABLE library_folders
  ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES library_folders(id) ON DELETE CASCADE;

ALTER TABLE library_folders
  ADD COLUMN IF NOT EXISTS created_via_share_id UUID REFERENCES media_shares(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_library_folders_parent
  ON library_folders (parent_id) WHERE parent_id IS NOT NULL;

-- Unique per (business, parent, name). COALESCE folds every top-level folder into one group.
CREATE UNIQUE INDEX IF NOT EXISTS idx_library_folders_sibling_name
  ON library_folders (
    business_id,
    COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'::uuid),
    lower(btrim(name))
  );
DROP INDEX IF EXISTS idx_library_folders_business_name;

DROP TRIGGER IF EXISTS trg_library_folders_parent_same_business ON library_folders;
CREATE TRIGGER trg_library_folders_parent_same_business
  BEFORE INSERT OR UPDATE ON library_folders
  FOR EACH ROW
  EXECUTE FUNCTION enforce_same_business('library_folders', 'parent_id');

CREATE OR REPLACE FUNCTION library_folders_guard_parent()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  cur UUID := NEW.parent_id;
  depth INT := 0;
BEGIN
  WHILE cur IS NOT NULL LOOP
    IF cur = NEW.id THEN
      RAISE EXCEPTION 'A folder can''t be placed inside itself or one of its subfolders.'
        USING ERRCODE = '23514';
    END IF;
    depth := depth + 1;
    IF depth > 32 THEN
      RAISE EXCEPTION 'Folders can be nested up to 32 levels deep.'
        USING ERRCODE = '23514';
    END IF;
    SELECT parent_id INTO cur FROM library_folders WHERE id = cur;
  END LOOP;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION library_folders_guard_parent() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_library_folders_guard_parent ON library_folders;
CREATE TRIGGER trg_library_folders_guard_parent
  BEFORE INSERT OR UPDATE OF parent_id ON library_folders
  FOR EACH ROW
  EXECUTE FUNCTION library_folders_guard_parent();
