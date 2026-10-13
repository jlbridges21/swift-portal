-- Shared US ZIP centroid table for travel fees, plus the one-way miles
-- stored on a quote so the business can trace the figure later.
--
-- zip_codes is platform reference data. It has no business_id on purpose.
-- Every tenant may read it. Do not add business_id to satisfy tenant-lint;
-- scripts/tenant-lint.ts lists it in SHARED_REFERENCE_TABLES.
--
-- Source (public domain, US Census Bureau 2026 Gazetteer, ZCTA national file):
--   https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2026_Gazetteer/2026_Gaz_zcta_national.zip
-- Confirmed on the Census directory listing for 2026_Gazetteer (file dated 2026-09-08).
-- The gazetteer columns are GEOID, GEOIDFQ, area, and INTPTLAT / INTPTLONG.
-- It does not include city or state, so those columns stay empty.
-- ZCTAs approximate ZIP areas. PO Box-only ZIPs have no ZCTA and are absent.
-- Those lookups fail open.
--
-- Seeding is not in this file (~33,000 rows). The committed table is
-- data/us-zcta-centroids-2026.csv. Load it with:
--   npx tsx --env-file=.env.local scripts/seed-zip-centroids.ts
-- The script upserts on zip, so running it again does not insert duplicates.

CREATE TABLE IF NOT EXISTS public.zip_codes (
  zip text PRIMARY KEY,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  city text NOT NULL DEFAULT '',
  state text NOT NULL DEFAULT ''
);

COMMENT ON TABLE public.zip_codes IS
  'Shared platform reference data: US Census ZCTA centroids. No business_id. Readable by every tenant. PO Box-only ZIPs are absent.';

ALTER TABLE public.zip_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS zip_codes_select ON public.zip_codes;
CREATE POLICY zip_codes_select
  ON public.zip_codes
  FOR SELECT
  TO authenticated
  USING (true);

GRANT SELECT ON public.zip_codes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.zip_codes TO service_role;

ALTER TABLE public.project_quotes
  ADD COLUMN IF NOT EXISTS travel_one_way_miles double precision;

COMMENT ON COLUMN public.project_quotes.travel_one_way_miles IS
  'One-way straight-line miles used to price the travel fee. For the business to trace later. Do not show this to clients.';

-- A travel lookup that fails open is recorded with logWorkflowSkipped.
-- Clients never see this type (CLIENT_HIDDEN_ACTIVITY_TYPES).
ALTER TYPE activity_type ADD VALUE IF NOT EXISTS 'workflow_automation';
