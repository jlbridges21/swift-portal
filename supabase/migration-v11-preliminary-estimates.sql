-- Swift Portal V11: Preliminary estimates vs official proposals
DO $$ BEGIN
  CREATE TYPE quote_kind AS ENUM ('preliminary', 'official');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE project_quotes
  ADD COLUMN IF NOT EXISTS quote_kind quote_kind NOT NULL DEFAULT 'official';

CREATE INDEX IF NOT EXISTS idx_project_quotes_kind ON project_quotes(project_id, quote_kind);

ALTER TYPE activity_type ADD VALUE IF NOT EXISTS 'preliminary_estimate_created';
ALTER TYPE activity_type ADD VALUE IF NOT EXISTS 'official_proposal_sent';
