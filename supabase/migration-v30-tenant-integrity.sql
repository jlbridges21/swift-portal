-- Swift Portal V30: business_id NOT NULL + cross-tenant integrity triggers
--
-- Makes business_id mandatory on business-owned tables (except profiles) and
-- rejects child rows whose parent belongs to a different business.
--
-- WHY TRIGGERS: 54 application files use the Supabase service role, which
-- bypasses RLS entirely. Triggers and constraints are NOT bypassed, so they
-- are the real tenant-isolation guarantee.
--
-- HOW TO RUN:
-- 1. Open Supabase Dashboard → SQL Editor → New query
-- 2. Paste this entire file and click Run
-- 3. If step 4 detected duplicate (business_id, lower(email)) clients, the
--    script RAISES and stops. Resolve those rows, then re-run this file.
--    Do not continue to later migrations until this file completes.
--
-- VERIFICATION:
--   1. Run this migration in the Supabase SQL editor. It must complete with
--      no errors. If step 4 detected duplicates and stopped, report them
--      and do not continue.
--   2. Manually run one of the commented-out cross-tenant INSERTs from
--      step 6 — it MUST be rejected with the tenant integrity violation
--      message.
--   3. Confirm the triggers do NOT block legitimate NULL parents:
--      INSERT a media_assets row with project_id NULL and the Swift
--      business_id — it must SUCCEED. (See the commented example in step 6.)
--   4. npm run typecheck && npm run build must pass.
--   5. Full app smoke test, all of which must still succeed: create a
--      client, create a project, upload one photo, upload one document, add
--      a folder and move a photo into it, create a quote, create a payment
--      link, send a client message, create a shoot proposal, log an
--      activity, soft-delete and restore a project.
--   6. Because this runs against the production database, verify the
--      deployed production site still works after running it — load the
--      admin dashboard, one project, and the media library.
--
-- Trigger implementation note:
--   enforce_same_business() uses EXECUTE format('SELECT ($1).%I', parent_col)
--   INTO … USING NEW. This was verified against Postgres 16 (PGlite) as a
--   BEFORE INSERT OR UPDATE trigger: matching inserts succeed, NULL parents
--   return NEW, cross-tenant inserts raise. NEW in a row trigger is the
--   table's composite type, so ($1).column works. (A generic RECORD variable
--   can fail with "could not identify column in record data type"; that is
--   not the trigger path.) Approach used: the shared dynamic-SQL function,
--   not per-table functions.
--
-- Swift Aerial Media tenant UUID:
--   00000000-0000-0000-0000-000000000001

-- ---------------------------------------------------------------------------
-- 4-preflight. Duplicate (business_id, lower(email)) among non-deleted clients
--    Must run before the unique index. If any groups exist, RAISE and STOP.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  dup_count INT;
  dup_text  TEXT;
BEGIN
  SELECT COUNT(*) INTO dup_count
  FROM (
    SELECT business_id, lower(email)
    FROM clients
    WHERE deleted_at IS NULL
    GROUP BY 1, 2
    HAVING COUNT(*) > 1
  ) d;

  RAISE NOTICE 'idx_clients_business_email duplicate group count: %', dup_count;

  IF dup_count > 0 THEN
    SELECT string_agg(
      format('business_id=%s email=%s count=%s ids=%s', business_id, email, n, ids),
      E'\n'
    )
    INTO dup_text
    FROM (
      SELECT
        business_id,
        lower(email) AS email,
        COUNT(*)::text AS n,
        array_agg(id ORDER BY created_at, id)::text AS ids
      FROM clients
      WHERE deleted_at IS NULL
      GROUP BY 1, 2
      HAVING COUNT(*) > 1
    ) d;

    RAISE EXCEPTION
      E'Duplicate (business_id, lower(email)) among non-deleted clients — unique index NOT created. Resolve these then re-run v30:\n%',
      dup_text;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 1. business_id NOT NULL on every v29 business-owned table EXCEPT profiles
