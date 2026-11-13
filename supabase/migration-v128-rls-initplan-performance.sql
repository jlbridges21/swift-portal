-- V128 — RLS policy performance: evaluate session helpers once per query, not once per row
--
-- WHY
--   122 of 127 public RLS policies call argument-free session helpers bare:
--   current_business_id(), is_super_admin(), is_admin(), is_business_staff(),
--   get_user_client_id(), auth.uid(). Postgres then re-runs them (each a profiles lookup, some
--   several) for EVERY row a query touches, across every OR'd policy. is_admin() is even
--   VOLATILE, which rules out any caching. Wrapping a call as (SELECT fn()) makes Postgres
--   evaluate it once per statement (an InitPlan) — Supabase's documented RLS recommendation.
--
--   Measured 2026-11-12 on production data, as a real admin (read-only transaction):
--     activity_logs  latest 50   72.5 ms -> 0.75 ms
--     project_quotes by business 48.3 ms -> 0.33 ms
--     payments by business       12.1 ms -> 0.26 ms
--   pg_stat_statements showed the same pattern app-wide (activity_logs 100–157 ms mean,
--   project_quotes 127 ms mean, on tables of a few thousand rows).
--
-- WHAT CHANGES
--   Only the textual form of each USING / WITH CHECK expression: every bare helper call
--   becomes (SELECT helper()). Same policies, same names, roles, commands and logic. Policies
--   are altered in place (ALTER POLICY), so there is no moment without a policy.
--   Functions that take a row argument (client_has_project_access(project_id), etc.) are
--   unchanged — they still run per row, but after the cheap once-per-query checks.
--   The helpers depend only on the JWT/session (auth.uid()) and profile/business rows, so a
--   single evaluation per statement returns exactly what the per-row evaluation did.
--
-- VERIFIED (read-only, before shipping)
--   * All 193 rewritten expressions parse and plan against their tables.
--   * For 11 real users (admins, active staff, clients, shared viewers, super admin) the
--     rewritten SELECT policies return identical row counts to live RLS on all 60 tables.
--
-- ALSO: indexes on foreign keys the app filters by, or that ON DELETE CASCADE / SET NULL must
--   scan when a project, lead, payment, service or folder is deleted. Small tables today, so
--   each CREATE INDEX takes milliseconds.
--
-- Generated from the live policy definitions on 2026-11-12. If any of these policies is
-- edited before this runs, regenerate rather than apply (it would restore this snapshot).
--
-- HOW TO RUN: SQL Editor → paste → Run. Re-runnable.
-- Rollback: supabase/migration-v128-rls-initplan-rollback.sql (original expressions, verbatim).

BEGIN;

ALTER POLICY "Admins view all activity" ON public.activity_logs
  USING (((SELECT is_super_admin()) OR ((SELECT is_admin()) AND (business_id = (SELECT current_business_id())))));
ALTER POLICY "Authenticated users can log activity" ON public.activity_logs
  WITH CHECK ((((SELECT auth.uid()) IS NOT NULL) AND (business_id = (SELECT current_business_id()))));
ALTER POLICY "Clients view own activity" ON public.activity_logs
  USING (((business_id = (SELECT current_business_id())) AND (project_id IS NOT NULL) AND client_has_project_access(project_id)));
ALTER POLICY "Staff access activity_logs" ON public.activity_logs
  USING (((SELECT is_business_staff()) AND (business_id = (SELECT current_business_id())) AND ((project_id IS NULL) OR staff_can_access_project(project_id))))
  WITH CHECK (((SELECT is_business_staff()) AND (business_id = (SELECT current_business_id()))));
ALTER POLICY "Admins full access asset_reviews" ON public.asset_reviews
  USING (((SELECT is_super_admin()) OR ((SELECT is_admin()) AND (business_id = (SELECT current_business_id())))))
  WITH CHECK (((SELECT is_super_admin()) OR ((SELECT is_admin()) AND (business_id = (SELECT current_business_id())))));
ALTER POLICY "Clients manage own asset_reviews" ON public.asset_reviews
  USING (((business_id = (SELECT current_business_id())) AND client_has_project_access(project_id)))
  WITH CHECK (((business_id = (SELECT current_business_id())) AND client_has_project_access(project_id)));
ALTER POLICY "Clients view own asset_reviews" ON public.asset_reviews
  USING (((business_id = (SELECT current_business_id())) AND client_has_project_access(project_id)));
ALTER POLICY "Staff access asset_reviews" ON public.asset_reviews
  USING (((SELECT is_business_staff()) AND (business_id = (SELECT current_business_id())) AND staff_can_access_project(project_id)))
  WITH CHECK (((SELECT is_business_staff()) AND (business_id = (SELECT current_business_id())) AND staff_can_access_project(project_id)));
