-- ShootPortal V118 — Marketing Kit: Property Website Generator + Social Media Marketing Kit
--
-- Tables
--   marketing_kits             One row per project. Holds the shared marketing information
--                              (property facts, agent, branding, media picks, website + social
--                              design choices) as a DRAFT, plus the PUBLISHED snapshot that the
--                              public property website renders. Editing the draft never changes
--                              the public site until someone publishes.
--   marketing_kit_purchases    Who has access to which product (website / social) on a project:
--                              paid through an existing `payments` row, included by the business,
--                              or comped. Later price changes never touch these rows.
--   marketing_brand_profiles   Saved realtor branding per client (logo, headshot, brokerage,
--                              colors, preferred template) reused on that client's next listing.
--
-- businesses.listing_domain*   Property Website Address (e.g. listings.yourstudio.com). Mirrors
--                              the existing custom_domain* columns used for the client portal
--                              address and is managed by the same code path (lib/custom-domain.ts,
--                              kind = "listing"). The portal columns are NOT modified.
--
-- Additive only. The app runs without this migration: the Marketing Kit shows a setup notice,
-- the listing-domain section explains it is unavailable, and nothing else changes.
-- Rollback:
--   DROP TABLE marketing_kit_purchases, marketing_brand_profiles, marketing_kits;
--   ALTER TABLE businesses DROP COLUMN listing_domain, DROP COLUMN listing_domain_status,
--     DROP COLUMN listing_domain_vercel_verified, DROP COLUMN listing_domain_misconfigured,
--     DROP COLUMN listing_domain_last_checked_at, DROP COLUMN listing_domain_error,
--     DROP COLUMN listing_domain_verification;

-- ---------------------------------------------------------------------------
-- Listing domain (Property Website Address)
-- ---------------------------------------------------------------------------

ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS listing_domain TEXT,
  ADD COLUMN IF NOT EXISTS listing_domain_status TEXT,
  ADD COLUMN IF NOT EXISTS listing_domain_vercel_verified BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS listing_domain_misconfigured BOOLEAN,
  ADD COLUMN IF NOT EXISTS listing_domain_last_checked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS listing_domain_error TEXT,
  ADD COLUMN IF NOT EXISTS listing_domain_verification JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS idx_businesses_listing_domain
  ON businesses (listing_domain) WHERE listing_domain IS NOT NULL;

COMMENT ON COLUMN businesses.listing_domain IS
  'Hostname for public property websites (e.g. listings.yourstudio.com). Separate from custom_domain (client portal).';

-- A hostname can be a portal address or a listing address, never both (any business).
CREATE OR REPLACE FUNCTION enforce_domain_kinds_distinct()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.listing_domain IS NOT NULL AND EXISTS (
    SELECT 1 FROM businesses WHERE custom_domain = NEW.listing_domain
  ) THEN
    RAISE EXCEPTION 'That hostname is already used as a client portal address.' USING ERRCODE = '23505';
  END IF;
  IF NEW.custom_domain IS NOT NULL AND EXISTS (
    SELECT 1 FROM businesses WHERE listing_domain = NEW.custom_domain AND id <> NEW.id
  ) THEN
    RAISE EXCEPTION 'That hostname is already used as a property website address.' USING ERRCODE = '23505';
  END IF;
  IF NEW.custom_domain IS NOT NULL AND NEW.custom_domain = NEW.listing_domain THEN
    RAISE EXCEPTION 'The portal and property website addresses must be different.' USING ERRCODE = '23505';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_businesses_domain_kinds_distinct ON businesses;
CREATE TRIGGER trg_businesses_domain_kinds_distinct
  BEFORE INSERT OR UPDATE OF custom_domain, listing_domain ON businesses
  FOR EACH ROW
  EXECUTE FUNCTION enforce_domain_kinds_distinct();