--
--    profiles.business_id stays NULLABLE because super_admin rows will have
--    NULL. Do not SET NOT NULL on profiles.
--
--    Transitional DEFAULT of the Swift tenant UUID: existing application
--    INSERTs omit business_id. Without a default, SET NOT NULL would reject
--    every create/upload until write paths are updated. The integrity trigger
--    still rejects a row whose parent belongs to a different business.
--    Drop this DEFAULT once application writes always supply business_id.
-- ---------------------------------------------------------------------------
ALTER TABLE clients ALTER COLUMN business_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE leads ALTER COLUMN business_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE properties ALTER COLUMN business_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE projects ALTER COLUMN business_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE project_clients ALTER COLUMN business_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE project_quotes ALTER COLUMN business_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE asset_reviews ALTER COLUMN business_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE revisions ALTER COLUMN business_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE media_assets ALTER COLUMN business_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE media_folders ALTER COLUMN business_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE media_asset_tags ALTER COLUMN business_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE media_downloads ALTER COLUMN business_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE media_asset_events ALTER COLUMN business_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE tours ALTER COLUMN business_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE payments ALTER COLUMN business_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE shoot_proposals ALTER COLUMN business_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE client_messages ALTER COLUMN business_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE client_message_reads ALTER COLUMN business_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE project_messages ALTER COLUMN business_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE project_message_reads ALTER COLUMN business_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE notifications ALTER COLUMN business_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE communications ALTER COLUMN business_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE email_events ALTER COLUMN business_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE activity_logs ALTER COLUMN business_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE client_notes ALTER COLUMN business_id SET DEFAULT '00000000-0000-0000-0000-000000000001';

ALTER TABLE clients ALTER COLUMN business_id SET NOT NULL;
ALTER TABLE leads ALTER COLUMN business_id SET NOT NULL;
ALTER TABLE properties ALTER COLUMN business_id SET NOT NULL;
ALTER TABLE projects ALTER COLUMN business_id SET NOT NULL;
ALTER TABLE project_clients ALTER COLUMN business_id SET NOT NULL;
ALTER TABLE project_quotes ALTER COLUMN business_id SET NOT NULL;
ALTER TABLE asset_reviews ALTER COLUMN business_id SET NOT NULL;
ALTER TABLE revisions ALTER COLUMN business_id SET NOT NULL;
ALTER TABLE media_assets ALTER COLUMN business_id SET NOT NULL;
ALTER TABLE media_folders ALTER COLUMN business_id SET NOT NULL;
ALTER TABLE media_asset_tags ALTER COLUMN business_id SET NOT NULL;
ALTER TABLE media_downloads ALTER COLUMN business_id SET NOT NULL;
ALTER TABLE media_asset_events ALTER COLUMN business_id SET NOT NULL;
ALTER TABLE tours ALTER COLUMN business_id SET NOT NULL;
ALTER TABLE payments ALTER COLUMN business_id SET NOT NULL;
ALTER TABLE shoot_proposals ALTER COLUMN business_id SET NOT NULL;
ALTER TABLE client_messages ALTER COLUMN business_id SET NOT NULL;
ALTER TABLE client_message_reads ALTER COLUMN business_id SET NOT NULL;
ALTER TABLE project_messages ALTER COLUMN business_id SET NOT NULL;
ALTER TABLE project_message_reads ALTER COLUMN business_id SET NOT NULL;
ALTER TABLE notifications ALTER COLUMN business_id SET NOT NULL;
ALTER TABLE communications ALTER COLUMN business_id SET NOT NULL;
ALTER TABLE email_events ALTER COLUMN business_id SET NOT NULL;
ALTER TABLE activity_logs ALTER COLUMN business_id SET NOT NULL;
ALTER TABLE client_notes ALTER COLUMN business_id SET NOT NULL;

-- profiles.business_id stays NULLABLE because super_admin rows will have NULL.

-- ---------------------------------------------------------------------------
-- 2. Reusable same-business trigger function
--
--    NULL-parent early return is REQUIRED. These parent FKs are nullable
--    and legitimately so (TENANT-AUDIT §A):
--      media_assets.project_id (nullable since v19 — unassigned library)
--      media_asset_events.project_id
--      properties.client_id
--      email_events.project_id
--      client_messages.project_id
--      communications.project_id and client_id
--      activity_logs.project_id, client_id, property_id
--      leads.project_id
--      notifications.project_id and payment_id
--    Rejecting NULL parents would break the unassigned media library and
--    the whole activity log.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION enforce_same_business()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  parent_table TEXT := TG_ARGV[0];
  parent_col   TEXT := TG_ARGV[1];
  parent_bid   UUID;
  child_parent UUID;
