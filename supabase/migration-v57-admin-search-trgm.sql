-- Admin global search: trigram indexes + phone digit normalization.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS phone_digits text
  GENERATED ALWAYS AS (regexp_replace(COALESCE(phone, ''), '[^0-9]+', '', 'g')) STORED;

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS phone_digits text
  GENERATED ALWAYS AS (regexp_replace(COALESCE(phone, ''), '[^0-9]+', '', 'g')) STORED;

COMMENT ON COLUMN clients.phone_digits IS
  'Digits-only phone for admin search; matches (251) 501-7464 and 2515017464';
COMMENT ON COLUMN leads.phone_digits IS
  'Digits-only phone for admin search';

CREATE INDEX IF NOT EXISTS idx_clients_name_trgm ON clients USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_clients_full_name_trgm ON clients USING gin (full_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_clients_email_trgm ON clients USING gin (email gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_clients_phone_trgm ON clients USING gin (phone gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_clients_phone_digits_trgm ON clients USING gin (phone_digits gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_clients_company_trgm ON clients USING gin (company gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_projects_project_name_trgm ON projects USING gin (project_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_projects_property_address_trgm ON projects USING gin (property_address gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_projects_service_type_trgm ON projects USING gin (service_type gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_leads_name_trgm ON leads USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_leads_email_trgm ON leads USING gin (email gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_leads_phone_trgm ON leads USING gin (phone gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_leads_phone_digits_trgm ON leads USING gin (phone_digits gin_trgm_ops);
