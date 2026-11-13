-- V128 ROLLBACK — restores the 122 RLS policy expressions exactly as they were on 2026-11-12
-- (captured verbatim from pg_policies) and drops the V128 indexes.
-- HOW TO RUN: SQL Editor → paste → Run.

BEGIN;

ALTER POLICY "Admins view all activity" ON public.activity_logs
  USING ((is_super_admin() OR (is_admin() AND (business_id = current_business_id()))));
ALTER POLICY "Authenticated users can log activity" ON public.activity_logs
  WITH CHECK (((auth.uid() IS NOT NULL) AND (business_id = current_business_id())));
ALTER POLICY "Clients view own activity" ON public.activity_logs
  USING (((business_id = current_business_id()) AND (project_id IS NOT NULL) AND client_has_project_access(project_id)));
ALTER POLICY "Staff access activity_logs" ON public.activity_logs
  USING ((is_business_staff() AND (business_id = current_business_id()) AND ((project_id IS NULL) OR staff_can_access_project(project_id))))
  WITH CHECK ((is_business_staff() AND (business_id = current_business_id())));
ALTER POLICY "Admins full access asset_reviews" ON public.asset_reviews
  USING ((is_super_admin() OR (is_admin() AND (business_id = current_business_id()))))
  WITH CHECK ((is_super_admin() OR (is_admin() AND (business_id = current_business_id()))));
ALTER POLICY "Clients manage own asset_reviews" ON public.asset_reviews
  USING (((business_id = current_business_id()) AND client_has_project_access(project_id)))
  WITH CHECK (((business_id = current_business_id()) AND client_has_project_access(project_id)));
ALTER POLICY "Clients view own asset_reviews" ON public.asset_reviews
  USING (((business_id = current_business_id()) AND client_has_project_access(project_id)));
ALTER POLICY "Staff access asset_reviews" ON public.asset_reviews
  USING ((is_business_staff() AND (business_id = current_business_id()) AND staff_can_access_project(project_id)))
  WITH CHECK ((is_business_staff() AND (business_id = current_business_id()) AND staff_can_access_project(project_id)));
ALTER POLICY "Admins full access business_integrations" ON public.business_integrations
  USING ((is_super_admin() OR (is_admin() AND (business_id = current_business_id()))))
  WITH CHECK ((is_super_admin() OR (is_admin() AND (business_id = current_business_id()))));
ALTER POLICY "Admins full access business_services" ON public.business_services
  USING ((is_super_admin() OR (is_admin() AND (business_id = current_business_id()))))
  WITH CHECK ((is_super_admin() OR (is_admin() AND (business_id = current_business_id()))));
ALTER POLICY "Clients view active business_services" ON public.business_services
  USING (((business_id = current_business_id()) AND (is_active = true) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'client'::user_role))))));
ALTER POLICY "Super admins full access business_services" ON public.business_services
  USING (is_super_admin())
  WITH CHECK (is_super_admin());
ALTER POLICY "Admins full access business_settings" ON public.business_settings
  USING ((is_super_admin() OR (is_admin() AND (business_id = current_business_id()))))
  WITH CHECK ((is_super_admin() OR (is_admin() AND (business_id = current_business_id()))));
ALTER POLICY "Admins full access client_message_reads" ON public.client_message_reads
  USING ((is_super_admin() OR (is_admin() AND (business_id = current_business_id()))))
  WITH CHECK ((is_super_admin() OR (is_admin() AND (business_id = current_business_id()))));
ALTER POLICY "Users manage own client_message_reads" ON public.client_message_reads
  USING ((user_id = auth.uid()))
  WITH CHECK ((user_id = auth.uid()));
ALTER POLICY "Admins full access client_messages" ON public.client_messages
  USING ((is_super_admin() OR (is_admin() AND (business_id = current_business_id()))))
  WITH CHECK ((is_super_admin() OR (is_admin() AND (business_id = current_business_id()))));
ALTER POLICY "Clients insert own client_messages" ON public.client_messages
  WITH CHECK (((business_id = current_business_id()) AND (client_id = get_user_client_id()) AND (sender_user_id = auth.uid()) AND (sender_role = 'client'::text)));