BEGIN
  EXECUTE format('SELECT ($1).%I', parent_col) INTO child_parent USING NEW;
  IF child_parent IS NULL THEN RETURN NEW; END IF;
  EXECUTE format('SELECT business_id FROM %I WHERE id = $1', parent_table)
    INTO parent_bid USING child_parent;
  IF parent_bid IS NULL THEN
    RAISE EXCEPTION 'tenant integrity: % % not found', parent_table, child_parent;
  END IF;
  IF parent_bid <> NEW.business_id THEN
    RAISE EXCEPTION 'tenant integrity violation: %.% (%) belongs to business %, row claims %',
      TG_TABLE_NAME, parent_col, child_parent, parent_bid, NEW.business_id;
  END IF;
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 3. BEFORE INSERT OR UPDATE triggers for every parent/child pair
--    (derived from TENANT-AUDIT ownership paths)
-- ---------------------------------------------------------------------------

DROP TRIGGER IF EXISTS trg_projects_client_id_same_business ON projects;
CREATE TRIGGER trg_projects_client_id_same_business
  BEFORE INSERT OR UPDATE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION enforce_same_business('clients', 'client_id');

DROP TRIGGER IF EXISTS trg_projects_property_id_same_business ON projects;
CREATE TRIGGER trg_projects_property_id_same_business
  BEFORE INSERT OR UPDATE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION enforce_same_business('properties', 'property_id');

DROP TRIGGER IF EXISTS trg_project_clients_project_id_same_business ON project_clients;
CREATE TRIGGER trg_project_clients_project_id_same_business
  BEFORE INSERT OR UPDATE ON project_clients
  FOR EACH ROW
  EXECUTE FUNCTION enforce_same_business('projects', 'project_id');

DROP TRIGGER IF EXISTS trg_project_clients_client_id_same_business ON project_clients;
CREATE TRIGGER trg_project_clients_client_id_same_business
  BEFORE INSERT OR UPDATE ON project_clients
  FOR EACH ROW
  EXECUTE FUNCTION enforce_same_business('clients', 'client_id');

DROP TRIGGER IF EXISTS trg_project_quotes_project_id_same_business ON project_quotes;
CREATE TRIGGER trg_project_quotes_project_id_same_business
  BEFORE INSERT OR UPDATE ON project_quotes
  FOR EACH ROW
  EXECUTE FUNCTION enforce_same_business('projects', 'project_id');

DROP TRIGGER IF EXISTS trg_payments_project_id_same_business ON payments;
CREATE TRIGGER trg_payments_project_id_same_business
  BEFORE INSERT OR UPDATE ON payments
  FOR EACH ROW
  EXECUTE FUNCTION enforce_same_business('projects', 'project_id');

DROP TRIGGER IF EXISTS trg_payments_client_id_same_business ON payments;
CREATE TRIGGER trg_payments_client_id_same_business
  BEFORE INSERT OR UPDATE ON payments
  FOR EACH ROW
  EXECUTE FUNCTION enforce_same_business('clients', 'client_id');

DROP TRIGGER IF EXISTS trg_payments_quote_id_same_business ON payments;
CREATE TRIGGER trg_payments_quote_id_same_business
  BEFORE INSERT OR UPDATE ON payments
  FOR EACH ROW
  EXECUTE FUNCTION enforce_same_business('project_quotes', 'quote_id');

DROP TRIGGER IF EXISTS trg_media_assets_project_id_same_business ON media_assets;
CREATE TRIGGER trg_media_assets_project_id_same_business
  BEFORE INSERT OR UPDATE ON media_assets
  FOR EACH ROW
  EXECUTE FUNCTION enforce_same_business('projects', 'project_id');

DROP TRIGGER IF EXISTS trg_media_assets_client_id_same_business ON media_assets;
CREATE TRIGGER trg_media_assets_client_id_same_business
  BEFORE INSERT OR UPDATE ON media_assets
  FOR EACH ROW
  EXECUTE FUNCTION enforce_same_business('clients', 'client_id');

