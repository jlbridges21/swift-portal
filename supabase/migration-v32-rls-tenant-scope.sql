-- Swift Portal V32: business-scope every RLS policy (super_admin bypass)
--
-- Mechanical, additive transform. Does not redesign the access model.
-- 'admin' remains business admin. 'super_admin' is additive bypass.
--
-- EFFECTIVE POLICY SET before this file (enumerated from TENANT-AUDIT.md §A
-- plus last-wins DROP/CREATE across schema.sql and migration-v*.sql, then
-- confirmed against live pg_policy on this Postgres 16 project):
--
--   61 policies on 27 public tables (9 storage.objects policies unchanged):
--     activity_logs 3, asset_reviews 3, client_message_reads 2,
--     client_messages 3, client_notes 1, clients 2, communications 1,
--     email_events 1, google_calendar_connections 1, leads 4,
--     media_asset_events 1, media_asset_tags 2, media_assets 2,
--     media_downloads 1, media_folders 2, notifications 3, payments 2,
--     profiles 4, project_clients 2, project_message_reads 2,
--     project_messages 3, project_quotes 3, projects 2, properties 2,
--     revisions 3, shoot_proposals 4, tours 2
--   RLS ON, 0 policies (left alone): app_settings, processed_stripe_events,
--     businesses.
--
-- HOW TO RUN:
-- 1. Open Supabase Dashboard → SQL Editor → New query
-- 2. Paste this entire file and click Run
--
-- VERIFICATION (also at the bottom):
--   1. This file completes with no errors.
--   2. Policy-count listing: nothing lost its policies (61 public).
--   3. is_admin()-without-current_business_id() on tables that HAVE
--      business_id returns 0 rows.
--   4. client_has_project_access is STABLE; client_stats has security_invoker.
--   5. npm run typecheck && npm run build (no TypeScript in this step).
--   6. Admin / client / public /request / production smoke tests in the prompt.
--
-- Public lead capture (/request, /api/leads, /api/request/logged-in) uses the
-- service role, which bypasses RLS. The leads INSERT WITH CHECK still lets an
-- omitted business_id land on the v30 Swift DEFAULT, which is an active
-- non-deleted businesses row — so an anon-key insert would also succeed.

