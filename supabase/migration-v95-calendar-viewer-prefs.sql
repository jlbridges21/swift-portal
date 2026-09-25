-- Per owner-admin calendar visibility. One Google connection is shared by the
-- business; up to three owner admins would otherwise fight over one toggle set.
-- A missing calendar id means visible, so a newly discovered calendar stays on.
-- Staff never read this column. Event contents are still not stored.

ALTER TABLE google_calendar_connections
  ADD COLUMN IF NOT EXISTS viewer_hidden_calendar_ids JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN google_calendar_connections.viewer_hidden_calendar_ids IS
  'Map of owner-admin user id → Google calendar ids that admin has hidden. Absence means visible.';