DROP TRIGGER IF EXISTS trg_media_assets_property_id_same_business ON media_assets;
CREATE TRIGGER trg_media_assets_property_id_same_business
  BEFORE INSERT OR UPDATE ON media_assets
  FOR EACH ROW
  EXECUTE FUNCTION enforce_same_business('properties', 'property_id');

DROP TRIGGER IF EXISTS trg_media_assets_folder_id_same_business ON media_assets;
CREATE TRIGGER trg_media_assets_folder_id_same_business
  BEFORE INSERT OR UPDATE ON media_assets
  FOR EACH ROW
  EXECUTE FUNCTION enforce_same_business('media_folders', 'folder_id');

DROP TRIGGER IF EXISTS trg_media_folders_project_id_same_business ON media_folders;
CREATE TRIGGER trg_media_folders_project_id_same_business
  BEFORE INSERT OR UPDATE ON media_folders
  FOR EACH ROW
  EXECUTE FUNCTION enforce_same_business('projects', 'project_id');

DROP TRIGGER IF EXISTS trg_media_asset_tags_media_asset_id_same_business ON media_asset_tags;
CREATE TRIGGER trg_media_asset_tags_media_asset_id_same_business
  BEFORE INSERT OR UPDATE ON media_asset_tags
  FOR EACH ROW
  EXECUTE FUNCTION enforce_same_business('media_assets', 'media_asset_id');

DROP TRIGGER IF EXISTS trg_media_downloads_media_asset_id_same_business ON media_downloads;
CREATE TRIGGER trg_media_downloads_media_asset_id_same_business
  BEFORE INSERT OR UPDATE ON media_downloads
  FOR EACH ROW
  EXECUTE FUNCTION enforce_same_business('media_assets', 'media_asset_id');

DROP TRIGGER IF EXISTS trg_media_asset_events_media_asset_id_same_business ON media_asset_events;
CREATE TRIGGER trg_media_asset_events_media_asset_id_same_business
  BEFORE INSERT OR UPDATE ON media_asset_events
  FOR EACH ROW
  EXECUTE FUNCTION enforce_same_business('media_assets', 'media_asset_id');

DROP TRIGGER IF EXISTS trg_media_asset_events_project_id_same_business ON media_asset_events;
CREATE TRIGGER trg_media_asset_events_project_id_same_business
  BEFORE INSERT OR UPDATE ON media_asset_events
  FOR EACH ROW
  EXECUTE FUNCTION enforce_same_business('projects', 'project_id');

DROP TRIGGER IF EXISTS trg_tours_project_id_same_business ON tours;
CREATE TRIGGER trg_tours_project_id_same_business
  BEFORE INSERT OR UPDATE ON tours
  FOR EACH ROW
  EXECUTE FUNCTION enforce_same_business('projects', 'project_id');

DROP TRIGGER IF EXISTS trg_revisions_project_id_same_business ON revisions;
CREATE TRIGGER trg_revisions_project_id_same_business
  BEFORE INSERT OR UPDATE ON revisions
  FOR EACH ROW
  EXECUTE FUNCTION enforce_same_business('projects', 'project_id');

DROP TRIGGER IF EXISTS trg_revisions_client_id_same_business ON revisions;
CREATE TRIGGER trg_revisions_client_id_same_business
  BEFORE INSERT OR UPDATE ON revisions
  FOR EACH ROW
  EXECUTE FUNCTION enforce_same_business('clients', 'client_id');

DROP TRIGGER IF EXISTS trg_shoot_proposals_project_id_same_business ON shoot_proposals;
CREATE TRIGGER trg_shoot_proposals_project_id_same_business
  BEFORE INSERT OR UPDATE ON shoot_proposals
  FOR EACH ROW
  EXECUTE FUNCTION enforce_same_business('projects', 'project_id');

DROP TRIGGER IF EXISTS trg_asset_reviews_project_id_same_business ON asset_reviews;
CREATE TRIGGER trg_asset_reviews_project_id_same_business
  BEFORE INSERT OR UPDATE ON asset_reviews
  FOR EACH ROW
  EXECUTE FUNCTION enforce_same_business('projects', 'project_id');

DROP TRIGGER IF EXISTS trg_client_messages_client_id_same_business ON client_messages;
CREATE TRIGGER trg_client_messages_client_id_same_business
  BEFORE INSERT OR UPDATE ON client_messages
  FOR EACH ROW
  EXECUTE FUNCTION enforce_same_business('clients', 'client_id');