-- ---------------------------------------------------------------------------
-- 0. client_has_project_access: mark STABLE (was VOLATILE by default since v3)
--    Body and signature otherwise unchanged from v31b.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION client_has_project_access(p_project_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (
    EXISTS (
      SELECT 1 FROM project_clients
      WHERE project_id = p_project_id AND client_id = get_user_client_id()
    ) OR EXISTS (
      SELECT 1 FROM projects
      WHERE id = p_project_id AND client_id = get_user_client_id()
    )
  ) AND EXISTS (
    SELECT 1 FROM projects
    WHERE id = p_project_id AND business_id = current_business_id()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Admin USING/CHECK (repeated verbatim — do not hide behind a helper):
--   is_super_admin() OR (is_admin() AND business_id = current_business_id())

-- ===========================================================================
-- 1. Business-owned tables
-- ===========================================================================

-- ---------- profiles ----------
-- Preserve auth.uid() = id and the supabase_auth_admin insert policy.
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (
    auth.uid() = id
    OR is_super_admin()
    OR (is_admin() AND business_id = current_business_id())
  );

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (
    auth.uid() = id
    OR is_super_admin()
    OR (is_admin() AND business_id = current_business_id())
  );

DROP POLICY IF EXISTS "Admins can insert profiles" ON profiles;
CREATE POLICY "Admins can insert profiles" ON profiles
  FOR INSERT WITH CHECK (
    is_super_admin()
    OR (is_admin() AND business_id = current_business_id())
    OR auth.uid() = id
  );

-- Preserved byte-for-byte (role TO supabase_auth_admin, WITH CHECK true).
DROP POLICY IF EXISTS "Auth service can insert profiles" ON profiles;
CREATE POLICY "Auth service can insert profiles" ON profiles
  FOR INSERT TO supabase_auth_admin
  WITH CHECK (true);

-- ---------- clients ----------
DROP POLICY IF EXISTS "Admins full access clients" ON clients;
CREATE POLICY "Admins full access clients" ON clients
  FOR ALL
  USING (is_super_admin() OR (is_admin() AND business_id = current_business_id()))
  WITH CHECK (is_super_admin() OR (is_admin() AND business_id = current_business_id()));

DROP POLICY IF EXISTS "Clients view own record" ON clients;
CREATE POLICY "Clients view own record" ON clients
  FOR SELECT USING (
    business_id = current_business_id() AND id = get_user_client_id()
  );

-- ---------- leads ----------
-- A. Public INSERT no longer WITH CHECK (true). business_id must point at an
--    active, non-deleted business. Omitted business_id uses the v30 Swift
--    DEFAULT, which satisfies this check.
DROP POLICY IF EXISTS "Anyone can create leads" ON leads;
CREATE POLICY "Anyone can create leads" ON leads
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM businesses b
      WHERE b.id = leads.business_id
        AND b.status = 'active'
        AND b.deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "Admins can view leads" ON leads;
CREATE POLICY "Admins can view leads" ON leads
  FOR SELECT USING (
    is_super_admin() OR (is_admin() AND business_id = current_business_id())
  );

DROP POLICY IF EXISTS "Admins can update leads" ON leads;
CREATE POLICY "Admins can update leads" ON leads
  FOR UPDATE USING (
    is_super_admin() OR (is_admin() AND business_id = current_business_id())
  );

DROP POLICY IF EXISTS "Admins can delete leads" ON leads;
CREATE POLICY "Admins can delete leads" ON leads
  FOR DELETE USING (
    is_super_admin() OR (is_admin() AND business_id = current_business_id())
  );

-- ---------- projects ----------
DROP POLICY IF EXISTS "Admins full access projects" ON projects;
CREATE POLICY "Admins full access projects" ON projects
  FOR ALL
  USING (is_super_admin() OR (is_admin() AND business_id = current_business_id()))
  WITH CHECK (is_super_admin() OR (is_admin() AND business_id = current_business_id()));

DROP POLICY IF EXISTS "Clients view own projects" ON projects;
CREATE POLICY "Clients view own projects" ON projects
  FOR SELECT USING (
    business_id = current_business_id()
    AND deleted_at IS NULL
    AND (
      client_id = get_user_client_id()
      OR client_has_project_access(id)
    )
  );

-- ---------- project_clients ----------
DROP POLICY IF EXISTS "Admins full access project_clients" ON project_clients;
CREATE POLICY "Admins full access project_clients" ON project_clients
  FOR ALL
  USING (is_super_admin() OR (is_admin() AND business_id = current_business_id()))
  WITH CHECK (is_super_admin() OR (is_admin() AND business_id = current_business_id()));

DROP POLICY IF EXISTS "Clients view own project_clients" ON project_clients;
CREATE POLICY "Clients view own project_clients" ON project_clients
  FOR SELECT USING (
    business_id = current_business_id() AND client_id = get_user_client_id()
  );

-- ---------- properties ----------
DROP POLICY IF EXISTS "Admins full access properties" ON properties;
CREATE POLICY "Admins full access properties" ON properties
  FOR ALL
  USING (is_super_admin() OR (is_admin() AND business_id = current_business_id()))
  WITH CHECK (is_super_admin() OR (is_admin() AND business_id = current_business_id()));

DROP POLICY IF EXISTS "Clients view own properties" ON properties;
CREATE POLICY "Clients view own properties" ON properties
  FOR SELECT USING (
    business_id = current_business_id()
    AND (
      client_id = get_user_client_id()
      OR EXISTS (
        SELECT 1 FROM projects p
        WHERE p.property_id = properties.id AND client_has_project_access(p.id)
      )
    )
  );

-- ---------- media_assets ----------
DROP POLICY IF EXISTS "Admins full access media" ON media_assets;
CREATE POLICY "Admins full access media" ON media_assets
  FOR ALL
  USING (is_super_admin() OR (is_admin() AND business_id = current_business_id()))
  WITH CHECK (is_super_admin() OR (is_admin() AND business_id = current_business_id()));

DROP POLICY IF EXISTS "Clients view own media" ON media_assets;
CREATE POLICY "Clients view own media" ON media_assets
  FOR SELECT USING (
    business_id = current_business_id()
    AND client_has_project_access(project_id)
  );

-- ---------- media_folders ----------
DROP POLICY IF EXISTS "Admins full access media_folders" ON media_folders;
CREATE POLICY "Admins full access media_folders" ON media_folders
  FOR ALL
  USING (is_super_admin() OR (is_admin() AND business_id = current_business_id()))
  WITH CHECK (is_super_admin() OR (is_admin() AND business_id = current_business_id()));

DROP POLICY IF EXISTS "Clients view own media_folders" ON media_folders;
CREATE POLICY "Clients view own media_folders" ON media_folders
  FOR SELECT USING (
    business_id = current_business_id()
    AND client_has_project_access(project_id)
  );

-- ---------- media_asset_tags ----------
DROP POLICY IF EXISTS "Admins full access media_asset_tags" ON media_asset_tags;
CREATE POLICY "Admins full access media_asset_tags" ON media_asset_tags
  FOR ALL
  USING (is_super_admin() OR (is_admin() AND business_id = current_business_id()))
  WITH CHECK (is_super_admin() OR (is_admin() AND business_id = current_business_id()));

DROP POLICY IF EXISTS "Clients view tags on accessible media" ON media_asset_tags;
CREATE POLICY "Clients view tags on accessible media" ON media_asset_tags
  FOR SELECT USING (
    business_id = current_business_id()
    AND EXISTS (
      SELECT 1 FROM media_assets m
      WHERE m.id = media_asset_tags.media_asset_id
        AND client_has_project_access(m.project_id)
    )
  );

-- ---------- media_downloads ----------
DROP POLICY IF EXISTS "Admins full access media_downloads" ON media_downloads;
CREATE POLICY "Admins full access media_downloads" ON media_downloads
  FOR ALL
  USING (is_super_admin() OR (is_admin() AND business_id = current_business_id()))
  WITH CHECK (is_super_admin() OR (is_admin() AND business_id = current_business_id()));

-- ---------- media_asset_events ----------
DROP POLICY IF EXISTS "Admins full access media_asset_events" ON media_asset_events;
CREATE POLICY "Admins full access media_asset_events" ON media_asset_events
  FOR ALL
  USING (is_super_admin() OR (is_admin() AND business_id = current_business_id()))
  WITH CHECK (is_super_admin() OR (is_admin() AND business_id = current_business_id()));

-- ---------- tours ----------
DROP POLICY IF EXISTS "Admins full access tours" ON tours;
CREATE POLICY "Admins full access tours" ON tours
  FOR ALL
  USING (is_super_admin() OR (is_admin() AND business_id = current_business_id()))
  WITH CHECK (is_super_admin() OR (is_admin() AND business_id = current_business_id()));

DROP POLICY IF EXISTS "Clients view own tours" ON tours;
CREATE POLICY "Clients view own tours" ON tours
  FOR SELECT USING (
    business_id = current_business_id()
    AND client_has_project_access(project_id)
  );

-- ---------- payments ----------
DROP POLICY IF EXISTS "Admins full access payments" ON payments;
CREATE POLICY "Admins full access payments" ON payments
  FOR ALL
  USING (is_super_admin() OR (is_admin() AND business_id = current_business_id()))
  WITH CHECK (is_super_admin() OR (is_admin() AND business_id = current_business_id()));

DROP POLICY IF EXISTS "Clients view own payments" ON payments;
CREATE POLICY "Clients view own payments" ON payments
  FOR SELECT USING (
    business_id = current_business_id()
    AND (
      client_id = get_user_client_id()
      OR (project_id IS NOT NULL AND client_has_project_access(project_id))
    )
  );

-- ---------- revisions ----------
DROP POLICY IF EXISTS "Admins full access revisions" ON revisions;
CREATE POLICY "Admins full access revisions" ON revisions
  FOR ALL
  USING (is_super_admin() OR (is_admin() AND business_id = current_business_id()))
  WITH CHECK (is_super_admin() OR (is_admin() AND business_id = current_business_id()));

DROP POLICY IF EXISTS "Clients view own revisions" ON revisions;
CREATE POLICY "Clients view own revisions" ON revisions
  FOR SELECT USING (
    business_id = current_business_id()
    AND (
      client_id = get_user_client_id()
      OR (project_id IS NOT NULL AND client_has_project_access(project_id))
    )
  );

DROP POLICY IF EXISTS "Clients create revisions" ON revisions;
CREATE POLICY "Clients create revisions" ON revisions
  FOR INSERT WITH CHECK (
    business_id = current_business_id()
    AND client_id = get_user_client_id()
    AND (
      project_id IS NULL
      OR client_has_project_access(project_id)
    )
  );

-- ---------- activity_logs ----------
DROP POLICY IF EXISTS "Admins view all activity" ON activity_logs;
CREATE POLICY "Admins view all activity" ON activity_logs
  FOR SELECT USING (
    is_super_admin() OR (is_admin() AND business_id = current_business_id())
  );

DROP POLICY IF EXISTS "Clients view own activity" ON activity_logs;
CREATE POLICY "Clients view own activity" ON activity_logs
  FOR SELECT USING (
    business_id = current_business_id()
    AND project_id IS NOT NULL
    AND client_has_project_access(project_id)
  );

-- C. Authenticated INSERT also requires current_business_id().
DROP POLICY IF EXISTS "Authenticated users can log activity" ON activity_logs;
CREATE POLICY "Authenticated users can log activity" ON activity_logs
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL
    AND business_id = current_business_id()
  );

-- ---------- notifications ----------
-- user_id = auth.uid() preserved on SELECT/UPDATE.
DROP POLICY IF EXISTS "Users view own notifications" ON notifications;
CREATE POLICY "Users view own notifications" ON notifications
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own notifications" ON notifications;
CREATE POLICY "Users update own notifications" ON notifications
  FOR UPDATE USING (auth.uid() = user_id);

-- B. Authenticated INSERT no longer WITH CHECK (true). Service-role writes
--    bypass RLS and are unaffected.
DROP POLICY IF EXISTS "Service can insert notifications" ON notifications;
CREATE POLICY "Service can insert notifications" ON notifications
  FOR INSERT WITH CHECK (business_id = current_business_id());

-- ---------- shoot_proposals ----------
DROP POLICY IF EXISTS "Admins full access shoot_proposals" ON shoot_proposals;
CREATE POLICY "Admins full access shoot_proposals" ON shoot_proposals
  FOR ALL
  USING (is_super_admin() OR (is_admin() AND business_id = current_business_id()))
  WITH CHECK (is_super_admin() OR (is_admin() AND business_id = current_business_id()));

DROP POLICY IF EXISTS "Clients view own shoot_proposals" ON shoot_proposals;
CREATE POLICY "Clients view own shoot_proposals" ON shoot_proposals
  FOR SELECT USING (
    business_id = current_business_id()
    AND client_has_project_access(project_id)
  );

DROP POLICY IF EXISTS "Clients create shoot_proposals" ON shoot_proposals;
CREATE POLICY "Clients create shoot_proposals" ON shoot_proposals
  FOR INSERT WITH CHECK (
    business_id = current_business_id()
    AND client_has_project_access(project_id)
    AND proposed_by = 'client'
  );

DROP POLICY IF EXISTS "Clients update own counter proposals" ON shoot_proposals;
CREATE POLICY "Clients update own counter proposals" ON shoot_proposals
  FOR UPDATE USING (
    business_id = current_business_id()
    AND client_has_project_access(project_id)
  );

-- ---------- project_quotes ----------
DROP POLICY IF EXISTS "Admins full access project_quotes" ON project_quotes;
CREATE POLICY "Admins full access project_quotes" ON project_quotes
  FOR ALL
  USING (is_super_admin() OR (is_admin() AND business_id = current_business_id()))
  WITH CHECK (is_super_admin() OR (is_admin() AND business_id = current_business_id()));

DROP POLICY IF EXISTS "Clients view own project_quotes" ON project_quotes;
CREATE POLICY "Clients view own project_quotes" ON project_quotes
  FOR SELECT USING (
    business_id = current_business_id()
    AND client_has_project_access(project_id)
  );

DROP POLICY IF EXISTS "Clients update own project_quotes" ON project_quotes;
CREATE POLICY "Clients update own project_quotes" ON project_quotes
  FOR UPDATE USING (
    business_id = current_business_id()
    AND client_has_project_access(project_id)
  );

-- ---------- asset_reviews ----------
DROP POLICY IF EXISTS "Admins full access asset_reviews" ON asset_reviews;
CREATE POLICY "Admins full access asset_reviews" ON asset_reviews
  FOR ALL
  USING (is_super_admin() OR (is_admin() AND business_id = current_business_id()))
  WITH CHECK (is_super_admin() OR (is_admin() AND business_id = current_business_id()));

DROP POLICY IF EXISTS "Clients view own asset_reviews" ON asset_reviews;
CREATE POLICY "Clients view own asset_reviews" ON asset_reviews
  FOR SELECT USING (
    business_id = current_business_id()
    AND client_has_project_access(project_id)
  );

DROP POLICY IF EXISTS "Clients manage own asset_reviews" ON asset_reviews;
CREATE POLICY "Clients manage own asset_reviews" ON asset_reviews
  FOR ALL
  USING (
    business_id = current_business_id()
    AND client_has_project_access(project_id)
  )
  WITH CHECK (
    business_id = current_business_id()
    AND client_has_project_access(project_id)
  );

-- ---------- email_events ----------
-- Original used an inline profiles.role = 'admin' EXISTS, not is_admin().
-- Preserve that predicate; add super_admin bypass and business_id scope.
DROP POLICY IF EXISTS "Admins view email events" ON email_events;
CREATE POLICY "Admins view email events" ON email_events
  FOR SELECT USING (
    is_super_admin()
    OR (
      business_id = current_business_id()
      AND EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
      )
    )
  );

