-- Swift Portal V90b — staff accounts schema (run AFTER migration-v90-staff-role.sql)
--
-- 'staff' is a business-scoped seat (profiles.business_id NOT NULL for staff).
-- Permissions live as JSONB on profiles (loaded with every getProfile — no extra round trip).
-- project_staff is the assignment table for later phases (scoping not enforced yet).
--
-- is_admin() is intentionally UNCHANGED — staff never passes RLS admin policies.
-- handle_new_user accepts role=staff only from invite metadata (never public signup).

-- ---------------------------------------------------------------------------
-- 1. Profiles: permissions JSONB + soft-disable (releases seat)
-- ---------------------------------------------------------------------------

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS staff_permissions JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS disabled_at TIMESTAMPTZ;

COMMENT ON COLUMN profiles.staff_permissions IS
  'Per-staff permission flags (phase 2+). Empty object in phase 1. Queried with the profile row.';
COMMENT ON COLUMN profiles.disabled_at IS
  'When set, staff/admin seat is released and sign-in is blocked for this profile.';

CREATE INDEX IF NOT EXISTS idx_profiles_business_seat
  ON profiles (business_id)
  WHERE role IN ('admin', 'staff') AND disabled_at IS NULL;

-- ---------------------------------------------------------------------------
-- 2. project_staff — assignment store (enforcement is a later phase)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS project_staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  added_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_project_staff_business_id ON project_staff (business_id);
CREATE INDEX IF NOT EXISTS idx_project_staff_user_id ON project_staff (user_id);
CREATE INDEX IF NOT EXISTS idx_project_staff_project_id ON project_staff (project_id);

DROP TRIGGER IF EXISTS trg_project_staff_project_id_same_business ON project_staff;
CREATE TRIGGER trg_project_staff_project_id_same_business
  BEFORE INSERT OR UPDATE ON project_staff
  FOR EACH ROW
  EXECUTE FUNCTION enforce_same_business('projects', 'project_id');

-- user_id must be a staff (or admin) profile in the same business
CREATE OR REPLACE FUNCTION enforce_project_staff_user_tenant()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  profile_bid UUID;
  profile_role public.user_role;
BEGIN
  SELECT business_id, role INTO profile_bid, profile_role
  FROM profiles
  WHERE id = NEW.user_id;

  IF profile_bid IS NULL OR profile_bid IS DISTINCT FROM NEW.business_id THEN
    RAISE EXCEPTION 'tenant integrity: project_staff.user_id business mismatch';
  END IF;
  IF profile_role NOT IN ('staff', 'admin') THEN
    RAISE EXCEPTION 'project_staff.user_id must be staff or admin';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_project_staff_user_tenant ON project_staff;
CREATE TRIGGER trg_project_staff_user_tenant
  BEFORE INSERT OR UPDATE ON project_staff
  FOR EACH ROW
  EXECUTE FUNCTION enforce_project_staff_user_tenant();

ALTER TABLE project_staff ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins full access project_staff" ON project_staff;
CREATE POLICY "Admins full access project_staff" ON project_staff
  FOR ALL
  USING (is_super_admin() OR (is_admin() AND business_id = current_business_id()))
  WITH CHECK (is_super_admin() OR (is_admin() AND business_id = current_business_id()));

-- Staff may read their own assignment rows (no write)
DROP POLICY IF EXISTS "Staff read own project_staff" ON project_staff;
CREATE POLICY "Staff read own project_staff" ON project_staff
  FOR SELECT USING (
    user_id = auth.uid()
    AND business_id = current_business_id()
    AND EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'staff' AND p.disabled_at IS NULL
    )
  );

-- ---------------------------------------------------------------------------
-- 3. is_staff() — additive helper; is_admin() stays admin-only (default deny)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION is_staff()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND role = 'staff'
      AND disabled_at IS NULL
  );
$$;

-- ---------------------------------------------------------------------------
-- 4. handle_new_user — allow staff from invite metadata only
--    Public signup still cannot mint staff (signup metadata uses admin|omit→client).
-- ---------------------------------------------------------------------------

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
  -- Never mint super_admin from signup/invite metadata.
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

  -- Staff invites MUST carry a valid business_id; otherwise fall back to client
  -- so a forged metadata role cannot create orphan staff.
  IF resolved_role = 'staff' AND resolved_business IS NULL THEN
    resolved_role := 'client';
  END IF;

  INSERT INTO public.profiles (id, email, full_name, role, business_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    resolved_role,
    resolved_business
  );
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 5. Verification helpers (manual)
-- ---------------------------------------------------------------------------
-- SELECT unnest(enum_range(NULL::user_role)) AS user_role;
-- SELECT count(*) FROM project_staff;  -- expect 0 initially