DROP TRIGGER IF EXISTS trg_client_messages_project_id_same_business ON client_messages;
CREATE TRIGGER trg_client_messages_project_id_same_business
  BEFORE INSERT OR UPDATE ON client_messages
  FOR EACH ROW
  EXECUTE FUNCTION enforce_same_business('projects', 'project_id');

DROP TRIGGER IF EXISTS trg_client_message_reads_message_id_same_business ON client_message_reads;
CREATE TRIGGER trg_client_message_reads_message_id_same_business
  BEFORE INSERT OR UPDATE ON client_message_reads
  FOR EACH ROW
  EXECUTE FUNCTION enforce_same_business('client_messages', 'message_id');

DROP TRIGGER IF EXISTS trg_project_messages_project_id_same_business ON project_messages;
CREATE TRIGGER trg_project_messages_project_id_same_business
  BEFORE INSERT OR UPDATE ON project_messages
  FOR EACH ROW
  EXECUTE FUNCTION enforce_same_business('projects', 'project_id');

DROP TRIGGER IF EXISTS trg_project_message_reads_message_id_same_business ON project_message_reads;
CREATE TRIGGER trg_project_message_reads_message_id_same_business
  BEFORE INSERT OR UPDATE ON project_message_reads
  FOR EACH ROW
  EXECUTE FUNCTION enforce_same_business('project_messages', 'message_id');

DROP TRIGGER IF EXISTS trg_communications_project_id_same_business ON communications;
CREATE TRIGGER trg_communications_project_id_same_business
  BEFORE INSERT OR UPDATE ON communications
  FOR EACH ROW
  EXECUTE FUNCTION enforce_same_business('projects', 'project_id');

DROP TRIGGER IF EXISTS trg_communications_client_id_same_business ON communications;
CREATE TRIGGER trg_communications_client_id_same_business
  BEFORE INSERT OR UPDATE ON communications
  FOR EACH ROW
  EXECUTE FUNCTION enforce_same_business('clients', 'client_id');

DROP TRIGGER IF EXISTS trg_activity_logs_project_id_same_business ON activity_logs;
CREATE TRIGGER trg_activity_logs_project_id_same_business
  BEFORE INSERT OR UPDATE ON activity_logs
  FOR EACH ROW
  EXECUTE FUNCTION enforce_same_business('projects', 'project_id');

DROP TRIGGER IF EXISTS trg_activity_logs_client_id_same_business ON activity_logs;
CREATE TRIGGER trg_activity_logs_client_id_same_business
  BEFORE INSERT OR UPDATE ON activity_logs
  FOR EACH ROW
  EXECUTE FUNCTION enforce_same_business('clients', 'client_id');

DROP TRIGGER IF EXISTS trg_activity_logs_property_id_same_business ON activity_logs;
CREATE TRIGGER trg_activity_logs_property_id_same_business
  BEFORE INSERT OR UPDATE ON activity_logs
  FOR EACH ROW
  EXECUTE FUNCTION enforce_same_business('properties', 'property_id');

DROP TRIGGER IF EXISTS trg_notifications_project_id_same_business ON notifications;
CREATE TRIGGER trg_notifications_project_id_same_business
  BEFORE INSERT OR UPDATE ON notifications
  FOR EACH ROW
  EXECUTE FUNCTION enforce_same_business('projects', 'project_id');

DROP TRIGGER IF EXISTS trg_notifications_payment_id_same_business ON notifications;
CREATE TRIGGER trg_notifications_payment_id_same_business
  BEFORE INSERT OR UPDATE ON notifications
  FOR EACH ROW
  EXECUTE FUNCTION enforce_same_business('payments', 'payment_id');

DROP TRIGGER IF EXISTS trg_client_notes_client_id_same_business ON client_notes;
CREATE TRIGGER trg_client_notes_client_id_same_business
  BEFORE INSERT OR UPDATE ON client_notes
  FOR EACH ROW
  EXECUTE FUNCTION enforce_same_business('clients', 'client_id');

DROP TRIGGER IF EXISTS trg_email_events_project_id_same_business ON email_events;
CREATE TRIGGER trg_email_events_project_id_same_business
  BEFORE INSERT OR UPDATE ON email_events
  FOR EACH ROW
  EXECUTE FUNCTION enforce_same_business('projects', 'project_id');