ALTER POLICY "Clients view own client_messages" ON public.client_messages
  USING (((business_id = current_business_id()) AND (client_id = get_user_client_id())));
ALTER POLICY "Staff access client_messages" ON public.client_messages
  USING ((is_business_staff() AND (business_id = current_business_id())))
  WITH CHECK ((is_business_staff() AND (business_id = current_business_id())));
ALTER POLICY "Admins full access client_notes" ON public.client_notes
  USING ((is_super_admin() OR (is_admin() AND (business_id = current_business_id()))))
  WITH CHECK ((is_super_admin() OR (is_admin() AND (business_id = current_business_id()))));
ALTER POLICY "Admins view client notification claims" ON public.client_notification_claims
  USING ((is_super_admin() OR (is_admin() AND (business_id = current_business_id()))));
ALTER POLICY "Admins full access clients" ON public.clients
  USING ((is_super_admin() OR (is_admin() AND (business_id = current_business_id()))))
  WITH CHECK ((is_super_admin() OR (is_admin() AND (business_id = current_business_id()))));
ALTER POLICY "Clients view own record" ON public.clients
  USING (((business_id = current_business_id()) AND (id = get_user_client_id())));
ALTER POLICY "Staff access clients" ON public.clients
  USING ((is_business_staff() AND (business_id = current_business_id()) AND ((COALESCE(( SELECT (profiles.staff_permissions -> 'projects.view_all'::text)
   FROM profiles
  WHERE (profiles.id = auth.uid())), 'false'::jsonb) = 'true'::jsonb) OR (EXISTS ( SELECT 1
   FROM (project_clients pc
     JOIN project_staff ps ON (((ps.project_id = pc.project_id) AND (ps.user_id = auth.uid()))))
  WHERE ((pc.client_id = clients.id) AND (pc.business_id = current_business_id())))) OR (COALESCE(( SELECT (profiles.staff_permissions -> 'area.clients'::text)
   FROM profiles
  WHERE (profiles.id = auth.uid())), 'false'::jsonb) = 'true'::jsonb))))
  WITH CHECK ((is_business_staff() AND (business_id = current_business_id())));
ALTER POLICY "Admins full access communications" ON public.communications
  USING ((is_super_admin() OR (is_admin() AND (business_id = current_business_id()))))
  WITH CHECK ((is_super_admin() OR (is_admin() AND (business_id = current_business_id()))));
ALTER POLICY "Admins full access default_project_documents" ON public.default_project_documents
  USING ((is_super_admin() OR (is_admin() AND (business_id = current_business_id()))))
  WITH CHECK ((is_super_admin() OR (is_admin() AND (business_id = current_business_id()))));
ALTER POLICY "Admins view email events" ON public.email_events
  USING ((is_super_admin() OR ((business_id = current_business_id()) AND (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::user_role)))))));
ALTER POLICY "Admins can delete leads" ON public.leads
  USING ((is_super_admin() OR (is_admin() AND (business_id = current_business_id()))));
ALTER POLICY "Admins can update leads" ON public.leads
  USING ((is_super_admin() OR (is_admin() AND (business_id = current_business_id()))));
ALTER POLICY "Admins can view leads" ON public.leads
  USING ((is_super_admin() OR (is_admin() AND (business_id = current_business_id()))));
ALTER POLICY "Admins full access media_asset_events" ON public.media_asset_events
  USING ((is_super_admin() OR (is_admin() AND (business_id = current_business_id()))))
  WITH CHECK ((is_super_admin() OR (is_admin() AND (business_id = current_business_id()))));
ALTER POLICY "Admins full access media_asset_tags" ON public.media_asset_tags
  USING ((is_super_admin() OR (is_admin() AND (business_id = current_business_id()))))
  WITH CHECK ((is_super_admin() OR (is_admin() AND (business_id = current_business_id()))));
ALTER POLICY "Clients view tags on accessible media" ON public.media_asset_tags
  USING (((business_id = current_business_id()) AND (EXISTS ( SELECT 1
   FROM media_assets m
  WHERE ((m.id = media_asset_tags.media_asset_id) AND client_has_project_access(m.project_id))))));
