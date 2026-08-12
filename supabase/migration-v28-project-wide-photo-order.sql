-- Swift Portal V28: project-wide photo display_order (folders are a filter, not a sort scope)

-- ---------------------------------------------------------------------------
-- 1. Reindex display_order to a single contiguous 0..n-1 per project
--    Preserve current visible grouping: folder_id nulls first, then order, then created_at
-- ---------------------------------------------------------------------------
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY project_id
      ORDER BY
        folder_id NULLS FIRST,
        display_order ASC NULLS LAST,
        created_at ASC NULLS LAST,
        id ASC
    ) - 1 AS new_order
  FROM media_assets
  WHERE project_id IS NOT NULL
    AND media_type = 'photo'
)
UPDATE media_assets m
SET display_order = ranked.new_order,
    updated_at = NOW()
FROM ranked
WHERE m.id = ranked.id
  AND m.display_order IS DISTINCT FROM ranked.new_order;

-- ---------------------------------------------------------------------------
-- 2. Replace reorder RPC — (project_id, ordered_ids) only; no folder_id
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS reorder_media_assets(UUID, UUID, UUID[]);

CREATE OR REPLACE FUNCTION reorder_media_assets(
  p_project_id UUID,
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

  SELECT COUNT(*) INTO matched_count
  FROM media_assets
  WHERE id = ANY (p_ordered_ids)
    AND project_id = p_project_id
    AND media_type = 'photo';

  IF matched_count <> id_count THEN
    RAISE EXCEPTION 'one or more media IDs do not belong to this project as photos';
  END IF;

  UPDATE media_assets m
  SET display_order = o.ord::INTEGER - 1,
      updated_at = NOW()
  FROM unnest(p_ordered_ids) WITH ORDINALITY AS o(id, ord)
  WHERE m.id = o.id
    AND m.project_id = p_project_id;
END;
$$;

REVOKE ALL ON FUNCTION reorder_media_assets(UUID, UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION reorder_media_assets(UUID, UUID[]) TO service_role;
GRANT EXECUTE ON FUNCTION reorder_media_assets(UUID, UUID[]) TO authenticated;
