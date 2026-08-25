-- ShootPortal V70 — Partner program lifecycle emails (approval / decline)
--
-- Templates live in platform_email_templates (editable at /platform/lifecycle-emails).
-- Sends are logged in partner_email_sends for idempotency (exactly once per entity + key).
--
-- Idempotent / re-runnable.

-- ---------------------------------------------------------------------------
-- 1. partner_email_sends (idempotent send log — platform operational)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS partner_email_sends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID REFERENCES partners (id) ON DELETE CASCADE,
  application_id UUID REFERENCES partner_applications (id) ON DELETE CASCADE,
  template_key TEXT NOT NULL,
  template_id UUID REFERENCES platform_email_templates (id) ON DELETE SET NULL,
  is_test BOOLEAN NOT NULL DEFAULT false,
  recipient TEXT NOT NULL,
  subject TEXT NOT NULL,
  resend_message_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT partner_email_sends_entity_present CHECK (
    partner_id IS NOT NULL OR application_id IS NOT NULL
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS partner_email_sends_partner_idempotent
  ON partner_email_sends (partner_id, template_key)
  WHERE partner_id IS NOT NULL AND is_test = false;

CREATE UNIQUE INDEX IF NOT EXISTS partner_email_sends_application_idempotent
  ON partner_email_sends (application_id, template_key)
  WHERE application_id IS NOT NULL AND is_test = false;

CREATE INDEX IF NOT EXISTS idx_partner_email_sends_created
  ON partner_email_sends (created_at DESC);

ALTER TABLE partner_email_sends ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admins read partner email sends" ON partner_email_sends;
CREATE POLICY "Super admins read partner email sends"
  ON partner_email_sends
  FOR SELECT
  USING (is_super_admin());

REVOKE ALL ON partner_email_sends FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON partner_email_sends FROM authenticated;
GRANT SELECT ON partner_email_sends TO authenticated;

-- ---------------------------------------------------------------------------
-- 2. Seed partner lifecycle templates
-- ---------------------------------------------------------------------------
INSERT INTO platform_email_templates (key, name, description, subject, body, is_active, send_offset_days)
VALUES
  (
    'partner_approved_existing',
    'Partner approved — existing account',
    'Sent when a partner is approved and already has a ShootPortal profile (no invite).',
    'You''re approved for the ShootPortal Partner Program',
    E'Hi {{partnerName}},\n\nCongratulations — you''re approved as a ShootPortal partner.\n\nYour commission rate: {{commissionRatePct}}%\nYour referral link: {{referralLink}}\nYour landing page: {{landingPageUrl}}\n\nSign in with your existing account and open Partner from your portal navigation, or visit {{partnerDashboardUrl}}.\n\n— ShootPortal',
    true,
    0
  ),
  (
    'partner_approved_invite',
    'Partner approved — invite new user',
    'Sent when a partner is approved and needs to accept an invite to create their account.',
    'You''re invited to the ShootPortal Partner Program',
    E'Hi {{partnerName}},\n\nCongratulations — you''re approved as a ShootPortal partner.\n\nYour commission rate: {{commissionRatePct}}%\nYour referral link: {{referralLink}}\nYour landing page: {{landingPageUrl}}\n\nClick below to set your password and open your partner dashboard at {{partnerDashboardUrl}}.\n\n— ShootPortal',
    true,
    0
  ),
  (
    'partner_application_declined',
    'Partner application declined',
    'Sent when a pending partner application is declined.',
    'Update on your ShootPortal Partner Program application',
    E'Hi {{partnerName}},\n\nThank you for applying to the ShootPortal Partner Program. After review, we''re unable to approve your application at this time.\n\nYou''re welcome to reapply in the future if your audience or promotion plan changes.\n\n— ShootPortal',
    true,
    0
  )
ON CONFLICT (key) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 3. Default commission rate on program settings (editable in /platform)
-- ---------------------------------------------------------------------------
ALTER TABLE partner_program_settings
  ADD COLUMN IF NOT EXISTS default_commission_rate_pct NUMERIC(5, 2) NOT NULL DEFAULT 30
    CHECK (default_commission_rate_pct >= 0 AND default_commission_rate_pct <= 100);

COMMENT ON COLUMN partner_program_settings.default_commission_rate_pct IS
  'Default commission rate for newly approved partners and public marketing copy.';

-- Keep RPC in sync with program settings (falls back to column DEFAULT if unset).
CREATE OR REPLACE FUNCTION partner_program_default_commission_rate_pct()
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  from_settings numeric;
  def text;
  matched text;
  n numeric;
BEGIN
  SELECT p.default_commission_rate_pct INTO from_settings
  FROM partner_program_settings p
  WHERE p.id = 1;

  IF from_settings IS NOT NULL AND from_settings >= 0 AND from_settings <= 100 THEN
    RETURN from_settings;
  END IF;

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
