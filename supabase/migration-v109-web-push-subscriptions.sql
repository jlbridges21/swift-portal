-- Standard Web Push (VAPID) device subscriptions for portal admins.
--
-- OneSignal web push is locked to a single site origin per OneSignal app
-- (portal.swiftaerialmedia.com), so it cannot subscribe devices on other
-- tenants' subdomains or custom portal domains. Each row here is one
-- browser/installed-app push endpoint on whatever origin the admin enabled
-- notifications from. Service-role access only (RLS on, no policies).
--
-- Additive: the app keeps working (OneSignal legacy path only) before this runs.

CREATE TABLE IF NOT EXISTS web_push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses (id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'other'
    CHECK (platform IN ('ios', 'android', 'desktop', 'other')),
  standalone BOOLEAN NOT NULL DEFAULT false,
  origin TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_success_at TIMESTAMPTZ,
  failure_count INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT web_push_subscriptions_business_endpoint_unique
    UNIQUE (business_id, endpoint)
);

CREATE INDEX IF NOT EXISTS idx_web_push_subscriptions_profile
  ON web_push_subscriptions (business_id, profile_id);

DROP TRIGGER IF EXISTS trg_web_push_subscriptions_profile_same_business
  ON web_push_subscriptions;
CREATE TRIGGER trg_web_push_subscriptions_profile_same_business
  BEFORE INSERT OR UPDATE ON web_push_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION enforce_same_business('profiles', 'profile_id');

ALTER TABLE web_push_subscriptions ENABLE ROW LEVEL SECURITY;