-- ---------- communications ----------
DROP POLICY IF EXISTS "Admins full access communications" ON communications;
CREATE POLICY "Admins full access communications" ON communications
  FOR ALL
  USING (is_super_admin() OR (is_admin() AND business_id = current_business_id()))
  WITH CHECK (is_super_admin() OR (is_admin() AND business_id = current_business_id()));

-- ---------- client_notes ----------
DROP POLICY IF EXISTS "Admins full access client_notes" ON client_notes;
CREATE POLICY "Admins full access client_notes" ON client_notes
  FOR ALL
  USING (is_super_admin() OR (is_admin() AND business_id = current_business_id()))
  WITH CHECK (is_super_admin() OR (is_admin() AND business_id = current_business_id()));

-- ---------- project_messages ----------
DROP POLICY IF EXISTS "Admins full access project_messages" ON project_messages;
CREATE POLICY "Admins full access project_messages" ON project_messages
  FOR ALL
  USING (is_super_admin() OR (is_admin() AND business_id = current_business_id()))
  WITH CHECK (is_super_admin() OR (is_admin() AND business_id = current_business_id()));

DROP POLICY IF EXISTS "Clients view project messages" ON project_messages;
CREATE POLICY "Clients view project messages" ON project_messages
  FOR SELECT USING (
    business_id = current_business_id()
    AND client_has_project_access(project_id)
  );

