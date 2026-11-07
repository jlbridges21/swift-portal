-- ShootPortal V112 — Platform Economics: storage snapshots, egress metering, cost assumptions,
-- recorded provider invoices, saved pricing scenarios.
--
-- Additive only. Nothing here touches plans, prices, subscriptions, Stripe, or tenant data.
-- The app runs without this migration: /platform falls back to media_assets.file_size sums
-- (labelled as such) and every metering write is best-effort.
--
-- Platform-level tables (service role only — RLS on with NO policies, privileges revoked from
-- anon/authenticated, same pattern as V103/V107):
--   platform_storage_snapshots        one row per day: platform totals from storage.objects
--   business_storage_snapshots        one row per (day, business): bytes stored, by bucket
--   business_egress_daily             metered download traffic per (business, day, channel)
--   platform_economics_settings       single row: unit prices / assumptions (editable)
--   platform_expense_entries          actual provider invoices entered by a super admin
--   platform_pricing_scenarios        saved Pricing Simulator scenarios (analysis only)
--
-- Functions (SECURITY DEFINER, EXECUTE granted to service_role only):
--   platform_storage_usage_by_business()   one scan of storage.objects, attributed per business
--   record_business_egress(...)            atomic increment for business_egress_daily
--
-- Rollback: DROP the six tables and two functions. No other object depends on them.

-- ---------------------------------------------------------------------------
-- Storage snapshots
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS platform_storage_snapshots (
  day DATE PRIMARY KEY,
  total_bytes BIGINT NOT NULL DEFAULT 0,
  attributed_bytes BIGINT NOT NULL DEFAULT 0,
  unattributed_bytes BIGINT NOT NULL DEFAULT 0,
  object_count BIGINT NOT NULL DEFAULT 0,
  by_bucket JSONB NOT NULL DEFAULT '{}'::jsonb,
  source TEXT NOT NULL DEFAULT 'storage_objects' CHECK (source IN ('storage_objects', 'media_assets')),
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS business_storage_snapshots (
  day DATE NOT NULL,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  total_bytes BIGINT NOT NULL DEFAULT 0,
  object_count BIGINT NOT NULL DEFAULT 0,
  by_bucket JSONB NOT NULL DEFAULT '{}'::jsonb,
  storage_limit_gb INTEGER,
  plan TEXT CHECK (char_length(plan) <= 80),
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (day, business_id)
);

CREATE INDEX IF NOT EXISTS business_storage_snapshots_business_idx
  ON business_storage_snapshots (business_id, day DESC);

-- ---------------------------------------------------------------------------
-- Egress metering (going forward — Supabase does not expose per-path egress history)
-- channel:
--   proxied_download  bytes streamed through a ShootPortal route (exact; Supabase→Vercel→client)
--   zip_download      ZIP archives streamed through a ShootPortal route (exact source bytes)
--   signed_delivery   full-size signed URLs handed to browsers (estimated = file size per issue)
-- image_transforms counts Supabase image-transformation renders we requested (MLS downloads).
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS business_egress_daily (
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  day DATE NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('proxied_download', 'zip_download', 'signed_delivery')),
  bytes BIGINT NOT NULL DEFAULT 0,
  requests INTEGER NOT NULL DEFAULT 0,
  image_transforms INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (business_id, day, channel)
);

CREATE INDEX IF NOT EXISTS business_egress_daily_day_idx ON business_egress_daily (day DESC);

-- ---------------------------------------------------------------------------
-- Assumptions, invoices, scenarios
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS platform_economics_settings (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  pricing JSONB NOT NULL DEFAULT '{}'::jsonb,
  tracking_started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by_email TEXT CHECK (char_length(updated_by_email) <= 320)
);

INSERT INTO platform_economics_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS platform_expense_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  month DATE NOT NULL CHECK (EXTRACT(DAY FROM month) = 1),
  provider TEXT NOT NULL CHECK (char_length(provider) BETWEEN 1 AND 80),
  category TEXT NOT NULL CHECK (category IN (
    'supabase_storage', 'supabase_egress', 'supabase_compute', 'supabase_base',
    'supabase_image_transforms', 'supabase_other', 'vercel', 'stripe_fees', 'email', 'other'
  )),
  cost_type TEXT NOT NULL CHECK (cost_type IN ('usage_shared', 'fixed', 'attributable')),
  amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
  notes TEXT CHECK (char_length(notes) <= 500),
  created_by_email TEXT CHECK (char_length(created_by_email) <= 320),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS platform_expense_entries_month_idx ON platform_expense_entries (month DESC);

CREATE TABLE IF NOT EXISTS platform_pricing_scenarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  description TEXT CHECK (char_length(description) <= 500),
  config JSONB NOT NULL,
  created_by_email TEXT CHECK (char_length(created_by_email) <= 320),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE platform_pricing_scenarios IS
  'Pricing Simulator scenarios. Analysis only — never read by billing, plans, or Stripe code.';