ALTER POLICY "Admins full access media" ON public.media_assets
  USING ((is_super_admin() OR (is_admin() AND (business_id = current_business_id()))))
  WITH CHECK ((is_super_admin() OR (is_admin() AND (business_id = current_business_id()))));
ALTER POLICY "Clients view own media" ON public.media_assets
  USING ((client_has_project_access(project_id) AND ((business_id = current_business_id()) OR user_has_active_project_share(project_id))));
ALTER POLICY "Staff access media_assets" ON public.media_assets
  USING ((is_business_staff() AND (business_id = current_business_id()) AND ((project_id IS NULL) OR staff_can_access_project(project_id))))
  WITH CHECK ((is_business_staff() AND (business_id = current_business_id()) AND ((project_id IS NULL) OR staff_can_access_project(project_id))));
ALTER POLICY "Admins full access media_downloads" ON public.media_downloads
  USING ((is_super_admin() OR (is_admin() AND (business_id = current_business_id()))))
  WITH CHECK ((is_super_admin() OR (is_admin() AND (business_id = current_business_id()))));
ALTER POLICY "Admins full access media_folders" ON public.media_folders
  USING ((is_super_admin() OR (is_admin() AND (business_id = current_business_id()))))
  WITH CHECK ((is_super_admin() OR (is_admin() AND (business_id = current_business_id()))));
ALTER POLICY "Clients view own media_folders" ON public.media_folders
  USING ((client_has_project_access(project_id) AND ((business_id = current_business_id()) OR user_has_active_project_share(project_id))));
ALTER POLICY "Staff access media_folders" ON public.media_folders
  USING ((is_business_staff() AND (business_id = current_business_id()) AND staff_can_access_project(project_id)))
  WITH CHECK ((is_business_staff() AND (business_id = current_business_id()) AND staff_can_access_project(project_id)));
ALTER POLICY "Service can insert notifications" ON public.notifications
  WITH CHECK ((business_id = current_business_id()));
ALTER POLICY "Staff read own notifications" ON public.notifications
  USING ((is_business_staff() AND (user_id = auth.uid())));
ALTER POLICY "Users update own notifications" ON public.notifications
  USING ((auth.uid() = user_id));
ALTER POLICY "Users view own notifications" ON public.notifications
  USING ((auth.uid() = user_id));
ALTER POLICY "Super admins manage partner applications" ON public.partner_applications
  USING (is_super_admin())
  WITH CHECK (is_super_admin());
ALTER POLICY "Partners read own commissions" ON public.partner_commissions
  USING ((partner_id IN ( SELECT partners.id
   FROM partners
  WHERE ((partners.user_id IS NOT NULL) AND (partners.user_id = auth.uid())))));
ALTER POLICY "Super admins manage partner commissions" ON public.partner_commissions
  USING (is_super_admin())
  WITH CHECK (is_super_admin());
ALTER POLICY "Super admins read partner email sends" ON public.partner_email_sends
  USING (is_super_admin());
ALTER POLICY "Super admins manage partner landing pages" ON public.partner_landing_pages
  USING (is_super_admin())
  WITH CHECK (is_super_admin());
ALTER POLICY "Super admins manage partner landing slug aliases" ON public.partner_landing_slug_aliases
  USING (is_super_admin())
  WITH CHECK (is_super_admin());
ALTER POLICY "Partners read own payout run items" ON public.partner_payout_run_items
  USING ((partner_id IN ( SELECT partners.id
   FROM partners
  WHERE ((partners.user_id IS NOT NULL) AND (partners.user_id = auth.uid())))));
ALTER POLICY "Super admins manage partner payout run items" ON public.partner_payout_run_items
  USING (is_super_admin())
  WITH CHECK (is_super_admin());
ALTER POLICY "Super admins manage partner payout runs" ON public.partner_payout_runs
  USING (is_super_admin())
  WITH CHECK (is_super_admin());
ALTER POLICY "Partners read own payouts" ON public.partner_payouts
  USING ((partner_id IN ( SELECT partners.id
   FROM partners
  WHERE ((partners.user_id IS NOT NULL) AND (partners.user_id = auth.uid())))));
