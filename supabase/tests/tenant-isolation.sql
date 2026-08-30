-- Swift Portal — tenant isolation harness (RLS read + write)
-- Run in Supabase SQL Editor after v29–v40. See docs/TENANT-TESTING.md.
--
-- v35: business_id has no DEFAULT. Every INSERT below sets it EXPLICITLY.
-- v36: storage object keys — Tenant B prefix must be invisible to a Swift admin.
-- v37: business_integrations — Tenant B Stripe row must be invisible to a Swift admin.
-- v40: business_services — Tenant B catalog row must be invisible to a Swift admin.
--
-- Prerequisite auth users (Dashboard → Authentication → Add user, auto-confirm):
--   tenant-b-admin@example.test
--   tenant-b-client@example.test
-- handle_new_user() creates profiles; this script UPDATEs them — do not INSERT profiles.

DROP FUNCTION IF EXISTS _tenant_test_assert_swift_hidden(text);
DROP FUNCTION IF EXISTS _tenant_test_assert_swift_hidden(text, uuid);
DROP FUNCTION IF EXISTS _tenant_test_assert_read_hidden(text, uuid);
DROP FUNCTION IF EXISTS _tenant_test_set_auth(uuid);
DROP FUNCTION IF EXISTS _tenant_test_bump();

-- Session state + helpers (dropped at end of this file)
CREATE TEMP TABLE IF NOT EXISTS _tenant_test_state (
  assertions int NOT NULL DEFAULT 0,
  swift_bid uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'
);
DELETE FROM _tenant_test_state;
INSERT INTO _tenant_test_state (assertions) VALUES (0);
GRANT SELECT, UPDATE ON _tenant_test_state TO authenticated;

CREATE TEMP TABLE IF NOT EXISTS _tenant_test_writes (
  op text NOT NULL,
  mechanism text NOT NULL
);
DELETE FROM _tenant_test_writes;
GRANT INSERT, SELECT ON _tenant_test_writes TO authenticated;

CREATE OR REPLACE FUNCTION _tenant_test_bump()
RETURNS void LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  UPDATE _tenant_test_state SET assertions = assertions + 1;
END;
$$;

CREATE OR REPLACE FUNCTION _tenant_test_set_auth(p_user uuid)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', p_user::text, 'role', 'authenticated')::text,
    true
  );
  IF auth.uid() IS DISTINCT FROM p_user THEN
    RAISE EXCEPTION 'RLS context failed: expected auth.uid() = %, got %', p_user, auth.uid();
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION _tenant_test_assert_read_hidden(p_table text, p_id uuid)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE v_n bigint;
BEGIN
  EXECUTE format('SELECT count(*) FROM %I WHERE id = $1', p_table) INTO v_n USING p_id;
  IF v_n > 0 THEN
    RAISE EXCEPTION 'READ LEAK: % id % visible (% row(s))', p_table, p_id, v_n;
  END IF;
  PERFORM _tenant_test_bump();
END;
$$;

CREATE OR REPLACE FUNCTION _tenant_test_assert_swift_hidden(p_table text, p_swift_bid uuid)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE v_n bigint;
BEGIN
  EXECUTE format('SELECT count(*) FROM %I WHERE business_id = $1', p_table) INTO v_n USING p_swift_bid;
  IF v_n > 0 THEN
    RAISE EXCEPTION 'REVERSE READ LEAK: % shows % Swift row(s)', p_table, v_n;
  END IF;
  PERFORM _tenant_test_bump();
END;
$$;

-- =============================================================================
-- VARIABLES — paste UUIDs from Auth dashboard
-- =============================================================================
DO $$
DECLARE
  -- >>> REPLACE these two after creating example.test users <<<
  v_tenant_b_admin_user_id  uuid := 'd8dbb086-ae9d-40f5-abcc-6a36491780ca';
  v_tenant_b_client_user_id uuid := 'bdd25ea1-18cb-4eff-bf85-a81c14417af5';
  -- Existing Swift admin (default jackson@swiftaerialmedia.com)
  v_swift_admin_user_id     uuid := '7d0957c6-6330-48ca-a530-f13d4dc15a84';

  v_business   uuid := '00000000-0000-0000-0000-0000000000ff';
  v_swift_bid  uuid := '00000000-0000-0000-0000-000000000001';

  v_client     uuid := '00000000-0000-0000-0000-0000000000b1';
  v_property   uuid := '00000000-0000-0000-0000-0000000000b2';
  v_project    uuid := '00000000-0000-0000-0000-0000000000b3';
  v_folder     uuid := '00000000-0000-0000-0000-0000000000b4';
  v_media1     uuid := '00000000-0000-0000-0000-0000000000b5';
  v_media2     uuid := '00000000-0000-0000-0000-0000000000b6';
  v_quote      uuid := '00000000-0000-0000-0000-0000000000b7';
  v_payment    uuid := '00000000-0000-0000-0000-0000000000b8';
  v_shoot      uuid := '00000000-0000-0000-0000-0000000000b9';
  v_message    uuid := '00000000-0000-0000-0000-0000000000ba';
  v_activity   uuid := '00000000-0000-0000-0000-0000000000bb';
  v_notif      uuid := '00000000-0000-0000-0000-0000000000bc';
  v_tour       uuid := '00000000-0000-0000-0000-0000000000bd';
  v_lead       uuid := '00000000-0000-0000-0000-0000000000be';
  v_proj_cli   uuid := '00000000-0000-0000-0000-0000000000bf';
  v_revision   uuid := '00000000-0000-0000-0000-0000000000c0';
  v_comm       uuid := '00000000-0000-0000-0000-0000000000c1';
  v_note       uuid := '00000000-0000-0000-0000-0000000000c2';
  v_email      uuid := '00000000-0000-0000-0000-0000000000c3';
  v_review     uuid := '00000000-0000-0000-0000-0000000000c4';
  v_download   uuid := '00000000-0000-0000-0000-0000000000c5';
  v_event      uuid := '00000000-0000-0000-0000-0000000000c6';
  v_tag        uuid := '00000000-0000-0000-0000-0000000000c7';
  v_proj_msg   uuid := '00000000-0000-0000-0000-0000000000c8';
  v_media_unassigned uuid := '00000000-0000-0000-0000-0000000000c9';
  v_notif_admin uuid := '00000000-0000-0000-0000-0000000000ca';
  v_svc        uuid := '00000000-0000-0000-0000-0000000000cb';
  -- Harness-only partner B — linked to tenant-b-admin (NOT Swift admin). Cross-partner isolation.
  v_harness_partner_b uuid := '00000000-0000-0000-0000-0000000000d0';
  v_storage_name text;

  v_assertions int;
  v_n          bigint;
  v_uid        uuid;
  v_mechanism  text;
  v_rows       int;

