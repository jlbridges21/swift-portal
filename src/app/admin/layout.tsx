import { getAppSettings } from "@/lib/app-settings";
import { getPortalBrandFromSettings } from "@/lib/portal-brand";
import { BrandProvider } from "@/components/brand/brand-provider";
import { AdminShell } from "@/components/admin/admin-shell";
import { AdminCapabilitiesProvider } from "@/components/admin/admin-capabilities-context";
import { SubscriptionBanner } from "@/components/admin/subscription-banner";
import { ImpersonationBanner } from "@/components/platform/impersonation-banner";
import { FinishSetupBanner } from "@/components/admin/finish-setup-banner";
import { requireAdminPage } from "@/lib/admin-access";
import { getCapabilities, partnerNavHref, partnerNavLabel, showPartnerNavItem } from "@/lib/capabilities";
import { getTenantContext } from "@/lib/tenant";
import { metadataFromBusiness } from "@/lib/site-metadata";
import { parseSurfaceMode } from "@/lib/brand-color";
import { showFinishSetupBanner } from "@/lib/onboarding";
import { staffCan, staffVisibleNavAreas } from "@/lib/staff-access";
import { w9CountryDecision } from "@/lib/w9-country";
import { TrialConversionModal } from "@/components/admin/trial-conversion-modal";
import { loadTrialUiContext } from "@/lib/billing-journey";
import { decideTrialModal, formatBillingDate, getScheduledPlan, trialModalCopy } from "@/lib/trial-conversion";
import { assertActivePlanKey, resolvePlanTrialDays } from "@/lib/entitlements";
import type { Metadata, Viewport } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const tenant = await getTenantContext();
  if (!tenant) return {};
  const settings = await getAppSettings(tenant.businessId);
  return metadataFromBusiness(settings.business);
}

export async function generateViewport(): Promise<Viewport> {
  const tenant = await getTenantContext();
  if (!tenant) return {};
  const settings = await getAppSettings(tenant.businessId);
  const dark = parseSurfaceMode(settings.business.surfaceMode) === "dark";
  return {
    themeColor: dark ? "#14181F" : "#F8FAFC",
    colorScheme: dark ? "dark" : "light",
  };
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { profile, tenant } = await requireAdminPage();
  const settings = await getAppSettings(tenant.businessId);
  const brand = getPortalBrandFromSettings(settings);
  const caps = await getCapabilities();
  const isStaff = profile.role === "staff";
  // Force showPartner false when profile.role === 'staff'.
  const showPartner = isStaff ? false : showPartnerNavItem(caps);
  const navPartnerLabel = isStaff ? "" : partnerNavLabel(caps);
  const navPartnerHref = isStaff ? "" : partnerNavHref(caps);
  const staffAreas = isStaff ? staffVisibleNavAreas(profile) : null;
  const navCreate = {
    project: staffCan(profile, "projects.create"),
    client: staffCan(profile, "clients.create"),
    media: staffCan(profile, "media.upload"),
  };
  const headerRole = isStaff ? ("staff" as const) : ("admin" as const);
  const showTax = isStaff ? false : (await w9CountryDecision(tenant.businessId)).us;
  const finishBanner =
    !isStaff &&
    showFinishSetupBanner({
      onboardingCompletedAt: tenant.business.onboarding_completed_at,
      onboardingState: tenant.business.onboarding_state,
      role: profile.role,
      impersonating: tenant.impersonating,
    });

  // Trial / scheduled-plan UI for owner admins. Best-effort: any failure just hides it.
  const subStatus = tenant.business.subscription_status;
  const wantsTrialUi = !isStaff && (subStatus === "trialing" || subStatus === "active");
  const ownerTrialing = wantsTrialUi && subStatus === "trialing" && profile.role === "admin" && !tenant.impersonating;
  const trialUi = wantsTrialUi
    ? await loadTrialUiContext(tenant.businessId, profile.id, { needModalState: ownerTrialing })
    : null;
  const scheduledPlan = trialUi ? getScheduledPlan({ ...tenant.business, journey: trialUi.journey }) : null;
  let trialModal: React.ReactNode = null;
  if (ownerTrialing && trialUi) {
    const decision = decideTrialModal({
      subscription_status: subStatus,
      trial_ends_at: tenant.business.trial_ends_at,
      trialStartedAt: trialUi.journey?.trial_started_at ?? trialUi.businessCreatedAt,
      scheduled: Boolean(scheduledPlan),
      seen: trialUi.seen,
    });
    let plan: Awaited<ReturnType<typeof assertActivePlanKey>> | null = null;
    if (decision.show) {
      try {
        plan = await assertActivePlanKey(tenant.business.plan || "studio");
      } catch (err) {
        console.warn("[admin] trial modal skipped", err instanceof Error ? err.message : err);
      }
    }
    if (decision.show && plan) {
      trialModal = (
        <TrialConversionModal
          milestone={decision.milestone}
          trialDay={decision.trialDay}
          copy={trialModalCopy(decision.milestone, decision.msRemaining, resolvePlanTrialDays(plan, "trial_modal"))}
          planKey={plan.key}
          monthlyCents={plan.price_monthly_cents}
          annualPerMonthCents={plan.price_annual_cents}
          trialEndLabel={formatBillingDate(decision.trialEndsAt)}
          canCheckout={plan.is_public && plan.key !== "founding"}
        />
      );
    }
  }

  return (
    <BrandProvider brand={brand} surfaceMode={parseSurfaceMode(settings.business.surfaceMode)}>
      <AdminCapabilitiesProvider
        showPartner={showPartner}
        partnerActive={caps.partner.active}
        partnerSuspended={caps.partner.suspended}
        partnerNavLabel={navPartnerLabel}
        partnerNavHref={navPartnerHref}
        staffAreas={staffAreas}
        userRole={headerRole}
        navCreate={navCreate}
        showTax={showTax}
      >
        {tenant.impersonating && (
          <ImpersonationBanner
            businessName={tenant.business.name}
            businessId={tenant.businessId}
            allowWrites={tenant.allowWrites}
            subscriptionStatus={tenant.business.subscription_status}
            trialEndsAt={tenant.business.trial_ends_at}
            compedUntil={tenant.business.comped_until}
            compedReason={tenant.business.comped_reason}
          />
        )}
        {!isStaff && (
          <SubscriptionBanner
            subscriptionStatus={tenant.business.subscription_status}
            trialEndsAt={tenant.business.trial_ends_at}
            compedUntil={tenant.business.comped_until}
            subscriptionCurrentPeriodEnd={tenant.business.subscription_current_period_end}
            subscriptionCancelAtPeriodEnd={tenant.business.subscription_cancel_at_period_end}
            scheduled={scheduledPlan}
          />
        )}
        {trialModal}
        {finishBanner ? <FinishSetupBanner /> : null}
        <AdminShell
          showPartner={showPartner}
          partnerNavLabel={navPartnerLabel}
          partnerNavHref={navPartnerHref}
          staffAreas={staffAreas ?? undefined}
          userRole={headerRole}
        >
          {children}
        </AdminShell>
      </AdminCapabilitiesProvider>
    </BrandProvider>
  );
}