ALTER POLICY "Super admins manage partner payouts" ON public.partner_payouts
  USING (is_super_admin())
  WITH CHECK (is_super_admin());
ALTER POLICY "Super admins manage partner program settings" ON public.partner_program_settings
  USING (is_super_admin())
  WITH CHECK (is_super_admin());
ALTER POLICY "Super admins manage partner referral attribution events" ON public.partner_referral_attribution_events
  USING (is_super_admin())
  WITH CHECK (is_super_admin());
ALTER POLICY "Super admins manage partner referral discount coupons" ON public.partner_referral_discount_stripe_coupons
  USING (is_super_admin())
  WITH CHECK (is_super_admin());
ALTER POLICY "Super admins read partner referral removals" ON public.partner_referral_removals
  USING (is_super_admin());
ALTER POLICY "Super admins manage partner referrals" ON public.partner_referrals
  USING (is_super_admin())
  WITH CHECK (is_super_admin());
ALTER POLICY "Partners read own row" ON public.partners
  USING (((user_id IS NOT NULL) AND (user_id = auth.uid())));
ALTER POLICY "Super admins manage partners" ON public.partners
  USING (is_super_admin())
  WITH CHECK (is_super_admin());
ALTER POLICY "Admins full access payments" ON public.payments
  USING ((is_super_admin() OR (is_admin() AND (business_id = current_business_id()))))
  WITH CHECK ((is_super_admin() OR (is_admin() AND (business_id = current_business_id()))));
ALTER POLICY "Clients view own payments" ON public.payments
  USING (((business_id = current_business_id()) AND ((client_id = get_user_client_id()) OR ((project_id IS NOT NULL) AND client_has_project_access(project_id)))));
ALTER POLICY "Staff access payments" ON public.payments
  USING ((is_business_staff() AND (business_id = current_business_id()) AND staff_can_access_project(project_id)))
  WITH CHECK ((is_business_staff() AND (business_id = current_business_id()) AND staff_can_access_project(project_id)));
ALTER POLICY "Super admins manage plan_stripe_prices" ON public.plan_stripe_prices
  USING (is_super_admin())
  WITH CHECK (is_super_admin());
ALTER POLICY "Super admins manage plans" ON public.plans
  USING (is_super_admin())
  WITH CHECK (is_super_admin());
ALTER POLICY "Super admins read platform audit log" ON public.platform_audit_log
  USING (is_super_admin());
ALTER POLICY "Super admins read platform email sends" ON public.platform_email_sends
  USING (is_super_admin());
ALTER POLICY "Super admins manage platform email templates" ON public.platform_email_templates
  USING (is_super_admin())
  WITH CHECK (is_super_admin());
ALTER POLICY "Super admins read platform_subscription_payments" ON public.platform_subscription_payments
  USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'super_admin'::user_role)))));
ALTER POLICY "Admins can insert profiles" ON public.profiles
  WITH CHECK ((is_super_admin() OR (is_admin() AND (business_id = current_business_id())) OR (auth.uid() = id)));
ALTER POLICY "Users can update own profile" ON public.profiles
  USING (((auth.uid() = id) OR is_super_admin() OR (is_admin() AND (business_id = current_business_id()))))
  WITH CHECK (((auth.uid() = id) OR is_super_admin() OR (is_admin() AND (business_id = current_business_id()))));
ALTER POLICY "Users can view own profile" ON public.profiles
  USING (((auth.uid() = id) OR is_super_admin() OR (is_admin() AND (business_id = current_business_id()))));
ALTER POLICY "Admins full access project_3d_models" ON public.project_3d_models
  USING ((is_super_admin() OR (is_admin() AND (business_id = current_business_id()))))
  WITH CHECK ((is_super_admin() OR (is_admin() AND (business_id = current_business_id()))));
ALTER POLICY "Clients view own project_3d_models" ON public.project_3d_models
  USING ((client_has_project_access(project_id) AND ((business_id = current_business_id()) OR user_has_active_project_share(project_id))));
