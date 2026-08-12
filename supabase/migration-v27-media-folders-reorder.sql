-- Swift Portal V27: photo folders, title consolidation, atomic media reorder

-- ---------------------------------------------------------------------------
-- 1. Title backfill — title is the single display/download label
-- ---------------------------------------------------------------------------
UPDATE media_assets
SET title = file_name
WHERE title IS NULL OR btrim(title) = '';

ALTER TABLE media_assets
  ALTER COLUMN title SET DEFAULT '';

-- Keep nullable for safety on older insert paths; app always writes title on create.

-- ---------------------------------------------------------------------------
-- 2. media_folders
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS media_folders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_media_folders_project_order
  ON media_folders (project_id, display_order);

ALTER TABLE media_folders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins full access media_folders" ON media_folders;
CREATE POLICY "Admins full access media_folders" ON media_folders
  FOR ALL USING (is_admin());

DROP POLICY IF EXISTS "Clients view own media_folders" ON media_folders;
CREATE POLICY "Clients view own media_folders" ON media_folders
  FOR SELECT USING (client_has_project_access(project_id));

-- ---------------------------------------------------------------------------
-- 3. folder_id on media_assets (NULL = unfiled)
-- ---------------------------------------------------------------------------
ALTER TABLE media_assets
  ADD COLUMN IF NOT EXISTS folder_id UUID REFERENCES media_folders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_media_assets_folder
  ON media_assets (project_id, folder_id, display_order);

-- Re-backfill display_order per (project_id, folder_id) so order stays stable
-- after folder scoping. Existing rows all have folder_id NULL.
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY project_id, folder_id
      ORDER BY display_order ASC NULLS LAST, created_at ASC NULLS LAST, id ASC
    ) - 1 AS new_order
  FROM media_assets
  WHERE project_id IS NOT NULL
)
UPDATE media_assets m
SET display_order = ranked.new_order
FROM ranked
WHERE m.id = ranked.id
  AND m.display_order IS DISTINCT FROM ranked.new_order;

-- ---------------------------------------------------------------------------
-- 4. Atomic reorder RPC for photos within a project folder (or unfiled)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION reorder_media_assets(
  p_project_id UUID,
  p_folder_id UUID,
  p_ordered_ids UUID[]
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  id_count INT;
  matched_count INT;
BEGIN
  IF p_project_id IS NULL THEN
    RAISE EXCEPTION 'project_id is required';
  END IF;

  id_count := COALESCE(array_length(p_ordered_ids, 1), 0);
  IF id_count = 0 THEN
    RETURN;
  END IF;

  IF p_folder_id IS NULL THEN
    SELECT COUNT(*) INTO matched_count
    FROM media_assets
    WHERE id = ANY (p_ordered_ids)
      AND project_id = p_project_id
      AND folder_id IS NULL;
  ELSE
    -- Folder must belong to the same project
    IF NOT EXISTS (
      SELECT 1 FROM media_folders
      WHERE id = p_folder_id AND project_id = p_project_id
    ) THEN
      RAISE EXCEPTION 'folder does not belong to project';
    END IF;

    SELECT COUNT(*) INTO matched_count
    FROM media_assets
    WHERE id = ANY (p_ordered_ids)
      AND project_id = p_project_id
      AND folder_id = p_folder_id;
  END IF;

  IF matched_count <> id_count THEN
    RAISE EXCEPTION 'one or more media IDs do not belong to this project/folder';
  END IF;

  UPDATE media_assets m
  SET display_order = o.ord::INTEGER - 1,
      updated_at = NOW()
  FROM unnest(p_ordered_ids) WITH ORDINALITY AS o(id, ord)
  WHERE m.id = o.id;
END;
$$;

REVOKE ALL ON FUNCTION reorder_media_assets(UUID, UUID, UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION reorder_media_assets(UUID, UUID, UUID[]) TO service_role;
GRANT EXECUTE ON FUNCTION reorder_media_assets(UUID, UUID, UUID[]) TO authenticated;
