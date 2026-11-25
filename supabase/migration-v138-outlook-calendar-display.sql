-- ShootPortal V138 — Outlook calendars on the Shoot Calendar (display choices)
--
-- Which Outlook calendars the owner shows on the Shoot Calendar, and their colors. Same idea as
-- google_calendar_connections.viewer_hidden_calendar_ids / viewer_calendar_colors, but Outlook is
-- one owner-managed connection per business, so plain columns are enough.
--
--   display_hidden_calendar_ids  NULL = not chosen yet (read-only calendars such as Birthdays and
--                                Holidays start hidden; the rest show)
--   display_calendar_colors      { "<outlook calendar id>": "#RRGGBB" }
--
-- Additive only. Without it, Outlook events still show (default choices) and changes aren't saved.
--
-- HOW TO RUN: Supabase SQL Editor → paste → Run. Re-runnable.
-- Rollback:
--   ALTER TABLE outlook_calendar_connections DROP COLUMN IF EXISTS display_hidden_calendar_ids;
--   ALTER TABLE outlook_calendar_connections DROP COLUMN IF EXISTS display_calendar_colors;

ALTER TABLE outlook_calendar_connections
  ADD COLUMN IF NOT EXISTS display_hidden_calendar_ids TEXT[];

ALTER TABLE outlook_calendar_connections
  ADD COLUMN IF NOT EXISTS display_calendar_colors JSONB NOT NULL DEFAULT '{}'::jsonb;
