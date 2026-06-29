-- Separate first/last names + GoHighLevel webhook sync tracking on projects
ALTER TABLE clients ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS last_name TEXT;

ALTER TABLE leads ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS last_name TEXT;

UPDATE clients
SET
  first_name = COALESCE(NULLIF(first_name, ''), split_part(name, ' ', 1)),
  last_name = COALESCE(
    NULLIF(last_name, ''),
    NULLIF(trim(substring(name FROM position(' ' IN name) + 1)), '')
  )
WHERE name IS NOT NULL;

UPDATE leads
SET
  first_name = COALESCE(NULLIF(first_name, ''), split_part(name, ' ', 1)),
  last_name = COALESCE(
    NULLIF(last_name, ''),
    NULLIF(trim(substring(name FROM position(' ' IN name) + 1)), '')
  )
WHERE name IS NOT NULL;

ALTER TABLE projects ADD COLUMN IF NOT EXISTS ghl_sync_status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS ghl_last_sync_attempt_at TIMESTAMPTZ;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS ghl_webhook_status_code INTEGER;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS ghl_webhook_response_body TEXT;

CREATE INDEX IF NOT EXISTS idx_projects_ghl_sync_status ON projects (ghl_sync_status);
