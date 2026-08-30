-- ShootPortal V77 — Video review data model (phase 1: schema + integrity only)
--
-- Structured timecoded comments on versioned video assets. Complements the existing
-- `revisions` table (project-level text requests) and `asset_reviews` (approve/reject).
-- Does NOT replace either workflow.
--
-- Idempotent / re-runnable.

-- ---------------------------------------------------------------------------
-- 1. video_reviews
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS video_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses (id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  created_by UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_video_reviews_business_id ON video_reviews (business_id);
CREATE INDEX IF NOT EXISTS idx_video_reviews_project_id ON video_reviews (project_id);

DROP TRIGGER IF EXISTS video_reviews_updated_at ON video_reviews;
CREATE TRIGGER video_reviews_updated_at
  BEFORE UPDATE ON video_reviews
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ---------------------------------------------------------------------------
-- 2. video_review_versions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS video_review_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses (id) ON DELETE CASCADE,
  review_id UUID NOT NULL REFERENCES video_reviews (id) ON DELETE CASCADE,
  media_asset_id UUID NOT NULL REFERENCES media_assets (id) ON DELETE RESTRICT,
  version_number INTEGER NOT NULL CHECK (version_number >= 1),
  uploaded_by UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT video_review_versions_review_version_unique UNIQUE (review_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_video_review_versions_business_id ON video_review_versions (business_id);
CREATE INDEX IF NOT EXISTS idx_video_review_versions_review_id ON video_review_versions (review_id);
CREATE INDEX IF NOT EXISTS idx_video_review_versions_media_asset_id ON video_review_versions (media_asset_id);

-- ---------------------------------------------------------------------------
-- 3. video_review_comments
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS video_review_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses (id) ON DELETE CASCADE,
  review_id UUID NOT NULL REFERENCES video_reviews (id) ON DELETE CASCADE,
  version_id UUID NOT NULL REFERENCES video_review_versions (id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
  parent_comment_id UUID REFERENCES video_review_comments (id) ON DELETE CASCADE,
  author_user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE RESTRICT,
  author_kind TEXT NOT NULL CHECK (author_kind IN ('client', 'admin')),
  timestamp_seconds NUMERIC CHECK (timestamp_seconds IS NULL OR timestamp_seconds >= 0),
  point_x NUMERIC,
  point_y NUMERIC,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'unresolved' CHECK (status IN ('unresolved', 'resolved')),
  resolved_by UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT video_review_comments_top_level_timestamp CHECK (
    parent_comment_id IS NOT NULL OR timestamp_seconds IS NOT NULL
  ),
  CONSTRAINT video_review_comments_reply_no_timestamp CHECK (
    parent_comment_id IS NULL OR timestamp_seconds IS NULL
  ),
  CONSTRAINT video_review_comments_reply_no_points CHECK (
    parent_comment_id IS NULL
    OR (point_x IS NULL AND point_y IS NULL)
  ),
  CONSTRAINT video_review_comments_reply_no_status CHECK (
    parent_comment_id IS NULL
    OR (
      status = 'unresolved'
      AND resolved_by IS NULL
      AND resolved_at IS NULL
    )
  ),
  CONSTRAINT video_review_comments_points_pair CHECK (
    (point_x IS NULL AND point_y IS NULL)
    OR (
      point_x IS NOT NULL
      AND point_y IS NOT NULL
      AND point_x >= 0
      AND point_x <= 1
      AND point_y >= 0
      AND point_y <= 1
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_video_review_comments_business_id ON video_review_comments (business_id);
CREATE INDEX IF NOT EXISTS idx_video_review_comments_review_id ON video_review_comments (review_id);
CREATE INDEX IF NOT EXISTS idx_video_review_comments_version_id ON video_review_comments (version_id);
CREATE INDEX IF NOT EXISTS idx_video_review_comments_project_id ON video_review_comments (project_id);
CREATE INDEX IF NOT EXISTS idx_video_review_comments_parent_id ON video_review_comments (parent_comment_id);

DROP TRIGGER IF EXISTS video_review_comments_updated_at ON video_review_comments;
CREATE TRIGGER video_review_comments_updated_at
  BEFORE UPDATE ON video_review_comments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ---------------------------------------------------------------------------
-- 4. Shape / reference integrity (beyond cross-tenant triggers)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION enforce_video_review_comment_shape()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  parent_row video_review_comments%ROWTYPE;
  version_review_id UUID;
BEGIN
  SELECT review_id INTO version_review_id
  FROM video_review_versions
  WHERE id = NEW.version_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'video review comment: version % not found', NEW.version_id;
  END IF;

  IF version_review_id <> NEW.review_id THEN
    RAISE EXCEPTION 'video review comment: version % does not belong to review %',
      NEW.version_id, NEW.review_id;
  END IF;

  IF NEW.parent_comment_id IS NOT NULL THEN
    SELECT * INTO parent_row
    FROM video_review_comments
    WHERE id = NEW.parent_comment_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'video review comment: parent % not found', NEW.parent_comment_id;
    END IF;

    IF parent_row.parent_comment_id IS NOT NULL THEN
      RAISE EXCEPTION 'video review comment: replies cannot nest beyond one level';
    END IF;

    IF parent_row.review_id <> NEW.review_id
      OR parent_row.version_id <> NEW.version_id
      OR parent_row.project_id <> NEW.project_id THEN
      RAISE EXCEPTION 'video review comment: reply must match parent review, version, and project';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_video_review_comments_shape ON video_review_comments;
CREATE TRIGGER trg_video_review_comments_shape
  BEFORE INSERT OR UPDATE ON video_review_comments
  FOR EACH ROW
  EXECUTE FUNCTION enforce_video_review_comment_shape();

CREATE OR REPLACE FUNCTION enforce_video_review_version_project()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  review_project_id UUID;
  asset_project_id UUID;
BEGIN
  SELECT project_id INTO review_project_id
  FROM video_reviews
  WHERE id = NEW.review_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'video review version: review % not found', NEW.review_id;
  END IF;

  SELECT project_id INTO asset_project_id
  FROM media_assets
  WHERE id = NEW.media_asset_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'video review version: media asset % not found', NEW.media_asset_id;
  END IF;

  IF asset_project_id IS DISTINCT FROM review_project_id THEN
    RAISE EXCEPTION 'video review version: media asset project % does not match review project %',
      asset_project_id, review_project_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_video_review_versions_project ON video_review_versions;
CREATE TRIGGER trg_video_review_versions_project
  BEFORE INSERT OR UPDATE ON video_review_versions
  FOR EACH ROW
  EXECUTE FUNCTION enforce_video_review_version_project();

-- ---------------------------------------------------------------------------
-- 5. Cross-tenant integrity (v30 pattern)
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_video_reviews_project_id_same_business ON video_reviews;
CREATE TRIGGER trg_video_reviews_project_id_same_business
  BEFORE INSERT OR UPDATE ON video_reviews
  FOR EACH ROW
  EXECUTE FUNCTION enforce_same_business('projects', 'project_id');

DROP TRIGGER IF EXISTS trg_video_review_versions_review_id_same_business ON video_review_versions;
CREATE TRIGGER trg_video_review_versions_review_id_same_business
  BEFORE INSERT OR UPDATE ON video_review_versions
  FOR EACH ROW
  EXECUTE FUNCTION enforce_same_business('video_reviews', 'review_id');

DROP TRIGGER IF EXISTS trg_video_review_versions_media_asset_id_same_business ON video_review_versions;
CREATE TRIGGER trg_video_review_versions_media_asset_id_same_business
  BEFORE INSERT OR UPDATE ON video_review_versions
  FOR EACH ROW
  EXECUTE FUNCTION enforce_same_business('media_assets', 'media_asset_id');

DROP TRIGGER IF EXISTS trg_video_review_comments_review_id_same_business ON video_review_comments;
CREATE TRIGGER trg_video_review_comments_review_id_same_business
  BEFORE INSERT OR UPDATE ON video_review_comments
  FOR EACH ROW
  EXECUTE FUNCTION enforce_same_business('video_reviews', 'review_id');

DROP TRIGGER IF EXISTS trg_video_review_comments_version_id_same_business ON video_review_comments;
CREATE TRIGGER trg_video_review_comments_version_id_same_business
  BEFORE INSERT OR UPDATE ON video_review_comments
  FOR EACH ROW
  EXECUTE FUNCTION enforce_same_business('video_review_versions', 'version_id');

DROP TRIGGER IF EXISTS trg_video_review_comments_project_id_same_business ON video_review_comments;
CREATE TRIGGER trg_video_review_comments_project_id_same_business
  BEFORE INSERT OR UPDATE ON video_review_comments
  FOR EACH ROW
  EXECUTE FUNCTION enforce_same_business('projects', 'project_id');

DROP TRIGGER IF EXISTS trg_video_review_comments_parent_comment_id_same_business ON video_review_comments;
CREATE TRIGGER trg_video_review_comments_parent_comment_id_same_business
  BEFORE INSERT OR UPDATE ON video_review_comments
  FOR EACH ROW
  EXECUTE FUNCTION enforce_same_business('video_review_comments', 'parent_comment_id');

-- ---------------------------------------------------------------------------
-- 6. Row level security
-- ---------------------------------------------------------------------------
ALTER TABLE video_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_review_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_review_comments ENABLE ROW LEVEL SECURITY;

-- video_reviews
DROP POLICY IF EXISTS "Admins full access video_reviews" ON video_reviews;
CREATE POLICY "Admins full access video_reviews" ON video_reviews
  FOR ALL
  USING (is_super_admin() OR (is_admin() AND business_id = current_business_id()))
  WITH CHECK (is_super_admin() OR (is_admin() AND business_id = current_business_id()));

DROP POLICY IF EXISTS "Clients view own video_reviews" ON video_reviews;
CREATE POLICY "Clients view own video_reviews" ON video_reviews
  FOR SELECT USING (
    business_id = current_business_id()
    AND client_has_project_access(project_id)
  );

-- video_review_versions
DROP POLICY IF EXISTS "Admins full access video_review_versions" ON video_review_versions;
CREATE POLICY "Admins full access video_review_versions" ON video_review_versions
  FOR ALL
  USING (is_super_admin() OR (is_admin() AND business_id = current_business_id()))
  WITH CHECK (is_super_admin() OR (is_admin() AND business_id = current_business_id()));

DROP POLICY IF EXISTS "Clients view own video_review_versions" ON video_review_versions;
CREATE POLICY "Clients view own video_review_versions" ON video_review_versions
  FOR SELECT USING (
    business_id = current_business_id()
    AND EXISTS (
      SELECT 1 FROM video_reviews vr
      WHERE vr.id = review_id
        AND vr.business_id = current_business_id()
        AND client_has_project_access(vr.project_id)
    )
  );

-- video_review_comments
DROP POLICY IF EXISTS "Admins full access video_review_comments" ON video_review_comments;
CREATE POLICY "Admins full access video_review_comments" ON video_review_comments
  FOR ALL
  USING (is_super_admin() OR (is_admin() AND business_id = current_business_id()))
  WITH CHECK (is_super_admin() OR (is_admin() AND business_id = current_business_id()));

DROP POLICY IF EXISTS "Clients view own video_review_comments" ON video_review_comments;
CREATE POLICY "Clients view own video_review_comments" ON video_review_comments
  FOR SELECT USING (
    business_id = current_business_id()
    AND client_has_project_access(project_id)
  );

DROP POLICY IF EXISTS "Clients manage own video_review_comments" ON video_review_comments;
CREATE POLICY "Clients manage own video_review_comments" ON video_review_comments
  FOR ALL
  USING (
    business_id = current_business_id()
    AND client_has_project_access(project_id)
    AND author_kind = 'client'
    AND author_user_id = auth.uid()
  )
  WITH CHECK (
    business_id = current_business_id()
    AND client_has_project_access(project_id)
    AND author_kind = 'client'
    AND author_user_id = auth.uid()
  );
