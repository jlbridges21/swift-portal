-- Swift Portal V29: businesses tenant table + nullable business_id on business-owned tables
--
-- Introduces the multi-tenant key without changing application behavior.
-- business_id is NULLABLE (no NOT NULL, no RLS changes). All existing rows are
-- backfilled to the single Swift Aerial Media business.
--
-- HOW TO RUN:
-- 1. Open Supabase Dashboard → SQL Editor → New query
-- 2. Paste this entire file and click Run
--
-- VERIFICATION (do these before migration v30):
--   1. Run this migration in the Supabase SQL editor.
--   2. Run the final verification SELECT at the bottom — every null_business_ids
--      count must be 0. If any is non-zero, do not proceed.
--   3. Run: SELECT count(*) FROM businesses; -- must be 1
--   4. npm run typecheck && npm run build — both must pass.
--   5. Smoke test the running app: as admin, open /admin, a project detail page,
--      /admin/media, /admin/messages, /admin/clients, /admin/calendar. As a test
--      client, open /dashboard and a project. Everything must look and behave
--      exactly as before.
--   6. Because this migration runs against the production database, also verify
--      the deployed production site still works after running it.
--
-- Swift Aerial Media tenant UUID (referenced by later migrations):
--   00000000-0000-0000-0000-000000000001

-- ---------------------------------------------------------------------------
-- 1. businesses
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS businesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','suspended','pending','cancelled')),
  custom_domain TEXT UNIQUE,
  plan TEXT NOT NULL DEFAULT 'standard',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

DROP TRIGGER IF EXISTS businesses_updated_at ON businesses;
CREATE TRIGGER businesses_updated_at BEFORE UPDATE ON businesses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ---------------------------------------------------------------------------
-- 2. Seed Swift Aerial Media (fixed UUID for later migrations)
-- ---------------------------------------------------------------------------
INSERT INTO businesses (id, slug, name, status, custom_domain, plan)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'swift-aerial-media',
  'Swift Aerial Media',
  'active',
  'portal.swiftaerialmedia.com',
  'standard'
)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 3. Nullable business_id on every business-owned table (TENANT-AUDIT §A)
--    26 tables. Skip: app_settings, google_calendar_connections (singletons),
--    processed_stripe_events (platform-level).
-- ---------------------------------------------------------------------------
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES businesses(id);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES businesses(id);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES businesses(id);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES businesses(id);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES businesses(id);
ALTER TABLE project_clients ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES businesses(id);
ALTER TABLE project_quotes ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES businesses(id);
ALTER TABLE asset_reviews ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES businesses(id);
ALTER TABLE revisions ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES businesses(id);
ALTER TABLE media_assets ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES businesses(id);
ALTER TABLE media_folders ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES businesses(id);
ALTER TABLE media_asset_tags ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES businesses(id);
ALTER TABLE media_downloads ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES businesses(id);
ALTER TABLE media_asset_events ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES businesses(id);
ALTER TABLE tours ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES businesses(id);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES businesses(id);
ALTER TABLE shoot_proposals ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES businesses(id);
ALTER TABLE client_messages ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES businesses(id);
ALTER TABLE client_message_reads ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES businesses(id);
ALTER TABLE project_messages ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES businesses(id);
ALTER TABLE project_message_reads ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES businesses(id);
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES businesses(id);
ALTER TABLE communications ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES businesses(id);
ALTER TABLE email_events ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES businesses(id);
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES businesses(id);
ALTER TABLE client_notes ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES businesses(id);

