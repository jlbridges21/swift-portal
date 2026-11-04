-- =============================================================================
-- v110: Profile privilege guard
-- =============================================================================
-- Closes two privilege-escalation holes (docs/platform-api/security-fix-plan.md):
--
--   #1  Any signed-in user could call Supabase's REST API directly and change
--       their own profiles.role / business_id (e.g. to super_admin, or admin of
--       another business). The UPDATE policy had USING but no WITH CHECK, and
--       nothing guarded those columns.
--
--   #2  handle_new_user() copied role + business_id from signup metadata, which
--       the public anon `signUp` call lets anyone set.
--
-- How the fix works, in plain English:
--   * A trigger on profiles refuses any change to the "privileged" columns
--     unless it comes from our server (service role) or the database itself
--     (SQL editor, SECURITY DEFINER functions). Requests made with a user's own
--     login token run as the Postgres role `authenticated` (or `anon`), and those
--     are exactly the ones we block.
--   * The signup trigger stops trusting metadata. Every new auth user starts as a
--     plain `client` with no business. Server code then promotes them. Every app
--     path already does this with the service role (audited 2026-11-03).
--
-- Safe to run more than once. Rollback statements are at the bottom.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Guard trigger: privileged profile columns can only be changed by the server
-- -----------------------------------------------------------------------------
-- Why `current_user` and not auth.role(): auth.role() reads the caller's JWT,
-- which still says "authenticated" inside SECURITY DEFINER functions (e.g.
-- attribute_partner_referral). current_user is the Postgres role actually
-- executing the statement: `authenticated`/`anon` for direct REST calls, and the
-- function owner inside trusted SECURITY DEFINER functions.
CREATE OR REPLACE FUNCTION public.guard_profile_privileged_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  -- Only requests made with an end user's own token are restricted.
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- A user-created profile may only ever be a plain client with no business.
    -- (In practice profiles are created by handle_new_user, not by users.)
    IF NEW.role IS DISTINCT FROM 'client'::public.user_role
       OR NEW.business_id IS NOT NULL
       OR NEW.client_id IS NOT NULL
       OR NEW.disabled_at IS NOT NULL
       OR COALESCE(NEW.staff_permissions, '{}'::jsonb) <> '{}'::jsonb THEN
      RAISE EXCEPTION 'profiles: privileged columns can only be set by the server'
        USING ERRCODE = '42501'; -- insufficient_privilege
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE: name, phone, avatar, notification preferences etc. stay editable.
  IF NEW.id                IS DISTINCT FROM OLD.id
     OR NEW.role              IS DISTINCT FROM OLD.role
     OR NEW.business_id       IS DISTINCT FROM OLD.business_id
     OR NEW.client_id         IS DISTINCT FROM OLD.client_id
     OR NEW.email             IS DISTINCT FROM OLD.email
     OR NEW.staff_permissions IS DISTINCT FROM OLD.staff_permissions
     OR NEW.disabled_at       IS DISTINCT FROM OLD.disabled_at THEN
    RAISE EXCEPTION 'profiles: privileged columns can only be changed by the server'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_guard_privileged_columns ON public.profiles;
CREATE TRIGGER profiles_guard_privileged_columns
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_privileged_columns();

-- -----------------------------------------------------------------------------
-- 2. Belt-and-braces: give the UPDATE policy a WITH CHECK that mirrors USING
-- -----------------------------------------------------------------------------
-- Without WITH CHECK, Postgres reuses USING for the new row. Spelling it out
-- makes the intent explicit for anyone reading the policy later.
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE
  USING (
    auth.uid() = id
    OR is_super_admin()
    OR (is_admin() AND business_id = current_business_id())
  )
  WITH CHECK (
    auth.uid() = id
    OR is_super_admin()
    OR (is_admin() AND business_id = current_business_id())
  );

-- -----------------------------------------------------------------------------
-- 3. Signup trigger: never trust role / business_id from signup metadata
-- -----------------------------------------------------------------------------
-- Every new auth user starts as role 'client' with no business. Server code
-- (service role) then promotes them:
--   * self-serve signup ........ src/lib/platform-onboard.ts (createBusiness…)
--   * platform admin invite .... src/lib/platform-onboard.ts (invite…Admin)
--   * staff invite ............. src/lib/staff.ts (inviteStaffMember)
--   * clients / request form ... api/clients, api/request, client-portal-*
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, business_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    'client',
    NULL
  );
  RETURN NEW;
END;
$$;

COMMIT;

-- =============================================================================
-- Verify (read-only), run after the migration:
--   select tgname from pg_trigger
--   where tgrelid = 'public.profiles'::regclass and not tgisinternal;
--     → profiles_updated_at, profiles_guard_privileged_columns
--   select policyname, with_check from pg_policies
--   where tablename = 'profiles' and cmd = 'UPDATE';
--     → with_check is no longer null
-- =============================================================================

-- =============================================================================
-- ROLLBACK (only if something legitimate breaks; this reopens both holes):
--
-- BEGIN;
-- DROP TRIGGER IF EXISTS profiles_guard_privileged_columns ON public.profiles;
-- DROP FUNCTION IF EXISTS public.guard_profile_privileged_columns();
-- -- Restore the v90b signup trigger body from supabase/migration-v90b-staff-accounts.sql
-- -- (section 4, "handle_new_user — allow staff from invite metadata only").
-- COMMIT;
-- =============================================================================