-- ---------------------------------------------------------------------------
-- marketing_kits
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS marketing_kits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  -- Draft: only the fields someone changed. Everything else is derived live from the
  -- project (address, approved media, hero image, client branding) so drafts stay in sync.
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Fully resolved snapshot rendered by the public website. NULL until first publish.
  published_content JSONB,
  -- URL path segment: listings.yourstudio.com/{site_slug}. Unique per business, stable once
  -- published (address edits never change a live URL).
  site_slug TEXT NOT NULL CHECK (site_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND char_length(site_slug) <= 80),
  website_status TEXT NOT NULL DEFAULT 'draft'
    CHECK (website_status IN ('draft', 'published', 'unpublished')),
  published_at TIMESTAMPTZ,
  published_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  unpublished_at TIMESTAMPTZ,
  -- Per-project offer overrides: {"website": {"mode": "included"|"paid"|"unavailable", "priceCents": 4900}, "social": {...}}
  -- Absent key = use the business default (Settings → Marketing Kit).
  offer_overrides JSONB NOT NULL DEFAULT '{}'::jsonb,
  draft_updated_at TIMESTAMPTZ,
  draft_updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  view_count BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_marketing_kits_project ON marketing_kits (project_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_marketing_kits_business_slug ON marketing_kits (business_id, site_slug);
CREATE INDEX IF NOT EXISTS idx_marketing_kits_business_published
  ON marketing_kits (business_id) WHERE website_status = 'published';

DROP TRIGGER IF EXISTS trg_marketing_kits_project_same_business ON marketing_kits;
CREATE TRIGGER trg_marketing_kits_project_same_business
  BEFORE INSERT OR UPDATE ON marketing_kits
  FOR EACH ROW
  EXECUTE FUNCTION enforce_same_business('projects', 'project_id');

-- Fail closed: hiding (soft-deleting) a project takes its website offline.
CREATE OR REPLACE FUNCTION unpublish_marketing_kit_on_project_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
    UPDATE marketing_kits
       SET website_status = 'unpublished',
           unpublished_at = now(),
           updated_at = now()
     WHERE project_id = NEW.id
       AND website_status = 'published';
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_projects_unpublish_marketing_kit ON projects;
CREATE TRIGGER trg_projects_unpublish_marketing_kit
  AFTER UPDATE OF deleted_at ON projects
  FOR EACH ROW
  EXECUTE FUNCTION unpublish_marketing_kit_on_project_delete();

-- ---------------------------------------------------------------------------
-- marketing_kit_purchases
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS marketing_kit_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  product TEXT NOT NULL CHECK (product IN ('website', 'social')),
  -- pending   : a payments row exists but is not paid yet (no access)
  -- paid      : the linked payment is paid (access)
  -- comped    : the business explicitly granted access without payment (access)
  -- refunded / disputed / cancelled : no access
  status TEXT NOT NULL CHECK (status IN ('pending', 'paid', 'comped', 'refunded', 'disputed', 'cancelled')),
  -- Price snapshot at purchase time (cents). Never recomputed.
  amount_cents INTEGER NOT NULL DEFAULT 0 CHECK (amount_cents >= 0),
  payment_id UUID REFERENCES payments(id) ON DELETE SET NULL,
  purchase_method TEXT CHECK (purchase_method IN ('pay_now', 'add_to_invoice', 'business')),
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  granted_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  revoked_reason TEXT CHECK (char_length(revoked_reason) <= 120),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- At most one granting row and one open (pending) row per project + product.
CREATE UNIQUE INDEX IF NOT EXISTS idx_marketing_purchases_one_granted
  ON marketing_kit_purchases (project_id, product) WHERE status IN ('paid', 'comped');
CREATE UNIQUE INDEX IF NOT EXISTS idx_marketing_purchases_one_pending
  ON marketing_kit_purchases (project_id, product) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_marketing_purchases_payment ON marketing_kit_purchases (payment_id);
CREATE INDEX IF NOT EXISTS idx_marketing_purchases_business ON marketing_kit_purchases (business_id);

DROP TRIGGER IF EXISTS trg_marketing_purchases_project_same_business ON marketing_kit_purchases;
CREATE TRIGGER trg_marketing_purchases_project_same_business
  BEFORE INSERT OR UPDATE ON marketing_kit_purchases
  FOR EACH ROW
  EXECUTE FUNCTION enforce_same_business('projects', 'project_id');

DROP TRIGGER IF EXISTS trg_marketing_purchases_payment_same_business ON marketing_kit_purchases;
CREATE TRIGGER trg_marketing_purchases_payment_same_business
  BEFORE INSERT OR UPDATE ON marketing_kit_purchases
  FOR EACH ROW
  EXECUTE FUNCTION enforce_same_business('payments', 'payment_id');

-- ---------------------------------------------------------------------------
-- marketing_brand_profiles (per realtor client)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS marketing_brand_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  profile JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_marketing_brand_profiles_client ON marketing_brand_profiles (client_id);

DROP TRIGGER IF EXISTS trg_marketing_brand_profiles_client_same_business ON marketing_brand_profiles;
CREATE TRIGGER trg_marketing_brand_profiles_client_same_business
  BEFORE INSERT OR UPDATE ON marketing_brand_profiles
  FOR EACH ROW
  EXECUTE FUNCTION enforce_same_business('clients', 'client_id');

-- ---------------------------------------------------------------------------
-- RLS: server-only tables. All access goes through the service role with an explicit
-- business_id (tenant client); browsers never read these directly.
-- ---------------------------------------------------------------------------

ALTER TABLE marketing_kits ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_kit_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_brand_profiles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON marketing_kits FROM PUBLIC, anon, authenticated;
REVOKE ALL ON marketing_kit_purchases FROM PUBLIC, anon, authenticated;
REVOKE ALL ON marketing_brand_profiles FROM PUBLIC, anon, authenticated;
GRANT ALL ON marketing_kits TO service_role;
GRANT ALL ON marketing_kit_purchases TO service_role;
GRANT ALL ON marketing_brand_profiles TO service_role;

-- Increment the public view counter without a read-modify-write race.
CREATE OR REPLACE FUNCTION increment_marketing_kit_views(p_kit_id UUID, p_business_id UUID)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE marketing_kits SET view_count = view_count + 1
   WHERE id = p_kit_id AND business_id = p_business_id AND website_status = 'published';
$$;
REVOKE ALL ON FUNCTION increment_marketing_kit_views(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION increment_marketing_kit_views(UUID, UUID) TO service_role;

-- Activity timeline entries.
ALTER TYPE activity_type ADD VALUE IF NOT EXISTS 'marketing_website_published';
ALTER TYPE activity_type ADD VALUE IF NOT EXISTS 'marketing_website_unpublished';
ALTER TYPE activity_type ADD VALUE IF NOT EXISTS 'marketing_addon_purchased';