DROP POLICY IF EXISTS "Clients insert project messages" ON project_messages;
CREATE POLICY "Clients insert project messages" ON project_messages
  FOR INSERT WITH CHECK (
    business_id = current_business_id()
    AND client_has_project_access(project_id)
    AND sender_user_id = auth.uid()
    AND sender_role = 'client'
  );

-- ---------- project_message_reads ----------
DROP POLICY IF EXISTS "Admins full access project_message_reads" ON project_message_reads;
CREATE POLICY "Admins full access project_message_reads" ON project_message_reads
  FOR ALL
  USING (is_super_admin() OR (is_admin() AND business_id = current_business_id()))
  WITH CHECK (is_super_admin() OR (is_admin() AND business_id = current_business_id()));

DROP POLICY IF EXISTS "Users manage own message reads" ON project_message_reads;
CREATE POLICY "Users manage own message reads" ON project_message_reads
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ---------- client_messages ----------
DROP POLICY IF EXISTS "Admins full access client_messages" ON client_messages;
CREATE POLICY "Admins full access client_messages" ON client_messages
  FOR ALL
  USING (is_super_admin() OR (is_admin() AND business_id = current_business_id()))
  WITH CHECK (is_super_admin() OR (is_admin() AND business_id = current_business_id()));

DROP POLICY IF EXISTS "Clients view own client_messages" ON client_messages;
CREATE POLICY "Clients view own client_messages" ON client_messages
  FOR SELECT USING (
    business_id = current_business_id() AND client_id = get_user_client_id()
  );

