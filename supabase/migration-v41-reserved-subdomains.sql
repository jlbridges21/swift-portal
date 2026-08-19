-- Swift Portal V41: reserved platform subdomains cannot be business slugs
-- Keep the ARRAY in sync with src/lib/reserved-subdomains.ts.
--
-- IDEMPOTENT: DROP TRIGGER / DROP FUNCTION IF EXISTS, ADD CONSTRAINT IF NOT EXISTS.

CREATE OR REPLACE FUNCTION reserved_platform_subdomains()
RETURNS text[]
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT ARRAY[
    'www',
    'api',
    'admin',
    'app',
    'mail',
    'smtp',
    'ftp',
    'cdn',
    'static',
    'assets',
    'status',
    'help',
    'support',
    'docs',
    'blog',
    'platform',
    'dashboard'
  ]::text[];
$$;

-- Fail the migration if a live row already occupies a reserved label.
DO $$
DECLARE
  v_bad text;
BEGIN
  SELECT string_agg(slug, ', ' ORDER BY slug)
    INTO v_bad
  FROM businesses
  WHERE lower(slug) = ANY (reserved_platform_subdomains());

  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION
      'Reserved subdomain slug(s) already in use and cannot be constrained: %',
      v_bad;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION enforce_business_slug_not_reserved()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.slug IS NULL OR btrim(NEW.slug) = '' THEN
    RAISE EXCEPTION 'A business slug is required.';
  END IF;
  NEW.slug := lower(btrim(NEW.slug));
  IF lower(NEW.slug) = ANY (reserved_platform_subdomains()) THEN
    RAISE EXCEPTION
      'This slug is reserved for the ShootPortal platform and cannot be used as a business subdomain (%)',
      NEW.slug;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS businesses_slug_not_reserved ON businesses;
CREATE TRIGGER businesses_slug_not_reserved
  BEFORE INSERT OR UPDATE OF slug ON businesses
  FOR EACH ROW
  EXECUTE FUNCTION enforce_business_slug_not_reserved();

ALTER TABLE businesses DROP CONSTRAINT IF EXISTS businesses_slug_not_reserved_chk;
ALTER TABLE businesses
  ADD CONSTRAINT businesses_slug_not_reserved_chk
  CHECK (lower(slug) <> ALL (reserved_platform_subdomains()));
