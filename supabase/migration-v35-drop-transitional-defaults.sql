-- Swift Portal V35: drop transitional business_id DEFAULTs
--
-- v30 added DEFAULT '00000000-0000-0000-0000-000000000001' on 25 tables so
-- existing INSERTs that omitted business_id would keep working under NOT NULL.
-- Every application write path now stamps business_id (explicit column or
-- createTenantServiceClient injectBusinessId). The DEFAULT is now a liability:
-- a forgotten column silently creates Swift data instead of failing.
--
-- This migration DROPS the DEFAULT and LEAVES NOT NULL in place.
-- profiles never had a DEFAULT — do not touch it.
--
-- HOW TO RUN:
-- 1. Open Supabase Dashboard → SQL Editor → New query
-- 2. Paste this entire file and click Run
--
-- VERIFICATION:
--   The final SELECT lists every column named business_id with its
--   column_default. Every row must be NULL.

-- ---------------------------------------------------------------------------
-- 1. Drop DEFAULT from the 25 v30 tables (list from migration-v30 lines 106–130)
-- ---------------------------------------------------------------------------
ALTER TABLE clients ALTER COLUMN business_id DROP DEFAULT;
ALTER TABLE leads ALTER COLUMN business_id DROP DEFAULT;
ALTER TABLE properties ALTER COLUMN business_id DROP DEFAULT;
ALTER TABLE projects ALTER COLUMN business_id DROP DEFAULT;
ALTER TABLE project_clients ALTER COLUMN business_id DROP DEFAULT;
ALTER TABLE project_quotes ALTER COLUMN business_id DROP DEFAULT;
ALTER TABLE asset_reviews ALTER COLUMN business_id DROP DEFAULT;
ALTER TABLE revisions ALTER COLUMN business_id DROP DEFAULT;
ALTER TABLE media_assets ALTER COLUMN business_id DROP DEFAULT;
ALTER TABLE media_folders ALTER COLUMN business_id DROP DEFAULT;
ALTER TABLE media_asset_tags ALTER COLUMN business_id DROP DEFAULT;
ALTER TABLE media_downloads ALTER COLUMN business_id DROP DEFAULT;
ALTER TABLE media_asset_events ALTER COLUMN business_id DROP DEFAULT;
ALTER TABLE tours ALTER COLUMN business_id DROP DEFAULT;
ALTER TABLE payments ALTER COLUMN business_id DROP DEFAULT;
ALTER TABLE shoot_proposals ALTER COLUMN business_id DROP DEFAULT;
ALTER TABLE client_messages ALTER COLUMN business_id DROP DEFAULT;
ALTER TABLE client_message_reads ALTER COLUMN business_id DROP DEFAULT;
ALTER TABLE project_messages ALTER COLUMN business_id DROP DEFAULT;
ALTER TABLE project_message_reads ALTER COLUMN business_id DROP DEFAULT;
ALTER TABLE notifications ALTER COLUMN business_id DROP DEFAULT;
ALTER TABLE communications ALTER COLUMN business_id DROP DEFAULT;
ALTER TABLE email_events ALTER COLUMN business_id DROP DEFAULT;
ALTER TABLE activity_logs ALTER COLUMN business_id DROP DEFAULT;
ALTER TABLE client_notes ALTER COLUMN business_id DROP DEFAULT;

-- ---------------------------------------------------------------------------
-- 2. Verification — every business_id column_default must be NULL
-- ---------------------------------------------------------------------------
SELECT
  table_schema,
  table_name,
  column_name,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE column_name = 'business_id'
  AND table_schema = 'public'
ORDER BY table_name;