ALTER POLICY "Staff access project_3d_models" ON public.project_3d_models
  USING ((is_business_staff() AND (business_id = current_business_id()) AND staff_can_access_project(project_id)))
  WITH CHECK ((is_business_staff() AND (business_id = current_business_id()) AND staff_can_access_project(project_id)));
ALTER POLICY "Admins full access project_clients" ON public.project_clients
  USING ((is_super_admin() OR (is_admin() AND (business_id = current_business_id()))))
  WITH CHECK ((is_super_admin() OR (is_admin() AND (business_id = current_business_id()))));
ALTER POLICY "Clients view own project_clients" ON public.project_clients
  USING (((business_id = current_business_id()) AND (client_id = get_user_client_id())));
ALTER POLICY "Staff access project_clients" ON public.project_clients
  USING ((is_business_staff() AND (business_id = current_business_id()) AND staff_can_access_project(project_id)))
  WITH CHECK ((is_business_staff() AND (business_id = current_business_id()) AND staff_can_access_project(project_id)));
ALTER POLICY "Admins full access project_message_reads" ON public.project_message_reads
  USING ((is_super_admin() OR (is_admin() AND (business_id = current_business_id()))))
  WITH CHECK ((is_super_admin() OR (is_admin() AND (business_id = current_business_id()))));
ALTER POLICY "Users manage own message reads" ON public.project_message_reads
  USING ((user_id = auth.uid()))
  WITH CHECK ((user_id = auth.uid()));
ALTER POLICY "Admins full access project_messages" ON public.project_messages
  USING ((is_super_admin() OR (is_admin() AND (business_id = current_business_id()))))
  WITH CHECK ((is_super_admin() OR (is_admin() AND (business_id = current_business_id()))));
ALTER POLICY "Clients insert project messages" ON public.project_messages
  WITH CHECK (((business_id = current_business_id()) AND client_has_project_access(project_id) AND (sender_user_id = auth.uid()) AND (sender_role = 'client'::text)));
ALTER POLICY "Clients view project messages" ON public.project_messages
  USING (((business_id = current_business_id()) AND client_has_project_access(project_id)));
ALTER POLICY "Staff access project_messages" ON public.project_messages
  USING ((is_business_staff() AND (business_id = current_business_id()) AND staff_can_access_project(project_id)))
  WITH CHECK ((is_business_staff() AND (business_id = current_business_id()) AND staff_can_access_project(project_id)));
ALTER POLICY "Admins full access project_quotes" ON public.project_quotes
  USING ((is_super_admin() OR (is_admin() AND (business_id = current_business_id()))))
  WITH CHECK ((is_super_admin() OR (is_admin() AND (business_id = current_business_id()))));
ALTER POLICY "Clients update own project_quotes" ON public.project_quotes
  USING (((business_id = current_business_id()) AND client_has_project_access(project_id)));
ALTER POLICY "Clients view own project_quotes" ON public.project_quotes
  USING (((business_id = current_business_id()) AND client_has_project_access(project_id)));
ALTER POLICY "Staff access project_quotes" ON public.project_quotes
  USING ((is_business_staff() AND (business_id = current_business_id()) AND staff_can_access_project(project_id)))
  WITH CHECK ((is_business_staff() AND (business_id = current_business_id()) AND staff_can_access_project(project_id)));
ALTER POLICY "Admins full access project_shares" ON public.project_shares
  USING ((is_super_admin() OR (is_admin() AND (business_id = current_business_id()))))
  WITH CHECK ((is_super_admin() OR (is_admin() AND (business_id = current_business_id()))));
ALTER POLICY "Shared viewers read own project_shares" ON public.project_shares
  USING (((revoked_at IS NULL) AND (lower(email) = lower(COALESCE(( SELECT profiles.email
   FROM profiles
  WHERE (profiles.id = auth.uid())), ''::text)))));
ALTER POLICY "Admins full access project_staff" ON public.project_staff
  USING ((is_super_admin() OR (is_admin() AND (business_id = current_business_id()))))
  WITH CHECK ((is_super_admin() OR (is_admin() AND (business_id = current_business_id()))));
