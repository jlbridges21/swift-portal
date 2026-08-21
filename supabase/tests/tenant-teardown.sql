-- ShootPortal — tenant test teardown (standalone, ready to paste)
-- Deletes Tenant B (…0000ff) and pentest-co (…0000cc) only. Guarded.
-- Extracted from tenant-isolation.sql so it can be run without editing comment markers.
-- After running, delete the @example.test auth users in the Supabase dashboard.

DO $$
DECLARE
  v_teardown_business_id uuid := '00000000-0000-0000-0000-0000000000ff';
  v_pentest_business_id uuid := '00000000-0000-0000-0000-0000000000cc';
  v_tenant_b_admin_user_id  uuid := '5448df47-b934-4313-973a-db81d0396e36';
  v_tenant_b_client_user_id uuid := '694521a7-5660-4529-b13d-3745f0665b1e';
BEGIN
  IF v_teardown_business_id <> '00000000-0000-0000-0000-0000000000ff'::uuid THEN
    RAISE EXCEPTION 'Teardown aborted: business id guard failed (%)', v_teardown_business_id;
  END IF;
  DELETE FROM media_asset_tags WHERE business_id = v_teardown_business_id;
  DELETE FROM media_asset_events WHERE business_id = v_teardown_business_id;
  DELETE FROM media_downloads WHERE business_id = v_teardown_business_id;
  DELETE FROM asset_reviews WHERE business_id = v_teardown_business_id;
  DELETE FROM email_events WHERE business_id = v_teardown_business_id;
  DELETE FROM client_notes WHERE business_id = v_teardown_business_id;
  DELETE FROM communications WHERE business_id = v_teardown_business_id;
  DELETE FROM notifications WHERE business_id = v_teardown_business_id;
  DELETE FROM activity_logs WHERE business_id = v_teardown_business_id;
  DELETE FROM client_messages WHERE business_id = v_teardown_business_id;
  DELETE FROM project_messages WHERE business_id = v_teardown_business_id;
  DELETE FROM shoot_proposals WHERE business_id = v_teardown_business_id;
  DELETE FROM revisions WHERE business_id = v_teardown_business_id;
  DELETE FROM tours WHERE business_id = v_teardown_business_id;
  DELETE FROM payments WHERE business_id = v_teardown_business_id;
  DELETE FROM project_quotes WHERE business_id = v_teardown_business_id;
  DELETE FROM media_assets WHERE business_id = v_teardown_business_id;
  DELETE FROM media_folders WHERE business_id = v_teardown_business_id;
  DELETE FROM project_clients WHERE business_id = v_teardown_business_id;
  DELETE FROM leads WHERE business_id = v_teardown_business_id;
  DELETE FROM google_calendar_connections_v2 WHERE business_id = v_teardown_business_id;
  DELETE FROM business_integrations WHERE business_id = v_teardown_business_id;
  -- protect_objects_delete blocks SQL DELETE. Wrap so CRM teardown still runs.
  -- Then Storage API: DELETE /storage/v1/object/project-media/{id}/library/tenant-b-isolation.bin
  BEGIN
    DELETE FROM storage.objects
      WHERE bucket_id IN ('project-media', 'project-documents')
        AND name LIKE v_teardown_business_id::text || '/%';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'storage.objects SQL DELETE skipped (%). Use Storage API.', SQLERRM;
  END;
  DELETE FROM projects WHERE business_id = v_teardown_business_id;
  DELETE FROM business_services WHERE business_id = v_teardown_business_id;
  DELETE FROM properties WHERE business_id = v_teardown_business_id;
  DELETE FROM clients WHERE business_id = v_teardown_business_id;
  DELETE FROM business_settings WHERE business_id = v_teardown_business_id;
  DELETE FROM platform_email_sends WHERE business_id = v_teardown_business_id;
  -- profiles.business_id FK: clear Tenant B test profiles before deleting the business
  UPDATE profiles SET business_id = NULL, client_id = NULL
  WHERE id IN (v_tenant_b_admin_user_id, v_tenant_b_client_user_id);
  DELETE FROM businesses WHERE id = v_teardown_business_id;

  IF v_pentest_business_id <> '00000000-0000-0000-0000-0000000000cc'::uuid THEN
    RAISE EXCEPTION 'Teardown aborted: pentest business id guard failed (%)', v_pentest_business_id;
  END IF;
  DELETE FROM media_asset_tags WHERE business_id = v_pentest_business_id;
  DELETE FROM media_asset_events WHERE business_id = v_pentest_business_id;
  DELETE FROM media_downloads WHERE business_id = v_pentest_business_id;
  DELETE FROM asset_reviews WHERE business_id = v_pentest_business_id;
  DELETE FROM email_events WHERE business_id = v_pentest_business_id;
  DELETE FROM client_notes WHERE business_id = v_pentest_business_id;
  DELETE FROM communications WHERE business_id = v_pentest_business_id;
  DELETE FROM notifications WHERE business_id = v_pentest_business_id;
  DELETE FROM activity_logs WHERE business_id = v_pentest_business_id;
  DELETE FROM client_messages WHERE business_id = v_pentest_business_id;
  DELETE FROM project_messages WHERE business_id = v_pentest_business_id;
  DELETE FROM shoot_proposals WHERE business_id = v_pentest_business_id;
  DELETE FROM revisions WHERE business_id = v_pentest_business_id;
  DELETE FROM tours WHERE business_id = v_pentest_business_id;
  DELETE FROM payments WHERE business_id = v_pentest_business_id;
  DELETE FROM project_quotes WHERE business_id = v_pentest_business_id;
  DELETE FROM media_assets WHERE business_id = v_pentest_business_id;
  DELETE FROM media_folders WHERE business_id = v_pentest_business_id;
  DELETE FROM project_clients WHERE business_id = v_pentest_business_id;
  DELETE FROM leads WHERE business_id = v_pentest_business_id;
  DELETE FROM google_calendar_connections_v2 WHERE business_id = v_pentest_business_id;
  DELETE FROM business_integrations WHERE business_id = v_pentest_business_id;
  BEGIN
    DELETE FROM storage.objects
      WHERE bucket_id IN ('project-media', 'project-documents')
        AND name LIKE v_pentest_business_id::text || '/%';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'storage.objects SQL DELETE skipped (%). Use Storage API.', SQLERRM;
  END;
  DELETE FROM projects WHERE business_id = v_pentest_business_id;
  DELETE FROM business_services WHERE business_id = v_pentest_business_id;
  DELETE FROM properties WHERE business_id = v_pentest_business_id;
  DELETE FROM clients WHERE business_id = v_pentest_business_id;
  DELETE FROM business_settings WHERE business_id = v_pentest_business_id;
  DELETE FROM platform_email_sends WHERE business_id = v_pentest_business_id;
  UPDATE profiles SET business_id = NULL, client_id = NULL
  WHERE business_id = v_pentest_business_id;
  DELETE FROM businesses WHERE id = v_pentest_business_id;

  RAISE NOTICE 'Teardown complete for Tenant B (…0000ff) and pentest-co (…0000cc).';
END $$;
