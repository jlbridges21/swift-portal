-- ShootPortal tenant SQL audit.
-- Run in Supabase SQL Editor after v29–v42 (and v43 service_id integrity).
-- Fails with RAISE EXCEPTION if any check has findings.
--
-- Checks:
--   1. policies on tables with business_id that mention is_admin() but not
--      current_business_id()
--   2. business_id nullable (profiles + processed_stripe_events excepted)
--   3. business-data base tables with RLS disabled
--      (platform exceptions without business_id: processed_stripe_events,
--       platform_audit_log, plans, platform_email_templates, partners,
--       partner_applications — still must have RLS enabled)
--   4. business_id column_default (v35 dropped these)
--   5. SECURITY DEFINER functions/views readable by authenticated — must be
--      in the justified set below
--   6. expected v30 (+ v43 service_id) same-business triggers present
--   7. business_settings.senderEmail on a domain the business does not own

CREATE TEMP TABLE IF NOT EXISTS _tenant_sql_audit (
  check_name text NOT NULL,
  detail text NOT NULL
);
DELETE FROM _tenant_sql_audit;

-- ---------------------------------------------------------------------------
-- 1. is_admin() policies missing current_business_id()
-- ---------------------------------------------------------------------------
INSERT INTO _tenant_sql_audit (check_name, detail)
SELECT
  '1_is_admin_without_current_business_id',
  format('%I policy %L', c.relname, pol.polname)
FROM pg_policy pol
JOIN pg_class c ON c.oid = pol.polrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND EXISTS (
    SELECT 1 FROM information_schema.columns col
    WHERE col.table_schema = 'public'
      AND col.table_name = c.relname
      AND col.column_name = 'business_id'
  )
  AND (
    COALESCE(pg_get_expr(pol.polqual, pol.polrelid), '') ILIKE '%is_admin()%'
    OR COALESCE(pg_get_expr(pol.polwithcheck, pol.polrelid), '') ILIKE '%is_admin()%'
  )
  AND COALESCE(pg_get_expr(pol.polqual, pol.polrelid), '') NOT ILIKE '%current_business_id()%'
  AND COALESCE(pg_get_expr(pol.polwithcheck, pol.polrelid), '') NOT ILIKE '%current_business_id()%';

-- ---------------------------------------------------------------------------
-- 2. nullable business_id (except profiles + platform processed_stripe_events)
-- ---------------------------------------------------------------------------
INSERT INTO _tenant_sql_audit (check_name, detail)
SELECT
  '2_nullable_business_id',
  format('%I.business_id is nullable', table_name)
FROM information_schema.columns
WHERE table_schema = 'public'
  AND column_name = 'business_id'
  AND is_nullable = 'YES'
  AND table_name NOT IN ('profiles', 'processed_stripe_events');

-- plans / platform_email_templates / partners tables must NOT have business_id
-- (platform catalog / partner-program exceptions)
INSERT INTO _tenant_sql_audit (check_name, detail)
SELECT
  '2b_plans_has_business_id',
  'plans must remain platform-scoped without business_id'
WHERE EXISTS (
  SELECT 1 FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'plans'
    AND column_name = 'business_id'
);

INSERT INTO _tenant_sql_audit (check_name, detail)
SELECT
  '2b_platform_email_templates_has_business_id',
  'platform_email_templates must remain platform-scoped without business_id'
WHERE EXISTS (
  SELECT 1 FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'platform_email_templates'
    AND column_name = 'business_id'
);

INSERT INTO _tenant_sql_audit (check_name, detail)
SELECT
  '2b_partners_has_business_id',
  'partners must remain platform-scoped without business_id'
WHERE EXISTS (
  SELECT 1 FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'partners'
    AND column_name = 'business_id'
);

INSERT INTO _tenant_sql_audit (check_name, detail)
SELECT
  '2b_partner_applications_has_business_id',
  'partner_applications must remain platform-scoped without business_id'
WHERE EXISTS (
  SELECT 1 FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'partner_applications'
    AND column_name = 'business_id'
);

INSERT INTO _tenant_sql_audit (check_name, detail)
SELECT
  '2b_plans_missing',
  'plans table is missing'
WHERE NOT EXISTS (
  SELECT 1 FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name = 'plans'
);

INSERT INTO _tenant_sql_audit (check_name, detail)
SELECT
  '2b_platform_email_templates_missing',
  'platform_email_templates table is missing'