ALTER POLICY "Staff manage project_staff" ON public.project_staff
  USING ((is_business_staff() AND (business_id = current_business_id())))
  WITH CHECK ((is_business_staff() AND (business_id = current_business_id())));
ALTER POLICY "Staff read own project_staff" ON public.project_staff
  USING (((user_id = auth.uid()) AND (business_id = current_business_id()) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'staff'::user_role) AND (p.disabled_at IS NULL))))));
ALTER POLICY "Admins full access projects" ON public.projects
  USING ((is_super_admin() OR (is_admin() AND (business_id = current_business_id()))))
  WITH CHECK ((is_super_admin() OR (is_admin() AND (business_id = current_business_id()))));
ALTER POLICY "Clients view own projects" ON public.projects
  USING (((deleted_at IS NULL) AND (((business_id = current_business_id()) AND ((client_id = get_user_client_id()) OR client_has_project_access(id))) OR user_has_active_project_share(id))));
ALTER POLICY "Staff access projects" ON public.projects
  USING ((is_business_staff() AND (business_id = current_business_id()) AND staff_can_access_project(id)))
  WITH CHECK ((is_business_staff() AND (business_id = current_business_id())));
ALTER POLICY "Admins full access properties" ON public.properties
  USING ((is_super_admin() OR (is_admin() AND (business_id = current_business_id()))))
  WITH CHECK ((is_super_admin() OR (is_admin() AND (business_id = current_business_id()))));
ALTER POLICY "Clients view own properties" ON public.properties
  USING (((business_id = current_business_id()) AND ((client_id = get_user_client_id()) OR (EXISTS ( SELECT 1
   FROM projects p
  WHERE ((p.property_id = properties.id) AND client_has_project_access(p.id)))))));
ALTER POLICY "Admins full access revisions" ON public.revisions
  USING ((is_super_admin() OR (is_admin() AND (business_id = current_business_id()))))
  WITH CHECK ((is_super_admin() OR (is_admin() AND (business_id = current_business_id()))));
ALTER POLICY "Clients create revisions" ON public.revisions
  WITH CHECK (((business_id = current_business_id()) AND (client_id = get_user_client_id()) AND ((project_id IS NULL) OR client_has_project_access(project_id))));
ALTER POLICY "Clients view own revisions" ON public.revisions
  USING (((business_id = current_business_id()) AND ((client_id = get_user_client_id()) OR ((project_id IS NOT NULL) AND client_has_project_access(project_id)))));
ALTER POLICY "Staff access revisions" ON public.revisions
  USING ((is_business_staff() AND (business_id = current_business_id()) AND staff_can_access_project(project_id)))
  WITH CHECK ((is_business_staff() AND (business_id = current_business_id()) AND staff_can_access_project(project_id)));
ALTER POLICY "Admins full access shoot_proposals" ON public.shoot_proposals
  USING ((is_super_admin() OR (is_admin() AND (business_id = current_business_id()))))
  WITH CHECK ((is_super_admin() OR (is_admin() AND (business_id = current_business_id()))));
ALTER POLICY "Clients create shoot_proposals" ON public.shoot_proposals
  WITH CHECK (((business_id = current_business_id()) AND client_has_project_access(project_id) AND (proposed_by = 'client'::text)));
ALTER POLICY "Clients update own counter proposals" ON public.shoot_proposals
  USING (((business_id = current_business_id()) AND client_has_project_access(project_id)));
ALTER POLICY "Clients view own shoot_proposals" ON public.shoot_proposals
  USING (((business_id = current_business_id()) AND client_has_project_access(project_id)));
ALTER POLICY "Staff access shoot_proposals" ON public.shoot_proposals
  USING ((is_business_staff() AND (business_id = current_business_id()) AND staff_can_access_project(project_id)))
  WITH CHECK ((is_business_staff() AND (business_id = current_business_id()) AND staff_can_access_project(project_id)));
ALTER POLICY "Admins full access tours" ON public.tours
  USING ((is_super_admin() OR (is_admin() AND (business_id = current_business_id()))))
  WITH CHECK ((is_super_admin() OR (is_admin() AND (business_id = current_business_id()))));
ALTER POLICY "Clients view own tours" ON public.tours
  USING ((client_has_project_access(project_id) AND ((business_id = current_business_id()) OR user_has_active_project_share(project_id))));
