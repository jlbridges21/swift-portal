-- V121 — Classic / New interface rollout
--
-- 1. platform_ui_rollout   one-row global switch, controlled from /platform/ui-rollout (super-admin).
-- 2. user_ui_preferences   per-user interface choice, banner dismissals, and adoption markers.
--
-- Additive only. Until this runs, the app behaves as "Classic Only" for every business user
-- (super-admins can still preview the new interface) — deploying code never starts the rollout.
-- Both tables are read and written only by server code with the service role (RLS on, no policies).
--
-- HOW TO RUN: SQL Editor → paste → Run. Re-runnable.
-- Rollback: DROP TABLE user_ui_preferences; DROP TABLE platform_ui_rollout;

CREATE TABLE IF NOT EXISTS platform_ui_rollout (
  id BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id),            -- singleton row
  status TEXT NOT NULL DEFAULT 'classic_only'
    CHECK (status IN ('classic_only', 'optional', 'new_default', 'classic_rollback')),
  activated_at TIMESTAMPTZ,                                   -- when the optional period started
  transition_at TIMESTAMPTZ,                                  -- when everyone moves to New
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

INSERT INTO platform_ui_rollout (id) VALUES (TRUE) ON CONFLICT (id) DO NOTHING;

ALTER TABLE platform_ui_rollout ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON platform_ui_rollout FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS user_ui_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  interface TEXT CHECK (interface IN ('classic', 'new')),     -- NULL = never chose (Classic default)
  try_new_banner_dismissed_at TIMESTAMPTZ,
  welcome_new_banner_dismissed_at TIMESTAMPTZ,
  first_tried_new_at TIMESTAMPTZ,                             -- first switch to New
  first_switched_back_at TIMESTAMPTZ,                         -- first switch from New back to Classic
  switch_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_ui_preferences_interface ON user_ui_preferences (interface);

ALTER TABLE user_ui_preferences ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON user_ui_preferences FROM anon, authenticated;