DROP POLICY IF EXISTS "Clients insert own client_messages" ON client_messages;
CREATE POLICY "Clients insert own client_messages" ON client_messages
  FOR INSERT WITH CHECK (
    business_id = current_business_id()
    AND client_id = get_user_client_id()
    AND sender_user_id = auth.uid()
    AND sender_role = 'client'
  );

-- ---------- client_message_reads ----------
DROP POLICY IF EXISTS "Admins full access client_message_reads" ON client_message_reads;
CREATE POLICY "Admins full access client_message_reads" ON client_message_reads
  FOR ALL
  USING (is_super_admin() OR (is_admin() AND business_id = current_business_id()))
  WITH CHECK (is_super_admin() OR (is_admin() AND business_id = current_business_id()));

DROP POLICY IF EXISTS "Users manage own client_message_reads" ON client_message_reads;
CREATE POLICY "Users manage own client_message_reads" ON client_message_reads
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ---------- google_calendar_connections (singleton, NO business_id) ----------
-- Not in the 26 business-owned tables. Super_admin bypass only so a promoted
-- super_admin is not locked out of the existing admin calendar card.
DROP POLICY IF EXISTS "Admins full access google_calendar" ON google_calendar_connections;
CREATE POLICY "Admins full access google_calendar" ON google_calendar_connections
  FOR ALL
  USING (is_super_admin() OR is_admin())
  WITH CHECK (is_super_admin() OR is_admin());

