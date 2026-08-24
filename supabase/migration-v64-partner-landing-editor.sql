-- ShootPortal V64 — Partner landing page editor (partner-facing + extended fields)
--
-- Empty stored fields resolve at render time from partner/program data.
-- slug and is_active remain super-admin controlled.
-- Idempotent / re-runnable.

ALTER TABLE partner_landing_pages
  ADD COLUMN IF NOT EXISTS logo_url TEXT,
  ADD COLUMN IF NOT EXISTS brand_primary_color TEXT,
  ADD COLUMN IF NOT EXISTS brand_accent_color TEXT,
  ADD COLUMN IF NOT EXISTS subheadline TEXT,
  ADD COLUMN IF NOT EXISTS benefits JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS testimonial_quote TEXT,
  ADD COLUMN IF NOT EXISTS testimonial_attribution TEXT,
  ADD COLUMN IF NOT EXISTS show_offer BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES auth.users (id) ON DELETE SET NULL;

COMMENT ON COLUMN partner_landing_pages.logo_url IS
  'Partner brand mark (https). Distinct from photo_url (personal headshot).';
COMMENT ON COLUMN partner_landing_pages.benefits IS
  'Plain-text bullet strings (max 5). Empty array → render-time defaults.';
COMMENT ON COLUMN partner_landing_pages.show_offer IS
  'When true and referral discount is active, offer block shows generated discount copy.';

-- Allow empty headline — defaults applied at render time.
ALTER TABLE partner_landing_pages DROP CONSTRAINT IF EXISTS partner_landing_pages_headline_len;
ALTER TABLE partner_landing_pages ALTER COLUMN headline SET DEFAULT '';
ALTER TABLE partner_landing_pages
  ADD CONSTRAINT partner_landing_pages_headline_len CHECK (char_length(headline) <= 200);

ALTER TABLE partner_landing_pages DROP CONSTRAINT IF EXISTS partner_landing_pages_subheadline_len;
ALTER TABLE partner_landing_pages
  ADD CONSTRAINT partner_landing_pages_subheadline_len CHECK (
    subheadline IS NULL OR char_length(subheadline) <= 280
  );

ALTER TABLE partner_landing_pages DROP CONSTRAINT IF EXISTS partner_landing_pages_testimonial_quote_len;
ALTER TABLE partner_landing_pages
  ADD CONSTRAINT partner_landing_pages_testimonial_quote_len CHECK (
    testimonial_quote IS NULL OR char_length(testimonial_quote) <= 500
  );

ALTER TABLE partner_landing_pages DROP CONSTRAINT IF EXISTS partner_landing_pages_testimonial_attr_len;
ALTER TABLE partner_landing_pages
  ADD CONSTRAINT partner_landing_pages_testimonial_attr_len CHECK (
    testimonial_attribution IS NULL OR char_length(testimonial_attribution) <= 120
  );

ALTER TABLE partner_landing_pages DROP CONSTRAINT IF EXISTS partner_landing_pages_brand_color_len;
ALTER TABLE partner_landing_pages
  ADD CONSTRAINT partner_landing_pages_brand_color_len CHECK (
    (brand_primary_color IS NULL OR char_length(brand_primary_color) <= 32)
    AND (brand_accent_color IS NULL OR char_length(brand_accent_color) <= 32)
  );

-- Empty stored values resolve at render time (same as headline).
ALTER TABLE partner_landing_pages DROP CONSTRAINT IF EXISTS partner_landing_pages_cta_len;
ALTER TABLE partner_landing_pages ALTER COLUMN cta_label SET DEFAULT '';
ALTER TABLE partner_landing_pages
  ADD CONSTRAINT partner_landing_pages_cta_len CHECK (char_length(cta_label) <= 80);