-- ---------------------------------------------------------------------------
-- 4. Backfill all rows to Swift Aerial Media
--    Unconditional WHERE business_id IS NULL covers orphan / nullable-parent rows:
--      media_assets.project_id NULL (unassigned library, v19)
--      media_asset_events.project_id NULL
--      properties.client_id NULL
--      email_events.project_id NULL
--      client_messages.project_id NULL
--      communications.project_id AND client_id NULL
--      activity_logs.project_id / client_id / property_id NULL
--      leads with no owner FK
--      profiles.client_id NULL (admins and unlinked clients)
-- ---------------------------------------------------------------------------
UPDATE profiles SET business_id = '00000000-0000-0000-0000-000000000001' WHERE business_id IS NULL;
UPDATE clients SET business_id = '00000000-0000-0000-0000-000000000001' WHERE business_id IS NULL;
UPDATE leads SET business_id = '00000000-0000-0000-0000-000000000001' WHERE business_id IS NULL;
UPDATE properties SET business_id = '00000000-0000-0000-0000-000000000001' WHERE business_id IS NULL;
UPDATE projects SET business_id = '00000000-0000-0000-0000-000000000001' WHERE business_id IS NULL;
UPDATE project_clients SET business_id = '00000000-0000-0000-0000-000000000001' WHERE business_id IS NULL;
UPDATE project_quotes SET business_id = '00000000-0000-0000-0000-000000000001' WHERE business_id IS NULL;
UPDATE asset_reviews SET business_id = '00000000-0000-0000-0000-000000000001' WHERE business_id IS NULL;
UPDATE revisions SET business_id = '00000000-0000-0000-0000-000000000001' WHERE business_id IS NULL;
UPDATE media_assets SET business_id = '00000000-0000-0000-0000-000000000001' WHERE business_id IS NULL;
UPDATE media_folders SET business_id = '00000000-0000-0000-0000-000000000001' WHERE business_id IS NULL;
UPDATE media_asset_tags SET business_id = '00000000-0000-0000-0000-000000000001' WHERE business_id IS NULL;
UPDATE media_downloads SET business_id = '00000000-0000-0000-0000-000000000001' WHERE business_id IS NULL;
UPDATE media_asset_events SET business_id = '00000000-0000-0000-0000-000000000001' WHERE business_id IS NULL;
UPDATE tours SET business_id = '00000000-0000-0000-0000-000000000001' WHERE business_id IS NULL;
UPDATE payments SET business_id = '00000000-0000-0000-0000-000000000001' WHERE business_id IS NULL;
UPDATE shoot_proposals SET business_id = '00000000-0000-0000-0000-000000000001' WHERE business_id IS NULL;
UPDATE client_messages SET business_id = '00000000-0000-0000-0000-000000000001' WHERE business_id IS NULL;
UPDATE client_message_reads SET business_id = '00000000-0000-0000-0000-000000000001' WHERE business_id IS NULL;
UPDATE project_messages SET business_id = '00000000-0000-0000-0000-000000000001' WHERE business_id IS NULL;
UPDATE project_message_reads SET business_id = '00000000-0000-0000-0000-000000000001' WHERE business_id IS NULL;
UPDATE notifications SET business_id = '00000000-0000-0000-0000-000000000001' WHERE business_id IS NULL;
UPDATE communications SET business_id = '00000000-0000-0000-0000-000000000001' WHERE business_id IS NULL;
UPDATE email_events SET business_id = '00000000-0000-0000-0000-000000000001' WHERE business_id IS NULL;
UPDATE activity_logs SET business_id = '00000000-0000-0000-0000-000000000001' WHERE business_id IS NULL;
UPDATE client_notes SET business_id = '00000000-0000-0000-0000-000000000001' WHERE business_id IS NULL;

