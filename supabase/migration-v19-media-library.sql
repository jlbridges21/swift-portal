-- Allow media assets without a project (global / unassigned library uploads)
ALTER TABLE media_assets ALTER COLUMN project_id DROP NOT NULL;

-- Backfill empty file_path from storage_path where available
UPDATE media_assets
SET file_path = storage_path
WHERE (file_path IS NULL OR btrim(file_path) = '')
  AND storage_path IS NOT NULL
  AND btrim(storage_path) <> '';

-- Assign unique legacy paths for any rows still missing file_path
UPDATE media_assets
SET file_path = 'legacy/migrated/' || id::text,
    storage_path = COALESCE(NULLIF(storage_path, ''), 'legacy/migrated/' || id::text)
WHERE file_path IS NULL OR btrim(file_path) = '';

-- Resolve duplicate file_path values (keep oldest row per path; suffix others)
WITH ranked AS (
  SELECT
    id,
    file_path,
    ROW_NUMBER() OVER (
      PARTITION BY file_path
      ORDER BY created_at ASC NULLS LAST, id ASC
    ) AS rn
  FROM media_assets
  WHERE file_path IS NOT NULL AND btrim(file_path) <> ''
)
UPDATE media_assets AS m
SET
  file_path = m.file_path || '/legacy-' || m.id::text,
  storage_path = CASE
    WHEN m.storage_path IS NULL OR m.storage_path = m.file_path THEN m.file_path || '/legacy-' || m.id::text
    ELSE m.storage_path
  END
FROM ranked AS r
WHERE m.id = r.id
  AND r.rn > 1;

-- Idempotent saves by storage path (safe after cleanup above)
DROP INDEX IF EXISTS idx_media_assets_file_path_unique;
CREATE UNIQUE INDEX idx_media_assets_file_path_unique ON media_assets (file_path);

-- Fast lookup for unassigned media
CREATE INDEX IF NOT EXISTS idx_media_assets_unassigned ON media_assets (created_at DESC) WHERE project_id IS NULL;