ALTER POLICY "Admins full access business_integrations" ON public.business_integrations
  USING (((SELECT is_super_admin()) OR ((SELECT is_admin()) AND (business_id = (SELECT current_business_id())))))
  WITH CHECK (((SELECT is_super_admin()) OR ((SELECT is_admin()) AND (business_id = (SELECT current_business_id())))));
ALTER POLICY "Admins full access business_services" ON public.business_services
  USING (((SELECT is_super_admin()) OR ((SELECT is_admin()) AND (business_id = (SELECT current_business_id())))))
  WITH CHECK (((SELECT is_super_admin()) OR ((SELECT is_admin()) AND (business_id = (SELECT current_business_id())))));
ALTER POLICY "Clients view active business_services" ON public.business_services
  USING (((business_id = (SELECT current_business_id())) AND (is_active = true) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (SELECT auth.uid())) AND (p.role = 'client'::user_role))))));
ALTER POLICY "Super admins full access business_services" ON public.business_services
  USING ((SELECT is_super_admin()))
  WITH CHECK ((SELECT is_super_admin()));
ALTER POLICY "Admins full access business_settings" ON public.business_settings
  USING (((SELECT is_super_admin()) OR ((SELECT is_admin()) AND (business_id = (SELECT current_business_id())))))
  WITH CHECK (((SELECT is_super_admin()) OR ((SELECT is_admin()) AND (business_id = (SELECT current_business_id())))));
ALTER POLICY "Admins full access client_message_reads" ON public.client_message_reads
  USING (((SELECT is_super_admin()) OR ((SELECT is_admin()) AND (business_id = (SELECT current_business_id())))))
  WITH CHECK (((SELECT is_super_admin()) OR ((SELECT is_admin()) AND (business_id = (SELECT current_business_id())))));
ALTER POLICY "Users manage own client_message_reads" ON public.client_message_reads
  USING ((user_id = (SELECT auth.uid())))
  WITH CHECK ((user_id = (SELECT auth.uid())));
ALTER POLICY "Admins full access client_messages" ON public.client_messages
  USING (((SELECT is_super_admin()) OR ((SELECT is_admin()) AND (business_id = (SELECT current_business_id())))))
  WITH CHECK (((SELECT is_super_admin()) OR ((SELECT is_admin()) AND (business_id = (SELECT current_business_id())))));
ALTER POLICY "Clients insert own client_messages" ON public.client_messages
  WITH CHECK (((business_id = (SELECT current_business_id())) AND (client_id = (SELECT get_user_client_id())) AND (sender_user_id = (SELECT auth.uid())) AND (sender_role = 'client'::text)));
ALTER POLICY "Clients view own client_messages" ON public.client_messages
  USING (((business_id = (SELECT current_business_id())) AND (client_id = (SELECT get_user_client_id()))));
ALTER POLICY "Staff access client_messages" ON public.client_messages
  USING (((SELECT is_business_staff()) AND (business_id = (SELECT current_business_id()))))
  WITH CHECK (((SELECT is_business_staff()) AND (business_id = (SELECT current_business_id()))));
ALTER POLICY "Admins full access client_notes" ON public.client_notes
  USING (((SELECT is_super_admin()) OR ((SELECT is_admin()) AND (business_id = (SELECT current_business_id())))))
  WITH CHECK (((SELECT is_super_admin()) OR ((SELECT is_admin()) AND (business_id = (SELECT current_business_id())))));
ALTER POLICY "Admins view client notification claims" ON public.client_notification_claims
  USING (((SELECT is_super_admin()) OR ((SELECT is_admin()) AND (business_id = (SELECT current_business_id())))));
ALTER POLICY "Admins full access clients" ON public.clients
  USING (((SELECT is_super_admin()) OR ((SELECT is_admin()) AND (business_id = (SELECT current_business_id())))))
  WITH CHECK (((SELECT is_super_admin()) OR ((SELECT is_admin()) AND (business_id = (SELECT current_business_id())))));
ALTER POLICY "Clients view own record" ON public.clients
  USING (((business_id = (SELECT current_business_id())) AND (id = (SELECT get_user_client_id()))));
