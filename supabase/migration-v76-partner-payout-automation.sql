-- ShootPortal V76 — Automated partner payout runs (Phase 2)
--
-- Scheduled Stripe transfers to partner Express accounts (FLOW C).
-- OFF by default: automated_payouts_enabled = false, dry_run = true,
-- live/test transfer flags = false. Kill switch halts an in-progress run.
--
-- Idempotent / re-runnable. Next unused after v75.

-- ---------------------------------------------------------------------------
-- 1. Program settings — automation toggles (singleton partner_program_settings)
-- ---------------------------------------------------------------------------
ALTER TABLE partner_program_settings
  ADD COLUMN IF NOT EXISTS automated_payouts_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS automated_payouts_dry_run BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS automated_payouts_live_transfers_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS automated_payouts_test_transfers_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS automated_payouts_minimum_cents INTEGER NOT NULL DEFAULT 5000
    CHECK (automated_payouts_minimum_cents >= 0),
  ADD COLUMN IF NOT EXISTS automated_payouts_kill_switch BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN partner_program_settings.automated_payouts_enabled IS
  'Master switch for monthly cron. Default false — no automated money movement until explicitly enabled.';
COMMENT ON COLUMN partner_program_settings.automated_payouts_dry_run IS
  'When true, runs compute and audit only — no Stripe transfers. Default true.';
COMMENT ON COLUMN partner_program_settings.automated_payouts_live_transfers_enabled IS
  'Separate explicit enable for sk_live_ deploys. Test enable does NOT enable live.';
COMMENT ON COLUMN partner_program_settings.automated_payouts_test_transfers_enabled IS
  'Explicit enable for sk_test_ deploy real transfers. Default false.';
COMMENT ON COLUMN partner_program_settings.automated_payouts_minimum_cents IS
  'Minimum open payable balance (cents) before an automated payout. Default 5000 ($50).';
COMMENT ON COLUMN partner_program_settings.automated_payouts_kill_switch IS
  'When true, an in-progress run aborts before the next partner transfer.';

-- ---------------------------------------------------------------------------
-- 2. partner_payout_runs — audit header per invocation
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS partner_payout_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_key TEXT NOT NULL,
  stripe_mode TEXT NOT NULL CHECK (stripe_mode IN ('test', 'live')),
  triggered_by TEXT NOT NULL CHECK (triggered_by IN ('cron', 'manual')),
  triggered_by_user_id UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  dry_run BOOLEAN NOT NULL DEFAULT true,
  execute_transfers BOOLEAN NOT NULL DEFAULT false,
  kill_switch_triggered BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'aborted', 'failed')),
  platform_balance_available_cents INTEGER,
  total_evaluated INTEGER NOT NULL DEFAULT 0,
  total_paid INTEGER NOT NULL DEFAULT 0,
  total_skipped INTEGER NOT NULL DEFAULT 0,
  total_failed INTEGER NOT NULL DEFAULT 0,
  total_amount_cents INTEGER NOT NULL DEFAULT 0,
  error_summary TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

COMMENT ON TABLE partner_payout_runs IS
  'PLATFORM-SCOPED: audit log for automated partner payout runs (cron or manual).';

CREATE INDEX IF NOT EXISTS idx_partner_payout_runs_started
  ON partner_payout_runs (started_at DESC);

CREATE INDEX IF NOT EXISTS idx_partner_payout_runs_period_mode
  ON partner_payout_runs (period_key, stripe_mode);

ALTER TABLE partner_payout_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admins manage partner payout runs" ON partner_payout_runs;
CREATE POLICY "Super admins manage partner payout runs"
  ON partner_payout_runs
  FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

REVOKE ALL ON partner_payout_runs FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON partner_payout_runs FROM authenticated;
GRANT SELECT ON partner_payout_runs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON partner_payout_runs TO service_role;

-- ---------------------------------------------------------------------------
-- 3. partner_payout_run_items — per-partner outcome
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS partner_payout_run_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES partner_payout_runs (id) ON DELETE CASCADE,
  partner_id UUID NOT NULL REFERENCES partners (id) ON DELETE RESTRICT,
  outcome TEXT NOT NULL CHECK (outcome IN ('paid', 'skipped', 'failed', 'dry_run_would_pay')),
  skip_reason TEXT,
  amount_cents INTEGER,
  stripe_transfer_id TEXT,
  payout_id UUID REFERENCES partner_payouts (id) ON DELETE SET NULL,
  idempotency_key TEXT,
  partner_email TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE partner_payout_run_items IS
  'Per-partner line items for an automated payout run.';

CREATE INDEX IF NOT EXISTS idx_partner_payout_run_items_run
  ON partner_payout_run_items (run_id);

CREATE INDEX IF NOT EXISTS idx_partner_payout_run_items_partner
  ON partner_payout_run_items (partner_id, created_at DESC);

ALTER TABLE partner_payout_run_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admins manage partner payout run items" ON partner_payout_run_items;
CREATE POLICY "Super admins manage partner payout run items"
  ON partner_payout_run_items
  FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS "Partners read own payout run items" ON partner_payout_run_items;
CREATE POLICY "Partners read own payout run items"
  ON partner_payout_run_items
  FOR SELECT
  USING (
    partner_id IN (
      SELECT id FROM partners WHERE user_id IS NOT NULL AND user_id = auth.uid()
    )
  );

REVOKE ALL ON partner_payout_run_items FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON partner_payout_run_items FROM authenticated;
GRANT SELECT ON partner_payout_run_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON partner_payout_run_items TO service_role;

-- ---------------------------------------------------------------------------
-- 4. Payout notification email templates
-- ---------------------------------------------------------------------------
INSERT INTO platform_email_templates (key, name, description, subject, body, is_active, send_offset_days)
VALUES
  (
    'partner_payout_sent',
    'Partner payout sent',
    'Sent when an automated commission payout transfer succeeds.',
    'Your ShootPortal commission payout of {{payoutAmount}} was sent',
    E'Hi {{partnerName}},\n\nWe sent {{payoutAmount}} to your Stripe payout account for partner commissions earned through {{periodLabel}}.\n\nView payout history: {{partnerPayoutsUrl}}\n\n— ShootPortal',
    true,
    0
  ),
  (
    'partner_payout_skipped',
    'Partner payout skipped',
    'Sent when an automated payout was skipped for a fixable reason (requirements, threshold, etc.).',
    'Action needed for your ShootPortal commission payout',
    E'Hi {{partnerName}},\n\nWe could not send your commission payout for {{periodLabel}}.\n\nReason: {{skipReason}}\n\nOpen payout details to fix this: {{partnerPayoutDetailsUrl}}\n\n— ShootPortal',
    true,
    0
  )
ON CONFLICT (key) DO NOTHING;

DO $$
BEGIN
  RAISE NOTICE 'v76: partner payout automation settings + run audit tables + email templates';
END $$;
