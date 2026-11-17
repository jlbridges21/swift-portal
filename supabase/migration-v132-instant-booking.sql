-- v132 — Native Instant Booking.
--
-- Additive only. Until this runs, the app keeps working: Instant Booking stays
-- "not ready" (Settings → Instant Booking says so), requests submit without a
-- scheduling step, and the calendar shows shoots as before.
--
-- What it adds:
--   1. shoot_proposals → real appointments: end time, buffers, assigned team
--      member, booking source, Google destination calendar, override + cancel
--      audit, appointment slot key (multi-appointment ready).
--   2. projects.scheduling_status — scheduling state, separate from the
--      project pipeline status, proposals and payments.
--   3. projects travel snapshot (Google Routes distance/time at request time).
--   4. business_services durations, buffers and booking rules.
--   5. team_scheduling_profiles — per team member availability + booking profile.
--   6. booking_holds — short slot reservations while a client confirms.
--   7. route_cache — Google Routes results per business (cost + latency).
--   8. Double-booking protection: an exclusion constraint on confirmed
--      appointments per team member, plus confirm_instant_booking() which
--      serializes confirmation per team member and re-checks holds.
--
-- Historical travel fees are untouched: they live in project_quotes line items
-- and are never recalculated.

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ---------------------------------------------------------------------------
-- 1. Appointments on shoot_proposals
-- ---------------------------------------------------------------------------

ALTER TYPE shoot_proposal_status ADD VALUE IF NOT EXISTS 'cancelled';

ALTER TABLE shoot_proposals
  ADD COLUMN IF NOT EXISTS end_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS duration_minutes INTEGER,
  ADD COLUMN IF NOT EXISTS buffer_before_minutes INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS buffer_after_minutes INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS assigned_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS booking_source TEXT,
  ADD COLUMN IF NOT EXISTS appointment_key TEXT NOT NULL DEFAULT 'primary',
  ADD COLUMN IF NOT EXISTS google_calendar_id TEXT,
  ADD COLUMN IF NOT EXISTS conflict_override BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS override_reason TEXT,
  ADD COLUMN IF NOT EXISTS override_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_by TEXT,
  ADD COLUMN IF NOT EXISTS cancel_reason TEXT;

ALTER TABLE shoot_proposals DROP CONSTRAINT IF EXISTS shoot_proposals_booking_source_check;
ALTER TABLE shoot_proposals
  ADD CONSTRAINT shoot_proposals_booking_source_check
  CHECK (booking_source IS NULL OR booking_source IN ('instant', 'manual', 'proposal'));

ALTER TABLE shoot_proposals DROP CONSTRAINT IF EXISTS shoot_proposals_end_after_start_check;
ALTER TABLE shoot_proposals
  ADD CONSTRAINT shoot_proposals_end_after_start_check
  CHECK (end_at IS NULL OR end_at > proposed_at);

ALTER TABLE shoot_proposals DROP CONSTRAINT IF EXISTS shoot_proposals_buffers_check;
ALTER TABLE shoot_proposals
  ADD CONSTRAINT shoot_proposals_buffers_check
  CHECK (buffer_before_minutes BETWEEN 0 AND 480 AND buffer_after_minutes BETWEEN 0 AND 480);

CREATE INDEX IF NOT EXISTS idx_shoot_proposals_assigned_window
  ON shoot_proposals (business_id, assigned_user_id, proposed_at)
  WHERE status = 'confirmed';

COMMENT ON COLUMN shoot_proposals.end_at IS 'Shoot end (on-site, excluding buffers). NULL on legacy rows = 1 hour.';
COMMENT ON COLUMN shoot_proposals.assigned_user_id IS 'Team member (profiles.id) doing the shoot. Owner on solo businesses.';
COMMENT ON COLUMN shoot_proposals.booking_source IS 'instant = client self-booked; manual = business scheduled through the booking engine; proposal = legacy propose/confirm flow.';
COMMENT ON COLUMN shoot_proposals.appointment_key IS 'Appointment slot on the project. "primary" by default; other keys allow multiple appointments per project.';
COMMENT ON COLUMN shoot_proposals.google_calendar_id IS 'Google calendar the event was written to, so updates and deletes reach the same calendar after settings change.';
COMMENT ON COLUMN shoot_proposals.conflict_override IS 'Admin override: confirmed despite a conflict. Excluded from the double-booking constraint.';