ALTER POLICY "Staff access clients" ON public.clients
  USING (((SELECT is_business_staff()) AND (business_id = (SELECT current_business_id())) AND ((COALESCE(( SELECT (profiles.staff_permissions -> 'projects.view_all'::text)
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid()))), 'false'::jsonb) = 'true'::jsonb) OR (EXISTS ( SELECT 1
   FROM (project_clients pc
     JOIN project_staff ps ON (((ps.project_id = pc.project_id) AND (ps.user_id = (SELECT auth.uid())))))
  WHERE ((pc.client_id = clients.id) AND (pc.business_id = (SELECT current_business_id()))))) OR (COALESCE(( SELECT (profiles.staff_permissions -> 'area.clients'::text)
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid()))), 'false'::jsonb) = 'true'::jsonb))))
  WITH CHECK (((SELECT is_business_staff()) AND (business_id = (SELECT current_business_id()))));
ALTER POLICY "Admins full access communications" ON public.communications
  USING (((SELECT is_super_admin()) OR ((SELECT is_admin()) AND (business_id = (SELECT current_business_id())))))
  WITH CHECK (((SELECT is_super_admin()) OR ((SELECT is_admin()) AND (business_id = (SELECT current_business_id())))));
ALTER POLICY "Admins full access default_project_documents" ON public.default_project_documents
  USING (((SELECT is_super_admin()) OR ((SELECT is_admin()) AND (business_id = (SELECT current_business_id())))))
  WITH CHECK (((SELECT is_super_admin()) OR ((SELECT is_admin()) AND (business_id = (SELECT current_business_id())))));
ALTER POLICY "Admins view email events" ON public.email_events
  USING (((SELECT is_super_admin()) OR ((business_id = (SELECT current_business_id())) AND (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (SELECT auth.uid())) AND (profiles.role = 'admin'::user_role)))))));
ALTER POLICY "Admins can delete leads" ON public.leads
  USING (((SELECT is_super_admin()) OR ((SELECT is_admin()) AND (business_id = (SELECT current_business_id())))));
ALTER POLICY "Admins can update leads" ON public.leads
  USING (((SELECT is_super_admin()) OR ((SELECT is_admin()) AND (business_id = (SELECT current_business_id())))));
ALTER POLICY "Admins can view leads" ON public.leads
  USING (((SELECT is_super_admin()) OR ((SELECT is_admin()) AND (business_id = (SELECT current_business_id())))));
ALTER POLICY "Admins full access media_asset_events" ON public.media_asset_events
  USING (((SELECT is_super_admin()) OR ((SELECT is_admin()) AND (business_id = (SELECT current_business_id())))))
  WITH CHECK (((SELECT is_super_admin()) OR ((SELECT is_admin()) AND (business_id = (SELECT current_business_id())))));
ALTER POLICY "Admins full access media_asset_tags" ON public.media_asset_tags
  USING (((SELECT is_super_admin()) OR ((SELECT is_admin()) AND (business_id = (SELECT current_business_id())))))
  WITH CHECK (((SELECT is_super_admin()) OR ((SELECT is_admin()) AND (business_id = (SELECT current_business_id())))));
ALTER POLICY "Clients view tags on accessible media" ON public.media_asset_tags
  USING (((business_id = (SELECT current_business_id())) AND (EXISTS ( SELECT 1
   FROM media_assets m
  WHERE ((m.id = media_asset_tags.media_asset_id) AND client_has_project_access(m.project_id))))));
ALTER POLICY "Admins full access media" ON public.media_assets
  USING (((SELECT is_super_admin()) OR ((SELECT is_admin()) AND (business_id = (SELECT current_business_id())))))
  WITH CHECK (((SELECT is_super_admin()) OR ((SELECT is_admin()) AND (business_id = (SELECT current_business_id())))));
ALTER POLICY "Clients view own media" ON public.media_assets
  USING ((client_has_project_access(project_id) AND ((business_id = (SELECT current_business_id())) OR user_has_active_project_share(project_id))));
ALTER POLICY "Staff access media_assets" ON public.media_assets
  USING (((SELECT is_business_staff()) AND (business_id = (SELECT current_business_id())) AND ((project_id IS NULL) OR staff_can_access_project(project_id))))
  WITH CHECK (((SELECT is_business_staff()) AND (business_id = (SELECT current_business_id())) AND ((project_id IS NULL) OR staff_can_access_project(project_id))));
ALTER POLICY "Admins full access media_downloads" ON public.media_downloads
  USING (((SELECT is_super_admin()) OR ((SELECT is_admin()) AND (business_id = (SELECT current_business_id())))))
  WITH CHECK (((SELECT is_super_admin()) OR ((SELECT is_admin()) AND (business_id = (SELECT current_business_id())))));
ALTER POLICY "Admins full access media_folders" ON public.media_folders
  USING (((SELECT is_super_admin()) OR ((SELECT is_admin()) AND (business_id = (SELECT current_business_id())))))
  WITH CHECK (((SELECT is_super_admin()) OR ((SELECT is_admin()) AND (business_id = (SELECT current_business_id())))));
