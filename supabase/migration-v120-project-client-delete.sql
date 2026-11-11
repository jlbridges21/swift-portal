-- ShootPortal V120 — Permanent Delete for projects and clients (alongside Hide)
--
-- Why this is needed (FK audit, before this migration):
--   projects.client_id      NOT NULL → clients ON DELETE CASCADE   (deleting a client would wipe its projects)
--   payments.client_id      NOT NULL → clients ON DELETE CASCADE   (… and its payment / invoice records)
--   revisions.client_id     NOT NULL → clients ON DELETE CASCADE
--   tours.project_id        NOT NULL → projects ON DELETE CASCADE  (a tour cannot outlive its project)
--   project_3d_models.project_id NOT NULL → projects ON DELETE CASCADE
--   media_assets.project_id nullable → projects ON DELETE CASCADE  (handled in delete_project_v120 below)
--   video_review_versions.media_asset_id → media_assets ON DELETE RESTRICT (handled below)
--
-- Changes:
--   1. projects / payments / revisions .client_id become nullable, FK → ON DELETE SET NULL.
--      A project whose client was deleted stays in ShootPortal with client_id NULL ("No client").
--   2. tours / project_3d_models: project_id becomes nullable and gains client_id
--      (→ clients ON DELETE SET NULL) so "Delete project, keep media" can keep them in the
--      Media library under the same client. FK on project_id is left as CASCADE; the delete
--      function detaches rows explicitly first.
--   3. delete_project_v120(business, project, delete_media) and delete_client_v120(business, client):
--      SECURITY DEFINER, service_role only, tenant-checked, run in one transaction. They return
--      the Storage objects the app must remove afterwards (Storage is not transactional).
--
-- Additive only. Until this is applied the app keeps working: the Delete buttons explain
-- that this migration is required and nothing is deleted. Hide is unchanged.
--
-- Rollback (only safe while no project has client_id NULL and no tour/model has project_id NULL):
--   DROP FUNCTION IF EXISTS delete_project_v120(UUID, UUID, BOOLEAN);
--   DROP FUNCTION IF EXISTS delete_client_v120(UUID, UUID);
--   ALTER TABLE tours DROP COLUMN client_id;  ALTER TABLE tours ALTER COLUMN project_id SET NOT NULL;
--   ALTER TABLE project_3d_models DROP COLUMN client_id;  ALTER TABLE project_3d_models ALTER COLUMN project_id SET NOT NULL;
--   ALTER TABLE projects/payments/revisions ALTER COLUMN client_id SET NOT NULL and re-create the FKs ON DELETE CASCADE.

-- ---------------------------------------------------------------------------
-- 1. client_id nullable + ON DELETE SET NULL (projects, payments, revisions)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  t TEXT;
  c RECORD;
