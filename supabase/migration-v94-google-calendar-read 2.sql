-- Phase 2: which calendars to read, and opaque Google sync cursors.
-- Event titles, times, attendees, descriptions, and locations are NOT stored.
-- The calendar page fetches the visible window live. Disconnect deletes this row.

ALTER TABLE google_calendar_connections
  ADD COLUMN IF NOT EXISTS read_calendar_ids TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS read_sync_tokens JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN google_calendar_connections.read_calendar_ids IS
  'Calendars shown on the owner calendar. Empty means the write target only. Independent of calendar_id.';

COMMENT ON COLUMN google_calendar_connections.read_sync_tokens IS
  'Opaque Google nextSyncToken per calendar id. Not event content.';