ALTER POLICY "Clients view own media_folders" ON public.media_folders
  USING ((client_has_project_access(project_id) AND ((business_id = (SELECT current_business_id())) OR user_has_active_project_share(project_id))));
ALTER POLICY "Staff access media_folders" ON public.media_folders
  USING (((SELECT is_business_staff()) AND (business_id = (SELECT current_business_id())) AND staff_can_access_project(project_id)))
  WITH CHECK (((SELECT is_business_staff()) AND (business_id = (SELECT current_business_id())) AND staff_can_access_project(project_id)));
ALTER POLICY "Service can insert notifications" ON public.notifications
  WITH CHECK ((business_id = (SELECT current_business_id())));
ALTER POLICY "Staff read own notifications" ON public.notifications
  USING (((SELECT is_business_staff()) AND (user_id = (SELECT auth.uid()))));
ALTER POLICY "Users update own notifications" ON public.notifications
  USING (((SELECT auth.uid()) = user_id));
ALTER POLICY "Users view own notifications" ON public.notifications
  USING (((SELECT auth.uid()) = user_id));
ALTER POLICY "Super admins manage partner applications" ON public.partner_applications
  USING ((SELECT is_super_admin()))
  WITH CHECK ((SELECT is_super_admin()));
ALTER POLICY "Partners read own commissions" ON public.partner_commissions
  USING ((partner_id IN ( SELECT partners.id
   FROM partners
  WHERE ((partners.user_id IS NOT NULL) AND (partners.user_id = (SELECT auth.uid()))))));
ALTER POLICY "Super admins manage partner commissions" ON public.partner_commissions
  USING ((SELECT is_super_admin()))
  WITH CHECK ((SELECT is_super_admin()));
ALTER POLICY "Super admins read partner email sends" ON public.partner_email_sends
  USING ((SELECT is_super_admin()));
ALTER POLICY "Super admins manage partner landing pages" ON public.partner_landing_pages
  USING ((SELECT is_super_admin()))
  WITH CHECK ((SELECT is_super_admin()));
ALTER POLICY "Super admins manage partner landing slug aliases" ON public.partner_landing_slug_aliases
  USING ((SELECT is_super_admin()))
  WITH CHECK ((SELECT is_super_admin()));
ALTER POLICY "Partners read own payout run items" ON public.partner_payout_run_items
  USING ((partner_id IN ( SELECT partners.id
   FROM partners
  WHERE ((partners.user_id IS NOT NULL) AND (partners.user_id = (SELECT auth.uid()))))));
ALTER POLICY "Super admins manage partner payout run items" ON public.partner_payout_run_items
  USING ((SELECT is_super_admin()))
  WITH CHECK ((SELECT is_super_admin()));
ALTER POLICY "Super admins manage partner payout runs" ON public.partner_payout_runs
  USING ((SELECT is_super_admin()))
  WITH CHECK ((SELECT is_super_admin()));
ALTER POLICY "Partners read own payouts" ON public.partner_payouts
  USING ((partner_id IN ( SELECT partners.id
   FROM partners
  WHERE ((partners.user_id IS NOT NULL) AND (partners.user_id = (SELECT auth.uid()))))));
ALTER POLICY "Super admins manage partner payouts" ON public.partner_payouts
  USING ((SELECT is_super_admin()))
  WITH CHECK ((SELECT is_super_admin()));
ALTER POLICY "Super admins manage partner program settings" ON public.partner_program_settings
  USING ((SELECT is_super_admin()))
  WITH CHECK ((SELECT is_super_admin()));
ALTER POLICY "Super admins manage partner referral attribution events" ON public.partner_referral_attribution_events
  USING ((SELECT is_super_admin()))
  WITH CHECK ((SELECT is_super_admin()));
ALTER POLICY "Super admins manage partner referral discount coupons" ON public.partner_referral_discount_stripe_coupons
  USING ((SELECT is_super_admin()))
  WITH CHECK ((SELECT is_super_admin()));
ALTER POLICY "Super admins read partner referral removals" ON public.partner_referral_removals
  USING ((SELECT is_super_admin()));
ALTER POLICY "Super admins manage partner referrals" ON public.partner_referrals
  USING ((SELECT is_super_admin()))
  WITH CHECK ((SELECT is_super_admin()));
ALTER POLICY "Partners read own row" ON public.partners
  USING (((user_id IS NOT NULL) AND (user_id = (SELECT auth.uid()))));
ALTER POLICY "Super admins manage partners" ON public.partners
  USING ((SELECT is_super_admin()))
  WITH CHECK ((SELECT is_super_admin()));
