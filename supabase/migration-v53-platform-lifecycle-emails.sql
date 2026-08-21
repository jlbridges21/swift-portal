-- ShootPortal V53 — platform lifecycle emails (ShootPortal → photography businesses)
--
-- PLATFORM-LEVEL: platform_email_templates has NO business_id on purpose.
-- Templates are ShootPortal-owned catalog rows (copy, timing, active flags)
-- shared across every tenant — like `plans` and `platform_audit_log`. Tenant-lint
-- and the standing “every new table gets business_id” rule do NOT apply.
--
-- platform_email_sends DOES have business_id (recipient tenant), but it is still a
-- platform operational log: RLS is super_admin SELECT only; tenants never read it.
--
-- Identity split (do not conflate):
--   A) business → client  = sendBrandedEmail (tenant branding)
--   B) ShootPortal → business = sendPlatformEmail (this feature)
--
-- Idempotent: DROP POLICY IF EXISTS before each CREATE POLICY.
-- HOW TO RUN: SQL Editor → paste → Run. Re-runnable.

-- ---------------------------------------------------------------------------
-- 1. platform_email_templates (platform catalog — no business_id)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS platform_email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  -- Negative = days before the event, 0 = day of, positive = days after.
  send_offset_days INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT platform_email_templates_offset_reasonable
    CHECK (send_offset_days BETWEEN -365 AND 365)
);

DROP TRIGGER IF EXISTS platform_email_templates_updated_at ON platform_email_templates;
CREATE TRIGGER platform_email_templates_updated_at
  BEFORE UPDATE ON platform_email_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX IF NOT EXISTS idx_platform_email_templates_active
  ON platform_email_templates (is_active) WHERE is_active = true;

ALTER TABLE platform_email_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admins manage platform email templates" ON platform_email_templates;
CREATE POLICY "Super admins manage platform email templates"
  ON platform_email_templates
  FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

REVOKE ALL ON platform_email_templates FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON platform_email_templates FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON platform_email_templates TO authenticated;
-- SELECT/mutate only via is_super_admin() policy above.

-- ---------------------------------------------------------------------------
-- 2. platform_email_sends (idempotent send log)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS platform_email_sends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  template_key TEXT NOT NULL,
  template_id UUID REFERENCES platform_email_templates(id) ON DELETE SET NULL,
  -- Calendar date of the logical event (e.g. DATE(trial_ends_at)). Combined with
  -- template_key this prevents double-sends when cron runs twice the same day.
  event_date DATE NOT NULL,
  is_test BOOLEAN NOT NULL DEFAULT false,
  recipient TEXT NOT NULL,
  subject TEXT NOT NULL,
  resend_message_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Real cron sends only — test sends must not block or satisfy idempotency.
CREATE UNIQUE INDEX IF NOT EXISTS platform_email_sends_idempotent
  ON platform_email_sends (business_id, template_key, event_date)
  WHERE is_test = false;

