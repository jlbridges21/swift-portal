-- ShootPortal V71 — Partner landing personal photo intrinsic dimensions
--
-- Stores natural width/height at upload time so the public page can size the
-- photo to the image's aspect ratio (no crop). Existing rows stay NULL and
-- fall back to object-contain letterboxing at render time.
-- Idempotent / re-runnable.

ALTER TABLE partner_landing_pages
  ADD COLUMN IF NOT EXISTS photo_width INTEGER,
  ADD COLUMN IF NOT EXISTS photo_height INTEGER;

COMMENT ON COLUMN partner_landing_pages.photo_width IS
  'Natural width (px) of photo_url after upload processing. NULL = unknown / legacy.';
COMMENT ON COLUMN partner_landing_pages.photo_height IS
  'Natural height (px) of photo_url after upload processing. NULL = unknown / legacy.';

ALTER TABLE partner_landing_pages DROP CONSTRAINT IF EXISTS partner_landing_pages_photo_dims;
ALTER TABLE partner_landing_pages
  ADD CONSTRAINT partner_landing_pages_photo_dims CHECK (
    (photo_width IS NULL AND photo_height IS NULL)
    OR (
      photo_width IS NOT NULL
      AND photo_height IS NOT NULL
      AND photo_width > 0
      AND photo_height > 0
      AND photo_width <= 10000
      AND photo_height <= 10000
    )
  );