WHERE NOT EXISTS (
  SELECT 1 FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name = 'platform_email_templates'
);

INSERT INTO _tenant_sql_audit (check_name, detail)
SELECT
  '2b_partners_missing',
  'partners table is missing'
WHERE NOT EXISTS (
  SELECT 1 FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name = 'partners'
);

INSERT INTO _tenant_sql_audit (check_name, detail)
SELECT
  '2b_partner_applications_missing',
  'partner_applications table is missing'
WHERE NOT EXISTS (
  SELECT 1 FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name = 'partner_applications'
);

-- ---------------------------------------------------------------------------
-- 3. RLS disabled on public base tables that hold business or identity data
--     Platform tables without business_id (plans, platform_audit_log,
--     processed_stripe_events, platform_email_templates, partners,
--     partner_applications) are still required to have RLS enabled.
-- ---------------------------------------------------------------------------
INSERT INTO _tenant_sql_audit (check_name, detail)
SELECT
  '3_rls_disabled',
  format('%I has RLS disabled', c.relname)
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND c.relrowsecurity IS NOT TRUE
  AND c.relname NOT LIKE 'pg_%';

-- ---------------------------------------------------------------------------
-- 4. business_id column defaults (v35)
-- ---------------------------------------------------------------------------
INSERT INTO _tenant_sql_audit (check_name, detail)
SELECT
  '4_business_id_default',
  format('%I.business_id default %s', table_name, column_default)
FROM information_schema.columns
WHERE table_schema = 'public'
  AND column_name = 'business_id'
  AND column_default IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 5. SECURITY DEFINER functions granted to authenticated
--     Justified set (do not add new ones without a business filter):
--       is_admin / is_super_admin — role predicates; policies AND current_business_id()
--       current_business_id — the tenant filter itself
--       get_user_client_id — hop is scoped with current_business_id() on fallback
--       client_has_project_access — requires projects.business_id = current_business_id()
--       handle_new_user — auth trigger; stamps business_id from signup metadata
--       enforce_same_business — trigger; not a read path
--       reorder_media_assets — JWT path checks current_business_id(); service_role is app-gated
--       peek_impersonated_current_business_id — super_admin-only; sets
--         app.impersonated_business_id then returns current_business_id()
-- ---------------------------------------------------------------------------
INSERT INTO _tenant_sql_audit (check_name, detail)
SELECT
  '5_unexpected_security_definer',
  format('%s (acl %s)', p.proname, COALESCE(p.proacl::text, ''))
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.prosecdef
  AND p.proname NOT IN (
    'is_admin',
    'is_super_admin',
    'current_business_id',
    'get_user_client_id',
    'client_has_project_access',
    'handle_new_user',
    'enforce_same_business',
    'reorder_media_assets',
    'peek_impersonated_current_business_id'
  )
  AND (
    COALESCE(p.proacl::text, '') ILIKE '%authenticated%'
    OR p.proacl IS NULL
  );

INSERT INTO _tenant_sql_audit (check_name, detail)
SELECT
  '5_security_definer_view',
  format('view %I is security_definer', c.relname)
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'v'
  AND EXISTS (
    SELECT 1 FROM unnest(COALESCE(c.reloptions, ARRAY[]::text[])) opt
    WHERE opt ILIKE 'security_barrier%' OR opt ILIKE 'security_invoker=false'
  );

INSERT INTO _tenant_sql_audit (check_name, detail)
SELECT
  '5_client_stats_not_invoker',
  'client_stats must be security_invoker'
WHERE NOT EXISTS (
  SELECT 1
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname = 'client_stats'
    AND EXISTS (
      SELECT 1 FROM unnest(COALESCE(c.reloptions, ARRAY[]::text[])) opt
      WHERE opt = 'security_invoker=true'
    )
);

-- Missing expected helpers (regression if dropped)
INSERT INTO _tenant_sql_audit (check_name, detail)
SELECT
  '5_missing_helper',
  format('expected function %s is missing', expected)
FROM unnest(ARRAY[
  'is_admin',
  'is_super_admin',
  'current_business_id',
  'get_user_client_id',
  'client_has_project_access',
  'handle_new_user',
  'enforce_same_business',
  'reorder_media_assets',
  'peek_impersonated_current_business_id'
]) AS expected
WHERE NOT EXISTS (
  SELECT 1 FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = expected
);

-- ---------------------------------------------------------------------------
-- 6. v30 (+ v43) same-business triggers
-- ---------------------------------------------------------------------------
INSERT INTO _tenant_sql_audit (check_name, detail)
SELECT
  '6_missing_trigger',
  format('missing %s', expected)
