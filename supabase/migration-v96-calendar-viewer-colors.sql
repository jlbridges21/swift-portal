-- Per owner-admin event colors. Same scope as viewer_hidden_calendar_ids:
-- one Google connection is shared, and each admin's colors must not overwrite
-- another's. A missing key means "use the default" (Google's own calendar
-- color, or ShootPortal blue). Only an explicit pick is stored.
-- Staff never read this column.

ALTER TABLE google_calendar_connections
  ADD COLUMN IF NOT EXISTS viewer_calendar_colors JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN google_calendar_connections.viewer_calendar_colors IS
  'Map of owner-admin user id → { shoots?: hex, calendars?: { calendar id → hex } }. Absence means the default color.';
