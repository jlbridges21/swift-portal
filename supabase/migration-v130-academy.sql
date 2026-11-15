-- ShootPortal Academy (v130): per-user lesson progress and earned certificates.
-- Additive only. Run in the Supabase SQL editor. Safe to run twice.
-- Access is server-side only (service role), like w9_sends: API routes check the signed-in
-- user and only ever read or write that user's own rows.

CREATE TABLE IF NOT EXISTS academy_lesson_progress (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  -- Lesson key from src/lib/academy/catalog.ts, e.g. 'V07'. Not a foreign key: the catalog lives in code.
  lesson_key TEXT NOT NULL CHECK (lesson_key ~ '^[A-Z0-9_-]{1,16}$'),
  -- Furthest point reached, as a share of the video (0-100), and where to resume (seconds).
  watched_percent SMALLINT NOT NULL DEFAULT 0 CHECK (watched_percent BETWEEN 0 AND 100),
  last_position_seconds INTEGER NOT NULL DEFAULT 0 CHECK (last_position_seconds >= 0),
  completed_at TIMESTAMPTZ,
  -- 'watched' (reached 90%) or 'manual' (Mark as complete).
  completed_via TEXT CHECK (completed_via IN ('watched', 'manual')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, lesson_key)
);

CREATE INDEX IF NOT EXISTS academy_lesson_progress_business
  ON academy_lesson_progress (business_id);

COMMENT ON TABLE academy_lesson_progress IS
  'ShootPortal Academy: how far each user got in each lesson video. One row per user and lesson.';

CREATE TABLE IF NOT EXISTS academy_certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  -- Public verification code shown on the certificate (shootportal.app/academy/verify/<code>).
  code TEXT NOT NULL UNIQUE CHECK (code ~ '^SPA-[A-Z0-9]{4}-[A-Z0-9]{4}$'),
  -- Name and business as they were when the certificate was issued.
  holder_name TEXT NOT NULL,
  business_name TEXT,
  lesson_count SMALLINT NOT NULL,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ,
  UNIQUE (user_id)
);

COMMENT ON TABLE academy_certificates IS
  'ShootPortal Academy completion certificates. One per user; the code is public for verification.';

ALTER TABLE academy_lesson_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE academy_certificates ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON academy_lesson_progress FROM PUBLIC, anon, authenticated;
REVOKE ALL ON academy_certificates FROM PUBLIC, anon, authenticated;
GRANT ALL ON academy_lesson_progress TO service_role;
GRANT ALL ON academy_certificates TO service_role;