-- ===========================================================================
-- 2D. client_stats — security_invoker so underlying clients/payments/projects
--     RLS applies. Exact v24 column list and semantics.
-- ===========================================================================
DROP VIEW IF EXISTS client_stats;

CREATE VIEW client_stats
WITH (security_invoker = true)
AS
WITH client_projects AS (
  SELECT c.id AS client_id, p.id AS project_id, p.status
  FROM clients c
  LEFT JOIN projects p ON p.client_id = c.id AND p.deleted_at IS NULL
  WHERE c.deleted_at IS NULL
  UNION
  SELECT pc.client_id, p.id, p.status
  FROM project_clients pc
  JOIN projects p ON p.id = pc.project_id AND p.deleted_at IS NULL
  JOIN clients c ON c.id = pc.client_id AND c.deleted_at IS NULL
),
paid_totals AS (
  SELECT
    pay.client_id,
    COALESCE(SUM(pay.amount), 0)::bigint AS lifetime_revenue,
    MAX(pay.paid_at) AS last_payment_at,
    COUNT(*) FILTER (WHERE pay.status = 'paid') AS paid_payment_count
  FROM payments pay
  JOIN projects pr ON pr.id = pay.project_id AND pr.deleted_at IS NULL
  JOIN clients c ON c.id = pay.client_id AND c.deleted_at IS NULL
  WHERE pay.status = 'paid'
  GROUP BY pay.client_id
),
outstanding AS (
  SELECT
    pay.client_id,
    COALESCE(SUM(pay.amount), 0)::bigint AS outstanding_balance
  FROM payments pay
  JOIN projects pr ON pr.id = pay.project_id AND pr.deleted_at IS NULL
  JOIN clients c ON c.id = pay.client_id AND c.deleted_at IS NULL
  WHERE pay.status IN ('pending', 'sent', 'draft')
  GROUP BY pay.client_id
)
SELECT
  c.id AS client_id,
  COALESCE(pt.lifetime_revenue, 0) AS lifetime_revenue,
  COALESCE(o.outstanding_balance, 0) AS outstanding_balance,
  COUNT(DISTINCT cp.project_id) FILTER (
    WHERE cp.status IS NOT NULL AND cp.status::text NOT IN ('delivered')
  ) AS active_project_count,
  COUNT(DISTINCT cp.project_id) FILTER (
    WHERE cp.status::text = 'delivered'
  ) AS delivered_project_count,
  COUNT(DISTINCT cp.project_id) FILTER (WHERE cp.project_id IS NOT NULL) AS total_project_count,
  CASE
    WHEN COALESCE(pt.paid_payment_count, 0) > 0
    THEN (COALESCE(pt.lifetime_revenue, 0) / pt.paid_payment_count)::bigint
    ELSE 0
  END AS average_project_value,
  pt.last_payment_at