ALTER POLICY "Admins full access payments" ON public.payments
  USING (((SELECT is_super_admin()) OR ((SELECT is_admin()) AND (business_id = (SELECT current_business_id())))))
  WITH CHECK (((SELECT is_super_admin()) OR ((SELECT is_admin()) AND (business_id = (SELECT current_business_id())))));
ALTER POLICY "Clients view own payments" ON public.payments
  USING (((business_id = (SELECT current_business_id())) AND ((client_id = (SELECT get_user_client_id())) OR ((project_id IS NOT NULL) AND client_has_project_access(project_id)))));
ALTER POLICY "Staff access payments" ON public.payments
  USING (((SELECT is_business_staff()) AND (business_id = (SELECT current_business_id())) AND staff_can_access_project(project_id)))
  WITH CHECK (((SELECT is_business_staff()) AND (business_id = (SELECT current_business_id())) AND staff_can_access_project(project_id)));
ALTER POLICY "Super admins manage plan_stripe_prices" ON public.plan_stripe_prices
  USING ((SELECT is_super_admin()))
  WITH CHECK ((SELECT is_super_admin()));
ALTER POLICY "Super admins manage plans" ON public.plans
  USING ((SELECT is_super_admin()))
  WITH CHECK ((SELECT is_super_admin()));
ALTER POLICY "Super admins read platform audit log" ON public.platform_audit_log
  USING ((SELECT is_super_admin()));
ALTER POLICY "Super admins read platform email sends" ON public.platform_email_sends
  USING ((SELECT is_super_admin()));
ALTER POLICY "Super admins manage platform email templates" ON public.platform_email_templates
  USING ((SELECT is_super_admin()))
  WITH CHECK ((SELECT is_super_admin()));
ALTER POLICY "Super admins read platform_subscription_payments" ON public.platform_subscription_payments
  USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (SELECT auth.uid())) AND (profiles.role = 'super_admin'::user_role)))));
ALTER POLICY "Admins can insert profiles" ON public.profiles
  WITH CHECK (((SELECT is_super_admin()) OR ((SELECT is_admin()) AND (business_id = (SELECT current_business_id()))) OR ((SELECT auth.uid()) = id)));
ALTER POLICY "Users can update own profile" ON public.profiles
  USING ((((SELECT auth.uid()) = id) OR (SELECT is_super_admin()) OR ((SELECT is_admin()) AND (business_id = (SELECT current_business_id())))))
  WITH CHECK ((((SELECT auth.uid()) = id) OR (SELECT is_super_admin()) OR ((SELECT is_admin()) AND (business_id = (SELECT current_business_id())))));
ALTER POLICY "Users can view own profile" ON public.profiles
  USING ((((SELECT auth.uid()) = id) OR (SELECT is_super_admin()) OR ((SELECT is_admin()) AND (business_id = (SELECT current_business_id())))));
ALTER POLICY "Admins full access project_3d_models" ON public.project_3d_models
  USING (((SELECT is_super_admin()) OR ((SELECT is_admin()) AND (business_id = (SELECT current_business_id())))))
  WITH CHECK (((SELECT is_super_admin()) OR ((SELECT is_admin()) AND (business_id = (SELECT current_business_id())))));
ALTER POLICY "Clients view own project_3d_models" ON public.project_3d_models
  USING ((client_has_project_access(project_id) AND ((business_id = (SELECT current_business_id())) OR user_has_active_project_share(project_id))));
ALTER POLICY "Staff access project_3d_models" ON public.project_3d_models
  USING (((SELECT is_business_staff()) AND (business_id = (SELECT current_business_id())) AND staff_can_access_project(project_id)))
  WITH CHECK (((SELECT is_business_staff()) AND (business_id = (SELECT current_business_id())) AND staff_can_access_project(project_id)));
ALTER POLICY "Admins full access project_clients" ON public.project_clients
  USING (((SELECT is_super_admin()) OR ((SELECT is_admin()) AND (business_id = (SELECT current_business_id())))))
  WITH CHECK (((SELECT is_super_admin()) OR ((SELECT is_admin()) AND (business_id = (SELECT current_business_id())))));
ALTER POLICY "Clients view own project_clients" ON public.project_clients
  USING (((business_id = (SELECT current_business_id())) AND (client_id = (SELECT get_user_client_id()))));
ALTER POLICY "Staff access project_clients" ON public.project_clients
  USING (((SELECT is_business_staff()) AND (business_id = (SELECT current_business_id())) AND staff_can_access_project(project_id)))
  WITH CHECK (((SELECT is_business_staff()) AND (business_id = (SELECT current_business_id())) AND staff_can_access_project(project_id)));
