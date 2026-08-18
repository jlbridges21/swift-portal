-- Swift Portal V36: tenant-prefixed storage paths (two shapes, forever)
--
-- NEW uploads write to:
--   {business_id}/{project_id}/{filename}     project-attached
--   {business_id}/library/{filename}          unassigned library
--
-- LEGACY objects already in production stay exactly where they are:
--   {project_id}/{filename}
--   library/unassigned/{filename}
--
-- DO NOT move, copy, rename, or re-key existing storage objects.
-- DO NOT UPDATE media_assets.file_path / storage_path for historical rows.
-- Those columns are absolute object keys. Rewriting them breaks every
-- client download of media uploaded before this migration. The two shapes
-- coexist permanently — "cleaning up" legacy prefixes is out of scope.
--
-- Avatars stay {auth.uid()}/... — policies in migration-v12 are untouched.
-- Bucket names, file size limits, and MIME allowlists are unchanged.
--
-- HOW TO RUN:
-- 1. Open Supabase Dashboard → SQL Editor → New query
-- 2. Paste this entire file and click Run
--
-- VERIFICATION:
--   pg_policies on storage.objects still has the four avatar policies.
--   project-media / project-documents have exactly four policies (one per
--   command), each ORing legacy and new path shapes.

-- ---------------------------------------------------------------------------
-- 1. Drop existing project-media / project-documents policies
--    (avatars policies are NOT listed here)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admins can upload media" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update media" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete media" ON storage.objects;
DROP POLICY IF EXISTS "Admins can view all media" ON storage.objects;
DROP POLICY IF EXISTS "Clients can view own media files" ON storage.objects;

-- Idempotency: drop this migration's own policies so the file is re-runnable
-- (repo convention — every migration must be safe to run twice).
DROP POLICY IF EXISTS "Media files select" ON storage.objects;
DROP POLICY IF EXISTS "Media files insert" ON storage.objects;
DROP POLICY IF EXISTS "Media files update" ON storage.objects;
DROP POLICY IF EXISTS "Media files delete" ON storage.objects;

-- ---------------------------------------------------------------------------
-- 2. SELECT — clients (exact v3 legacy predicate OR new prefix) + admins
--    (legacy project in this business, legacy library/unassigned rows owned
--    by this business, or new {business}/… prefix)
-- ---------------------------------------------------------------------------
CREATE POLICY "Media files select" ON storage.objects
  FOR SELECT USING (
    bucket_id IN ('project-media', 'project-documents')
    AND (
      -- LEGACY client: first folder is a project id the caller can access.
      -- Predicate copied from migration-v3.sql (junction + primary client_id).
      (storage.foldername(name))[1] IN (
        SELECT id::text FROM projects p
        WHERE p.client_id = get_user_client_id()
           OR EXISTS (
             SELECT 1 FROM project_clients pc
             WHERE pc.project_id = p.id AND pc.client_id = get_user_client_id()
           )
      )
      OR (
        -- NEW client: {business}/{project}/…
        (storage.foldername(name))[1] = current_business_id()::text
        AND (storage.foldername(name))[2] IN (
          SELECT id::text FROM projects p
          WHERE p.client_id = get_user_client_id()
             OR EXISTS (
               SELECT 1 FROM project_clients pc
               WHERE pc.project_id = p.id AND pc.client_id = get_user_client_id()
             )
        )
      )
      OR (
        (is_admin() OR is_super_admin())
        AND current_business_id() IS NOT NULL
        AND (
          (storage.foldername(name))[1] IN (
            SELECT id::text FROM projects WHERE business_id = current_business_id()
          )
          OR (
            (storage.foldername(name))[1] = 'library'
            AND (storage.foldername(name))[2] = 'unassigned'
            AND EXISTS (
              SELECT 1 FROM media_assets m
              WHERE m.file_path = name
                AND m.business_id = current_business_id()
            )
          )
          OR (
            (storage.foldername(name))[1] = current_business_id()::text
            AND (
              (storage.foldername(name))[2] IN (
                SELECT id::text FROM projects WHERE business_id = current_business_id()
              )
              OR (storage.foldername(name))[2] = 'library'
            )
          )
        )
      )
    )
  );