ALTER POLICY "Staff access tours" ON public.tours
  USING ((is_business_staff() AND (business_id = current_business_id()) AND staff_can_access_project(project_id)))
  WITH CHECK ((is_business_staff() AND (business_id = current_business_id()) AND staff_can_access_project(project_id)));
ALTER POLICY "Admins full access video_review_comments" ON public.video_review_comments
  USING ((is_super_admin() OR (is_admin() AND (business_id = current_business_id()))))
  WITH CHECK ((is_super_admin() OR (is_admin() AND (business_id = current_business_id()))));
ALTER POLICY "Clients manage own video_review_comments" ON public.video_review_comments
  USING ((client_has_project_access(project_id) AND ((business_id = current_business_id()) OR user_has_active_project_share(project_id)) AND (author_kind = 'client'::text) AND (author_user_id = auth.uid())))
  WITH CHECK ((client_has_project_access(project_id) AND ((business_id = current_business_id()) OR user_has_active_project_share(project_id)) AND (author_kind = 'client'::text) AND (author_user_id = auth.uid())));
ALTER POLICY "Clients view own video_review_comments" ON public.video_review_comments
  USING ((client_has_project_access(project_id) AND ((business_id = current_business_id()) OR user_has_active_project_share(project_id))));
ALTER POLICY "Admins full access video_review_notification_batches" ON public.video_review_notification_batches
  USING ((is_super_admin() OR (is_admin() AND (business_id = current_business_id()))))
  WITH CHECK ((is_super_admin() OR (is_admin() AND (business_id = current_business_id()))));
ALTER POLICY "Admins full access video_review_notification_sends" ON public.video_review_notification_sends
  USING ((is_super_admin() OR (is_admin() AND (business_id = current_business_id()))))
  WITH CHECK ((is_super_admin() OR (is_admin() AND (business_id = current_business_id()))));
ALTER POLICY "Admins full access video_review_versions" ON public.video_review_versions
  USING ((is_super_admin() OR (is_admin() AND (business_id = current_business_id()))))
  WITH CHECK ((is_super_admin() OR (is_admin() AND (business_id = current_business_id()))));
ALTER POLICY "Clients view own video_review_versions" ON public.video_review_versions
  USING ((EXISTS ( SELECT 1
   FROM video_reviews vr
  WHERE ((vr.id = video_review_versions.review_id) AND client_has_project_access(vr.project_id) AND ((vr.business_id = current_business_id()) OR user_has_active_project_share(vr.project_id))))));
ALTER POLICY "Admins full access video_reviews" ON public.video_reviews
  USING ((is_super_admin() OR (is_admin() AND (business_id = current_business_id()))))
  WITH CHECK ((is_super_admin() OR (is_admin() AND (business_id = current_business_id()))));
ALTER POLICY "Clients view own video_reviews" ON public.video_reviews
  USING ((client_has_project_access(project_id) AND ((business_id = current_business_id()) OR user_has_active_project_share(project_id))));
ALTER POLICY "Staff access video_reviews" ON public.video_reviews
  USING ((is_business_staff() AND (business_id = current_business_id()) AND staff_can_access_project(project_id)))
  WITH CHECK ((is_business_staff() AND (business_id = current_business_id()) AND staff_can_access_project(project_id)));

DROP INDEX IF EXISTS public.idx_notifications_project_id;
DROP INDEX IF EXISTS public.idx_notifications_payment_id;
DROP INDEX IF EXISTS public.idx_media_assets_folder_id;
DROP INDEX IF EXISTS public.idx_media_asset_events_project_id;
DROP INDEX IF EXISTS public.idx_project_services_service_id;
DROP INDEX IF EXISTS public.idx_leads_project_id;
DROP INDEX IF EXISTS public.idx_activity_logs_lead_id;
DROP INDEX IF EXISTS public.idx_client_notification_claims_project_id;
DROP INDEX IF EXISTS public.idx_vr_notification_batches_review_id;
DROP INDEX IF EXISTS public.idx_vr_notification_batches_project_id;

COMMIT;
