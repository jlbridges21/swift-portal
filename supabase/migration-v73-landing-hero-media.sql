-- ShootPortal V73 — Client landing hero media + overlay (JSON settings)
--
-- Landing hero fields live in business_settings.settings -> landing.hero JSON:
--   mediaType: 'showreel' | 'image' | 'none' | '' (empty = legacy inference)
--   heroImageUrl: https or same-origin path (isSafeBrandAssetUrl)
--   overlayColor: CSS color (isSafeCssColor); empty = legacy #0F172A gradient
--   overlayOpacity: 0–100 or null (null = legacy opacities)
--
-- No DDL — JSONB settings remain schemaless. Missing keys must keep existing
-- showreel businesses rendering identically (legacy path in resolveLandingPage).
--
-- Idempotent documentation marker for deploy ordering (next after v72).

DO $$
BEGIN
  -- No schema change required. Marker comment for migration inventory.
  RAISE NOTICE 'v73: landing hero mediaType/heroImageUrl/overlayColor/overlayOpacity (JSON only)';
END $$;
