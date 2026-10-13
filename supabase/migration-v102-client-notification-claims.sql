-- One outbound client notification per idempotency key.
-- Incidental media uploads share one key per project per day so parallel
-- completions cannot each send an email. The day boundary is 09:00 UTC,
-- not UTC midnight (see DAY_BOUNDARY_OFFSET_MS). A conflicting insert means
-- another request already claimed this day. business_id is part of the
-- unique key so
-- one tenant's claim cannot suppress another's.

CREATE TABLE IF NOT EXISTS client_notification_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses (id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
  idempotency_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT client_notification_claims_business_key_unique
    UNIQUE (business_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_client_notification_claims_project
  ON client_notification_claims (business_id, project_id);

DROP TRIGGER IF EXISTS trg_client_notification_claims_project_id_same_business
  ON client_notification_claims;
CREATE TRIGGER trg_client_notification_claims_project_id_same_business
  BEFORE INSERT OR UPDATE ON client_notification_claims
  FOR EACH ROW
  EXECUTE FUNCTION enforce_same_business('projects', 'project_id');

ALTER TABLE client_notification_claims ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins view client notification claims" ON client_notification_claims;
CREATE POLICY "Admins view client notification claims" ON client_notification_claims
  FOR SELECT
  USING (is_super_admin() OR (is_admin() AND business_id = current_business_id()));
