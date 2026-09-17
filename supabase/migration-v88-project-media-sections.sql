-- V88 — Per-project client media section visibility
-- Controls whether clients / shared viewers / anonymous link visitors see
-- Photo Gallery, Video, 360° Tours, and Documents. Admins always see all.
-- Defaults ON for existing and new rows (matches current behavior).
-- Business defaults for NEW projects live in business_settings JSON (app code).

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS client_section_photos BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS client_section_videos BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS client_section_tours BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS client_section_documents BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN projects.client_section_photos IS
  'When false, clients/shared/anonymous do not see Photo Gallery or download photos.';
COMMENT ON COLUMN projects.client_section_videos IS
  'When false, clients/shared/anonymous do not see Video section or download videos.';
COMMENT ON COLUMN projects.client_section_tours IS
  'When false, clients/shared/anonymous do not see 360° Virtual Tours.';
COMMENT ON COLUMN projects.client_section_documents IS
  'When false, clients/shared/anonymous do not see Documents or download documents.';

-- Existing projects: force all four ON (idempotent with DEFAULT, but explicit for clarity)
UPDATE projects SET
  client_section_photos = COALESCE(client_section_photos, true),
  client_section_videos = COALESCE(client_section_videos, true),
  client_section_tours = COALESCE(client_section_tours, true),
  client_section_documents = COALESCE(client_section_documents, true);