BEGIN
  UPDATE _tenant_test_state SET swift_bid = v_swift_bid;

  -- 0. Validate + RLS context smoke test
  IF v_tenant_b_admin_user_id = '00000000-0000-0000-0000-000000000000'::uuid
     OR v_tenant_b_client_user_id = '00000000-0000-0000-0000-000000000000'::uuid THEN
    RAISE EXCEPTION 'Paste tenant-b-admin and tenant-b-client UUIDs in the VARIABLES block';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = v_tenant_b_admin_user_id) THEN
    RAISE EXCEPTION 'No profile for tenant-b-admin % — create the auth user first', v_tenant_b_admin_user_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = v_tenant_b_client_user_id) THEN
    RAISE EXCEPTION 'No profile for tenant-b-client % — create the auth user first', v_tenant_b_client_user_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = v_swift_admin_user_id AND role = 'admin') THEN
    RAISE EXCEPTION 'Swift admin profile % missing or not admin', v_swift_admin_user_id;
  END IF;

  PERFORM _tenant_test_set_auth(v_swift_admin_user_id);
  v_uid := auth.uid();
  IF v_uid IS DISTINCT FROM v_swift_admin_user_id THEN
    RAISE EXCEPTION 'Step 0 FAILED: auth.uid() = %, expected %', v_uid, v_swift_admin_user_id;
  END IF;
  RAISE NOTICE 'Step 0: RLS context OK — auth.uid() = %', v_uid;

  RESET ROLE;

  IF v_business <> '00000000-0000-0000-0000-0000000000ff'::uuid THEN
    RAISE EXCEPTION 'Tenant B business UUID guard failed';
  END IF;

  -- Idempotent Tenant B setup (every INSERT sets business_id explicitly)
  DELETE FROM media_asset_tags WHERE business_id = v_business;
  DELETE FROM media_asset_events WHERE business_id = v_business;
  DELETE FROM media_downloads WHERE business_id = v_business;
  DELETE FROM asset_reviews WHERE business_id = v_business;
  DELETE FROM video_review_notification_sends WHERE business_id = v_business;
  DELETE FROM video_review_notification_batches WHERE business_id = v_business;
  DELETE FROM video_review_comments WHERE business_id = v_business;
  DELETE FROM video_review_versions WHERE business_id = v_business;
  DELETE FROM video_reviews WHERE business_id = v_business;
  DELETE FROM email_events WHERE business_id = v_business;
  DELETE FROM client_notes WHERE business_id = v_business;
  DELETE FROM communications WHERE business_id = v_business;
  DELETE FROM notifications WHERE business_id = v_business;
  DELETE FROM activity_logs WHERE business_id = v_business;
  DELETE FROM client_messages WHERE business_id = v_business;
  DELETE FROM project_messages WHERE business_id = v_business;
  DELETE FROM shoot_proposals WHERE business_id = v_business;
  DELETE FROM revisions WHERE business_id = v_business;
  DELETE FROM tours WHERE business_id = v_business;
  DELETE FROM payments WHERE business_id = v_business;
  DELETE FROM project_quotes WHERE business_id = v_business;
  DELETE FROM media_assets WHERE business_id = v_business;
  DELETE FROM media_folders WHERE business_id = v_business;
  DELETE FROM project_clients WHERE business_id = v_business;
  DELETE FROM leads WHERE business_id = v_business;
  DELETE FROM business_integrations WHERE business_id = v_business;
  -- storage.objects has protect_objects_delete ("Use the Storage API instead").
  -- SQL Editor / MCP cannot set session_replication_role. Best-effort SQL
  -- DELETE; if it fails, remove via:
  --   DELETE /storage/v1/object/project-media/{business_id}/library/tenant-b-isolation.bin
  BEGIN
    DELETE FROM storage.objects
      WHERE bucket_id IN ('project-media', 'project-documents')
        AND name LIKE v_business::text || '/%';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'storage.objects SQL DELETE skipped (%). Use Storage API.', SQLERRM;
  END;
  DELETE FROM projects WHERE business_id = v_business;
  DELETE FROM business_services WHERE business_id = v_business;
  DELETE FROM properties WHERE business_id = v_business;
  DELETE FROM clients WHERE business_id = v_business;
  DELETE FROM business_settings WHERE business_id = v_business;
  UPDATE profiles SET business_id = NULL, client_id = NULL
  WHERE id IN (v_tenant_b_admin_user_id, v_tenant_b_client_user_id)
    AND business_id = v_business;
  DELETE FROM businesses WHERE id = v_business;

  -- slug must not be a reserved platform subdomain (v41)
  INSERT INTO businesses (id, slug, name, status, plan)
  VALUES (v_business, 'test-tenant-b', 'Test Tenant B', 'active', 'studio')
  ON CONFLICT (id) DO UPDATE SET slug = EXCLUDED.slug, name = EXCLUDED.name, status = EXCLUDED.status;

  INSERT INTO business_settings (business_id, settings)
  VALUES (v_business, '{}'::jsonb)
  ON CONFLICT (business_id) DO NOTHING;

  UPDATE profiles SET role = 'admin', business_id = v_business, client_id = NULL,
    email = 'tenant-b-admin@example.test', full_name = 'Tenant B Admin'
  WHERE id = v_tenant_b_admin_user_id;

  UPDATE profiles SET role = 'client', business_id = v_business, client_id = NULL,
    email = 'tenant-b-client@example.test', full_name = 'Tenant B Client'
  WHERE id = v_tenant_b_client_user_id;

  INSERT INTO clients (id, business_id, name, email, user_id, first_name, last_name, full_name)
  VALUES (v_client, v_business, 'Tenant B Client', 'tenant-b-client@example.test',
    v_tenant_b_client_user_id, 'Tenant', 'B Client', 'Tenant B Client');

  UPDATE profiles SET client_id = v_client WHERE id = v_tenant_b_client_user_id;

  INSERT INTO properties (id, business_id, client_id, address, normalized_address, property_type)
  VALUES (v_property, v_business, v_client, '999 Test Lane, Isolation City, MS 00000',
    '999 test lane, isolation city, ms 00000', 'Other');

  INSERT INTO projects (id, business_id, client_id, property_id, property_address, project_name, service_type, status)
  VALUES (v_project, v_business, v_client, v_property, '999 Test Lane, Isolation City, MS 00000',
    'Tenant B Isolation Project', 'Residential', 'new_request');

  INSERT INTO project_clients (id, business_id, project_id, client_id, is_primary)
  VALUES (v_proj_cli, v_business, v_project, v_client, true);

  INSERT INTO media_folders (id, business_id, project_id, name, display_order)
  VALUES (v_folder, v_business, v_project, 'Tenant B Folder', 0);

  INSERT INTO media_assets (id, business_id, project_id, client_id, property_id, folder_id,
    file_name, file_path, mime_type, media_type, display_order)
  VALUES
    (v_media1, v_business, v_project, v_client, v_property, v_folder,
      'tenant-b-photo-1.jpg', 'tenant-b/test/photo-1.jpg', 'image/jpeg', 'photo', 0),
    (v_media2, v_business, v_project, v_client, v_property, NULL,
      'tenant-b-photo-2.jpg', 'tenant-b/test/photo-2.jpg', 'image/jpeg', 'photo', 1);

  -- Unassigned library asset (project_id NULL) — still Tenant B via business_id
  INSERT INTO media_assets (id, business_id, project_id, client_id, property_id, folder_id,
    file_name, file_path, mime_type, media_type, display_order)
  VALUES
    (v_media_unassigned, v_business, NULL, NULL, NULL, NULL,
      'tenant-b-unassigned.jpg', 'tenant-b/test/unassigned.jpg', 'image/jpeg', 'photo', 0);

  INSERT INTO media_asset_tags (id, business_id, media_asset_id, tag)
  VALUES (v_tag, v_business, v_media1, 'tenant-b-test');

  INSERT INTO project_quotes (id, business_id, project_id, title, line_items, total_cents, quote_kind)
  VALUES (v_quote, v_business, v_project, 'Tenant B Quote', '[]'::jsonb, 10000, 'preliminary');

  INSERT INTO payments (id, business_id, project_id, client_id, quote_id, amount, description, status)
  VALUES (v_payment, v_business, v_project, v_client, v_quote, 10000, 'Tenant B test payment', 'pending');

  INSERT INTO shoot_proposals (id, business_id, project_id, proposed_by, proposed_at, status)
  VALUES (v_shoot, v_business, v_project, 'admin', now(), 'pending');

  INSERT INTO business_integrations (
    business_id, stripe_account_id, stripe_account_status
  ) VALUES (
    v_business, 'acct_tenant_b_isolation', 'not_connected'
  );

  INSERT INTO business_services (
    id, business_id, name, slug, description, preliminary_estimate_cents,
    starting_label, includes, line_items, notes, hide_pricing, is_active, aliases, display_order
  ) VALUES (
    v_svc, v_business, 'Tenant B Aerial', 'tenant_b_aerial', 'Isolation catalog row', 12300,
    'Starting at $123', '[]'::jsonb, '[]'::jsonb, '', false, true, '["Tenant B Aerial"]'::jsonb, 0
  );

  INSERT INTO client_messages (id, business_id, client_id, project_id, sender_user_id, sender_role, body)
  VALUES (v_message, v_business, v_client, v_project, v_tenant_b_admin_user_id, 'admin', 'Tenant B test message');

  INSERT INTO project_messages (id, business_id, project_id, sender_user_id, sender_role, body)
  VALUES (v_proj_msg, v_business, v_project, v_tenant_b_admin_user_id, 'admin', 'Tenant B project message');

  INSERT INTO activity_logs (id, business_id, project_id, client_id, activity_type, description, user_id)
  VALUES (v_activity, v_business, v_project, v_client, 'project_created', 'Tenant B activity', v_tenant_b_admin_user_id);

  INSERT INTO notifications (id, business_id, user_id, type, title, project_id)
  VALUES (v_notif, v_business, v_tenant_b_client_user_id, 'status_changed', 'Tenant B notification', v_project);

  -- Prompt 11: Tenant B project notification for Tenant B admin only — never a Swift profile
  INSERT INTO notifications (id, business_id, user_id, type, title, project_id)
  VALUES (v_notif_admin, v_business, v_tenant_b_admin_user_id, 'project_message',
    'Tenant B admin notification', v_project);

  INSERT INTO tours (id, business_id, project_id, tour_name, kuula_url)
  VALUES (v_tour, v_business, v_project, 'Tenant B Tour', 'https://example.test/kuula/tenant-b');

  INSERT INTO leads (id, business_id, name, email, property_address, service_requested, is_read)
  VALUES (v_lead, v_business, 'Tenant B Lead', 'lead@example.test', '999 Test Lane', 'Residential', false);

  INSERT INTO revisions (id, business_id, project_id, client_id, description)
  VALUES (v_revision, v_business, v_project, v_client, 'Tenant B revision');

  INSERT INTO communications (id, business_id, project_id, client_id, comm_type, title, message)
  VALUES (v_comm, v_business, v_project, v_client, 'system', 'Tenant B comm', 'test');

  INSERT INTO client_notes (id, business_id, client_id, user_id, note)
  VALUES (v_note, v_business, v_client, v_tenant_b_admin_user_id, 'Tenant B note');

  INSERT INTO email_events (id, business_id, project_id, recipient, email_type, event_type)
  VALUES (v_email, v_business, v_project, 'tenant-b-client@example.test', 'test', 'sent');

  INSERT INTO asset_reviews (id, business_id, project_id, asset_type, asset_id)
  VALUES (v_review, v_business, v_project, 'photo', v_media1);

  INSERT INTO media_downloads (id, business_id, media_asset_id, user_id)
  VALUES (v_download, v_business, v_media1, v_tenant_b_client_user_id);

  INSERT INTO media_asset_events (id, business_id, media_asset_id, project_id, event_type)
  VALUES (v_event, v_business, v_media1, v_project, 'uploaded');

  -- v36: Tenant B object under its own business prefix (not a real media_assets row)
  v_storage_name := v_business::text || '/library/tenant-b-isolation.bin';
  INSERT INTO storage.objects (bucket_id, name)
  SELECT 'project-media', v_storage_name
  WHERE NOT EXISTS (
    SELECT 1 FROM storage.objects
    WHERE bucket_id = 'project-media' AND name = v_storage_name
  );

  -- Harness partner B — tenant-b-admin owns this row; Swift admin must NOT see it (dual-role safe).
  DELETE FROM partners WHERE id = v_harness_partner_b;
  INSERT INTO partners (
    id, email, name, brand_name, referral_code, commission_rate_pct, status, user_id
  ) VALUES (
    v_harness_partner_b,
    'tenant-b-partner-harness@example.test',
    'Tenant B Harness Partner',
    'Tenant B Harness',
    'tenant-b-harness',
    25,
    'active',
    v_tenant_b_admin_user_id
  );

  RAISE NOTICE 'Setup: Tenant B fixtures created (business_id = %)', v_business;

  -- 4. READ isolation — Swift admin
  PERFORM _tenant_test_set_auth(v_swift_admin_user_id);
  PERFORM _tenant_test_assert_read_hidden('clients', v_client);
  PERFORM _tenant_test_assert_read_hidden('projects', v_project);
  PERFORM _tenant_test_assert_read_hidden('properties', v_property);
  PERFORM _tenant_test_assert_read_hidden('leads', v_lead);
  PERFORM _tenant_test_assert_read_hidden('payments', v_payment);
  PERFORM _tenant_test_assert_read_hidden('project_quotes', v_quote);
  PERFORM _tenant_test_assert_read_hidden('media_assets', v_media1);
  PERFORM _tenant_test_assert_read_hidden('media_assets', v_media2);
  PERFORM _tenant_test_assert_read_hidden('media_assets', v_media_unassigned);
  PERFORM _tenant_test_assert_read_hidden('media_folders', v_folder);
  PERFORM _tenant_test_assert_read_hidden('media_asset_tags', v_tag);
  PERFORM _tenant_test_assert_read_hidden('tours', v_tour);
  PERFORM _tenant_test_assert_read_hidden('revisions', v_revision);
  PERFORM _tenant_test_assert_read_hidden('shoot_proposals', v_shoot);

  -- v37: Tenant B business_integrations is invisible to Swift admin
  SELECT count(*) INTO v_n FROM business_integrations WHERE business_id = v_business;
  IF v_n > 0 THEN
    RAISE EXCEPTION 'READ LEAK: business_integrations Tenant B row visible (% rows)', v_n;
  END IF;
  PERFORM _tenant_test_bump();

  -- v40: Tenant B business_services is invisible to Swift admin
  PERFORM _tenant_test_assert_read_hidden('business_services', v_svc);
  PERFORM _tenant_test_assert_read_hidden('project_messages', v_proj_msg);
  PERFORM _tenant_test_assert_read_hidden('notifications', v_notif);
  PERFORM _tenant_test_assert_read_hidden('communications', v_comm);
  PERFORM _tenant_test_assert_read_hidden('activity_logs', v_activity);
  PERFORM _tenant_test_assert_read_hidden('client_notes', v_note);
  PERFORM _tenant_test_assert_read_hidden('email_events', v_email);
  PERFORM _tenant_test_assert_read_hidden('asset_reviews', v_review);
  PERFORM _tenant_test_assert_read_hidden('media_downloads', v_download);
  PERFORM _tenant_test_assert_read_hidden('media_asset_events', v_event);
  PERFORM _tenant_test_assert_read_hidden('project_clients', v_proj_cli);

  -- Prompt 11: creating a Tenant B project notification must produce ZERO rows for any Swift profile
  SELECT count(*) INTO v_n FROM notifications
    WHERE business_id = v_business AND user_id = v_swift_admin_user_id;
  IF v_n > 0 THEN
    RAISE EXCEPTION 'NOTIF LEAK: Tenant B notification targeting Swift admin (% rows)', v_n;
  END IF;
  PERFORM _tenant_test_bump();

  -- Prompt 11: inbox-shaped query — Swift admin must not see Tenant B client_messages
  SELECT count(*) INTO v_n FROM client_messages WHERE id = v_message;
  IF v_n > 0 THEN
    RAISE EXCEPTION 'INBOX LEAK: Tenant B client_message visible to Swift admin inbox';
  END IF;
  PERFORM _tenant_test_bump();

  SELECT count(*) INTO v_n FROM business_settings WHERE business_id = v_business;
  IF v_n > 0 THEN RAISE EXCEPTION 'READ LEAK: business_settings Tenant B visible (% rows)', v_n; END IF;
  PERFORM _tenant_test_bump();

  SELECT count(*) INTO v_n FROM client_stats WHERE client_id = v_client;
  IF v_n > 0 THEN RAISE EXCEPTION 'READ LEAK: client_stats Tenant B client (% rows)', v_n; END IF;
  PERFORM _tenant_test_bump();

  -- v44: business admin cannot read or mutate platform_audit_log
  SELECT count(*) INTO v_n FROM platform_audit_log;
  IF v_n > 0 THEN
    RAISE EXCEPTION 'READ LEAK: platform_audit_log visible to Swift admin (% rows)', v_n;
  END IF;
  PERFORM _tenant_test_bump();

  BEGIN
    UPDATE platform_audit_log SET action = action;
    RAISE EXCEPTION 'WRITE LEAK: UPDATE platform_audit_log granted to Swift admin';
  EXCEPTION
    WHEN insufficient_privilege THEN
      PERFORM _tenant_test_bump();
  END;

  BEGIN
    DELETE FROM platform_audit_log;
    RAISE EXCEPTION 'WRITE LEAK: DELETE platform_audit_log granted to Swift admin';
  EXCEPTION
    WHEN insufficient_privilege THEN
      PERFORM _tenant_test_bump();
  END;

  -- v53: business admin cannot read platform lifecycle email catalog / send log
  SELECT count(*) INTO v_n FROM platform_email_templates;
  IF v_n > 0 THEN
    RAISE EXCEPTION 'READ LEAK: platform_email_templates visible to Swift admin (% rows)', v_n;
  END IF;
  PERFORM _tenant_test_bump();

  SELECT count(*) INTO v_n FROM platform_email_sends;
  IF v_n > 0 THEN
    RAISE EXCEPTION 'READ LEAK: platform_email_sends visible to Swift admin (% rows)', v_n;
  END IF;
  PERFORM _tenant_test_bump();

  -- v59: partner tables — dual-role users may read ONLY their own partner row(s).
  -- Swift admin (Jackson) is also an active partner; seeing user_id = auth.uid() is correct RLS.
  SELECT count(*) INTO v_n FROM partners;
  IF v_n > 1 THEN
    RAISE EXCEPTION 'READ LEAK: partners visible to Swift admin (% rows; expected at most 1 own row)', v_n;
  END IF;
  IF v_n = 1 THEN
    SELECT user_id INTO v_uid FROM partners LIMIT 1;
    IF v_uid IS DISTINCT FROM v_swift_admin_user_id THEN
      RAISE EXCEPTION 'READ LEAK: visible partner is not own row (partner.user_id=% auth.uid=%)', v_uid, v_swift_admin_user_id;
    END IF;
    RAISE NOTICE 'partners dual-role OK: Swift admin sees exactly 1 own partner row';
  ELSE
    RAISE NOTICE 'partners: Swift admin sees 0 partner rows (not a partner user)';
  END IF;
  PERFORM _tenant_test_bump();

  -- Cross-partner isolation: harness partner B (tenant-b-admin) must be invisible to Swift admin
  PERFORM _tenant_test_assert_read_hidden('partners', v_harness_partner_b);

  -- partner_commissions / partner_payouts: same dual-role rule — own rows only, never other partners
  SELECT count(*) INTO v_n
    FROM partner_commissions pc
    JOIN partners p ON p.id = pc.partner_id
   WHERE p.user_id IS DISTINCT FROM v_swift_admin_user_id;
  IF v_n > 0 THEN
    RAISE EXCEPTION 'READ LEAK: partner_commissions for other partners visible (% rows)', v_n;
  END IF;
  PERFORM _tenant_test_bump();

  SELECT count(*) INTO v_n
    FROM partner_payouts pp
    JOIN partners p ON p.id = pp.partner_id
   WHERE p.user_id IS DISTINCT FROM v_swift_admin_user_id;
  IF v_n > 0 THEN
    RAISE EXCEPTION 'READ LEAK: partner_payouts for other partners visible (% rows)', v_n;
  END IF;
  PERFORM _tenant_test_bump();

  SELECT count(*) INTO v_n FROM partner_referrals;
  IF v_n > 0 THEN
    RAISE EXCEPTION 'READ LEAK: partner_referrals visible to Swift admin (% rows)', v_n;
  END IF;
  PERFORM _tenant_test_bump();

  SELECT count(*) INTO v_n FROM partner_landing_pages;
  IF v_n > 0 THEN
    RAISE EXCEPTION 'READ LEAK: partner_landing_pages visible to Swift admin (% rows)', v_n;
  END IF;
  PERFORM _tenant_test_bump();

  -- v36: Swift admin still sees own-business storage objects (legacy {project}/… must keep working)
  SELECT count(*) INTO v_n FROM storage.objects
    WHERE bucket_id IN ('project-media', 'project-documents');
  IF v_n = 0 THEN
    RAISE EXCEPTION 'STORAGE POLICY TOO TIGHT: Swift admin sees 0 media objects';
  END IF;
  PERFORM _tenant_test_bump();

  -- v36: Tenant B storage object under {business}/library/ is invisible to Swift admin
  SELECT count(*) INTO v_n FROM storage.objects
    WHERE bucket_id = 'project-media' AND name = v_storage_name;
  IF v_n > 0 THEN
    RAISE EXCEPTION 'STORAGE LEAK: Tenant B object visible to Swift admin (% rows)', v_n;
  END IF;
  PERFORM _tenant_test_bump();

  -- 5. WRITE isolation — Swift admin
  PERFORM _tenant_test_set_auth(v_swift_admin_user_id);

  BEGIN
    INSERT INTO projects (business_id, client_id, property_address, project_name, service_type, status)
    VALUES (v_swift_bid, v_client, 'Cross-tenant', 'Cross-tenant', 'Residential', 'new_request');
    RAISE EXCEPTION 'WRITE LEAK: INSERT project w/ Tenant B client succeeded';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'WRITE LEAK:%' THEN RAISE; END IF;
    v_mechanism := CASE WHEN SQLERRM LIKE '%tenant integrity%' THEN 'trigger (v30)'
      WHEN SQLSTATE = '42501' THEN 'RLS' ELSE 'blocked: ' || SQLERRM END;
    INSERT INTO _tenant_test_writes VALUES ('INSERT project w/ Tenant B client', v_mechanism);
    RAISE NOTICE 'WRITE blocked — INSERT project: %', v_mechanism;
    PERFORM _tenant_test_bump();
  END;

  BEGIN
    INSERT INTO payments (business_id, project_id, client_id, amount, description, status)
    VALUES (v_swift_bid, v_project, v_client, 100, 'cross-tenant', 'pending');
    RAISE EXCEPTION 'WRITE LEAK: INSERT payment w/ Tenant B project succeeded';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'WRITE LEAK:%' THEN RAISE; END IF;
    v_mechanism := CASE WHEN SQLERRM LIKE '%tenant integrity%' THEN 'trigger (v30)'
      WHEN SQLSTATE = '42501' THEN 'RLS' ELSE 'blocked: ' || SQLERRM END;
    INSERT INTO _tenant_test_writes VALUES ('INSERT payment w/ Tenant B project', v_mechanism);
    RAISE NOTICE 'WRITE blocked — INSERT payment: %', v_mechanism;
    PERFORM _tenant_test_bump();
  END;

  BEGIN
    INSERT INTO media_assets (business_id, project_id, file_name, file_path, mime_type, media_type)
    VALUES (v_swift_bid, v_project, 'hack.jpg', 'tenant-b/hack.jpg', 'image/jpeg', 'photo');
    RAISE EXCEPTION 'WRITE LEAK: INSERT media_asset w/ Tenant B project succeeded';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'WRITE LEAK:%' THEN RAISE; END IF;
    v_mechanism := CASE WHEN SQLERRM LIKE '%tenant integrity%' THEN 'trigger (v30)'
      WHEN SQLSTATE = '42501' THEN 'RLS' ELSE 'blocked: ' || SQLERRM END;
    INSERT INTO _tenant_test_writes VALUES ('INSERT media_asset w/ Tenant B project', v_mechanism);
    RAISE NOTICE 'WRITE blocked — INSERT media_asset: %', v_mechanism;
    PERFORM _tenant_test_bump();
  END;

  UPDATE projects SET status = 'delivered' WHERE id = v_project;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows > 0 THEN RAISE EXCEPTION 'WRITE LEAK: UPDATE Tenant B project (% rows)', v_rows; END IF;
  INSERT INTO _tenant_test_writes VALUES ('UPDATE Tenant B project status', 'RLS (0 rows)');
  RAISE NOTICE 'WRITE blocked — UPDATE project: RLS (0 rows)';
  PERFORM _tenant_test_bump();

  UPDATE payments SET status = 'paid' WHERE id = v_payment;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows > 0 THEN RAISE EXCEPTION 'WRITE LEAK: UPDATE Tenant B payment (% rows)', v_rows; END IF;
  INSERT INTO _tenant_test_writes VALUES ('UPDATE Tenant B payment to paid', 'RLS (0 rows)');
  RAISE NOTICE 'WRITE blocked — UPDATE payment: RLS (0 rows)';
  PERFORM _tenant_test_bump();

  UPDATE business_integrations SET stripe_account_status = 'active' WHERE business_id = v_business;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows > 0 THEN RAISE EXCEPTION 'WRITE LEAK: UPDATE Tenant B business_integrations (% rows)', v_rows; END IF;
  INSERT INTO _tenant_test_writes VALUES ('UPDATE Tenant B business_integrations', 'RLS (0 rows)');
  RAISE NOTICE 'WRITE blocked — UPDATE business_integrations: RLS (0 rows)';
  PERFORM _tenant_test_bump();

  UPDATE project_quotes SET status = 'draft' WHERE id = v_quote;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows > 0 THEN RAISE EXCEPTION 'WRITE LEAK: UPDATE Tenant B project_quote (% rows)', v_rows; END IF;
  INSERT INTO _tenant_test_writes VALUES ('UPDATE Tenant B project_quote', 'RLS (0 rows)');
  RAISE NOTICE 'WRITE blocked — UPDATE project_quote: RLS (0 rows)';
  PERFORM _tenant_test_bump();

  DELETE FROM clients WHERE id = v_client;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows > 0 THEN RAISE EXCEPTION 'WRITE LEAK: DELETE Tenant B client (% rows)', v_rows; END IF;
  INSERT INTO _tenant_test_writes VALUES ('DELETE Tenant B client', 'RLS (0 rows)');
  RAISE NOTICE 'WRITE blocked — DELETE client: RLS (0 rows)';
  PERFORM _tenant_test_bump();

  BEGIN
    PERFORM reorder_media_assets(v_project, ARRAY[v_media1, v_media2]);
    RAISE EXCEPTION 'WRITE LEAK: reorder_media_assets succeeded';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'WRITE LEAK:%' THEN RAISE; END IF;
    v_mechanism := CASE WHEN SQLERRM LIKE '%not authorized%' OR SQLERRM LIKE '%tenant integrity%' THEN 'RPC auth (v32)'
      WHEN SQLSTATE = '42501' THEN 'RLS' ELSE 'blocked: ' || SQLERRM END;
    INSERT INTO _tenant_test_writes VALUES ('reorder_media_assets Tenant B project', v_mechanism);
    RAISE NOTICE 'WRITE blocked — reorder_media_assets: %', v_mechanism;
    PERFORM _tenant_test_bump();
  END;

  -- 6. Reverse — Tenant B admin vs Swift
  PERFORM _tenant_test_set_auth(v_tenant_b_admin_user_id);
  PERFORM _tenant_test_assert_swift_hidden('clients', v_swift_bid);
  PERFORM _tenant_test_assert_swift_hidden('projects', v_swift_bid);
  PERFORM _tenant_test_assert_swift_hidden('properties', v_swift_bid);
  PERFORM _tenant_test_assert_swift_hidden('leads', v_swift_bid);
  PERFORM _tenant_test_assert_swift_hidden('payments', v_swift_bid);
  PERFORM _tenant_test_assert_swift_hidden('project_quotes', v_swift_bid);
  PERFORM _tenant_test_assert_swift_hidden('media_assets', v_swift_bid);
  PERFORM _tenant_test_assert_swift_hidden('media_folders', v_swift_bid);
  PERFORM _tenant_test_assert_swift_hidden('media_asset_tags', v_swift_bid);
  PERFORM _tenant_test_assert_swift_hidden('tours', v_swift_bid);
  PERFORM _tenant_test_assert_swift_hidden('revisions', v_swift_bid);
  PERFORM _tenant_test_assert_swift_hidden('shoot_proposals', v_swift_bid);
  PERFORM _tenant_test_assert_swift_hidden('business_integrations', v_swift_bid);
  PERFORM _tenant_test_assert_swift_hidden('business_services', v_swift_bid);
  PERFORM _tenant_test_assert_swift_hidden('client_messages', v_swift_bid);
  PERFORM _tenant_test_assert_swift_hidden('project_messages', v_swift_bid);
  PERFORM _tenant_test_assert_swift_hidden('notifications', v_swift_bid);
  PERFORM _tenant_test_assert_swift_hidden('communications', v_swift_bid);
  PERFORM _tenant_test_assert_swift_hidden('activity_logs', v_swift_bid);
  PERFORM _tenant_test_assert_swift_hidden('client_notes', v_swift_bid);
  PERFORM _tenant_test_assert_swift_hidden('email_events', v_swift_bid);
  PERFORM _tenant_test_assert_swift_hidden('asset_reviews', v_swift_bid);
  PERFORM _tenant_test_assert_swift_hidden('media_downloads', v_swift_bid);
  PERFORM _tenant_test_assert_swift_hidden('media_asset_events', v_swift_bid);
  PERFORM _tenant_test_assert_swift_hidden('project_clients', v_swift_bid);

  SELECT count(*) INTO v_n FROM business_settings WHERE business_id = v_swift_bid;
  IF v_n > 0 THEN RAISE EXCEPTION 'REVERSE READ LEAK: business_settings shows Swift row(s) (%)', v_n; END IF;
  PERFORM _tenant_test_bump();

  SELECT count(*) INTO v_n FROM client_stats cs JOIN clients c ON c.id = cs.client_id WHERE c.business_id = v_swift_bid;
  IF v_n > 0 THEN RAISE EXCEPTION 'REVERSE READ LEAK: client_stats Swift rows (%)', v_n; END IF;
  PERFORM _tenant_test_bump();

  -- 7. Tenant B client
  PERFORM _tenant_test_set_auth(v_tenant_b_client_user_id);
  SELECT count(*) INTO v_n FROM clients WHERE business_id = v_swift_bid;
  IF v_n > 0 THEN RAISE EXCEPTION 'CLIENT LEAK: Swift clients (%)', v_n; END IF;
  PERFORM _tenant_test_bump();
  SELECT count(*) INTO v_n FROM projects WHERE business_id = v_swift_bid;
  IF v_n > 0 THEN RAISE EXCEPTION 'CLIENT LEAK: Swift projects (%)', v_n; END IF;
  PERFORM _tenant_test_bump();
  SELECT count(*) INTO v_n FROM client_stats;
  IF v_n <> 1 THEN RAISE EXCEPTION 'CLIENT client_stats expected 1 row, got %', v_n; END IF;
  PERFORM _tenant_test_bump();
  SELECT count(*) INTO v_n FROM client_stats WHERE client_id = v_client;
  IF v_n <> 1 THEN RAISE EXCEPTION 'CLIENT client_stats wrong client (%)', v_n; END IF;
  PERFORM _tenant_test_bump();
  SELECT count(*) INTO v_n FROM business_integrations;
  IF v_n > 0 THEN RAISE EXCEPTION 'CLIENT LEAK: business_integrations (%)', v_n; END IF;
  PERFORM _tenant_test_bump();

  RESET ROLE;
  SELECT assertions INTO v_assertions FROM _tenant_test_state LIMIT 1;
  RAISE NOTICE 'ALL TENANT ISOLATION TESTS PASSED — % assertions', v_assertions;
