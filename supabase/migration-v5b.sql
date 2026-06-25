-- Swift Portal V5 — PART 2 of 2 (run after migration-v5.sql succeeds)
-- Migrates data, creates quote & asset-review tables.

-- Migrate existing project statuses to new workflow
UPDATE projects SET status = 'new_request' WHERE status = 'lead_received';
UPDATE projects SET status = 'shoot_complete_editing' WHERE status IN ('shot_complete', 'editing');
UPDATE projects SET status = 'proposal_approved' WHERE status = 'shoot_rescheduled';

-- Quote / proposal status enum (new type — safe in this transaction)
DO $$ BEGIN
  CREATE TYPE quote_status AS ENUM ('draft', 'sent', 'approved', 'changes_requested');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS project_quotes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  line_items JSONB NOT NULL DEFAULT '[]',
  total_cents INTEGER NOT NULL,
  notes TEXT,
  expires_at DATE,
  status quote_status NOT NULL DEFAULT 'draft',
  sent_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  changes_feedback TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_quotes_project ON project_quotes(project_id);

-- Asset-level deliverable reviews
DO $$ BEGIN
  CREATE TYPE asset_review_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS asset_reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  asset_type TEXT NOT NULL CHECK (asset_type IN ('photo', 'video', 'tour', 'document')),
  asset_id UUID NOT NULL,
  status asset_review_status NOT NULL DEFAULT 'pending',
  feedback TEXT,
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(project_id, asset_type, asset_id)
);

CREATE INDEX IF NOT EXISTS idx_asset_reviews_project ON asset_reviews(project_id);

ALTER TABLE project_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins full access project_quotes" ON project_quotes;
CREATE POLICY "Admins full access project_quotes" ON project_quotes FOR ALL USING (is_admin());

DROP POLICY IF EXISTS "Clients view own project_quotes" ON project_quotes;
CREATE POLICY "Clients view own project_quotes" ON project_quotes
  FOR SELECT USING (client_has_project_access(project_id));

DROP POLICY IF EXISTS "Clients update own project_quotes" ON project_quotes;
CREATE POLICY "Clients update own project_quotes" ON project_quotes
  FOR UPDATE USING (client_has_project_access(project_id));

DROP POLICY IF EXISTS "Admins full access asset_reviews" ON asset_reviews;
CREATE POLICY "Admins full access asset_reviews" ON asset_reviews FOR ALL USING (is_admin());

DROP POLICY IF EXISTS "Clients view own asset_reviews" ON asset_reviews;
CREATE POLICY "Clients view own asset_reviews" ON asset_reviews
  FOR SELECT USING (client_has_project_access(project_id));

DROP POLICY IF EXISTS "Clients manage own asset_reviews" ON asset_reviews;
CREATE POLICY "Clients manage own asset_reviews" ON asset_reviews
  FOR ALL USING (client_has_project_access(project_id));

DROP TRIGGER IF EXISTS project_quotes_updated_at ON project_quotes;
CREATE TRIGGER project_quotes_updated_at BEFORE UPDATE ON project_quotes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS asset_reviews_updated_at ON asset_reviews;
CREATE TRIGGER asset_reviews_updated_at BEFORE UPDATE ON asset_reviews
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
