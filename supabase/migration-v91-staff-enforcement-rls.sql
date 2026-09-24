-- Swift Portal V91 — staff RLS for operational tables (Phase 3)
--
-- App-layer staffCan() + project scoping remain the security boundary for
-- permissions. These policies let active staff in the current business READ/WRITE
-- operational rows via the user session (createClient). Never-delegable surfaces
-- (billing settings mutations, custom domain, stripe connect, staff management)
-- stay is_admin()-only.

CREATE OR REPLACE FUNCTION is_business_staff()
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
      AND business_id IS NOT NULL
      AND business_id = current_business_id()
  );
$$;

COMMENT ON FUNCTION is_business_staff() IS
  'Active staff whose profiles.business_id matches current_business_id().';

-- Helper: staff may see this project (view_all or project_staff assignment)
CREATE OR REPLACE FUNCTION staff_can_access_project(p_project_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT is_business_staff() AND (
    COALESCE((SELECT staff_permissions->'projects.view_all' FROM profiles WHERE id = auth.uid()), 'false'::jsonb) = 'true'::jsonb
    OR EXISTS (
      SELECT 1 FROM project_staff ps
      WHERE ps.project_id = p_project_id
        AND ps.user_id = auth.uid()
        AND ps.business_id = current_business_id()
    )
  );
$$;

-- ---------------------------------------------------------------------------
-- Operational tables — staff tenant access (business_id scoped)
-- Project-scoped tables also require staff_can_access_project where applicable.
-- ---------------------------------------------------------------------------

-- projects
DROP POLICY IF EXISTS "Staff access projects" ON projects;
CREATE POLICY "Staff access projects" ON projects
  FOR ALL
  USING (is_business_staff() AND business_id = current_business_id() AND staff_can_access_project(id))
  WITH CHECK (is_business_staff() AND business_id = current_business_id());

-- project_staff: staff can read assignments in-tenant; writes still admin via existing policy
-- (Phase 2 API is admin-only; Phase 3 manage_staff checked in app — allow staff write when assigned)
DROP POLICY IF EXISTS "Staff manage project_staff" ON project_staff;
CREATE POLICY "Staff manage project_staff" ON project_staff
  FOR ALL
  USING (is_business_staff() AND business_id = current_business_id())
  WITH CHECK (is_business_staff() AND business_id = current_business_id());

-- project_clients
DROP POLICY IF EXISTS "Staff access project_clients" ON project_clients;
CREATE POLICY "Staff access project_clients" ON project_clients
  FOR ALL
  USING (is_business_staff() AND business_id = current_business_id() AND staff_can_access_project(project_id))
  WITH CHECK (is_business_staff() AND business_id = current_business_id() AND staff_can_access_project(project_id));

-- clients: visible if attached to a visible project OR staff has area.clients
-- (broader SELECT; app filters lists)
DROP POLICY IF EXISTS "Staff access clients" ON clients;
CREATE POLICY "Staff access clients" ON clients
  FOR ALL
  USING (
    is_business_staff() AND business_id = current_business_id() AND (
      COALESCE((SELECT staff_permissions->'projects.view_all' FROM profiles WHERE id = auth.uid()), 'false'::jsonb) = 'true'::jsonb
      OR EXISTS (
        SELECT 1 FROM project_clients pc
        JOIN project_staff ps ON ps.project_id = pc.project_id AND ps.user_id = auth.uid()
        WHERE pc.client_id = clients.id AND pc.business_id = current_business_id()
      )
      OR COALESCE((SELECT staff_permissions->'area.clients' FROM profiles WHERE id = auth.uid()), 'false'::jsonb) = 'true'::jsonb
    )
  )
  WITH CHECK (is_business_staff() AND business_id = current_business_id());

-- media_assets
DROP POLICY IF EXISTS "Staff access media_assets" ON media_assets;
CREATE POLICY "Staff access media_assets" ON media_assets
  FOR ALL
  USING (
    is_business_staff() AND business_id = current_business_id() AND (
      project_id IS NULL
      OR staff_can_access_project(project_id)
    )
  )
  WITH CHECK (
    is_business_staff() AND business_id = current_business_id() AND (
      project_id IS NULL OR staff_can_access_project(project_id)
    )
  );

-- media_folders
DROP POLICY IF EXISTS "Staff access media_folders" ON media_folders;
CREATE POLICY "Staff access media_folders" ON media_folders
  FOR ALL
  USING (is_business_staff() AND business_id = current_business_id() AND staff_can_access_project(project_id))
  WITH CHECK (is_business_staff() AND business_id = current_business_id() AND staff_can_access_project(project_id));

-- messages (project_messages)
DROP POLICY IF EXISTS "Staff access project_messages" ON project_messages;
CREATE POLICY "Staff access project_messages" ON project_messages
  FOR ALL
  USING (is_business_staff() AND business_id = current_business_id() AND staff_can_access_project(project_id))
  WITH CHECK (is_business_staff() AND business_id = current_business_id() AND staff_can_access_project(project_id));

DROP POLICY IF EXISTS "Staff access client_messages" ON client_messages;
CREATE POLICY "Staff access client_messages" ON client_messages
  FOR ALL
  USING (is_business_staff() AND business_id = current_business_id())
  WITH CHECK (is_business_staff() AND business_id = current_business_id());

-- shoot_proposals
DROP POLICY IF EXISTS "Staff access shoot_proposals" ON shoot_proposals;
CREATE POLICY "Staff access shoot_proposals" ON shoot_proposals
  FOR ALL
  USING (is_business_staff() AND business_id = current_business_id() AND staff_can_access_project(project_id))
  WITH CHECK (is_business_staff() AND business_id = current_business_id() AND staff_can_access_project(project_id));

-- payments
DROP POLICY IF EXISTS "Staff access payments" ON payments;
CREATE POLICY "Staff access payments" ON payments
  FOR ALL
  USING (is_business_staff() AND business_id = current_business_id() AND staff_can_access_project(project_id))
  WITH CHECK (is_business_staff() AND business_id = current_business_id() AND staff_can_access_project(project_id));

-- project_quotes
DROP POLICY IF EXISTS "Staff access project_quotes" ON project_quotes;
CREATE POLICY "Staff access project_quotes" ON project_quotes
  FOR ALL
  USING (is_business_staff() AND business_id = current_business_id() AND staff_can_access_project(project_id))
  WITH CHECK (is_business_staff() AND business_id = current_business_id() AND staff_can_access_project(project_id));

-- tours
DROP POLICY IF EXISTS "Staff access tours" ON tours;
CREATE POLICY "Staff access tours" ON tours
  FOR ALL
  USING (is_business_staff() AND business_id = current_business_id() AND staff_can_access_project(project_id))
  WITH CHECK (is_business_staff() AND business_id = current_business_id() AND staff_can_access_project(project_id));

-- project_3d_models
DROP POLICY IF EXISTS "Staff access project_3d_models" ON project_3d_models;
CREATE POLICY "Staff access project_3d_models" ON project_3d_models
  FOR ALL
  USING (is_business_staff() AND business_id = current_business_id() AND staff_can_access_project(project_id))
  WITH CHECK (is_business_staff() AND business_id = current_business_id() AND staff_can_access_project(project_id));

-- activity_logs
DROP POLICY IF EXISTS "Staff access activity_logs" ON activity_logs;
CREATE POLICY "Staff access activity_logs" ON activity_logs
  FOR ALL
  USING (
    is_business_staff() AND business_id = current_business_id() AND (
      project_id IS NULL OR staff_can_access_project(project_id)
    )
  )
  WITH CHECK (is_business_staff() AND business_id = current_business_id());

-- revisions
DROP POLICY IF EXISTS "Staff access revisions" ON revisions;
CREATE POLICY "Staff access revisions" ON revisions
  FOR ALL
  USING (is_business_staff() AND business_id = current_business_id() AND staff_can_access_project(project_id))
  WITH CHECK (is_business_staff() AND business_id = current_business_id() AND staff_can_access_project(project_id));

-- asset_reviews
DROP POLICY IF EXISTS "Staff access asset_reviews" ON asset_reviews;
CREATE POLICY "Staff access asset_reviews" ON asset_reviews
  FOR ALL
  USING (is_business_staff() AND business_id = current_business_id() AND staff_can_access_project(project_id))
  WITH CHECK (is_business_staff() AND business_id = current_business_id() AND staff_can_access_project(project_id));

-- video_reviews (if present)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'video_reviews') THEN
    EXECUTE $p$
      DROP POLICY IF EXISTS "Staff access video_reviews" ON video_reviews;
      CREATE POLICY "Staff access video_reviews" ON video_reviews
        FOR ALL
        USING (is_business_staff() AND business_id = current_business_id() AND staff_can_access_project(project_id))
        WITH CHECK (is_business_staff() AND business_id = current_business_id() AND staff_can_access_project(project_id));
    $p$;
  END IF;