FROM unnest(ARRAY[
  'trg_projects_client_id_same_business',
  'trg_projects_property_id_same_business',
  'trg_projects_service_id_same_business',
  'trg_project_clients_project_id_same_business',
  'trg_project_clients_client_id_same_business',
  'trg_project_quotes_project_id_same_business',
  'trg_payments_project_id_same_business',
  'trg_payments_client_id_same_business',
  'trg_payments_quote_id_same_business',
  'trg_media_assets_project_id_same_business',
  'trg_media_assets_client_id_same_business',
  'trg_media_assets_property_id_same_business',
  'trg_media_assets_folder_id_same_business',
  'trg_media_folders_project_id_same_business',
  'trg_media_asset_tags_media_asset_id_same_business',
  'trg_media_downloads_media_asset_id_same_business',
  'trg_media_asset_events_media_asset_id_same_business',
  'trg_media_asset_events_project_id_same_business',
  'trg_tours_project_id_same_business',
  'trg_revisions_project_id_same_business',
  'trg_revisions_client_id_same_business',
  'trg_shoot_proposals_project_id_same_business',
  'trg_asset_reviews_project_id_same_business',
  'trg_client_messages_client_id_same_business',
  'trg_client_messages_project_id_same_business',
  'trg_client_message_reads_message_id_same_business',
  'trg_project_messages_project_id_same_business',
  'trg_project_message_reads_message_id_same_business',
  'trg_communications_project_id_same_business',
  'trg_communications_client_id_same_business',
  'trg_activity_logs_project_id_same_business',
  'trg_activity_logs_client_id_same_business',
  'trg_activity_logs_property_id_same_business',
  'trg_notifications_project_id_same_business',
  'trg_notifications_payment_id_same_business',
  'trg_client_notes_client_id_same_business',
  'trg_email_events_project_id_same_business',
  'trg_leads_project_id_same_business',
  'trg_properties_client_id_same_business'
]) AS expected
WHERE NOT EXISTS (
  SELECT 1 FROM pg_trigger t
  WHERE NOT t.tgisinternal AND t.tgname = expected
);

-- ---------------------------------------------------------------------------
-- 7. senderEmail on a domain the business does not own
--     Ownership: settings.email.customDomain, or businesses.custom_domain
--     (exact or a hostname under that registrable domain).
-- ---------------------------------------------------------------------------
INSERT INTO _tenant_sql_audit (check_name, detail)
SELECT
  '7_unowned_sender_email',
  format(
    '%s (%s) senderEmail=%s customDomain=%s custom_domain=%s',
    b.slug,
    b.id,
    sender_email,
    custom_dom,
    b.custom_domain
  )
FROM (
  SELECT
    bs.business_id,
    btrim(bs.settings#>>'{email,senderEmail}') AS sender_email,
    regexp_replace(
      lower(btrim(split_part(bs.settings#>>'{email,senderEmail}', '@', 2))),
      '^www\.',
      ''
    ) AS sender_domain,
    regexp_replace(
      lower(btrim(COALESCE(bs.settings#>>'{email,customDomain}', ''))),
      '^www\.',
      ''
    ) AS custom_dom
  FROM business_settings bs
) s
JOIN businesses b ON b.id = s.business_id
WHERE NULLIF(s.sender_email, '') IS NOT NULL
  AND s.sender_domain IS DISTINCT FROM s.custom_dom
  AND s.sender_domain IS DISTINCT FROM regexp_replace(lower(btrim(COALESCE(b.custom_domain, ''))), '^www\.', '')
  AND regexp_replace(lower(btrim(COALESCE(b.custom_domain, ''))), '^www\.', '')
      NOT LIKE '%.' || s.sender_domain;

-- ---------------------------------------------------------------------------
-- Report
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_n int;
  v_text text;
BEGIN
  SELECT COUNT(*) INTO v_n FROM _tenant_sql_audit;
  IF v_n > 0 THEN
    SELECT string_agg(check_name || ': ' || detail, E'\n' ORDER BY check_name, detail)
      INTO v_text
    FROM _tenant_sql_audit;
    RAISE EXCEPTION E'TENANT SQL AUDIT FAILED (% finding(s)):\n%', v_n, v_text;
  END IF;
END $$;

SELECT 'TENANT SQL AUDIT PASSED' AS result, 0 AS findings;
