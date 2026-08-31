-- Verification-only: simulate comment failure after review+version insert (rolls back both).
CREATE OR REPLACE FUNCTION verify_simulate_lazy_review_orphan_failure(
  p_business_id UUID,
  p_project_id UUID,
  p_media_asset_id UUID,
  p_created_by UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_review_id UUID;
  v_asset_project UUID;
BEGIN
  SELECT ma.project_id
  INTO v_asset_project
  FROM media_assets ma
  WHERE ma.id = p_media_asset_id
    AND ma.business_id = p_business_id
    AND ma.media_type = 'video';

  IF v_asset_project IS NULL OR v_asset_project <> p_project_id THEN
    RAISE EXCEPTION 'asset_not_found';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(p_media_asset_id::text));

  INSERT INTO video_reviews (business_id, project_id, title, created_by)
  VALUES (p_business_id, p_project_id, 'Orphan simulation', p_created_by)
  RETURNING id INTO v_review_id;

  INSERT INTO video_review_versions (
    business_id, review_id, media_asset_id, version_number, uploaded_by
  ) VALUES (
    p_business_id, v_review_id, p_media_asset_id, 1, p_created_by
  );

  RAISE EXCEPTION 'simulated_comment_failure';
END;
$$;