BEGIN
  FOREACH t IN ARRAY ARRAY['projects', 'payments', 'revisions'] LOOP
    EXECUTE format('ALTER TABLE %I ALTER COLUMN client_id DROP NOT NULL', t);

    -- Drop whatever FK(s) currently link <t>.client_id → clients (name may vary by environment).
    FOR c IN
      SELECT con.conname
      FROM pg_constraint con
      JOIN pg_attribute att
        ON att.attrelid = con.conrelid AND att.attnum = ANY (con.conkey)
      WHERE con.contype = 'f'
        AND con.conrelid = format('public.%I', t)::regclass
        AND con.confrelid = 'public.clients'::regclass
        AND att.attname = 'client_id'
    LOOP
      EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', t, c.conname);
    END LOOP;

    EXECUTE format(
      'ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (client_id) REFERENCES clients (id) ON DELETE SET NULL',
      t, t || '_client_id_fkey'
    );
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 2. tours / project_3d_models can outlive their project (kept media)
-- ---------------------------------------------------------------------------
ALTER TABLE tours ALTER COLUMN project_id DROP NOT NULL;
ALTER TABLE tours ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients (id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_tours_client_id ON tours (client_id) WHERE client_id IS NOT NULL;

ALTER TABLE project_3d_models ALTER COLUMN project_id DROP NOT NULL;
ALTER TABLE project_3d_models ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients (id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_project_3d_models_client_id ON project_3d_models (client_id) WHERE client_id IS NOT NULL;

DROP TRIGGER IF EXISTS trg_tours_client_id_same_business ON tours;
CREATE TRIGGER trg_tours_client_id_same_business
  BEFORE INSERT OR UPDATE OF client_id, business_id ON tours
  FOR EACH ROW
  EXECUTE FUNCTION enforce_same_business('clients', 'client_id');

DROP TRIGGER IF EXISTS trg_project_3d_models_client_id_same_business ON project_3d_models;
CREATE TRIGGER trg_project_3d_models_client_id_same_business
  BEFORE INSERT OR UPDATE OF client_id, business_id ON project_3d_models
  FOR EACH ROW
  EXECUTE FUNCTION enforce_same_business('clients', 'client_id');

-- ---------------------------------------------------------------------------
-- 3a. delete_project_v120
--   p_delete_media = false → media / tours / 3D models are detached (project_id NULL) and keep the
--                            project's client + property so they stay in the Media library.
--   p_delete_media = true  → every attached asset row is deleted; returns its Storage objects.
--   Refused (project_has_paid_invoices) while any payment is paid / processing — hide instead.
--   The project's client record is never modified.
--   Also removed with the project (existing CASCADE FKs): folders, video reviews, shares (project,
--   media and public video links scoped to it), quotes/estimates, unpaid payment requests, shoot proposals,
--   staff assignments, marketing kit, notifications. Leads / activity / email events / client
--   messages keep their rows with project_id NULL.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION delete_project_v120(
  p_business_id UUID,
  p_project_id UUID,
  p_delete_media BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_client_id UUID;
  v_property_id UUID;
  v_media_ids UUID[];
  v_storage JSONB := '[]'::jsonb;
  v_tour_thumbs JSONB := '[]'::jsonb;
  v_media_count INT := 0;
  v_tour_count INT := 0;
  v_model_count INT := 0;
  v_paid INT := 0;
BEGIN
  SELECT client_id, property_id INTO v_client_id, v_property_id
  FROM projects
  WHERE id = p_project_id AND business_id = p_business_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'project_not_found' USING ERRCODE = 'P0002';
  END IF;

  -- Paid invoices are financial records: a project that has any can only be hidden.
  -- 'processing' = bank (ACH) payment already authorized and being collected.
  SELECT count(*) INTO v_paid
  FROM payments
  WHERE project_id = p_project_id AND business_id = p_business_id
    AND status IN ('paid', 'processing');
  IF v_paid > 0 THEN
    RAISE EXCEPTION 'project_has_paid_invoices' USING ERRCODE = 'P0001', DETAIL = v_paid::text;
  END IF;

  SELECT COALESCE(array_agg(id), '{}') INTO v_media_ids
  FROM media_assets
  WHERE project_id = p_project_id AND business_id = p_business_id;
  v_media_count := COALESCE(array_length(v_media_ids, 1), 0);

  IF NOT p_delete_media THEN
    UPDATE media_assets
    SET project_id = NULL,
        folder_id = NULL,
        client_id = COALESCE(client_id, v_client_id),
        property_id = COALESCE(property_id, v_property_id)
    WHERE project_id = p_project_id AND business_id = p_business_id;

    UPDATE tours
    SET project_id = NULL, client_id = COALESCE(client_id, v_client_id)
    WHERE project_id = p_project_id AND business_id = p_business_id;
    GET DIAGNOSTICS v_tour_count = ROW_COUNT;

    UPDATE project_3d_models
    SET project_id = NULL, client_id = COALESCE(client_id, v_client_id)
    WHERE project_id = p_project_id AND business_id = p_business_id;
    GET DIAGNOSTICS v_model_count = ROW_COUNT;
  ELSE
    -- Storage objects: originals + thumbnails (+ Photo Editor versions). External / YouTube /
    -- Kuula rows hold sentinel file_path values, not Storage objects. Only tenant-prefixed paths.
    SELECT COALESCE(jsonb_agg(DISTINCT jsonb_build_object('bucket', o.bucket, 'path', o.path)), '[]'::jsonb)
    INTO v_storage
    FROM (
      SELECT CASE WHEN ma.media_type = 'document' THEN 'project-documents' ELSE 'project-media' END AS bucket,
             ma.file_path AS path
      FROM media_assets ma
      WHERE ma.id = ANY (v_media_ids)
        AND ma.file_path IS NOT NULL
        AND COALESCE(ma.media_source, 'upload') NOT IN ('youtube', 'kuula', 'external')
      UNION
      SELECT 'project-media', ma.thumbnail_url
      FROM media_assets ma
      WHERE ma.id = ANY (v_media_ids)
        AND ma.thumbnail_url IS NOT NULL
        AND ma.thumbnail_url NOT LIKE 'http%'
      UNION
      SELECT 'project-media', v.file_path
      FROM media_asset_versions v
      WHERE v.media_asset_id = ANY (v_media_ids) AND v.file_path IS NOT NULL
      UNION
      SELECT 'project-media', v.thumbnail_url
      FROM media_asset_versions v
      WHERE v.media_asset_id = ANY (v_media_ids) AND v.thumbnail_url IS NOT NULL
    ) o
    WHERE o.path LIKE p_business_id::text || '/%';

    SELECT COALESCE(jsonb_agg(t.thumbnail_url), '[]'::jsonb) INTO v_tour_thumbs
    FROM tours t
    WHERE t.project_id = p_project_id AND t.business_id = p_business_id AND t.thumbnail_url IS NOT NULL;

    SELECT count(*) INTO v_tour_count FROM tours
    WHERE project_id = p_project_id AND business_id = p_business_id;
    SELECT count(*) INTO v_model_count FROM project_3d_models
    WHERE project_id = p_project_id AND business_id = p_business_id;

    -- video_review_versions → media_assets is ON DELETE RESTRICT: clear review data first.
    DELETE FROM video_reviews WHERE project_id = p_project_id AND business_id = p_business_id;
    DELETE FROM video_review_versions
    WHERE media_asset_id = ANY (v_media_ids) AND business_id = p_business_id;

    DELETE FROM media_assets WHERE id = ANY (v_media_ids) AND business_id = p_business_id;
    -- tours / project_3d_models go with the project (CASCADE).
  END IF;

  DELETE FROM projects WHERE id = p_project_id AND business_id = p_business_id;

  RETURN jsonb_build_object(
    'client_id', v_client_id,
    'media', v_media_count,
    'tours', v_tour_count,
    'models', v_model_count,
    'storage', v_storage,
    'tour_thumbnails', v_tour_thumbs
  );
END;
$$;

REVOKE ALL ON FUNCTION delete_project_v120(UUID, UUID, BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION delete_project_v120(UUID, UUID, BOOLEAN) TO service_role;

-- ---------------------------------------------------------------------------
-- 3b. delete_client_v120
--   Removes the client row and what is purely theirs (CASCADE): project assignments,
--   CRM notes, client messages, saved marketing brand profile.
--   Never deletes projects or media:
--     · projects they were primary on → handed to another assigned client if there is one,
--       otherwise client_id NULL (orphaned, still in ShootPortal);
--     · payments / revisions / media / properties / tours / 3D models / communications /
--       activity → client_id NULL (rows kept);
--     · their portal login profile → client_id NULL (sees an empty portal; auth user is kept).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION delete_client_v120(
  p_business_id UUID,
  p_client_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  r RECORD;
  v_next RECORD;
  v_reassigned INT := 0;
  v_orphaned INT := 0;
BEGIN
  PERFORM 1 FROM clients
  WHERE id = p_client_id AND business_id = p_business_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'client_not_found' USING ERRCODE = 'P0002';
  END IF;

  FOR r IN
    SELECT id FROM projects
    WHERE client_id = p_client_id AND business_id = p_business_id
    FOR UPDATE
  LOOP
    SELECT pc.id, pc.client_id INTO v_next
    FROM project_clients pc
    JOIN clients c ON c.id = pc.client_id
    WHERE pc.project_id = r.id AND pc.client_id <> p_client_id
    ORDER BY pc.is_primary DESC, (c.deleted_at IS NULL) DESC, pc.created_at ASC NULLS LAST
    LIMIT 1;

    IF FOUND THEN
      UPDATE project_clients SET is_primary = (id = v_next.id) WHERE project_id = r.id;
      UPDATE projects SET client_id = v_next.client_id WHERE id = r.id;
      v_reassigned := v_reassigned + 1;
    ELSE
      UPDATE projects SET client_id = NULL WHERE id = r.id;
      v_orphaned := v_orphaned + 1;
    END IF;
  END LOOP;

  -- Explicit (the FKs are SET NULL after step 1, but keep the intent visible).
  UPDATE payments SET client_id = NULL WHERE client_id = p_client_id AND business_id = p_business_id;
  UPDATE revisions SET client_id = NULL WHERE client_id = p_client_id AND business_id = p_business_id;

  DELETE FROM clients WHERE id = p_client_id AND business_id = p_business_id;

  RETURN jsonb_build_object('reassigned_projects', v_reassigned, 'orphaned_projects', v_orphaned);
END;
$$;

REVOKE ALL ON FUNCTION delete_client_v120(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION delete_client_v120(UUID, UUID) TO service_role;