-- ---------------------------------------------------------------------------
-- 3. INSERT / UPDATE / DELETE — admin, both shapes + business check.
--    INSERT does not allow library/unassigned (that global prefix is closed).
-- ---------------------------------------------------------------------------
CREATE POLICY "Media files insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id IN ('project-media', 'project-documents')
    AND (is_admin() OR is_super_admin())
    AND current_business_id() IS NOT NULL
    AND (
      (storage.foldername(name))[1] IN (
        SELECT id::text FROM projects WHERE business_id = current_business_id()
      )
      OR (
        (storage.foldername(name))[1] = current_business_id()::text
        AND (
          (storage.foldername(name))[2] IN (
            SELECT id::text FROM projects WHERE business_id = current_business_id()
          )
          OR (storage.foldername(name))[2] = 'library'
        )
      )
    )
  );

CREATE POLICY "Media files update" ON storage.objects
  FOR UPDATE
  USING (
    bucket_id IN ('project-media', 'project-documents')
    AND (is_admin() OR is_super_admin())
    AND current_business_id() IS NOT NULL
    AND (
      (storage.foldername(name))[1] IN (
        SELECT id::text FROM projects WHERE business_id = current_business_id()
      )
      OR (
        (storage.foldername(name))[1] = 'library'
        AND (storage.foldername(name))[2] = 'unassigned'
        AND EXISTS (
          SELECT 1 FROM media_assets m
          WHERE m.file_path = name
            AND m.business_id = current_business_id()
        )
      )
      OR (
        (storage.foldername(name))[1] = current_business_id()::text
        AND (
          (storage.foldername(name))[2] IN (
            SELECT id::text FROM projects WHERE business_id = current_business_id()
          )
          OR (storage.foldername(name))[2] = 'library'
        )
      )
    )
  )
  WITH CHECK (
    bucket_id IN ('project-media', 'project-documents')
    AND (is_admin() OR is_super_admin())
    AND current_business_id() IS NOT NULL
    AND (
      (storage.foldername(name))[1] IN (
        SELECT id::text FROM projects WHERE business_id = current_business_id()
      )
      OR (
        (storage.foldername(name))[1] = 'library'
        AND (storage.foldername(name))[2] = 'unassigned'
        AND EXISTS (
          SELECT 1 FROM media_assets m
          WHERE m.file_path = name
            AND m.business_id = current_business_id()
        )
      )
      OR (
        (storage.foldername(name))[1] = current_business_id()::text
        AND (
          (storage.foldername(name))[2] IN (
            SELECT id::text FROM projects WHERE business_id = current_business_id()
          )
          OR (storage.foldername(name))[2] = 'library'
        )
      )
    )
  );

CREATE POLICY "Media files delete" ON storage.objects
  FOR DELETE USING (
    bucket_id IN ('project-media', 'project-documents')
    AND (is_admin() OR is_super_admin())
    AND current_business_id() IS NOT NULL
    AND (
      (storage.foldername(name))[1] IN (
        SELECT id::text FROM projects WHERE business_id = current_business_id()
      )
      OR (
        (storage.foldername(name))[1] = 'library'
        AND (storage.foldername(name))[2] = 'unassigned'
        AND EXISTS (
          SELECT 1 FROM media_assets m
          WHERE m.file_path = name
            AND m.business_id = current_business_id()
        )
      )
      OR (
        (storage.foldername(name))[1] = current_business_id()::text
        AND (
          (storage.foldername(name))[2] IN (
            SELECT id::text FROM projects WHERE business_id = current_business_id()
          )
          OR (storage.foldername(name))[2] = 'library'
        )
      )
    )
  );

-- ---------------------------------------------------------------------------
-- 4. Verification
-- ---------------------------------------------------------------------------
SELECT policyname, cmd
FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects'
ORDER BY policyname;