ALTER POLICY "Admins full access project_message_reads" ON public.project_message_reads
  USING (((SELECT is_super_admin()) OR ((SELECT is_admin()) AND (business_id = (SELECT current_business_id())))))
  WITH CHECK (((SELECT is_super_admin()) OR ((SELECT is_admin()) AND (business_id = (SELECT current_business_id())))));
ALTER POLICY "Users manage own message reads" ON public.project_message_reads
  USING ((user_id = (SELECT auth.uid())))
  WITH CHECK ((user_id = (SELECT auth.uid())));
ALTER POLICY "Admins full access project_messages" ON public.project_messages
  USING (((SELECT is_super_admin()) OR ((SELECT is_admin()) AND (business_id = (SELECT current_business_id())))))
  WITH CHECK (((SELECT is_super_admin()) OR ((SELECT is_admin()) AND (business_id = (SELECT current_business_id())))));
ALTER POLICY "Clients insert project messages" ON public.project_messages
  WITH CHECK (((business_id = (SELECT current_business_id())) AND client_has_project_access(project_id) AND (sender_user_id = (SELECT auth.uid())) AND (sender_role = 'client'::text)));
ALTER POLICY "Clients view project messages" ON public.project_messages
  USING (((business_id = (SELECT current_business_id())) AND client_has_project_access(project_id)));
ALTER POLICY "Staff access project_messages" ON public.project_messages
  USING (((SELECT is_business_staff()) AND (business_id = (SELECT current_business_id())) AND staff_can_access_project(project_id)))
  WITH CHECK (((SELECT is_business_staff()) AND (business_id = (SELECT current_business_id())) AND staff_can_access_project(project_id)));
ALTER POLICY "Admins full access project_quotes" ON public.project_quotes
  USING (((SELECT is_super_admin()) OR ((SELECT is_admin()) AND (business_id = (SELECT current_business_id())))))
  WITH CHECK (((SELECT is_super_admin()) OR ((SELECT is_admin()) AND (business_id = (SELECT current_business_id())))));
ALTER POLICY "Clients update own project_quotes" ON public.project_quotes
  USING (((business_id = (SELECT current_business_id())) AND client_has_project_access(project_id)));
ALTER POLICY "Clients view own project_quotes" ON public.project_quotes
  USING (((business_id = (SELECT current_business_id())) AND client_has_project_access(project_id)));
ALTER POLICY "Staff access project_quotes" ON public.project_quotes
  USING (((SELECT is_business_staff()) AND (business_id = (SELECT current_business_id())) AND staff_can_access_project(project_id)))
  WITH CHECK (((SELECT is_business_staff()) AND (business_id = (SELECT current_business_id())) AND staff_can_access_project(project_id)));
ALTER POLICY "Admins full access project_shares" ON public.project_shares
  USING (((SELECT is_super_admin()) OR ((SELECT is_admin()) AND (business_id = (SELECT current_business_id())))))
  WITH CHECK (((SELECT is_super_admin()) OR ((SELECT is_admin()) AND (business_id = (SELECT current_business_id())))));
ALTER POLICY "Shared viewers read own project_shares" ON public.project_shares
  USING (((revoked_at IS NULL) AND (lower(email) = lower(COALESCE(( SELECT profiles.email
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid()))), ''::text)))));
ALTER POLICY "Admins full access project_staff" ON public.project_staff
  USING (((SELECT is_super_admin()) OR ((SELECT is_admin()) AND (business_id = (SELECT current_business_id())))))
  WITH CHECK (((SELECT is_super_admin()) OR ((SELECT is_admin()) AND (business_id = (SELECT current_business_id())))));
ALTER POLICY "Staff manage project_staff" ON public.project_staff
  USING (((SELECT is_business_staff()) AND (business_id = (SELECT current_business_id()))))
  WITH CHECK (((SELECT is_business_staff()) AND (business_id = (SELECT current_business_id()))));
ALTER POLICY "Staff read own project_staff" ON public.project_staff
  USING (((user_id = (SELECT auth.uid())) AND (business_id = (SELECT current_business_id())) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (SELECT auth.uid())) AND (p.role = 'staff'::user_role) AND (p.disabled_at IS NULL))))));
ALTER POLICY "Admins full access projects" ON public.projects
  USING (((SELECT is_super_admin()) OR ((SELECT is_admin()) AND (business_id = (SELECT current_business_id())))))
  WITH CHECK (((SELECT is_super_admin()) OR ((SELECT is_admin()) AND (business_id = (SELECT current_business_id())))));
