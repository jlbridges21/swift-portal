-- ShootPortal V103 — first-party marketing analytics + signup attribution
--
-- Additive only. Platform-level tables (no tenant data, no tenant access):
--   analytics_sessions        anonymous marketing sessions (landing context, source, UTMs)
--   analytics_events          pageview | cta_click | signup_start (deduped by client_event_id)
--   analytics_daily_salts     rotating salts for cookieless visitor keys (deleted after 2 days)
--   business_attribution      one snapshot per business, written once at verified signup
--   business_lifecycle_events billing history from the platform billing webhook
--
-- Security: RLS enabled with NO policies and privileges revoked from anon/authenticated.
-- Only the service role (server code behind super-admin checks or the write-only collector)
-- can touch these tables. See docs/ANALYTICS.md.

CREATE TABLE IF NOT EXISTS analytics_sessions (
  id UUID PRIMARY KEY,
  visitor_key TEXT NOT NULL CHECK (char_length(visitor_key) BETWEEN 8 AND 80),
  consent_mode TEXT NOT NULL CHECK (consent_mode IN ('persistent', 'cookieless')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  landing_path TEXT NOT NULL CHECK (char_length(landing_path) <= 300),
  landing_article_slug TEXT CHECK (char_length(landing_article_slug) <= 120),
  referrer_host TEXT CHECK (char_length(referrer_host) <= 200),
  channel TEXT NOT NULL CHECK (channel IN (
    'google_organic', 'bing_organic', 'other_search', 'instagram', 'facebook', 'tiktok',
    'other_social', 'email', 'paid', 'referral', 'direct', 'unknown'
  )),
  utm_source TEXT CHECK (char_length(utm_source) <= 120),
  utm_medium TEXT CHECK (char_length(utm_medium) <= 120),
  utm_campaign TEXT CHECK (char_length(utm_campaign) <= 160),
  utm_content TEXT CHECK (char_length(utm_content) <= 160),
  utm_term TEXT CHECK (char_length(utm_term) <= 160),
  device_class TEXT CHECK (device_class IN ('mobile', 'tablet', 'desktop', 'unknown'))
);

CREATE INDEX IF NOT EXISTS analytics_sessions_started_idx ON analytics_sessions (started_at DESC);
CREATE INDEX IF NOT EXISTS analytics_sessions_visitor_idx ON analytics_sessions (visitor_key, started_at DESC);

CREATE TABLE IF NOT EXISTS analytics_events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  client_event_id UUID NOT NULL,
  session_id UUID NOT NULL REFERENCES analytics_sessions(id) ON DELETE CASCADE,
  visitor_key TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('pageview', 'cta_click', 'signup_start')),
  path TEXT NOT NULL CHECK (char_length(path) <= 300),
  article_slug TEXT CHECK (char_length(article_slug) <= 120),
  cta_id TEXT CHECK (char_length(cta_id) <= 80),
  cta_location TEXT CHECK (char_length(cta_location) <= 40),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT analytics_events_client_event_unique UNIQUE (client_event_id)
);

CREATE INDEX IF NOT EXISTS analytics_events_occurred_idx ON analytics_events (occurred_at DESC);
CREATE INDEX IF NOT EXISTS analytics_events_session_idx ON analytics_events (session_id);
CREATE INDEX IF NOT EXISTS analytics_events_visitor_idx ON analytics_events (visitor_key, occurred_at DESC);
CREATE INDEX IF NOT EXISTS analytics_events_article_idx
  ON analytics_events (article_slug, occurred_at DESC) WHERE article_slug IS NOT NULL;

CREATE TABLE IF NOT EXISTS analytics_daily_salts (
  day DATE PRIMARY KEY,
  salt TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS business_attribution (
  business_id UUID PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('attributed', 'unknown')),
  unknown_reason TEXT CHECK (char_length(unknown_reason) <= 120),
  consent_mode TEXT CHECK (consent_mode IN ('persistent', 'cookieless')),
  visitor_key TEXT,
  ft_channel TEXT,
  ft_referrer_host TEXT,
  ft_utm_source TEXT,
  ft_utm_medium TEXT,
  ft_utm_campaign TEXT,
  ft_utm_content TEXT,
  ft_utm_term TEXT,
  ft_landing_path TEXT,
  ft_at TIMESTAMPTZ,
  lt_channel TEXT,
  lt_referrer_host TEXT,
  lt_utm_source TEXT,
  lt_utm_medium TEXT,
  lt_utm_campaign TEXT,
  lt_utm_content TEXT,
  lt_utm_term TEXT,
  lt_landing_path TEXT,
  lt_at TIMESTAMPTZ,
  first_article_slug TEXT,
  last_article_slug TEXT,
  articles_viewed TEXT[] NOT NULL DEFAULT '{}',
  signup_cta_id TEXT,
  signup_cta_location TEXT,
  signup_cta_path TEXT,
  sessions_before_signup INTEGER,
  signup_at TIMESTAMPTZ NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS business_attribution_signup_idx ON business_attribution (signup_at DESC);

CREATE TABLE IF NOT EXISTS business_lifecycle_events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('subscription_canceled', 'payment_failed', 'refund')),
  occurred_at TIMESTAMPTZ NOT NULL,
  stripe_event_id TEXT NOT NULL,
  amount_cents INTEGER,
  stripe_mode TEXT CHECK (stripe_mode IN ('test', 'live')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT business_lifecycle_events_stripe_event_unique UNIQUE (stripe_event_id)
);

CREATE INDEX IF NOT EXISTS business_lifecycle_events_business_idx
  ON business_lifecycle_events (business_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS business_lifecycle_events_occurred_idx
  ON business_lifecycle_events (occurred_at DESC);

-- Lock everything down: service role only.
ALTER TABLE analytics_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_daily_salts ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_attribution ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_lifecycle_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON analytics_sessions FROM anon, authenticated;
REVOKE ALL ON analytics_events FROM anon, authenticated;
REVOKE ALL ON analytics_daily_salts FROM anon, authenticated;
REVOKE ALL ON business_attribution FROM anon, authenticated;
REVOKE ALL ON business_lifecycle_events FROM anon, authenticated;

COMMENT ON TABLE analytics_sessions IS 'Platform marketing analytics (service role only). See docs/ANALYTICS.md.';
COMMENT ON TABLE analytics_events IS 'Platform marketing analytics (service role only). See docs/ANALYTICS.md.';
COMMENT ON TABLE analytics_daily_salts IS 'Rotating salts for cookieless visitor keys; rows older than 2 days are deleted.';
COMMENT ON TABLE business_attribution IS 'Signup attribution snapshot, written once per business (service role only).';
COMMENT ON TABLE business_lifecycle_events IS 'Platform billing history from the billing webhook (service role only).';