-- Double-booking protection. A confirmed appointment for one team member may not overlap
-- another confirmed appointment for the same team member, buffers included. Legacy rows
-- (no end_at or no assignee) and explicit admin overrides are excluded.
ALTER TABLE shoot_proposals DROP CONSTRAINT IF EXISTS shoot_proposals_no_double_booking;
ALTER TABLE shoot_proposals
  ADD CONSTRAINT shoot_proposals_no_double_booking
  EXCLUDE USING gist (
    business_id WITH =,
    assigned_user_id WITH =,
    tstzrange(
      proposed_at - make_interval(mins => buffer_before_minutes),
      end_at + make_interval(mins => buffer_after_minutes),
      '[)'
    ) WITH &&
  )
  WHERE (
    status = 'confirmed'
    AND end_at IS NOT NULL
    AND assigned_user_id IS NOT NULL
    AND conflict_override = false
  );

-- ---------------------------------------------------------------------------
-- 2 + 3. Scheduling status and travel snapshot on projects
-- ---------------------------------------------------------------------------

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS scheduling_status TEXT,
  ADD COLUMN IF NOT EXISTS travel_distance_miles NUMERIC(8, 2),
  ADD COLUMN IF NOT EXISTS travel_duration_minutes INTEGER,
  ADD COLUMN IF NOT EXISTS outside_service_area BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS estimated_duration_minutes INTEGER;

ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_scheduling_status_check;
ALTER TABLE projects
  ADD CONSTRAINT projects_scheduling_status_check
  CHECK (
    scheduling_status IS NULL
    OR scheduling_status IN ('unscheduled', 'awaiting_booking', 'scheduled', 'reschedule_requested', 'cancelled')
  );

COMMENT ON COLUMN projects.scheduling_status IS
  'Scheduling state only (never proposal, payment or delivery state). NULL = legacy project, derived from shoot_proposals.';
COMMENT ON COLUMN projects.travel_distance_miles IS
  'One-way driving miles from the travel-pricing origin (Google Routes) at request time. Snapshot, not recalculated.';

-- ---------------------------------------------------------------------------
-- 4. Service durations and booking rules
-- ---------------------------------------------------------------------------

ALTER TABLE business_services
  ADD COLUMN IF NOT EXISTS duration_minutes INTEGER NOT NULL DEFAULT 60,
  ADD COLUMN IF NOT EXISTS buffer_minutes INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS instant_booking_allowed BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS outside_radius_requires_quote BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE business_services DROP CONSTRAINT IF EXISTS business_services_duration_check;
ALTER TABLE business_services
  ADD CONSTRAINT business_services_duration_check
  CHECK (duration_minutes BETWEEN 5 AND 1440 AND buffer_minutes BETWEEN 0 AND 480);

-- ---------------------------------------------------------------------------
-- 5. Team scheduling profiles
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS team_scheduling_profiles (
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  display_title TEXT,
  short_bio TEXT,
  phone TEXT,
  base_address TEXT,
  -- NULL = use the business working hours.
  working_hours JSONB,
  max_shoots_per_day INTEGER,
  service_radius_miles INTEGER,
  bookable BOOLEAN NOT NULL DEFAULT true,
  -- Empty = qualified for every service.
  qualified_service_ids UUID[] NOT NULL DEFAULT '{}',
  block_calendar_ids TEXT[] NOT NULL DEFAULT '{}',
  destination_calendar_id TEXT,
  assignment_weights JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (business_id, user_id),
  CONSTRAINT team_scheduling_profiles_limits_check CHECK (
    (max_shoots_per_day IS NULL OR max_shoots_per_day BETWEEN 1 AND 50)
    AND (service_radius_miles IS NULL OR service_radius_miles BETWEEN 1 AND 1000)
    AND char_length(coalesce(short_bio, '')) <= 400
  )
);

DROP TRIGGER IF EXISTS team_scheduling_profiles_updated_at ON team_scheduling_profiles;
CREATE TRIGGER team_scheduling_profiles_updated_at
  BEFORE UPDATE ON team_scheduling_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE team_scheduling_profiles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON team_scheduling_profiles FROM PUBLIC, anon, authenticated;
GRANT ALL ON team_scheduling_profiles TO service_role;

-- ---------------------------------------------------------------------------
-- 6. Slot holds
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS booking_holds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  assigned_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  -- Occupied window including buffers (what other bookings may not overlap).
  block_start_at TIMESTAMPTZ NOT NULL,
  block_end_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (end_at > start_at AND block_end_at > block_start_at)
);

CREATE INDEX IF NOT EXISTS idx_booking_holds_lookup
  ON booking_holds (business_id, assigned_user_id, block_start_at);

ALTER TABLE booking_holds ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON booking_holds FROM PUBLIC, anon, authenticated;
GRANT ALL ON booking_holds TO service_role;

