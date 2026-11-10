-- ShootPortal V119 — Business Website Address (www.yourstudio.com)
--
-- businesses.website_domain*   Primary Business Website domain (e.g. www.yourstudio.com). Mirrors the
--                              existing custom_domain* (client portal) and listing_domain* (property
--                              websites, v118) columns and is managed by the same code path
--                              (lib/custom-domain.ts, kind = "website"). Portal and listing columns are
--                              NOT modified.
-- businesses.website_apex_redirect  Optional bare domain (yourstudio.com) registered with Vercel as a
--                              redirect to the www host. NULL when not used.
--
-- Business Website settings and the public portfolio live in business_settings.settings (JSON keys
-- "website" and "portfolio") and need no schema change.
--
-- Additive only. The app runs without this migration: Settings → Use Your Own Web Address shows a
-- setup notice for the Business Website Address and the website keeps working on the ShootPortal
-- address and the client portal domain.
-- Rollback:
--   ALTER TABLE businesses DROP COLUMN website_domain, DROP COLUMN website_domain_status,
--     DROP COLUMN website_domain_vercel_verified, DROP COLUMN website_domain_misconfigured,
--     DROP COLUMN website_domain_last_checked_at, DROP COLUMN website_domain_error,
--     DROP COLUMN website_domain_verification, DROP COLUMN website_apex_redirect;
--   (then re-run the v118 enforce_domain_kinds_distinct() definition)

ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS website_domain TEXT,
  ADD COLUMN IF NOT EXISTS website_domain_status TEXT,
  ADD COLUMN IF NOT EXISTS website_domain_vercel_verified BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS website_domain_misconfigured BOOLEAN,
  ADD COLUMN IF NOT EXISTS website_domain_last_checked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS website_domain_error TEXT,
  ADD COLUMN IF NOT EXISTS website_domain_verification JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS website_apex_redirect TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_businesses_website_domain
  ON businesses (website_domain) WHERE website_domain IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_businesses_website_apex_redirect
  ON businesses (website_apex_redirect) WHERE website_apex_redirect IS NOT NULL;

COMMENT ON COLUMN businesses.website_domain IS
  'Hostname for the public Business Website (e.g. www.yourstudio.com). Separate from custom_domain (client portal) and listing_domain (property websites).';

-- A hostname belongs to exactly one kind (portal / property website / business website / apex
-- redirect) for exactly one business. Replaces the v118 two-kind version of this function.
CREATE OR REPLACE FUNCTION enforce_domain_kinds_distinct()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  names TEXT[];
BEGIN
  names := ARRAY[NEW.custom_domain, NEW.listing_domain, NEW.website_domain, NEW.website_apex_redirect];
  -- Within this business: no hostname used twice.
  IF (SELECT count(*) FROM unnest(names) n WHERE n IS NOT NULL)
     <> (SELECT count(DISTINCT n) FROM unnest(names) n WHERE n IS NOT NULL) THEN
    RAISE EXCEPTION 'Each web address must be different (portal, property websites and business website).' USING ERRCODE = '23505';
  END IF;
  -- Across businesses: no hostname claimed in any column by anyone else.
  IF EXISTS (
    SELECT 1 FROM businesses b
     WHERE b.id <> NEW.id
       AND (
         b.custom_domain = ANY(names) OR b.listing_domain = ANY(names)
         OR b.website_domain = ANY(names) OR b.website_apex_redirect = ANY(names)
       )
  ) THEN
    RAISE EXCEPTION 'That hostname is already connected to another business.' USING ERRCODE = '23505';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_businesses_domain_kinds_distinct ON businesses;
CREATE TRIGGER trg_businesses_domain_kinds_distinct
  BEFORE INSERT OR UPDATE OF custom_domain, listing_domain, website_domain, website_apex_redirect ON businesses
  FOR EACH ROW
  EXECUTE FUNCTION enforce_domain_kinds_distinct();
