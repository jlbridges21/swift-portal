-- V115 — Per-project storage usage for admin project cards
-- One aggregated read for a whole board of cards: the bytes each project's media
-- occupies, computed live at query time (nothing stored, so it never goes stale
-- as files are uploaded or deleted).
--
--   bytes  = SUM(media_assets.file_size)                — originals (falls back to the
--                                                        storage object's size when a
--                                                        row has no file_size)
--          + size of each stored thumbnail object        — thumbnail_url in project-media
--
-- Additive only. The app works without it: src/lib/project-storage.ts falls back to
-- summing media_assets.file_size (originals only, no thumbnails).
-- Rollback: DROP FUNCTION project_storage_usage(UUID, UUID[]);

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
  WHERE ma.business_id = p_business_id
    AND ma.project_id = ANY (p_project_ids)
  GROUP BY ma.project_id;
$$;

REVOKE ALL ON FUNCTION project_storage_usage(UUID, UUID[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION project_storage_usage(UUID, UUID[]) TO service_role;
