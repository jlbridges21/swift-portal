-- Swift Portal V81 — passwordless email sharing (project_shares)
-- Shared viewers are NOT clients: access via project_shares row + profile email match.

CREATE TABLE IF NOT EXISTS project_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  invited_by UUID REFERENCES profiles(id),
  invited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notified_at TIMESTAMPTZ,
  last_accessed_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ
);

ALTER TABLE project_shares ALTER COLUMN business_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_project_shares_business_id ON project_shares (business_id);
CREATE INDEX IF NOT EXISTS idx_project_shares_project_id ON project_shares (project_id);
CREATE INDEX IF NOT EXISTS idx_project_shares_email_lower ON project_shares (lower(email));

CREATE UNIQUE INDEX IF NOT EXISTS idx_project_shares_active_project_email
  ON project_shares (project_id, lower(email))
  WHERE revoked_at IS NULL;

DROP TRIGGER IF EXISTS trg_project_shares_project_id_same_business ON project_shares;
CREATE TRIGGER trg_project_shares_project_id_same_business
  BEFORE INSERT OR UPDATE ON project_shares
  FOR EACH ROW
  EXECUTE FUNCTION enforce_same_business('projects', 'project_id');

-- Normalize email to lowercase on write
CREATE OR REPLACE FUNCTION normalize_project_share_email()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.email IS NOT NULL THEN
    NEW.email := lower(trim(NEW.email));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_project_shares_normalize_email ON project_shares;
CREATE TRIGGER trg_project_shares_normalize_email
  BEFORE INSERT OR UPDATE OF email ON project_shares
  FOR EACH ROW
  EXECUTE FUNCTION normalize_project_share_email();

-- ---------------------------------------------------------------------------
-- Access helpers — single SQL source aligned with resolveProjectAccess (app)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION user_has_active_project_share(p_project_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  caller_email TEXT;
BEGIN
  SELECT lower(trim(email)) INTO caller_email
  FROM profiles
  WHERE id = auth.uid();

  IF caller_email IS NULL OR caller_email = '' THEN
    RETURN FALSE;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM project_shares ps
    JOIN projects p ON p.id = ps.project_id
    WHERE ps.project_id = p_project_id
      AND ps.revoked_at IS NULL
      AND ps.email = caller_email
      AND p.deleted_at IS NULL
  );
END;
$$;

CREATE OR REPLACE FUNCTION client_has_project_access(p_project_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  -- Assigned client (unchanged — does NOT require a share row)
  IF (
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
  ) THEN
    RETURN TRUE;
  END IF;

  -- Passwordless shared viewer
  RETURN user_has_active_project_share(p_project_id);
END;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

ALTER TABLE project_shares ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins full access project_shares" ON project_shares;
CREATE POLICY "Admins full access project_shares" ON project_shares
  FOR ALL
  USING (is_super_admin() OR (is_admin() AND business_id = current_business_id()))
  WITH CHECK (is_super_admin() OR (is_admin() AND business_id = current_business_id()));

-- Shared viewers may read their own share rows (email match)
DROP POLICY IF EXISTS "Shared viewers read own project_shares" ON project_shares;
CREATE POLICY "Shared viewers read own project_shares" ON project_shares
  FOR SELECT USING (
    revoked_at IS NULL
    AND lower(email) = lower(COALESCE((SELECT email FROM profiles WHERE id = auth.uid()), ''))
  );

-- Projects: allow shared viewers (host-scoped reads still filter business_id in app)
DROP POLICY IF EXISTS "Clients view own projects" ON projects;
CREATE POLICY "Clients view own projects" ON projects
  FOR SELECT USING (
    deleted_at IS NULL
    AND (
      (
        business_id = current_business_id()
        AND (
          client_id = get_user_client_id()
          OR client_has_project_access(id)
        )
      )
      OR user_has_active_project_share(id)
    )
  );

GRANT SELECT ON project_shares TO authenticated;

-- Shared viewers: extend client read policies beyond current_business_id() = NULL
DROP POLICY IF EXISTS "Clients view own media" ON media_assets;
CREATE POLICY "Clients view own media" ON media_assets
  FOR SELECT USING (
    client_has_project_access(project_id)
    AND (
      business_id = current_business_id()
      OR user_has_active_project_share(project_id)
    )
  );

DROP POLICY IF EXISTS "Clients view own media_folders" ON media_folders;
CREATE POLICY "Clients view own media_folders" ON media_folders
  FOR SELECT USING (
    client_has_project_access(project_id)
    AND (
      business_id = current_business_id()
      OR user_has_active_project_share(project_id)
    )
  );

DROP POLICY IF EXISTS "Clients view own tours" ON tours;
CREATE POLICY "Clients view own tours" ON tours
  FOR SELECT USING (
    client_has_project_access(project_id)
    AND (
      business_id = current_business_id()
      OR user_has_active_project_share(project_id)
    )
  );

DROP POLICY IF EXISTS "Clients view own video_reviews" ON video_reviews;
CREATE POLICY "Clients view own video_reviews" ON video_reviews
  FOR SELECT USING (
    client_has_project_access(project_id)
    AND (
      business_id = current_business_id()
      OR user_has_active_project_share(project_id)
    )
  );

DROP POLICY IF EXISTS "Clients view own video_review_versions" ON video_review_versions;
CREATE POLICY "Clients view own video_review_versions" ON video_review_versions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM video_reviews vr
      WHERE vr.id = review_id
        AND client_has_project_access(vr.project_id)
        AND (
          vr.business_id = current_business_id()
          OR user_has_active_project_share(vr.project_id)
        )
    )
  );

DROP POLICY IF EXISTS "Clients view own video_review_comments" ON video_review_comments;
CREATE POLICY "Clients view own video_review_comments" ON video_review_comments
  FOR SELECT USING (
    client_has_project_access(project_id)
    AND (
      business_id = current_business_id()
      OR user_has_active_project_share(project_id)
    )
  );

DROP POLICY IF EXISTS "Clients manage own video_review_comments" ON video_review_comments;
CREATE POLICY "Clients manage own video_review_comments" ON video_review_comments
  FOR ALL
  USING (
    client_has_project_access(project_id)
    AND (
      business_id = current_business_id()
      OR user_has_active_project_share(project_id)
    )
    AND author_kind = 'client'
    AND author_user_id = auth.uid()
  )
  WITH CHECK (
    client_has_project_access(project_id)
    AND (
      business_id = current_business_id()
      OR user_has_active_project_share(project_id)
    )
    AND author_kind = 'client'
    AND author_user_id = auth.uid()
  );
