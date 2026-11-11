-- V122 — Client photo favorites (hearts) + spreadsheet documents
--
-- 1. client_photo_favorites  one row per (client, photo) a client hearted in their portal.
--    Separate from media_assets.is_favorite, which stays the business's own Media Library star.
--    Keyed by media_asset_id, so renaming, reordering or moving a photo between folders keeps
--    its likes; deleting the photo (or the client) removes them (ON DELETE CASCADE).
--    Read and written only by server code with the service role (RLS on, no policies).
-- 2. project-documents bucket also accepts Excel and CSV files (additive; nothing removed).
--
-- Additive only. Until this runs, the heart controls stay hidden and the business view shows
-- no client favorites — nothing else changes.
--
-- HOW TO RUN: SQL Editor → paste → Run. Re-runnable.
-- Rollback: DROP TABLE client_photo_favorites;

CREATE TABLE IF NOT EXISTS client_photo_favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  media_asset_id UUID NOT NULL REFERENCES media_assets(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,   -- who clicked (audit)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (media_asset_id, client_id)
);

CREATE INDEX IF NOT EXISTS idx_client_photo_favorites_project
  ON client_photo_favorites (business_id, project_id);
CREATE INDEX IF NOT EXISTS idx_client_photo_favorites_client
  ON client_photo_favorites (client_id, project_id);

ALTER TABLE client_photo_favorites ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON client_photo_favorites FROM anon, authenticated;

UPDATE storage.buckets
SET allowed_mime_types = (
  SELECT array_agg(DISTINCT t)
  FROM unnest(
    allowed_mime_types || ARRAY[
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv'
    ]
  ) AS t
)
WHERE id = 'project-documents' AND allowed_mime_types IS NOT NULL;
