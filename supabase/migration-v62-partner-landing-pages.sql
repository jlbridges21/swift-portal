-- ShootPortal V62 — Partner Program phase 6: custom partner landing pages
--
-- partner_landing_pages: PLATFORM-scoped (partner_id, no business_id).
-- Small field set rendered into the marketing template — NOT a page builder.
-- Slugs validated in app against RESERVED_APP_ROUTE_SLUGS (never shadow /pricing etc.).
--
-- Also: partner_program_default_commission_rate_pct() reads partners.commission_rate_pct
-- column DEFAULT so /partners marketing copy stays DB-driven.
--
-- Idempotent / re-runnable.

-- ---------------------------------------------------------------------------
-- 1. Default commission rate helper (reads column DEFAULT)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION partner_program_default_commission_rate_pct()
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  def text;
  matched text;
  n numeric;
BEGIN
  SELECT c.column_default INTO def
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = 'partners'
    AND c.column_name = 'commission_rate_pct';

  IF def IS NULL OR btrim(def) = '' THEN
    RETURN 30;
  END IF;

  matched := (regexp_match(def, '([0-9]+(?:\.[0-9]+)?)'))[1];
  IF matched IS NULL THEN
    RETURN 30;
  END IF;

  n := matched::numeric;
  IF n < 0 OR n > 100 THEN
    RETURN 30;
  END IF;
  RETURN n;
END;
$$;

COMMENT ON FUNCTION partner_program_default_commission_rate_pct() IS
  'Returns partners.commission_rate_pct column DEFAULT (program advertised rate). Used by /partners marketing.';

REVOKE ALL ON FUNCTION partner_program_default_commission_rate_pct() FROM PUBLIC;
REVOKE ALL ON FUNCTION partner_program_default_commission_rate_pct() FROM anon;
REVOKE ALL ON FUNCTION partner_program_default_commission_rate_pct() FROM authenticated;
GRANT EXECUTE ON FUNCTION partner_program_default_commission_rate_pct() TO service_role;

-- ---------------------------------------------------------------------------
-- 2. partner_landing_pages
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS partner_landing_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES partners (id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  headline TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  photo_url TEXT,
  cta_label TEXT NOT NULL DEFAULT 'Start free trial',
  offer_text TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT partner_landing_pages_slug_unique UNIQUE (slug),
  CONSTRAINT partner_landing_pages_slug_format CHECK (
    slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
    AND char_length(slug) BETWEEN 2 AND 48
  ),
  CONSTRAINT partner_landing_pages_headline_len CHECK (char_length(headline) BETWEEN 1 AND 200),
  CONSTRAINT partner_landing_pages_description_len CHECK (char_length(description) <= 2000),
  CONSTRAINT partner_landing_pages_cta_len CHECK (char_length(cta_label) BETWEEN 1 AND 80),
  CONSTRAINT partner_landing_pages_offer_len CHECK (
    offer_text IS NULL OR char_length(offer_text) <= 500
  )
);

COMMENT ON TABLE partner_landing_pages IS
  'PLATFORM-SCOPED: custom partner marketing landings at /{slug} on apex only. No business_id. No HTML — plain text fields.';

CREATE UNIQUE INDEX IF NOT EXISTS partner_landing_pages_one_per_partner
  ON partner_landing_pages (partner_id);

CREATE INDEX IF NOT EXISTS idx_partner_landing_pages_active_slug
  ON partner_landing_pages (slug)
  WHERE is_active = true;

DROP TRIGGER IF EXISTS partner_landing_pages_updated_at ON partner_landing_pages;
CREATE TRIGGER partner_landing_pages_updated_at
  BEFORE UPDATE ON partner_landing_pages
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

ALTER TABLE partner_landing_pages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admins manage partner landing pages" ON partner_landing_pages;
CREATE POLICY "Super admins manage partner landing pages"
  ON partner_landing_pages
  FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- Public read of active landings is via service role in the app (apex host gate).
REVOKE ALL ON partner_landing_pages FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON partner_landing_pages FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON partner_landing_pages TO service_role;
GRANT SELECT ON partner_landing_pages TO authenticated;