ALTER POLICY "Clients view own projects" ON public.projects
  USING (((deleted_at IS NULL) AND (((business_id = (SELECT current_business_id())) AND ((client_id = (SELECT get_user_client_id())) OR client_has_project_access(id))) OR user_has_active_project_share(id))));
ALTER POLICY "Staff access projects" ON public.projects
  USING (((SELECT is_business_staff()) AND (business_id = (SELECT current_business_id())) AND staff_can_access_project(id)))
  WITH CHECK (((SELECT is_business_staff()) AND (business_id = (SELECT current_business_id()))));
ALTER POLICY "Admins full access properties" ON public.properties
  USING (((SELECT is_super_admin()) OR ((SELECT is_admin()) AND (business_id = (SELECT current_business_id())))))
  WITH CHECK (((SELECT is_super_admin()) OR ((SELECT is_admin()) AND (business_id = (SELECT current_business_id())))));
ALTER POLICY "Clients view own properties" ON public.properties
  USING (((business_id = (SELECT current_business_id())) AND ((client_id = (SELECT get_user_client_id())) OR (EXISTS ( SELECT 1
   FROM projects p
  WHERE ((p.property_id = properties.id) AND client_has_project_access(p.id)))))));
ALTER POLICY "Admins full access revisions" ON public.revisions
  USING (((SELECT is_super_admin()) OR ((SELECT is_admin()) AND (business_id = (SELECT current_business_id())))))
  WITH CHECK (((SELECT is_super_admin()) OR ((SELECT is_admin()) AND (business_id = (SELECT current_business_id())))));
ALTER POLICY "Clients create revisions" ON public.revisions
  WITH CHECK (((business_id = (SELECT current_business_id())) AND (client_id = (SELECT get_user_client_id())) AND ((project_id IS NULL) OR client_has_project_access(project_id))));
ALTER POLICY "Clients view own revisions" ON public.revisions
  USING (((business_id = (SELECT current_business_id())) AND ((client_id = (SELECT get_user_client_id())) OR ((project_id IS NOT NULL) AND client_has_project_access(project_id)))));
ALTER POLICY "Staff access revisions" ON public.revisions
  USING (((SELECT is_business_staff()) AND (business_id = (SELECT current_business_id())) AND staff_can_access_project(project_id)))
  WITH CHECK (((SELECT is_business_staff()) AND (business_id = (SELECT current_business_id())) AND staff_can_access_project(project_id)));
ALTER POLICY "Admins full access shoot_proposals" ON public.shoot_proposals
  USING (((SELECT is_super_admin()) OR ((SELECT is_admin()) AND (business_id = (SELECT current_business_id())))))
  WITH CHECK (((SELECT is_super_admin()) OR ((SELECT is_admin()) AND (business_id = (SELECT current_business_id())))));
ALTER POLICY "Clients create shoot_proposals" ON public.shoot_proposals
  WITH CHECK (((business_id = (SELECT current_business_id())) AND client_has_project_access(project_id) AND (proposed_by = 'client'::text)));
ALTER POLICY "Clients update own counter proposals" ON public.shoot_proposals
  USING (((business_id = (SELECT current_business_id())) AND client_has_project_access(project_id)));
ALTER POLICY "Clients view own shoot_proposals" ON public.shoot_proposals
  USING (((business_id = (SELECT current_business_id())) AND client_has_project_access(project_id)));
ALTER POLICY "Staff access shoot_proposals" ON public.shoot_proposals
  USING (((SELECT is_business_staff()) AND (business_id = (SELECT current_business_id())) AND staff_can_access_project(project_id)))
  WITH CHECK (((SELECT is_business_staff()) AND (business_id = (SELECT current_business_id())) AND staff_can_access_project(project_id)));
ALTER POLICY "Admins full access tours" ON public.tours
  USING (((SELECT is_super_admin()) OR ((SELECT is_admin()) AND (business_id = (SELECT current_business_id())))))
  WITH CHECK (((SELECT is_super_admin()) OR ((SELECT is_admin()) AND (business_id = (SELECT current_business_id())))));
ALTER POLICY "Clients view own tours" ON public.tours
  USING ((client_has_project_access(project_id) AND ((business_id = (SELECT current_business_id())) OR user_has_active_project_share(project_id))));
ALTER POLICY "Staff access tours" ON public.tours
  USING (((SELECT is_business_staff()) AND (business_id = (SELECT current_business_id())) AND staff_can_access_project(project_id)))
  WITH CHECK (((SELECT is_business_staff()) AND (business_id = (SELECT current_business_id())) AND staff_can_access_project(project_id)));
