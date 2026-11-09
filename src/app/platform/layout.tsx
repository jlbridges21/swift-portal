import { cookies } from "next/headers";
import { BrandProvider } from "@/components/brand/brand-provider";
import { getPortalBrandFromSettings } from "@/lib/portal-brand";
import { DEFAULT_APP_SETTINGS } from "@/lib/app-settings";
import { requireSuperAdminPage } from "@/lib/admin-access";
import { PlatformConsoleShell } from "@/components/platform/platform-console-shell";
import { ImpersonationBanner } from "@/components/platform/impersonation-banner";
import { CONSOLE_SIDEBAR_COOKIE } from "@/lib/platform-console-nav";
import { getTenantContext } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  await requireSuperAdminPage();
  const tenant = await getTenantContext();
  const brand = getPortalBrandFromSettings(DEFAULT_APP_SETTINGS);
  const collapsed = (await cookies()).get(CONSOLE_SIDEBAR_COOKIE)?.value === "collapsed";

  return (
    <BrandProvider brand={brand} surfaceMode="light">
      <PlatformConsoleShell
        initialCollapsed={collapsed}
        banner={
          tenant?.impersonating ? (
            <ImpersonationBanner
              businessName={tenant.business.name}
              businessId={tenant.businessId}
              allowWrites={tenant.allowWrites}
              subscriptionStatus={tenant.business.subscription_status}
              trialEndsAt={tenant.business.trial_ends_at}
              compedUntil={tenant.business.comped_until}
              compedReason={tenant.business.comped_reason}
            />
          ) : null
        }
      >
        {children}
      </PlatformConsoleShell>
    </BrandProvider>
  );
}
