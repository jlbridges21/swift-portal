-- ShootPortal V116 — Public video sharing & embedding (video_public_shares)
--
-- One row per video (media_assets.media_type = 'video', uploaded — not YouTube). The row
-- holds a stable random public_id used in /v/{public_id} (watch page) and
-- /embed/{public_id} (iframe player). Turning sharing off flips `enabled`; turning it back
-- on reuses the same public_id so links and embeds already published keep working.
-- "Reset link" issues a new public_id (old links and embeds stop working).
--
-- Independent of project privacy: a row grants playback of exactly ONE video file. It never
-- grants the project, other media, client, or financial data. Nothing in projects,
-- project_shares, media_shares, or media_assets changes.
--
-- Fail closed: a share stops working when the video is deleted (CASCADE), moved to another
-- project (trigger below), or its project is deleted (trigger below). The app's resolver
-- re-checks all of it on every request, and also requires the business to be active.
--
-- Bandwidth: playback streams directly from Supabase Storage via short-lived signed URLs
-- (CDN-served, native range/seek). Bytes are ESTIMATED from the player's buffered ranges
-- and recorded per (share, day) in video_public_share_daily and per (business, day) in
-- business_egress_daily under the new channel 'public_video'.
--
-- Additive only. The app runs without this migration: the Share modal shows a notice
-- and public routes 404. Rollback: DROP the two tables and the function, and restore the
-- previous business_egress_daily channel CHECK.