ALTER POLICY "Admins full access video_review_comments" ON public.video_review_comments
  USING (((SELECT is_super_admin()) OR ((SELECT is_admin()) AND (business_id = (SELECT current_business_id())))))
  WITH CHECK (((SELECT is_super_admin()) OR ((SELECT is_admin()) AND (business_id = (SELECT current_business_id())))));
ALTER POLICY "Clients manage own video_review_comments" ON public.video_review_comments
  USING ((client_has_project_access(project_id) AND ((business_id = (SELECT current_business_id())) OR user_has_active_project_share(project_id)) AND (author_kind = 'client'::text) AND (author_user_id = (SELECT auth.uid()))))
  WITH CHECK ((client_has_project_access(project_id) AND ((business_id = (SELECT current_business_id())) OR user_has_active_project_share(project_id)) AND (author_kind = 'client'::text) AND (author_user_id = (SELECT auth.uid()))));
ALTER POLICY "Clients view own video_review_comments" ON public.video_review_comments
  USING ((client_has_project_access(project_id) AND ((business_id = (SELECT current_business_id())) OR user_has_active_project_share(project_id))));
ALTER POLICY "Admins full access video_review_notification_batches" ON public.video_review_notification_batches
  USING (((SELECT is_super_admin()) OR ((SELECT is_admin()) AND (business_id = (SELECT current_business_id())))))
  WITH CHECK (((SELECT is_super_admin()) OR ((SELECT is_admin()) AND (business_id = (SELECT current_business_id())))));
ALTER POLICY "Admins full access video_review_notification_sends" ON public.video_review_notification_sends
  USING (((SELECT is_super_admin()) OR ((SELECT is_admin()) AND (business_id = (SELECT current_business_id())))))
  WITH CHECK (((SELECT is_super_admin()) OR ((SELECT is_admin()) AND (business_id = (SELECT current_business_id())))));
ALTER POLICY "Admins full access video_review_versions" ON public.video_review_versions
  USING (((SELECT is_super_admin()) OR ((SELECT is_admin()) AND (business_id = (SELECT current_business_id())))))
  WITH CHECK (((SELECT is_super_admin()) OR ((SELECT is_admin()) AND (business_id = (SELECT current_business_id())))));
ALTER POLICY "Clients view own video_review_versions" ON public.video_review_versions
  USING ((EXISTS ( SELECT 1
   FROM video_reviews vr
  WHERE ((vr.id = video_review_versions.review_id) AND client_has_project_access(vr.project_id) AND ((vr.business_id = (SELECT current_business_id())) OR user_has_active_project_share(vr.project_id))))));
ALTER POLICY "Admins full access video_reviews" ON public.video_reviews
  USING (((SELECT is_super_admin()) OR ((SELECT is_admin()) AND (business_id = (SELECT current_business_id())))))
  WITH CHECK (((SELECT is_super_admin()) OR ((SELECT is_admin()) AND (business_id = (SELECT current_business_id())))));
ALTER POLICY "Clients view own video_reviews" ON public.video_reviews
  USING ((client_has_project_access(project_id) AND ((business_id = (SELECT current_business_id())) OR user_has_active_project_share(project_id))));
ALTER POLICY "Staff access video_reviews" ON public.video_reviews
  USING (((SELECT is_business_staff()) AND (business_id = (SELECT current_business_id())) AND staff_can_access_project(project_id)))
  WITH CHECK (((SELECT is_business_staff()) AND (business_id = (SELECT current_business_id())) AND staff_can_access_project(project_id)));

-- Foreign-key / filter indexes
CREATE INDEX IF NOT EXISTS idx_notifications_project_id ON public.notifications (project_id);
CREATE INDEX IF NOT EXISTS idx_notifications_payment_id ON public.notifications (payment_id);
CREATE INDEX IF NOT EXISTS idx_media_assets_folder_id ON public.media_assets (folder_id);
CREATE INDEX IF NOT EXISTS idx_media_asset_events_project_id ON public.media_asset_events (project_id);
CREATE INDEX IF NOT EXISTS idx_project_services_service_id ON public.project_services (service_id);
CREATE INDEX IF NOT EXISTS idx_leads_project_id ON public.leads (project_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_lead_id ON public.activity_logs (lead_id);
CREATE INDEX IF NOT EXISTS idx_client_notification_claims_project_id ON public.client_notification_claims (project_id);
CREATE INDEX IF NOT EXISTS idx_vr_notification_batches_review_id ON public.video_review_notification_batches (review_id);
CREATE INDEX IF NOT EXISTS idx_vr_notification_batches_project_id ON public.video_review_notification_batches (project_id);

COMMIT;
