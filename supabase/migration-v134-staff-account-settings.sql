-- v134 — Staff account Settings. Run after v133 (booking follow-ups).
--
-- Additive only. Until this runs, staff Settings still opens: profile (name, photo, title,
-- bio, phone, home base), sign-in & security, weekly hours, their own Google Calendar (v133)
-- and the existing email / in-app switches keep working. These parts say "not available yet"
-- instead of saving: time off, per-event notification choices, time zone, theme, and the
-- owner's "let staff edit their limits" switch. Staff shoot reminders don't send until it runs.
--
-- What it adds:
--   1. profiles: per-person time zone, theme and per-event notification choices.
--   2. team_scheduling_profiles: time off (vacations, sick days) and the owner switch that
--      lets a team member change their own max shoots per day and drive distance.
--   3. staff_shoot_reminders: one row per reminder sent, so the hourly job never repeats one.
--   4. Keeps profiles.email in step with the sign-in email after an email change is confirmed.
--
-- Requires v132 (team_scheduling_profiles) and v133.

-- ---------------------------------------------------------------------------
-- 1. Personal preferences on profiles
-- ---------------------------------------------------------------------------

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS time_zone TEXT,
  ADD COLUMN IF NOT EXISTS theme_preference TEXT,
  ADD COLUMN IF NOT EXISTS notification_event_prefs JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_theme_preference_check;
ALTER TABLE profiles
  ADD CONSTRAINT profiles_theme_preference_check
  CHECK (theme_preference IS NULL OR theme_preference IN ('studio', 'light', 'dark'));

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_time_zone_length_check;
ALTER TABLE profiles
  ADD CONSTRAINT profiles_time_zone_length_check
  CHECK (time_zone IS NULL OR char_length(time_zone) <= 64);

COMMENT ON COLUMN profiles.time_zone IS 'IANA time zone for this person (reminder timing). NULL = the business time zone.';
COMMENT ON COLUMN profiles.theme_preference IS 'App look for this person: studio (follow the business), light or dark. NULL = studio.';
COMMENT ON COLUMN profiles.notification_event_prefs IS 'Per-event on/off for team members, e.g. {"assigned": true, "reminder_day_before": false}. Missing key = on.';

-- ---------------------------------------------------------------------------
-- 2. Time off + owner lock on team scheduling profiles
-- ---------------------------------------------------------------------------

ALTER TABLE team_scheduling_profiles
  ADD COLUMN IF NOT EXISTS time_off JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS staff_can_edit_limits BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE team_scheduling_profiles DROP CONSTRAINT IF EXISTS team_scheduling_profiles_time_off_check;
ALTER TABLE team_scheduling_profiles
  ADD CONSTRAINT team_scheduling_profiles_time_off_check
  CHECK (jsonb_typeof(time_off) = 'array' AND jsonb_array_length(time_off) <= 200);

COMMENT ON COLUMN team_scheduling_profiles.time_off IS 'Blocked dates: [{id, startDay, endDay, startTime?, endTime?, note?}] in the business time zone. Nobody can book this person then.';
COMMENT ON COLUMN team_scheduling_profiles.staff_can_edit_limits IS 'Owner switch: the team member may change their own max shoots per day and drive distance.';

-- ---------------------------------------------------------------------------
-- 3. Shoot reminder log
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS staff_shoot_reminders (
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  proposal_id UUID NOT NULL REFERENCES shoot_proposals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  -- The shoot start the reminder was about. A rescheduled shoot gets fresh reminders.
  shoot_start_at TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (proposal_id, user_id, kind, shoot_start_at),
  CONSTRAINT staff_shoot_reminders_kind_check CHECK (kind IN ('day_before', 'morning_of'))
);

CREATE INDEX IF NOT EXISTS idx_staff_shoot_reminders_business_sent
  ON staff_shoot_reminders (business_id, sent_at);

ALTER TABLE staff_shoot_reminders ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON staff_shoot_reminders FROM PUBLIC, anon, authenticated;
GRANT ALL ON staff_shoot_reminders TO service_role;

-- ---------------------------------------------------------------------------
-- 4. Keep profiles.email in step with the sign-in email
-- ---------------------------------------------------------------------------
-- auth.users.email only changes once the person confirms the link sent to the new address.

CREATE OR REPLACE FUNCTION public.sync_profile_email_from_auth()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email IS DISTINCT FROM OLD.email AND NEW.email IS NOT NULL THEN
    UPDATE public.profiles SET email = NEW.email WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

GRANT EXECUTE ON FUNCTION public.sync_profile_email_from_auth() TO supabase_auth_admin;

DROP TRIGGER IF EXISTS on_auth_user_email_changed ON auth.users;
CREATE TRIGGER on_auth_user_email_changed
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.sync_profile_email_from_auth();
