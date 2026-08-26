-- ShootPortal V74 — Landing how-it-works step images (JSON settings)
--
-- Optional imageUrl on each landing.howItWorks[] step in business_settings.settings:
--   imageUrl: https or same-origin path (isSafeBrandAssetUrl); empty/missing → keep
--   default screenshot rotation on the public page (unchanged).
--
-- No DDL — JSONB settings remain schemaless. Missing keys must not throw.
-- Next unused number after v73 (v71 was already used twice historically).

DO $$
BEGIN
  RAISE NOTICE 'v74: landing.howItWorks[].imageUrl (JSON only)';
END $$;