CREATE TABLE IF NOT EXISTS video_public_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  media_asset_id UUID NOT NULL REFERENCES media_assets(id) ON DELETE CASCADE,
  -- Location snapshot; the resolver refuses the share if the video moves.
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  public_id TEXT NOT NULL CHECK (public_id ~ '^[A-Za-z0-9_-]{16,32}$'),
  enabled BOOLEAN NOT NULL DEFAULT false,
  enabled_at TIMESTAMPTZ,
  enabled_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  -- Who turned it on: 'business' (owner/staff) or 'client'. Client-enabled shares also
  -- require the video to still be visible to clients when resolved.
  enabled_by_role TEXT CHECK (enabled_by_role IN ('business', 'client')),
  disabled_at TIMESTAMPTZ,
  disabled_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  disabled_reason TEXT CHECK (char_length(disabled_reason) <= 40),
  -- Last embed options chosen in the Share modal (convenience only; the embed URL carries them).
  embed_settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  view_count BIGINT NOT NULL DEFAULT 0,
  play_count BIGINT NOT NULL DEFAULT 0,
  est_bytes BIGINT NOT NULL DEFAULT 0,
  last_viewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_video_public_shares_public_id ON video_public_shares (public_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_video_public_shares_media_asset ON video_public_shares (media_asset_id);
CREATE INDEX IF NOT EXISTS idx_video_public_shares_business ON video_public_shares (business_id);
CREATE INDEX IF NOT EXISTS idx_video_public_shares_project ON video_public_shares (project_id);

DROP TRIGGER IF EXISTS trg_video_public_shares_media_same_business ON video_public_shares;
CREATE TRIGGER trg_video_public_shares_media_same_business
  BEFORE INSERT OR UPDATE ON video_public_shares
  FOR EACH ROW
  EXECUTE FUNCTION enforce_same_business('media_assets', 'media_asset_id');

DROP TRIGGER IF EXISTS trg_video_public_shares_project_same_business ON video_public_shares;
CREATE TRIGGER trg_video_public_shares_project_same_business
  BEFORE INSERT OR UPDATE ON video_public_shares
  FOR EACH ROW
  EXECUTE FUNCTION enforce_same_business('projects', 'project_id');

-- ---------------------------------------------------------------------------
-- Fail-closed: moving the video to another project, or deleting the project, turns it off.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION disable_video_public_shares_on_asset_move()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.project_id IS DISTINCT FROM NEW.project_id THEN
    UPDATE video_public_shares
       SET enabled = false,
           disabled_at = now(),
           disabled_reason = 'moved',
           updated_at = now()
     WHERE media_asset_id = NEW.id
       AND enabled;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_media_assets_disable_video_public_shares ON media_assets;
CREATE TRIGGER trg_media_assets_disable_video_public_shares
  AFTER UPDATE OF project_id ON media_assets
  FOR EACH ROW
  EXECUTE FUNCTION disable_video_public_shares_on_asset_move();

CREATE OR REPLACE FUNCTION disable_video_public_shares_on_project_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
    UPDATE video_public_shares
       SET enabled = false,
           disabled_at = now(),
           disabled_reason = 'project_deleted',
           updated_at = now()
     WHERE project_id = NEW.id
       AND enabled;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_projects_disable_video_public_shares ON projects;
CREATE TRIGGER trg_projects_disable_video_public_shares
  AFTER UPDATE OF deleted_at ON projects
  FOR EACH ROW
  EXECUTE FUNCTION disable_video_public_shares_on_project_delete();

-- ---------------------------------------------------------------------------
-- Per-video daily traffic (super-admin analytics: high-traffic videos, cost attribution)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS video_public_share_daily (
  share_id UUID NOT NULL REFERENCES video_public_shares(id) ON DELETE CASCADE,
  day DATE NOT NULL,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  media_asset_id UUID NOT NULL,
  views INTEGER NOT NULL DEFAULT 0,
  embed_views INTEGER NOT NULL DEFAULT 0,
  plays INTEGER NOT NULL DEFAULT 0,
  est_bytes BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (share_id, day)
);

CREATE INDEX IF NOT EXISTS idx_video_public_share_daily_day ON video_public_share_daily (day DESC);
CREATE INDEX IF NOT EXISTS idx_video_public_share_daily_business ON video_public_share_daily (business_id, day DESC);

-- Public video bytes are their own egress channel so they are distinguishable from
-- project downloads in Platform Economics.
ALTER TABLE business_egress_daily DROP CONSTRAINT IF EXISTS business_egress_daily_channel_check;
ALTER TABLE business_egress_daily
  ADD CONSTRAINT business_egress_daily_channel_check
  CHECK (channel IN ('proxied_download', 'zip_download', 'signed_delivery', 'public_video'));

-- Atomic increment of share totals, the share's daily row and the business egress row.
-- p_kind: 'view' (watch page load), 'embed_view' (iframe load), 'play', 'bytes'.
CREATE OR REPLACE FUNCTION record_public_video_activity(
  p_share_id UUID,
  p_kind TEXT,
  p_bytes BIGINT DEFAULT 0
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_business UUID;
  v_media UUID;
  v_day DATE := (now() AT TIME ZONE 'utc')::date;
  v_bytes BIGINT := GREATEST(COALESCE(p_bytes, 0), 0);
  v_view INTEGER := CASE WHEN p_kind IN ('view', 'embed_view') THEN 1 ELSE 0 END;
  v_embed INTEGER := CASE WHEN p_kind = 'embed_view' THEN 1 ELSE 0 END;
  v_play INTEGER := CASE WHEN p_kind = 'play' THEN 1 ELSE 0 END;
BEGIN
  IF p_kind NOT IN ('view', 'embed_view', 'play', 'bytes') THEN
    RETURN;
  END IF;

  UPDATE video_public_shares
     SET view_count = view_count + v_view,
         play_count = play_count + v_play,
         est_bytes = est_bytes + v_bytes,
         last_viewed_at = CASE WHEN v_view = 1 THEN now() ELSE last_viewed_at END
   WHERE id = p_share_id
     AND enabled
  RETURNING business_id, media_asset_id INTO v_business, v_media;

  IF v_business IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO video_public_share_daily (share_id, day, business_id, media_asset_id, views, embed_views, plays, est_bytes)
  VALUES (p_share_id, v_day, v_business, v_media, v_view, v_embed, v_play, v_bytes)
  ON CONFLICT (share_id, day) DO UPDATE SET
    views = video_public_share_daily.views + EXCLUDED.views,
    embed_views = video_public_share_daily.embed_views + EXCLUDED.embed_views,
    plays = video_public_share_daily.plays + EXCLUDED.plays,
    est_bytes = video_public_share_daily.est_bytes + EXCLUDED.est_bytes,
    updated_at = now();

  IF v_bytes > 0 OR v_play = 1 THEN
    INSERT INTO business_egress_daily (business_id, day, channel, bytes, requests, image_transforms)
    VALUES (v_business, v_day, 'public_video', v_bytes, v_play, 0)
    ON CONFLICT (business_id, day, channel) DO UPDATE SET
      bytes = business_egress_daily.bytes + EXCLUDED.bytes,
      requests = business_egress_daily.requests + EXCLUDED.requests,
      updated_at = now();
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION record_public_video_activity(UUID, TEXT, BIGINT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION record_public_video_activity(UUID, TEXT, BIGINT) TO service_role;
REVOKE ALL ON FUNCTION disable_video_public_shares_on_asset_move() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION disable_video_public_shares_on_project_delete() FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- RLS: server-only tables. Every read/write goes through the service role with an explicit
-- business_id filter (tenant-lint enforced); browsers never read these directly.
-- ---------------------------------------------------------------------------

ALTER TABLE video_public_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_public_share_daily ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON video_public_shares FROM PUBLIC, anon, authenticated;
REVOKE ALL ON video_public_share_daily FROM PUBLIC, anon, authenticated;
GRANT ALL ON video_public_shares TO service_role;
GRANT ALL ON video_public_share_daily TO service_role;

ALTER TYPE activity_type ADD VALUE IF NOT EXISTS 'video_public_share_enabled';
ALTER TYPE activity_type ADD VALUE IF NOT EXISTS 'video_public_share_disabled';
ALTER TYPE activity_type ADD VALUE IF NOT EXISTS 'video_public_share_reset';
