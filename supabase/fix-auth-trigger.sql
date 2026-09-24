-- Canonical handle_new_user (kept in sync with migration-v90b-staff-accounts.sql)
-- Run this in Supabase SQL Editor only when repairing a drifted trigger.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  meta_role TEXT := COALESCE(NEW.raw_user_meta_data->>'role', '');
  resolved_role public.user_role;
  resolved_business UUID;
BEGIN
  IF meta_role = 'admin' THEN
    resolved_role := 'admin';
  ELSIF meta_role = 'staff' THEN
    resolved_role := 'staff';
  ELSE
    resolved_role := 'client';
  END IF;

  resolved_business := NULL;
  IF pg_input_is_valid(COALESCE(NEW.raw_user_meta_data->>'business_id', ''), 'uuid') THEN
    SELECT id INTO resolved_business
    FROM businesses
    WHERE id = (NEW.raw_user_meta_data->>'business_id')::uuid
      AND deleted_at IS NULL;
  END IF;

  IF resolved_role = 'staff' AND resolved_business IS NULL THEN
    resolved_role := 'client';
  END IF;

  INSERT INTO public.profiles (id, email, full_name, role, business_id, email_notifications_enabled, in_app_notifications_enabled)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    resolved_role,
    resolved_business,
    true,
    true
  );
  RETURN NEW;
EXCEPTION
  WHEN unique_violation THEN
    RETURN NEW;
END;
$$;

GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT ALL ON TABLE public.profiles TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO supabase_auth_admin;

DROP POLICY IF EXISTS "Auth service can insert profiles" ON public.profiles;
CREATE POLICY "Auth service can insert profiles"
  ON public.profiles
  FOR INSERT
  TO supabase_auth_admin
  WITH CHECK (true);

-- UPDATE public.profiles SET role = 'admin' WHERE email = 'your@email.com';