-- ---------------------------------------------------------------------------
-- 7. Google Routes cache (per business; addresses never shared across tenants)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS route_cache (
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  origin_key TEXT NOT NULL,
  destination_key TEXT NOT NULL,
  distance_meters INTEGER NOT NULL,
  duration_seconds INTEGER NOT NULL,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (business_id, origin_key, destination_key)
);

ALTER TABLE route_cache ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON route_cache FROM PUBLIC, anon, authenticated;
GRANT ALL ON route_cache TO service_role;

-- ---------------------------------------------------------------------------
-- 8. Serialized confirmation
-- ---------------------------------------------------------------------------
-- Confirms one appointment for one team member. Takes a transaction-scoped advisory lock
-- per (business, team member) so two clients racing for the same slot are serialized; the
-- second one sees the first one's row and gets 'conflict'. Holds owned by someone else
-- (p_hold_id excluded) also count as conflicts. The exclusion constraint above is the last
-- line of defence if anything bypasses this function.
--
-- Returns the new shoot_proposals id, or raises 'booking_conflict'.
CREATE OR REPLACE FUNCTION confirm_instant_booking(
  p_business_id UUID,
  p_project_id UUID,
  p_assigned_user_id UUID,
  p_start TIMESTAMPTZ,
  p_end TIMESTAMPTZ,
  p_buffer_before INTEGER,
  p_buffer_after INTEGER,
  p_source TEXT,
  p_created_by UUID,
  p_hold_id UUID,
  p_appointment_key TEXT DEFAULT 'primary',
  p_message TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_block_start TIMESTAMPTZ := p_start - make_interval(mins => p_buffer_before);
  v_block_end TIMESTAMPTZ := p_end + make_interval(mins => p_buffer_after);
  v_id UUID;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_business_id::text || ':' || p_assigned_user_id::text, 0));

  IF EXISTS (
    SELECT 1 FROM shoot_proposals sp
    WHERE sp.business_id = p_business_id
      AND sp.assigned_user_id = p_assigned_user_id
      AND sp.status = 'confirmed'
      AND sp.end_at IS NOT NULL
      AND sp.conflict_override = false
      AND NOT (sp.project_id = p_project_id AND sp.appointment_key = p_appointment_key)
      AND tstzrange(
            sp.proposed_at - make_interval(mins => sp.buffer_before_minutes),
            sp.end_at + make_interval(mins => sp.buffer_after_minutes), '[)')
          && tstzrange(v_block_start, v_block_end, '[)')
  ) THEN
    RAISE EXCEPTION 'booking_conflict' USING ERRCODE = 'P0001';
  END IF;

  IF EXISTS (
    SELECT 1 FROM booking_holds h
    WHERE h.business_id = p_business_id
      AND h.assigned_user_id = p_assigned_user_id
      AND h.expires_at > now()
      AND (p_hold_id IS NULL OR h.id <> p_hold_id)
      AND (h.project_id IS NULL OR h.project_id <> p_project_id)
      AND tstzrange(h.block_start_at, h.block_end_at, '[)') && tstzrange(v_block_start, v_block_end, '[)')
  ) THEN
    RAISE EXCEPTION 'booking_conflict' USING ERRCODE = 'P0001';
  END IF;

  -- The project's previous appointment in this slot is replaced (reschedule / rebook).
  UPDATE shoot_proposals
     SET status = 'superseded'
   WHERE business_id = p_business_id
     AND project_id = p_project_id
     AND appointment_key = p_appointment_key
     AND status IN ('confirmed', 'pending');

  INSERT INTO shoot_proposals (
    business_id, project_id, proposed_by, proposed_at, end_at, duration_minutes,
    buffer_before_minutes, buffer_after_minutes, assigned_user_id, booking_source,
    appointment_key, message, status, created_by
  ) VALUES (
    p_business_id, p_project_id,
    CASE WHEN p_source = 'instant' THEN 'client' ELSE 'admin' END,
    p_start, p_end, GREATEST(1, (EXTRACT(EPOCH FROM (p_end - p_start)) / 60)::int),
    p_buffer_before, p_buffer_after, p_assigned_user_id, p_source,
    p_appointment_key, p_message, 'confirmed', p_created_by
  ) RETURNING id INTO v_id;

  DELETE FROM booking_holds
   WHERE business_id = p_business_id
     AND (id = p_hold_id OR expires_at < now() - interval '1 day');

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION confirm_instant_booking(UUID, UUID, UUID, TIMESTAMPTZ, TIMESTAMPTZ, INTEGER, INTEGER, TEXT, UUID, UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION confirm_instant_booking(UUID, UUID, UUID, TIMESTAMPTZ, TIMESTAMPTZ, INTEGER, INTEGER, TEXT, UUID, UUID, TEXT, TEXT) TO service_role;
