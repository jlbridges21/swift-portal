-- Fix: "Database error saving new user" when creating/inviting users
-- Run this in Supabase SQL Editor

-- 1. Replace trigger function with a safe version (no invalid enum casts, correct search_path)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, email_notifications_enabled, in_app_notifications_enabled)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    CASE
      WHEN NEW.raw_user_meta_data->>'role' = 'admin' THEN 'admin'::public.user_role
      ELSE 'client'::public.user_role
    END,
    true,
    true
  );
  RETURN NEW;
EXCEPTION
  WHEN unique_violation THEN
    -- Profile already exists (e.g. retry) — don't block auth user creation
    RETURN NEW;
END;
$$;

-- 2. Allow Supabase Auth service to run the trigger and insert profiles
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT ALL ON TABLE public.profiles TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO supabase_auth_admin;

-- 3. RLS policy so auth admin can insert profiles during signup/invite
DROP POLICY IF EXISTS "Auth service can insert profiles" ON public.profiles;
CREATE POLICY "Auth service can insert profiles"
  ON public.profiles
  FOR INSERT
  TO supabase_auth_admin
  WITH CHECK (true);

-- 4. Recreate trigger (idempotent)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 5. After creating your first user in Auth dashboard, promote to admin:
-- UPDATE public.profiles SET role = 'admin' WHERE email = 'your@email.com';
