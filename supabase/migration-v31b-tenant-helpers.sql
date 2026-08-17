-- Swift Portal V31b — PART 2 of 2 (run AFTER migration-v31-roles.sql succeeds)
-- Tenant-aware SQL helpers: is_super_admin, current_business_id, scoped
-- get_user_client_id / client_has_project_access, handle_new_user writes
-- profiles.business_id from signup metadata.
--
-- HOW TO RUN:
-- 1. Confirm v31 completed with no errors in a previous SQL Editor query
-- 2. Open a NEW query, paste this entire file, click Run
--
-- VERIFICATION (also at the bottom of this file):
--   1. v31 ran alone and succeeded.
--   2. This file completes with no errors. Note the step-6 NOTICE for how
--      many profiles were backfilled.
--   3. The step-8 queries: enum includes super_admin; NULL business_id
--      count for non-super_admin profiles is 0; helpers exist and are STABLE.
--   4. npm run typecheck && npm run build
--   5–9. App / production smoke tests listed in the prompt (do not rewrite
--      RLS in this step; /platform is expected 404).
--
-- 'admin' is still business admin. 'super_admin' is additive. No RLS
-- policy bodies are changed here.
--
-- Swift Aerial Media tenant UUID:
--   00000000-0000-0000-0000-000000000001

-- ---------------------------------------------------------------------------
-- 1. is_super_admin()
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'super_admin'
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 2. current_business_id()
--    a) super_admin impersonation GUC (inert until the platform console)
--    b) profiles.business_id
--    c) clients.business_id for the caller's user_id (non-deleted)
--    d) NULL
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION current_business_id()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  impersonated_raw TEXT;
  impersonated_id  UUID;
  profile_bid      UUID;
  client_bid       UUID;
BEGIN
  -- a) Impersonation: only for super_admin, only a real non-deleted business.
  --    Never throw on a missing, empty, or malformed GUC.
  IF is_super_admin() THEN
    impersonated_raw := current_setting('app.impersonated_business_id', true);
    IF impersonated_raw IS NOT NULL
       AND impersonated_raw <> ''
       AND pg_input_is_valid(impersonated_raw, 'uuid') THEN
      SELECT id INTO impersonated_id
      FROM businesses
      WHERE id = impersonated_raw::uuid
        AND deleted_at IS NULL;
      IF impersonated_id IS NOT NULL THEN
        RETURN impersonated_id;
      END IF;
    END IF;
  END IF;

  -- b) Caller's profile
  SELECT business_id INTO profile_bid
  FROM profiles
  WHERE id = auth.uid();

  IF profile_bid IS NOT NULL THEN
    RETURN profile_bid;
  END IF;

  -- c) Client whose profile has no business_id
  SELECT business_id INTO client_bid
  FROM clients
  WHERE user_id = auth.uid()
    AND deleted_at IS NULL
  LIMIT 1;

  RETURN client_bid;
END;
$$;

-- ---------------------------------------------------------------------------
-- 3. get_user_client_id() — same signature / SECURITY DEFINER STABLE as v26
--    profiles.client_id path unchanged; user_id fallback is tenant-scoped.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_user_client_id()
RETURNS UUID AS $$
DECLARE
  cid UUID;
BEGIN
  SELECT client_id INTO cid
  FROM profiles
  WHERE id = auth.uid();

  IF cid IS NOT NULL THEN
    RETURN cid;
  END IF;

  SELECT id INTO cid
  FROM clients
  WHERE user_id = auth.uid()
    AND deleted_at IS NULL
    AND business_id = current_business_id()
  LIMIT 1;

  RETURN cid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ---------------------------------------------------------------------------
-- 4. client_has_project_access(p_project_id UUID)
--    Same signature as v3. Existing junction / legacy client_id checks,
--    plus the project's business_id must match current_business_id().
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION client_has_project_access(p_project_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (
    EXISTS (
      SELECT 1 FROM project_clients
      WHERE project_id = p_project_id AND client_id = get_user_client_id()
    ) OR EXISTS (
      SELECT 1 FROM projects
      WHERE id = p_project_id AND client_id = get_user_client_id()
    )
  ) AND EXISTS (
    SELECT 1 FROM projects
    WHERE id = p_project_id AND business_id = current_business_id()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ---------------------------------------------------------------------------
-- 5. handle_new_user() — start from fix-auth-trigger.sql
--    Plus: write profiles.business_id from metadata when it is a valid UUID
--    of an existing (non-deleted) business. Role derivation unchanged:
--    only 'admin' or 'client' — never 'super_admin' from signup metadata.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, email_notifications_enabled, in_app_notifications_enabled, business_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    CASE
      WHEN NEW.raw_user_meta_data->>'role' = 'admin' THEN 'admin'::public.user_role
      ELSE 'client'::public.user_role
    END,
    true,
    true,
    CASE
      WHEN pg_input_is_valid(COALESCE(NEW.raw_user_meta_data->>'business_id', ''), 'uuid') THEN (
        SELECT b.id
        FROM businesses b
        WHERE b.id = (NEW.raw_user_meta_data->>'business_id')::uuid
          AND b.deleted_at IS NULL
      )
      ELSE NULL
    END
  );
  RETURN NEW;
EXCEPTION
  WHEN unique_violation THEN
    -- Profile already exists (e.g. retry) — don't block auth user creation
    RETURN NEW;
END;
$$;

GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT ALL ON TABLE public.profiles TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO supabase_auth_admin;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ---------------------------------------------------------------------------
-- 6. Backfill AFTER the trigger update
--    Accounts created since v29 have NULL profiles.business_id because the
--    old handle_new_user() did not set it. Leave super_admin rows NULL.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  n INT;
BEGIN
  UPDATE profiles
  SET business_id = '00000000-0000-0000-0000-000000000001'
  WHERE business_id IS NULL
    AND role IN ('admin', 'client');
  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE 'v31b step 6: backfilled % profiles.business_id row(s) to Swift', n;
END $$;

-- ---------------------------------------------------------------------------
-- 7. Manual promotion (run by a human, not this migration)
-- ---------------------------------------------------------------------------
-- UPDATE profiles SET role = 'super_admin', business_id = NULL WHERE email = 'YOUR@EMAIL';

-- ---------------------------------------------------------------------------
-- 8. Verification
-- ---------------------------------------------------------------------------
SELECT unnest(enum_range(NULL::user_role)) AS user_role;

SELECT count(*) AS null_business_id_non_super_admin
FROM profiles
WHERE business_id IS NULL AND role <> 'super_admin';

SELECT
  p.proname,
  CASE p.provolatile
    WHEN 's' THEN 'STABLE'
    WHEN 'i' THEN 'IMMUTABLE'
    WHEN 'v' THEN 'VOLATILE'
  END AS volatility
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('current_business_id', 'is_super_admin')
ORDER BY p.proname;