CREATE INDEX IF NOT EXISTS idx_platform_email_sends_created
  ON platform_email_sends (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_platform_email_sends_business
  ON platform_email_sends (business_id, created_at DESC);

ALTER TABLE platform_email_sends ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admins read platform email sends" ON platform_email_sends;
CREATE POLICY "Super admins read platform email sends"
  ON platform_email_sends
  FOR SELECT
  USING (is_super_admin());

REVOKE ALL ON platform_email_sends FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON platform_email_sends FROM authenticated;
GRANT SELECT ON platform_email_sends TO authenticated;
-- Inserts go through service role only (cron / platform APIs).

-- ---------------------------------------------------------------------------
-- 3. Per-business suppress toggle
-- ---------------------------------------------------------------------------
ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS lifecycle_emails_suppressed BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN businesses.lifecycle_emails_suppressed IS
  'When true, ShootPortal lifecycle emails (trial/billing) are never sent for this business. Transactional notices — not a client unsubscribe.';

-- ---------------------------------------------------------------------------
-- 4. Seed defaults (idempotent on key)
-- ---------------------------------------------------------------------------
INSERT INTO platform_email_templates (key, name, description, subject, body, is_active, send_offset_days)
VALUES
  (
    'trial_ending_7d',
    'Trial ending — 7 days',
    'Warns the studio owner one week before trial_ends_at.',
    'Your ShootPortal trial ends in {{daysRemaining}} days',
    E'Hi {{ownerName}},\n\nYour {{planName}} trial for {{businessName}} ends on {{trialEndDate}} ({{daysRemaining}} days left).\n\nAdd a payment method anytime so you keep uninterrupted access:\n{{billingUrl}}\n\n— ShootPortal',
    true,
    -7
  ),
  (
    'trial_ending_3d',
    'Trial ending — 3 days',
    'Warns the studio owner three days before trial_ends_at.',
    'Your ShootPortal trial ends in {{daysRemaining}} days',
    E'Hi {{ownerName}},\n\nQuick reminder: the {{planName}} trial for {{businessName}} ends on {{trialEndDate}}.\n\nSubscribe here to stay live:\n{{billingUrl}}\n\n— ShootPortal',
    true,
    -3
  ),
  (
    'trial_ending_1d',
    'Trial ending — 1 day',
    'Final reminder the day before trial_ends_at.',
    'Your ShootPortal trial ends tomorrow',
    E'Hi {{ownerName}},\n\nTomorrow your {{planName}} trial for {{businessName}} ends ({{trialEndDate}}).\n\nSubscribe now to avoid losing admin access:\n{{billingUrl}}\n\n— ShootPortal',
    true,
    -1
  ),
  (
    'trial_ended',
    'Trial ended',
    'Sent on the day the trial ends (offset 0).',
    'Your ShootPortal trial has ended',
    E'Hi {{ownerName}},\n\nThe trial for {{businessName}} ended on {{trialEndDate}}. Your portal is locked until you subscribe to {{planName}} ({{planPrice}}).\n\n{{billingUrl}}\n\n— ShootPortal',
    true,
    0
  ),
  (
    'payment_failed',
    'Payment failed',
    'Sent when subscription_status is past_due (day of).',
    'Action needed: ShootPortal payment failed',
    E'Hi {{ownerName}},\n\nWe could not process payment for {{businessName}} ({{planName}} — {{planPrice}}).\n\nUpdate billing to keep access:\n{{billingUrl}}\n\n— ShootPortal',
    true,
    0
  ),
  (
    'payment_failed_followup',
    'Payment failed — follow-up',
    'Follow-up a few days after the first past_due notice.',
    'Still need a payment update for {{businessName}}',
    E'Hi {{ownerName}},\n\nPayment for {{businessName}} is still past due. Please update your card so ShootPortal access is not interrupted.\n\n{{billingUrl}}\n\n— ShootPortal',
    true,
    3
  ),
  (
    'subscription_canceled',
    'Subscription canceled',
    'Sent when subscription_status is canceled (day of).',
    'Your ShootPortal subscription was canceled',
    E'Hi {{ownerName}},\n\nThe ShootPortal subscription for {{businessName}} has been canceled.\n\nYou can resubscribe anytime:\n{{billingUrl}}\n\n— ShootPortal',
    true,
    0
  )
ON CONFLICT (key) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 5. Sanity checks
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'platform_email_templates'
  ) THEN
    RAISE EXCEPTION 'v53: platform_email_templates missing';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'platform_email_templates'
      AND column_name = 'business_id'
  ) THEN
    RAISE EXCEPTION 'v53: platform_email_templates must not have business_id';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'businesses'
      AND column_name = 'lifecycle_emails_suppressed'
  ) THEN
    RAISE EXCEPTION 'v53: businesses.lifecycle_emails_suppressed missing';
  END IF;
END $$;