END $$;

-- notifications: staff read own
DROP POLICY IF EXISTS "Staff read own notifications" ON notifications;
CREATE POLICY "Staff read own notifications" ON notifications
  FOR SELECT
  USING (is_business_staff() AND user_id = auth.uid());

-- Storage: allow staff same path rules as admin within tenant (folder = business_id)
-- Extend existing admin checks by OR is_business_staff() where policies use is_admin().
-- Done carefully via new policies rather than rewriting all v36 policies.

DROP POLICY IF EXISTS "Staff storage project-media" ON storage.objects;
CREATE POLICY "Staff storage project-media" ON storage.objects
  FOR ALL
  USING (
    bucket_id IN ('project-media', 'project-documents')
    AND is_business_staff()
    AND current_business_id() IS NOT NULL
    AND (storage.foldername(name))[1] = current_business_id()::text
  )
  WITH CHECK (
    bucket_id IN ('project-media', 'project-documents')
    AND is_business_staff()
    AND current_business_id() IS NOT NULL
    AND (storage.foldername(name))[1] = current_business_id()::text
  );

-- Auto-assign staff creator so insert().select() can see the new row under RLS
CREATE OR REPLACE FUNCTION auto_assign_staff_project_creator()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND role = 'staff'
      AND disabled_at IS NULL
      AND business_id = NEW.business_id
  ) THEN
    INSERT INTO project_staff (business_id, project_id, user_id, added_by)
    VALUES (NEW.business_id, NEW.id, auth.uid(), auth.uid())
    ON CONFLICT (project_id, user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_assign_staff_project_creator ON projects;
CREATE TRIGGER trg_auto_assign_staff_project_creator
  AFTER INSERT ON projects
  FOR EACH ROW
  EXECUTE FUNCTION auto_assign_staff_project_creator();
