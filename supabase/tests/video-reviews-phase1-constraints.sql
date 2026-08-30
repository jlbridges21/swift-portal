-- Video review phase 1 — CHECK constraint + cross-tenant trigger tests
-- Run in Supabase SQL Editor after migration-v77-video-reviews.sql

DO $$
DECLARE
  v_swift uuid := '00000000-0000-0000-0000-000000000001';
  v_tenant_b uuid := '00000000-0000-0000-0000-0000000000ff';
  v_project uuid;
  v_video uuid;
  v_review uuid := gen_random_uuid();
  v_version uuid := gen_random_uuid();
  v_parent uuid := gen_random_uuid();
  v_author uuid;
BEGIN
  SELECT id INTO v_project FROM projects WHERE id = '26e65643-74d1-4c34-b085-0711c6e4b97c';
  SELECT id INTO v_video FROM media_assets
    WHERE business_id = v_swift AND project_id = v_project AND media_type = 'video'
    LIMIT 1;
  SELECT id INTO v_author FROM auth.users LIMIT 1;

  IF v_project IS NULL OR v_video IS NULL OR v_author IS NULL THEN
    RAISE EXCEPTION 'Prerequisites missing (project/video/user)';
  END IF;

  INSERT INTO video_reviews (id, business_id, project_id, title, created_by)
  VALUES (v_review, v_swift, v_project, 'constraint test', v_author);

  INSERT INTO video_review_versions (id, business_id, review_id, media_asset_id, version_number, uploaded_by)
  VALUES (v_version, v_swift, v_review, v_video, 1, v_author);

  INSERT INTO video_review_comments (
    id, business_id, review_id, version_id, project_id,
    author_user_id, author_kind, timestamp_seconds, body
  ) VALUES (
    v_parent, v_swift, v_review, v_version, v_project,
    v_author, 'admin', 12.5, 'top-level marker'
  );

  BEGIN
    INSERT INTO video_review_comments (
      business_id, review_id, version_id, project_id,
      author_user_id, author_kind, body
    ) VALUES (
      v_swift, v_review, v_version, v_project,
      v_author, 'admin', 'missing timestamp'
    );
    RAISE EXCEPTION 'FAIL: top-level without timestamp should be rejected';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'OK: top-level without timestamp rejected — %', SQLERRM;
  END;

  BEGIN
    INSERT INTO video_review_comments (
      business_id, review_id, version_id, project_id, parent_comment_id,
      author_user_id, author_kind, timestamp_seconds, body
    ) VALUES (
      v_swift, v_review, v_version, v_project, v_parent,
      v_author, 'client', 3.0, 'reply with timestamp'
    );
    RAISE EXCEPTION 'FAIL: reply with timestamp should be rejected';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'OK: reply with timestamp rejected — %', SQLERRM;
  END;

  BEGIN
    INSERT INTO video_review_comments (
      business_id, review_id, version_id, project_id, parent_comment_id,
      author_user_id, author_kind, point_x, point_y, body
    ) VALUES (
      v_swift, v_review, v_version, v_project, v_parent,
      v_author, 'client', 0.5, 0.5, 'reply with point'
    );
    RAISE EXCEPTION 'FAIL: reply with point should be rejected';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'OK: reply with point rejected — %', SQLERRM;
  END;

  BEGIN
    INSERT INTO video_review_comments (
      business_id, review_id, version_id, project_id, parent_comment_id,
      author_user_id, author_kind, body, status
    ) VALUES (
      v_swift, v_review, v_version, v_project, v_parent,
      v_author, 'client', 'reply resolved', 'resolved'
    );
    RAISE EXCEPTION 'FAIL: reply with resolved status should be rejected';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'OK: reply with resolved status rejected — %', SQLERRM;
  END;

  BEGIN
    INSERT INTO video_review_comments (
      business_id, review_id, version_id, project_id,
      author_user_id, author_kind, timestamp_seconds, point_x, body
    ) VALUES (
      v_swift, v_review, v_version, v_project,
      v_author, 'admin', 1.0, 0.5, 'partial point'
    );
    RAISE EXCEPTION 'FAIL: partial points should be rejected';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'OK: partial points rejected — %', SQLERRM;
  END;

  BEGIN
    INSERT INTO video_review_comments (
      business_id, review_id, version_id, project_id,
      author_user_id, author_kind, timestamp_seconds, point_x, point_y, body
    ) VALUES (
      v_swift, v_review, v_version, v_project,
      v_author, 'admin', 1.0, 1.5, 0.5, 'bad point'
    );
    RAISE EXCEPTION 'FAIL: point > 1 should be rejected';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'OK: point out of range rejected — %', SQLERRM;
  END;

  BEGIN
    INSERT INTO video_review_comments (
      business_id, review_id, version_id, project_id,
      author_user_id, author_kind, timestamp_seconds, body
    ) VALUES (
      v_swift, v_review, v_version, v_project,
      v_author, 'admin', -1, 'negative time'
    );
    RAISE EXCEPTION 'FAIL: negative timestamp should be rejected';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'OK: negative timestamp rejected — %', SQLERRM;
  END;

  BEGIN
    DECLARE v_reply uuid := gen_random_uuid();
    BEGIN
      INSERT INTO video_review_comments (
        id, business_id, review_id, version_id, project_id, parent_comment_id,
        author_user_id, author_kind, body
      ) VALUES (
        v_reply, v_swift, v_review, v_version, v_project, v_parent,
        v_author, 'client', 'first reply'
      );
      BEGIN
        INSERT INTO video_review_comments (
          business_id, review_id, version_id, project_id, parent_comment_id,
          author_user_id, author_kind, body
        ) VALUES (
          v_swift, v_review, v_version, v_project, v_reply,
          v_author, 'client', 'nested reply'
        );
        RAISE EXCEPTION 'FAIL: nested reply should be rejected';
      EXCEPTION WHEN OTHERS THEN
        IF SQLERRM LIKE '%nest beyond one level%' THEN
          RAISE NOTICE 'OK: nested reply rejected — %', SQLERRM;
        ELSE
          RAISE;
        END IF;
      END;
    END;
  END;

  BEGIN
    DECLARE
      v_b_project uuid;
      v_b_review uuid := gen_random_uuid();
      v_b_version uuid := gen_random_uuid();
      v_b_video uuid;
    BEGIN
      SELECT id INTO v_b_project FROM projects WHERE business_id = v_tenant_b LIMIT 1;
      IF v_b_project IS NOT NULL THEN
        SELECT id INTO v_b_video FROM media_assets
          WHERE business_id = v_tenant_b AND project_id = v_b_project AND media_type = 'video'
          LIMIT 1;
      END IF;

      IF v_b_project IS NOT NULL AND v_b_video IS NOT NULL THEN
        INSERT INTO video_reviews (id, business_id, project_id, title)
        VALUES (v_b_review, v_tenant_b, v_b_project, 'tenant b review');
        INSERT INTO video_review_versions (id, business_id, review_id, media_asset_id, version_number)
        VALUES (v_b_version, v_tenant_b, v_b_review, v_b_video, 1);

        BEGIN
          INSERT INTO video_review_comments (
            business_id, review_id, version_id, project_id,
            author_user_id, author_kind, timestamp_seconds, body
          ) VALUES (
            v_swift, v_b_review, v_b_version, v_b_project,
            v_author, 'admin', 1.0, 'cross-tenant review'
          );
          RAISE EXCEPTION 'FAIL: cross-tenant review_id should be rejected';
        EXCEPTION WHEN OTHERS THEN
          IF SQLERRM LIKE '%tenant integrity violation%' THEN
            RAISE NOTICE 'OK: cross-tenant review_id rejected — %', SQLERRM;
          ELSE RAISE;
          END IF;
        END;

        BEGIN
          INSERT INTO video_review_comments (
            business_id, review_id, version_id, project_id,
            author_user_id, author_kind, timestamp_seconds, body
          ) VALUES (
            v_swift, v_review, v_b_version, v_project,
            v_author, 'admin', 1.0, 'cross-tenant version'
          );
          RAISE EXCEPTION 'FAIL: cross-tenant version_id should be rejected';
        EXCEPTION WHEN OTHERS THEN
          IF SQLERRM LIKE '%tenant integrity violation%' THEN
            RAISE NOTICE 'OK: cross-tenant version_id rejected — %', SQLERRM;
          ELSE RAISE;
          END IF;
        END;

        BEGIN
          INSERT INTO video_review_comments (
            business_id, review_id, version_id, project_id,
            author_user_id, author_kind, timestamp_seconds, body
          ) VALUES (
            v_swift, v_review, v_version, v_b_project,
            v_author, 'admin', 1.0, 'cross-tenant project'
          );
          RAISE EXCEPTION 'FAIL: cross-tenant project_id should be rejected';
        EXCEPTION WHEN OTHERS THEN
          IF SQLERRM LIKE '%tenant integrity violation%' THEN
            RAISE NOTICE 'OK: cross-tenant project_id rejected — %', SQLERRM;
          ELSE RAISE;
          END IF;
        END;

        DELETE FROM video_review_comments WHERE review_id = v_b_review;
        DELETE FROM video_review_versions WHERE review_id = v_b_review;
        DELETE FROM video_reviews WHERE id = v_b_review;
      ELSE
        RAISE NOTICE 'SKIP: Tenant B fixtures not present for cross-tenant comment tests';
      END IF;
    END;
  END;

  DELETE FROM video_review_comments WHERE review_id = v_review;
  DELETE FROM video_review_versions WHERE id = v_version;
  DELETE FROM video_reviews WHERE id = v_review;

  RAISE NOTICE 'video-reviews-phase1-constraints: all checks passed';
END;
$$;