-- ---------------------------------------------------------------------------
-- 5. Indexes
--    Existing indexes (status, created_at, deleted_at alone) are not duplicates
--    of (business_id, …) composites. No existing business_id indexes to skip.
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_profiles_business_id ON profiles (business_id);
CREATE INDEX IF NOT EXISTS idx_clients_business_id ON clients (business_id);
CREATE INDEX IF NOT EXISTS idx_leads_business_id ON leads (business_id);
CREATE INDEX IF NOT EXISTS idx_properties_business_id ON properties (business_id);
CREATE INDEX IF NOT EXISTS idx_projects_business_id ON projects (business_id);
CREATE INDEX IF NOT EXISTS idx_project_clients_business_id ON project_clients (business_id);
CREATE INDEX IF NOT EXISTS idx_project_quotes_business_id ON project_quotes (business_id);
CREATE INDEX IF NOT EXISTS idx_asset_reviews_business_id ON asset_reviews (business_id);
CREATE INDEX IF NOT EXISTS idx_revisions_business_id ON revisions (business_id);
CREATE INDEX IF NOT EXISTS idx_media_assets_business_id ON media_assets (business_id);
CREATE INDEX IF NOT EXISTS idx_media_folders_business_id ON media_folders (business_id);
CREATE INDEX IF NOT EXISTS idx_media_asset_tags_business_id ON media_asset_tags (business_id);
CREATE INDEX IF NOT EXISTS idx_media_downloads_business_id ON media_downloads (business_id);
CREATE INDEX IF NOT EXISTS idx_media_asset_events_business_id ON media_asset_events (business_id);
CREATE INDEX IF NOT EXISTS idx_tours_business_id ON tours (business_id);
CREATE INDEX IF NOT EXISTS idx_payments_business_id ON payments (business_id);
CREATE INDEX IF NOT EXISTS idx_shoot_proposals_business_id ON shoot_proposals (business_id);
CREATE INDEX IF NOT EXISTS idx_client_messages_business_id ON client_messages (business_id);
CREATE INDEX IF NOT EXISTS idx_client_message_reads_business_id ON client_message_reads (business_id);
CREATE INDEX IF NOT EXISTS idx_project_messages_business_id ON project_messages (business_id);
CREATE INDEX IF NOT EXISTS idx_project_message_reads_business_id ON project_message_reads (business_id);
CREATE INDEX IF NOT EXISTS idx_notifications_business_id ON notifications (business_id);
CREATE INDEX IF NOT EXISTS idx_communications_business_id ON communications (business_id);
CREATE INDEX IF NOT EXISTS idx_email_events_business_id ON email_events (business_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_business_id ON activity_logs (business_id);
CREATE INDEX IF NOT EXISTS idx_client_notes_business_id ON client_notes (business_id);

CREATE INDEX IF NOT EXISTS idx_clients_business_deleted ON clients (business_id, deleted_at);
CREATE INDEX IF NOT EXISTS idx_projects_business_deleted ON projects (business_id, deleted_at);
CREATE INDEX IF NOT EXISTS idx_properties_business_deleted ON properties (business_id, deleted_at);
CREATE INDEX IF NOT EXISTS idx_leads_business_deleted ON leads (business_id, deleted_at);

CREATE INDEX IF NOT EXISTS idx_projects_business_status ON projects (business_id, status);
CREATE INDEX IF NOT EXISTS idx_payments_business_status ON payments (business_id, status);

CREATE INDEX IF NOT EXISTS idx_activity_logs_business_created ON activity_logs (business_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_media_assets_business_created ON media_assets (business_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_business_created ON notifications (business_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- 6. Verification — every null_business_ids count must be 0 before v30
-- ---------------------------------------------------------------------------
SELECT table_name, null_business_ids
FROM (
  SELECT 'profiles'::text AS table_name, COUNT(*) FILTER (WHERE business_id IS NULL) AS null_business_ids FROM profiles
  UNION ALL SELECT 'clients', COUNT(*) FILTER (WHERE business_id IS NULL) FROM clients
  UNION ALL SELECT 'leads', COUNT(*) FILTER (WHERE business_id IS NULL) FROM leads
  UNION ALL SELECT 'properties', COUNT(*) FILTER (WHERE business_id IS NULL) FROM properties
  UNION ALL SELECT 'projects', COUNT(*) FILTER (WHERE business_id IS NULL) FROM projects
  UNION ALL SELECT 'project_clients', COUNT(*) FILTER (WHERE business_id IS NULL) FROM project_clients
  UNION ALL SELECT 'project_quotes', COUNT(*) FILTER (WHERE business_id IS NULL) FROM project_quotes
  UNION ALL SELECT 'asset_reviews', COUNT(*) FILTER (WHERE business_id IS NULL) FROM asset_reviews
  UNION ALL SELECT 'revisions', COUNT(*) FILTER (WHERE business_id IS NULL) FROM revisions
  UNION ALL SELECT 'media_assets', COUNT(*) FILTER (WHERE business_id IS NULL) FROM media_assets
  UNION ALL SELECT 'media_folders', COUNT(*) FILTER (WHERE business_id IS NULL) FROM media_folders
  UNION ALL SELECT 'media_asset_tags', COUNT(*) FILTER (WHERE business_id IS NULL) FROM media_asset_tags
  UNION ALL SELECT 'media_downloads', COUNT(*) FILTER (WHERE business_id IS NULL) FROM media_downloads
  UNION ALL SELECT 'media_asset_events', COUNT(*) FILTER (WHERE business_id IS NULL) FROM media_asset_events
  UNION ALL SELECT 'tours', COUNT(*) FILTER (WHERE business_id IS NULL) FROM tours
  UNION ALL SELECT 'payments', COUNT(*) FILTER (WHERE business_id IS NULL) FROM payments
  UNION ALL SELECT 'shoot_proposals', COUNT(*) FILTER (WHERE business_id IS NULL) FROM shoot_proposals
  UNION ALL SELECT 'client_messages', COUNT(*) FILTER (WHERE business_id IS NULL) FROM client_messages
  UNION ALL SELECT 'client_message_reads', COUNT(*) FILTER (WHERE business_id IS NULL) FROM client_message_reads
  UNION ALL SELECT 'project_messages', COUNT(*) FILTER (WHERE business_id IS NULL) FROM project_messages
  UNION ALL SELECT 'project_message_reads', COUNT(*) FILTER (WHERE business_id IS NULL) FROM project_message_reads
  UNION ALL SELECT 'notifications', COUNT(*) FILTER (WHERE business_id IS NULL) FROM notifications
  UNION ALL SELECT 'communications', COUNT(*) FILTER (WHERE business_id IS NULL) FROM communications
  UNION ALL SELECT 'email_events', COUNT(*) FILTER (WHERE business_id IS NULL) FROM email_events
  UNION ALL SELECT 'activity_logs', COUNT(*) FILTER (WHERE business_id IS NULL) FROM activity_logs
  UNION ALL SELECT 'client_notes', COUNT(*) FILTER (WHERE business_id IS NULL) FROM client_notes
) t
ORDER BY table_name;
