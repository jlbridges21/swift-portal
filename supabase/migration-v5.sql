-- Swift Portal V5 — PART 1 of 2 (run this first)
-- Run after migration-v4.sql
--
-- PostgreSQL requires new enum values to be committed before use.
-- Run this entire file in the Supabase SQL Editor, wait for success,
-- then run migration-v5b.sql in a separate query.

-- New project statuses
ALTER TYPE project_status ADD VALUE IF NOT EXISTS 'new_request';
ALTER TYPE project_status ADD VALUE IF NOT EXISTS 'quote_sent';
ALTER TYPE project_status ADD VALUE IF NOT EXISTS 'proposal_approved';
ALTER TYPE project_status ADD VALUE IF NOT EXISTS 'shoot_complete_editing';
ALTER TYPE project_status ADD VALUE IF NOT EXISTS 'approved';

-- Activity types for quotes & reviews
ALTER TYPE activity_type ADD VALUE IF NOT EXISTS 'quote_sent';
ALTER TYPE activity_type ADD VALUE IF NOT EXISTS 'quote_approved';
ALTER TYPE activity_type ADD VALUE IF NOT EXISTS 'quote_changes_requested';
ALTER TYPE activity_type ADD VALUE IF NOT EXISTS 'asset_reviewed';
ALTER TYPE activity_type ADD VALUE IF NOT EXISTS 'sent_for_review';
