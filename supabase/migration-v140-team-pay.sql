-- ShootPortal V140 — Team pay
--
-- Lets a business track what it owes each team member for the shoots they're assigned:
-- pay plans (hourly, per shoot, per service or a share of the price; driving by the hour,
-- by the mile, both, or the client's travel fee), pay periods, review, approve and mark paid.
--
-- Pay for an open period is always worked out live from the shoots themselves (time booked,
-- the route ShootPortal plans), so rescheduling, reassigning or cancelling a shoot needs no
-- bookkeeping. Approving a period stores a snapshot in team_pay_statements, which locks it.
--
--   team_pay_settings   one row per business: on/off, pay period, options
--   team_pay_plans      named pay plans
--   team_pay_members    which plan each person is on, contractor/employee, rate override
--   team_pay_shoot_edits  per-shoot corrections (time, miles, amount) and check-in times
--   team_pay_adjustments  bonuses, reimbursements, deductions
--   team_pay_requests   a team member asking for their actual time on a shoot
--   team_pay_statements approved / paid periods (snapshot of the lines)
--
-- RLS is enabled with no policies (service role only), like the calendar tables.
-- Additive only. Without it, Team pay stays hidden and Settings says to apply this migration.
--
-- HOW TO RUN: Supabase SQL Editor → paste → Run. Re-runnable.
-- Rollback:
--   DROP TABLE IF EXISTS team_pay_statements, team_pay_requests, team_pay_adjustments,
--     team_pay_shoot_edits, team_pay_members, team_pay_plans, team_pay_settings;

CREATE TABLE IF NOT EXISTS team_pay_settings (
  business_id UUID PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT false,
  period_type TEXT NOT NULL DEFAULT 'biweekly'
    CHECK (period_type IN ('weekly', 'biweekly', 'semimonthly', 'monthly')),
  -- First day of any one pay period (weekly / biweekly count from it).
  period_anchor DATE NOT NULL DEFAULT DATE '2026-01-04',
  late_cancel_enabled BOOLEAN NOT NULL DEFAULT false,
  late_cancel_hours INTEGER NOT NULL DEFAULT 24 CHECK (late_cancel_hours BETWEEN 1 AND 168),
  late_cancel_fee_cents INTEGER NOT NULL DEFAULT 0 CHECK (late_cancel_fee_cents >= 0),
  allow_time_requests BOOLEAN NOT NULL DEFAULT true,
  allow_check_in BOOLEAN NOT NULL DEFAULT false,
  -- Checked-in time this many minutes over the booked time waits for the owner's OK.
  review_over_minutes INTEGER NOT NULL DEFAULT 30 CHECK (review_over_minutes BETWEEN 0 AND 600),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS team_pay_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  -- Time at the shoot.
  base_type TEXT NOT NULL DEFAULT 'hourly'
    CHECK (base_type IN ('hourly', 'per_shoot', 'per_service', 'percent')),
  base_rate_cents INTEGER NOT NULL DEFAULT 0 CHECK (base_rate_cents >= 0),
  percent NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (percent >= 0 AND percent <= 100),
  -- { "<business_services.id>": cents }
  service_rates JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Driving.
  drive_type TEXT NOT NULL DEFAULT 'none'
    CHECK (drive_type IN ('none', 'hour', 'mile', 'both', 'travel_fee')),
  drive_hour_cents INTEGER NOT NULL DEFAULT 0 CHECK (drive_hour_cents >= 0),
  mile_cents NUMERIC(8,2) NOT NULL DEFAULT 0 CHECK (mile_cents >= 0),
  pay_first_drive BOOLEAN NOT NULL DEFAULT true,
  pay_drive_home BOOLEAN NOT NULL DEFAULT true,
  min_per_shoot_cents INTEGER NOT NULL DEFAULT 0 CHECK (min_per_shoot_cents >= 0),
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS team_pay_plans_business ON team_pay_plans (business_id);

CREATE TABLE IF NOT EXISTS team_pay_members (
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  plan_id UUID REFERENCES team_pay_plans(id) ON DELETE SET NULL,
  worker_type TEXT NOT NULL DEFAULT 'contractor' CHECK (worker_type IN ('contractor', 'employee')),
  -- Replaces the plan's main rate for this person (cents, or percent × 100 on a percent plan).
  rate_override INTEGER CHECK (rate_override IS NULL OR rate_override >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (business_id, user_id)
);

CREATE TABLE IF NOT EXISTS team_pay_shoot_edits (
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  proposal_id UUID NOT NULL REFERENCES shoot_proposals(id) ON DELETE CASCADE,
  -- Owner's corrections; NULL = use the planned value.
  onsite_minutes INTEGER CHECK (onsite_minutes IS NULL OR onsite_minutes BETWEEN 0 AND 1440),
  drive_minutes INTEGER CHECK (drive_minutes IS NULL OR drive_minutes BETWEEN 0 AND 1440),
  miles NUMERIC(7,1) CHECK (miles IS NULL OR miles >= 0),
  amount_cents INTEGER CHECK (amount_cents IS NULL OR amount_cents >= 0),
  note TEXT,
  -- Optional check-in by the team member.
  arrived_at TIMESTAMPTZ,
  done_at TIMESTAMPTZ,
  updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (business_id, proposal_id)
);

CREATE TABLE IF NOT EXISTS team_pay_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  pay_date DATE NOT NULL,
  kind TEXT NOT NULL DEFAULT 'bonus' CHECK (kind IN ('bonus', 'reimbursement', 'deduction', 'other')),
  label TEXT NOT NULL DEFAULT '',
  -- Signed: deductions are negative.
  amount_cents INTEGER NOT NULL,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS team_pay_adjustments_user_date
  ON team_pay_adjustments (business_id, user_id, pay_date);

CREATE TABLE IF NOT EXISTS team_pay_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  proposal_id UUID NOT NULL REFERENCES shoot_proposals(id) ON DELETE CASCADE,
  onsite_minutes INTEGER NOT NULL CHECK (onsite_minutes BETWEEN 0 AND 1440),
  note TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'declined')),
  decided_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS team_pay_requests_user ON team_pay_requests (business_id, user_id, status);
CREATE INDEX IF NOT EXISTS team_pay_requests_proposal ON team_pay_requests (business_id, proposal_id);

CREATE TABLE IF NOT EXISTS team_pay_statements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'approved' CHECK (status IN ('approved', 'paid')),
  total_cents INTEGER NOT NULL DEFAULT 0,
  -- The statement exactly as approved: { lines: [...], totals: {...}, plan: {...}, member: {...} }
  snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  approved_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at TIMESTAMPTZ,
  paid_method TEXT,
  paid_reference TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (business_id, user_id, period_start)
);
CREATE INDEX IF NOT EXISTS team_pay_statements_period ON team_pay_statements (business_id, period_start);

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'team_pay_settings', 'team_pay_plans', 'team_pay_members', 'team_pay_shoot_edits', 'team_pay_statements'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', t || '_updated_at', t);
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION update_updated_at()',
      t || '_updated_at', t
    );
  END LOOP;
  FOREACH t IN ARRAY ARRAY[
    'team_pay_settings', 'team_pay_plans', 'team_pay_members', 'team_pay_shoot_edits',
    'team_pay_adjustments', 'team_pay_requests', 'team_pay_statements'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON %I FROM PUBLIC, anon, authenticated', t);
    EXECUTE format('GRANT ALL ON %I TO service_role', t);
  END LOOP;
END $$;