FROM clients c
LEFT JOIN client_projects cp ON cp.client_id = c.id
LEFT JOIN paid_totals pt ON pt.client_id = c.id
LEFT JOIN outstanding o ON o.client_id = c.id
WHERE c.deleted_at IS NULL
GROUP BY c.id, pt.lifetime_revenue, pt.last_payment_at, pt.paid_payment_count, o.outstanding_balance;

GRANT SELECT ON client_stats TO authenticated;

-- ===========================================================================
-- 2E. reorder_media_assets — caller must own the project's tenant
--     Signature unchanged (src/app/api/media/reorder/route.ts).
--     The live API calls this RPC with the service role; auth.uid() is NULL
--     on that path, so service_role is allowed (the route is already gated
--     by requireAdminApi). The new checks close the GRANT TO authenticated
--     hole: any logged-in user who knows a project_id could previously
--     reorder another project's photos.
-- ===========================================================================
CREATE OR REPLACE FUNCTION reorder_media_assets(
  p_project_id UUID,
  p_ordered_ids UUID[]
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  id_count INT;
  matched_count INT;
  proj_bid UUID;
BEGIN
  IF p_project_id IS NULL THEN
    RAISE EXCEPTION 'project_id is required';
  END IF;

  SELECT business_id INTO proj_bid
  FROM projects
  WHERE id = p_project_id;

  IF proj_bid IS NULL THEN
    RAISE EXCEPTION 'project not found';
  END IF;

  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    IF is_super_admin() THEN
      NULL;
    ELSIF is_admin() AND proj_bid = current_business_id() THEN
      NULL;
    ELSE
      RAISE EXCEPTION 'not authorized to reorder photos for this project';
    END IF;

    -- Super_admin has NULL current_business_id() unless impersonating.
    IF NOT is_super_admin()
       AND proj_bid IS DISTINCT FROM current_business_id() THEN
      RAISE EXCEPTION 'tenant integrity: project belongs to business %, caller is %',
        proj_bid, current_business_id();
    END IF;
  END IF;

  id_count := COALESCE(array_length(p_ordered_ids, 1), 0);
  IF id_count = 0 THEN
    RETURN;
  END IF;

  SELECT COUNT(*) INTO matched_count
  FROM media_assets
  WHERE id = ANY (p_ordered_ids)
    AND project_id = p_project_id
    AND media_type = 'photo';

  IF matched_count <> id_count THEN
    RAISE EXCEPTION 'one or more media IDs do not belong to this project as photos';
  END IF;

  UPDATE media_assets m
  SET display_order = o.ord::INTEGER - 1,
      updated_at = NOW()
  FROM unnest(p_ordered_ids) WITH ORDINALITY AS o(id, ord)
  WHERE m.id = o.id
    AND m.project_id = p_project_id;
END;
$$;

REVOKE ALL ON FUNCTION reorder_media_assets(UUID, UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION reorder_media_assets(UUID, UUID[]) TO service_role;
GRANT EXECUTE ON FUNCTION reorder_media_assets(UUID, UUID[]) TO authenticated;

-- ===========================================================================
-- 3. Storage policies UNCHANGED
--    project-media, project-documents, and avatars policies are left as-is.
--    Storage path prefixing is a later phase; changing these now would break
--    existing client downloads.
-- ===========================================================================

-- ===========================================================================
-- 4. Verification
-- ===========================================================================

-- 4a. Every public table with RLS and its policy count
SELECT
  c.relname AS table_name,
  c.relrowsecurity AS rls_enabled,
  COUNT(p.oid)::int AS policy_count
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
LEFT JOIN pg_policy p ON p.polrelid = c.oid
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
GROUP BY c.relname, c.relrowsecurity
ORDER BY c.relname;

-- 4b. Policies on tables that HAVE business_id whose definition contains
--     is_admin() but not current_business_id(). Must be 0 rows.
--     Excludes storage.objects (left unchanged) and tables without
--     business_id (google_calendar_connections singleton).
SELECT
  c.relname AS table_name,
  p.polname AS policy_name,
  pg_get_expr(p.polqual, p.polrelid) AS using_expr,
  pg_get_expr(p.polwithcheck, p.polrelid) AS check_expr
FROM pg_policy p
JOIN pg_class c ON c.oid = p.polrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND EXISTS (
    SELECT 1 FROM pg_attribute a
    WHERE a.attrelid = c.oid
      AND a.attname = 'business_id'
      AND NOT a.attisdropped
  )
  AND (
    COALESCE(pg_get_expr(p.polqual, p.polrelid), '')
    || ' '
    || COALESCE(pg_get_expr(p.polwithcheck, p.polrelid), '')
  ) LIKE '%is_admin()%'
  AND (
    COALESCE(pg_get_expr(p.polqual, p.polrelid), '')
    || ' '
    || COALESCE(pg_get_expr(p.polwithcheck, p.polrelid), '')
  ) NOT LIKE '%current_business_id()%';

-- 4c. client_has_project_access is STABLE
SELECT
  p.proname,
  CASE p.provolatile
    WHEN 's' THEN 'STABLE'
    WHEN 'i' THEN 'IMMUTABLE'
    WHEN 'v' THEN 'VOLATILE'
  END AS volatility
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'client_has_project_access';

-- 4d. client_stats has security_invoker
SELECT
  c.relname,
  c.reloptions
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname = 'client_stats';
