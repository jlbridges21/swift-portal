-- V85 — Lazy video review creation (one review per media asset, atomic first comment)
-- Idempotent / re-runnable.

CREATE UNIQUE INDEX IF NOT EXISTS idx_video_review_versions_media_asset_unique
  ON video_review_versions (media_asset_id);

CREATE OR REPLACE FUNCTION create_lazy_video_review_comment(
  p_business_id UUID,
  p_project_id UUID,
  p_media_asset_id UUID,
  p_title TEXT,
  p_created_by UUID,
  p_author_user_id UUID,
  p_author_kind TEXT,
  p_body TEXT,
  p_timestamp_seconds NUMERIC,
  p_point_x NUMERIC DEFAULT NULL,
  p_point_y NUMERIC DEFAULT NULL
)
RETURNS TABLE (
  review_id UUID,
  version_id UUID,
  comment_id UUID,
  review_created BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_review_id UUID;
  v_version_id UUID;
  v_comment_id UUID;
  v_asset_project UUID;
  v_review_created BOOLEAN := false;
  v_body TEXT;
BEGIN
  v_body := trim(p_body);
  IF v_body = '' THEN
    RAISE EXCEPTION 'comment_body_required';
  END IF;

  IF p_author_kind NOT IN ('client', 'admin') THEN
    RAISE EXCEPTION 'invalid_author_kind';
  END IF;

  IF p_timestamp_seconds IS NULL OR p_timestamp_seconds < 0 THEN
    RAISE EXCEPTION 'comment_timestamp_required';
  END IF;

  SELECT ma.project_id
  INTO v_asset_project
  FROM media_assets ma
  WHERE ma.id = p_media_asset_id
    AND ma.business_id = p_business_id
    AND ma.media_type = 'video';

  IF v_asset_project IS NULL THEN
    RAISE EXCEPTION 'asset_not_found';
  END IF;

  IF v_asset_project <> p_project_id THEN
    RAISE EXCEPTION 'asset_project_mismatch';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(p_media_asset_id::text));

  SELECT vrv.review_id, vrv.id
  INTO v_review_id, v_version_id
  FROM video_review_versions vrv
  WHERE vrv.media_asset_id = p_media_asset_id;

  IF v_version_id IS NULL THEN
    INSERT INTO video_reviews (business_id, project_id, title, created_by)
    VALUES (p_business_id, p_project_id, trim(p_title), p_created_by)
    RETURNING id INTO v_review_id;

    v_review_created := true;

    BEGIN
      INSERT INTO video_review_versions (
        business_id,
        review_id,
        media_asset_id,
        version_number,
        uploaded_by
      ) VALUES (
        p_business_id,
        v_review_id,
        p_media_asset_id,
        1,
        p_created_by
      )
      RETURNING id INTO v_version_id;
    EXCEPTION
      WHEN unique_violation THEN
        DELETE FROM video_reviews WHERE id = v_review_id;
        v_review_created := false;
        SELECT vrv.review_id, vrv.id
        INTO v_review_id, v_version_id
        FROM video_review_versions vrv
        WHERE vrv.media_asset_id = p_media_asset_id;
        IF v_version_id IS NULL THEN
          RAISE;
        END IF;
    END;
  END IF;

  INSERT INTO video_review_comments (
    business_id,
    review_id,
    version_id,
    project_id,
    author_user_id,
    author_kind,
    body,
    timestamp_seconds,
    point_x,
    point_y
  ) VALUES (
    p_business_id,
    v_review_id,
    v_version_id,
    p_project_id,
    p_author_user_id,
    p_author_kind,
    v_body,
    p_timestamp_seconds,
    p_point_x,
    p_point_y
  )
  RETURNING id INTO v_comment_id;

  RETURN QUERY SELECT v_review_id, v_version_id, v_comment_id, v_review_created;
END;
$$;
