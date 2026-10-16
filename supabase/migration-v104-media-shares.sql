-- Swift Portal V104 — individual photo sharing (media_shares)
--
-- One row = one grant to ONE photo:
--   kind = 'email' → a per-recipient token emailed to that address (no account is created)
--   kind = 'link'  → "anyone with the link" token; at most one active per photo
--
-- Tokens are stored as SHA-256 hashes (same as project_shares.access_token_hash).
-- Link tokens additionally keep an AES-GCM ciphertext so admins can copy the link
-- again; email tokens are never recoverable.
--
-- Fail closed: a share stops working when the photo is deleted (CASCADE), moved to
-- another folder or project (trigger below, also fires on folder delete's SET NULL),
-- or its project is hidden/deleted (trigger below). The resolver re-checks all of it.
--
-- Safe to run before deploying the app: additive only, no existing rows change.

CREATE TABLE IF NOT EXISTS media_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id),
  media_asset_id UUID NOT NULL REFERENCES media_assets(id) ON DELETE CASCADE,
  -- Location snapshot at share time; the resolver refuses the share if either drifts.
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  folder_id UUID,
  kind TEXT NOT NULL CHECK (kind IN ('email', 'link')),
  email TEXT,
  access_token_hash TEXT NOT NULL,
  token_ciphertext TEXT,
  allow_download BOOLEAN NOT NULL DEFAULT false,
  access_mode TEXT NOT NULL DEFAULT 'reusable' CHECK (access_mode = 'reusable'),
  access_starts_at TIMESTAMPTZ,
  access_expires_at TIMESTAMPTZ,
  expiry_preset TEXT NOT NULL DEFAULT 'indefinite'
    CHECK (expiry_preset IN ('24h', '1week', '30days', '60days', 'indefinite', 'custom')),
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notified_at TIMESTAMPTZ,
  last_accessed_at TIMESTAMPTZ,
  view_count INTEGER NOT NULL DEFAULT 0,
  revoked_at TIMESTAMPTZ,
  revoked_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  revoked_reason TEXT,
  CONSTRAINT media_shares_email_matches_kind CHECK ((kind = 'email') = (email IS NOT NULL)),
  CONSTRAINT media_shares_ciphertext_link_only CHECK (kind = 'link' OR token_ciphertext IS NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_media_shares_access_token_hash
  ON media_shares (access_token_hash);
CREATE INDEX IF NOT EXISTS idx_media_shares_business_id ON media_shares (business_id);
CREATE INDEX IF NOT EXISTS idx_media_shares_media_asset_id ON media_shares (media_asset_id);
CREATE INDEX IF NOT EXISTS idx_media_shares_project_id ON media_shares (project_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_media_shares_one_active_link
  ON media_shares (media_asset_id)
  WHERE kind = 'link' AND revoked_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_media_shares_one_active_email
  ON media_shares (media_asset_id, lower(email))
  WHERE kind = 'email' AND revoked_at IS NULL;

-- Tenant integrity (v30 pattern): the photo and project must belong to business_id.
DROP TRIGGER IF EXISTS trg_media_shares_media_asset_same_business ON media_shares;
CREATE TRIGGER trg_media_shares_media_asset_same_business
  BEFORE INSERT OR UPDATE ON media_shares
  FOR EACH ROW
  EXECUTE FUNCTION enforce_same_business('media_assets', 'media_asset_id');

DROP TRIGGER IF EXISTS trg_media_shares_project_same_business ON media_shares;
CREATE TRIGGER trg_media_shares_project_same_business
  BEFORE INSERT OR UPDATE ON media_shares
  FOR EACH ROW
  EXECUTE FUNCTION enforce_same_business('projects', 'project_id');

-- Reuse the v81 email normalizer (lower + trim on NEW.email).
DROP TRIGGER IF EXISTS trg_media_shares_normalize_email ON media_shares;
CREATE TRIGGER trg_media_shares_normalize_email
  BEFORE INSERT OR UPDATE OF email ON media_shares
  FOR EACH ROW
  EXECUTE FUNCTION normalize_project_share_email();

-- ---------------------------------------------------------------------------
-- Fail-closed revocation
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION revoke_media_shares_on_asset_move()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.project_id IS DISTINCT FROM NEW.project_id
     OR OLD.folder_id IS DISTINCT FROM NEW.folder_id THEN
    UPDATE media_shares
       SET revoked_at = now(),
           revoked_reason = 'moved'
     WHERE media_asset_id = NEW.id
       AND revoked_at IS NULL;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_media_assets_revoke_shares_on_move ON media_assets;
CREATE TRIGGER trg_media_assets_revoke_shares_on_move
  AFTER UPDATE OF project_id, folder_id ON media_assets
  FOR EACH ROW
  EXECUTE FUNCTION revoke_media_shares_on_asset_move();

CREATE OR REPLACE FUNCTION revoke_media_shares_on_project_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
    UPDATE media_shares
       SET revoked_at = now(),
           revoked_reason = 'project_deleted'
     WHERE project_id = NEW.id
       AND revoked_at IS NULL;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_projects_revoke_media_shares_on_delete ON projects;
CREATE TRIGGER trg_projects_revoke_media_shares_on_delete
  AFTER UPDATE OF deleted_at ON projects
  FOR EACH ROW
  EXECUTE FUNCTION revoke_media_shares_on_project_delete();

-- Atomic view counter (avoids the read-modify-write race in project link views).
CREATE OR REPLACE FUNCTION media_share_record_view(p_share_id UUID)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE media_shares
     SET view_count = view_count + 1,
         last_accessed_at = now()
   WHERE id = p_share_id
     AND revoked_at IS NULL;
$$;

REVOKE ALL ON FUNCTION media_share_record_view(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION media_share_record_view(UUID) TO service_role;
REVOKE ALL ON FUNCTION revoke_media_shares_on_asset_move() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION revoke_media_shares_on_project_delete() FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- RLS: server-only table. Token hashes and ciphertext are never readable by
-- browser roles; every read/write goes through the service role with an
-- explicit business_id filter (tenant-lint enforced).
-- ---------------------------------------------------------------------------

ALTER TABLE media_shares ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON media_shares FROM PUBLIC, anon, authenticated;
GRANT ALL ON media_shares TO service_role;

ALTER TYPE activity_type ADD VALUE IF NOT EXISTS 'photo_shared';
ALTER TYPE activity_type ADD VALUE IF NOT EXISTS 'photo_share_revoked';
ALTER TYPE activity_type ADD VALUE IF NOT EXISTS 'photo_share_link_enabled';
ALTER TYPE activity_type ADD VALUE IF NOT EXISTS 'photo_share_link_disabled';
ALTER TYPE activity_type ADD VALUE IF NOT EXISTS 'photo_share_link_rotated';
ALTER TYPE activity_type ADD VALUE IF NOT EXISTS 'photo_share_updated';