ALTER TABLE platform_storage_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_storage_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_egress_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_economics_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_expense_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_pricing_scenarios ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON platform_storage_snapshots FROM anon, authenticated;
REVOKE ALL ON business_storage_snapshots FROM anon, authenticated;
REVOKE ALL ON business_egress_daily FROM anon, authenticated;
REVOKE ALL ON platform_economics_settings FROM anon, authenticated;
REVOKE ALL ON platform_expense_entries FROM anon, authenticated;
REVOKE ALL ON platform_pricing_scenarios FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- Storage attribution: a single pass over storage.objects.
-- Attribution order for an object key:
--   1. first path segment is a business id        ({businessId}/…  — v36+ uploads, logos)
--   2. first path segment is a project id         ({projectId}/…   — legacy project media)
--   3. first path segment is a profile id         ({userId}/avatar — avatars)
--   4. exact media_assets.file_path match         (library/unassigned/… legacy library)
--   otherwise business_id is NULL (platform-owned or orphaned objects).
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION platform_storage_usage_by_business()
RETURNS TABLE (business_id UUID, bucket_id TEXT, bytes BIGINT, objects BIGINT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, storage, pg_temp
AS $$
  WITH o AS (
    SELECT
      so.bucket_id::text AS bucket_id,
      so.name,
      split_part(so.name, '/', 1) AS seg1,
      COALESCE(NULLIF(so.metadata->>'size', '')::bigint, 0) AS size
    FROM storage.objects so
  ),
  first_pass AS (
    SELECT
      o.bucket_id,
      o.name,
      o.size,
      COALESCE(b.id, p.business_id, pr.business_id) AS business_id
    FROM o
    LEFT JOIN public.businesses b ON b.id::text = o.seg1
    LEFT JOIN public.projects p ON b.id IS NULL AND p.id::text = o.seg1
    LEFT JOIN public.profiles pr ON b.id IS NULL AND p.id IS NULL AND pr.id::text = o.seg1
  ),
  resolved AS (
    SELECT
      f.bucket_id,
      f.size,
      COALESCE(f.business_id, m.business_id) AS business_id
    FROM first_pass f
    LEFT JOIN LATERAL (
      SELECT ma.business_id FROM public.media_assets ma
      WHERE f.business_id IS NULL AND ma.file_path = f.name
      LIMIT 1
    ) m ON true
  )
  SELECT business_id, bucket_id, SUM(size)::bigint AS bytes, COUNT(*)::bigint AS objects
  FROM resolved
  GROUP BY business_id, bucket_id;
$$;

REVOKE ALL ON FUNCTION platform_storage_usage_by_business() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION platform_storage_usage_by_business() TO service_role;

CREATE OR REPLACE FUNCTION record_business_egress(
  p_business_id UUID,
  p_channel TEXT,
  p_bytes BIGINT,
  p_requests INTEGER DEFAULT 1,
  p_image_transforms INTEGER DEFAULT 0
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  INSERT INTO public.business_egress_daily (business_id, day, channel, bytes, requests, image_transforms)
  VALUES (
    p_business_id,
    (now() AT TIME ZONE 'utc')::date,
    p_channel,
    GREATEST(COALESCE(p_bytes, 0), 0),
    GREATEST(COALESCE(p_requests, 0), 0),
    GREATEST(COALESCE(p_image_transforms, 0), 0)
  )
  ON CONFLICT (business_id, day, channel) DO UPDATE SET
    bytes = public.business_egress_daily.bytes + EXCLUDED.bytes,
    requests = public.business_egress_daily.requests + EXCLUDED.requests,
    image_transforms = public.business_egress_daily.image_transforms + EXCLUDED.image_transforms,
    updated_at = now();
$$;

REVOKE ALL ON FUNCTION record_business_egress(UUID, TEXT, BIGINT, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION record_business_egress(UUID, TEXT, BIGINT, INTEGER, INTEGER) TO service_role;

-- ---------------------------------------------------------------------------
-- History aggregates (read-only, grouped in Postgres so the app never pulls raw rows).
--   platform_media_monthly()             bytes uploaded per (month, business) for media that
--                                        still exists (deleted files are not recoverable)
--   platform_download_estimates(from,to) logged single-file downloads per (month, business)
--                                        × original file size — an ESTIMATE of download bytes
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION platform_media_monthly()
RETURNS TABLE (month DATE, business_id UUID, bytes BIGINT, assets BIGINT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT date_trunc('month', ma.created_at AT TIME ZONE 'utc')::date AS month,
         ma.business_id,
         COALESCE(SUM(ma.file_size), 0)::bigint AS bytes,
         COUNT(*)::bigint AS assets
  FROM public.media_assets ma
  GROUP BY 1, 2;
$$;

REVOKE ALL ON FUNCTION platform_media_monthly() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION platform_media_monthly() TO service_role;

CREATE OR REPLACE FUNCTION platform_download_estimates(p_from TIMESTAMPTZ, p_to TIMESTAMPTZ)
RETURNS TABLE (month DATE, business_id UUID, downloads BIGINT, est_bytes BIGINT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT date_trunc('month', md.created_at AT TIME ZONE 'utc')::date AS month,
         COALESCE(md.business_id, ma.business_id) AS business_id,
         COUNT(*)::bigint AS downloads,
         COALESCE(SUM(ma.file_size), 0)::bigint AS est_bytes
  FROM public.media_downloads md
  JOIN public.media_assets ma ON ma.id = md.media_asset_id
  WHERE md.created_at >= p_from AND md.created_at < p_to
  GROUP BY 1, 2;
$$;

REVOKE ALL ON FUNCTION platform_download_estimates(TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION platform_download_estimates(TIMESTAMPTZ, TIMESTAMPTZ) TO service_role;