END $$;

SELECT
  'ALL TENANT ISOLATION TESTS PASSED' AS result,
  assertions AS assertion_count,
  (SELECT json_agg(json_build_object('op', op, 'mechanism', mechanism))
     FROM _tenant_test_writes) AS write_blocks
FROM _tenant_test_state;

DROP FUNCTION IF EXISTS _tenant_test_assert_swift_hidden(text, uuid);
DROP FUNCTION IF EXISTS _tenant_test_assert_read_hidden(text, uuid);
DROP FUNCTION IF EXISTS _tenant_test_set_auth(uuid);
DROP FUNCTION IF EXISTS _tenant_test_bump();


-- =============================================================================
-- TEARDOWN — run separately after tests pass
-- Deletes Tenant B (…0000ff) and pentest-co (…0000cc). Delete auth users
-- (example.test + pentest-*.example.test) in Dashboard after this block.
-- =============================================================================
/*
DO $$
DECLARE
  v_teardown_business_id uuid := '00000000-0000-0000-0000-0000000000ff';
  v_pentest_business_id uuid := '00000000-0000-0000-0000-0000000000cc';
  v_tenant_b_admin_user_id  uuid := 'd8dbb086-ae9d-40f5-abcc-6a36491780ca';
  v_tenant_b_client_user_id uuid := 'bdd25ea1-18cb-4eff-bf85-a81c14417af5';
BEGIN
  IF v_teardown_business_id <> '00000000-0000-0000-0000-0000000000ff'::uuid THEN
    RAISE EXCEPTION 'Teardown aborted: business id guard failed (%)', v_teardown_business_id;
  END IF;
  DELETE FROM media_asset_tags WHERE business_id = v_teardown_business_id;
  DELETE FROM media_asset_events WHERE business_id = v_teardown_business_id;
  DELETE FROM media_downloads WHERE business_id = v_teardown_business_id;
  DELETE FROM asset_reviews WHERE business_id = v_teardown_business_id;
  DELETE FROM video_review_notification_sends WHERE business_id = v_teardown_business_id;
  DELETE FROM video_review_notification_batches WHERE business_id = v_teardown_business_id;
  DELETE FROM video_review_comments WHERE business_id = v_teardown_business_id;
  DELETE FROM video_review_versions WHERE business_id = v_teardown_business_id;
  DELETE FROM video_reviews WHERE business_id = v_teardown_business_id;
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
  DELETE FROM partner_referrals WHERE business_id = v_teardown_business_id;
  DELETE FROM partner_commissions WHERE business_id = v_teardown_business_id;
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
  DELETE FROM video_review_notification_sends WHERE business_id = v_pentest_business_id;
  DELETE FROM video_review_notification_batches WHERE business_id = v_pentest_business_id;
  DELETE FROM video_review_comments WHERE business_id = v_pentest_business_id;
  DELETE FROM video_review_versions WHERE business_id = v_pentest_business_id;
  DELETE FROM video_reviews WHERE business_id = v_pentest_business_id;
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
  DELETE FROM partner_referrals WHERE business_id = v_pentest_business_id;
  DELETE FROM partner_commissions WHERE business_id = v_pentest_business_id;
  UPDATE profiles SET business_id = NULL, client_id = NULL
  WHERE business_id = v_pentest_business_id;
  DELETE FROM businesses WHERE id = v_pentest_business_id;

  RAISE NOTICE 'Teardown complete for Tenant B (…0000ff) and pentest-co (…0000cc).';
END $$;
*/