DROP TRIGGER IF EXISTS trg_leads_project_id_same_business ON leads;
CREATE TRIGGER trg_leads_project_id_same_business
  BEFORE INSERT OR UPDATE ON leads
  FOR EACH ROW
  EXECUTE FUNCTION enforce_same_business('projects', 'project_id');

DROP TRIGGER IF EXISTS trg_properties_client_id_same_business ON properties;
CREATE TRIGGER trg_properties_client_id_same_business
  BEFORE INSERT OR UPDATE ON properties
  FOR EACH ROW
  EXECUTE FUNCTION enforce_same_business('clients', 'client_id');

-- ---------------------------------------------------------------------------
-- 4. Unique (business_id, lower(email)) among non-deleted clients
--    Preflight above reported 0 duplicates against live data at write time;
--    the DO block still re-checks so a concurrent insert cannot sneak through.
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_business_email
  ON clients (business_id, lower(email)) WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- 5. Replace global media path unique index with a business-scoped one.
--    App lookups that previously treated file_path as globally unique must
--    now also filter by business_id (select-then-insert in
--    src/app/api/media/upload/complete/route.ts — not an upsert onConflict).
-- ---------------------------------------------------------------------------
DROP INDEX IF EXISTS idx_media_assets_file_path_unique;
CREATE UNIQUE INDEX IF NOT EXISTS idx_media_assets_business_file_path
  ON media_assets (business_id, file_path);

-- ---------------------------------------------------------------------------
-- 6. Verification examples (commented — run one by hand after this migration)
--
--    These MUST fail with: tenant integrity violation: …
--    They need a second businesses row so the FK on business_id succeeds
--    and the trigger is the thing that rejects the write. Create the dummy
--    tenant first (or reuse it), then run one INSERT. Delete the dummy
--    tenant when done if you created it only for this probe.
--
-- INSERT INTO businesses (id, slug, name, status)
-- VALUES (
--   '00000000-0000-0000-0000-000000000099',
--   'tenant-integrity-probe',
--   'Tenant Integrity Probe',
--   'active'
-- )
-- ON CONFLICT (id) DO NOTHING;
--
-- -- Example 1: media_assets points at a Swift project but claims the probe tenant
-- INSERT INTO media_assets (
--   business_id, project_id, file_name, file_path, mime_type, media_type
-- )
-- SELECT
--   '00000000-0000-0000-0000-000000000099',
--   id,
--   'tenant-integrity-probe.jpg',
--   'tenant-integrity-probe/cross-tenant.jpg',
--   'image/jpeg',
--   'photo'
-- FROM projects
-- WHERE business_id = '00000000-0000-0000-0000-000000000001'
-- LIMIT 1;
--
-- -- Example 2: client_notes points at a Swift client but claims the probe tenant
-- INSERT INTO client_notes (business_id, client_id, note)
-- SELECT
--   '00000000-0000-0000-0000-000000000099',
--   id,
--   'tenant-integrity-probe'
-- FROM clients
-- WHERE business_id = '00000000-0000-0000-0000-000000000001'
--   AND deleted_at IS NULL
-- LIMIT 1;
--
-- -- Example 3: activity_logs points at a Swift project but claims the probe tenant
-- INSERT INTO activity_logs (business_id, project_id, activity_type, description)
-- SELECT
--   '00000000-0000-0000-0000-000000000099',
--   id,
--   'project_created',
--   'tenant-integrity-probe'
-- FROM projects
-- WHERE business_id = '00000000-0000-0000-0000-000000000001'
-- LIMIT 1;
--
-- -- NULL-parent smoke (MUST SUCCEED): unassigned library row on Swift
-- INSERT INTO media_assets (
--   business_id, project_id, file_name, file_path, mime_type, media_type
-- ) VALUES (
--   '00000000-0000-0000-0000-000000000001',
--   NULL,
--   'tenant-integrity-unassigned.jpg',
--   'tenant-integrity-probe/unassigned.jpg',
--   'image/jpeg',
--   'photo'
-- );
-- -- Clean up that probe row:
-- -- DELETE FROM media_assets WHERE file_path = 'tenant-integrity-probe/unassigned.jpg';
