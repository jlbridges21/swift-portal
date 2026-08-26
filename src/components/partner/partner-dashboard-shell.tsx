import { getProfile } from "@/lib/auth";
import { getCapabilities, partnerNavHref, partnerNavLabel, showPartnerNavItem } from "@/lib/capabilities";
import { getAppSettings } from "@/lib/app-settings";
import { getPortalBrandFromSettings } from "@/lib/portal-brand";
import { BrandProvider } from "@/components/brand/brand-provider";
import { AdminCapabilitiesProvider } from "@/components/admin/admin-capabilities-context";
import { Header } from "@/components/layout/header";
import { PartnerTabNav } from "@/components/partner/partner-tab-nav";
import { DEFAULT_APP_SETTINGS } from "@/lib/app-settings";
import { Button } from "@/components/ui/button";

type Props = {
  children: React.ReactNode;
  brandName: string;
};

/**
 * Partner dashboard shell — keeps main business nav when the user has a tenant,
 * uses a minimal header for partner-only users, and always shows the partner left sidebar.
 */
export async function PartnerDashboardShell({ children, brandName }: Props) {
  const profile = await getProfile();
  const caps = await getCapabilities();
  const hasBusiness = caps.business.active && caps.business.role === "admin";
  const showPartner = showPartnerNavItem(caps);
  const navPartnerLabel = partnerNavLabel(caps);
  const navPartnerHref = partnerNavHref(caps);

  let brand = getPortalBrandFromSettings(DEFAULT_APP_SETTINGS);
  if (hasBusiness && caps.business.businessId) {
    const settings = await getAppSettings(caps.business.businessId);
    brand = getPortalBrandFromSettings(settings);
  }

  return (
    <BrandProvider brand={brand}>
      <AdminCapabilitiesProvider
        showPartner={showPartner}
        partnerActive={caps.partner.active}
        partnerSuspended={caps.partner.suspended}
        partnerNavLabel={navPartnerLabel}
        partnerNavHref={navPartnerHref}
      >
        <div className="min-h-screen bg-background">
          {hasBusiness ? (
            <Header
              variant="dashboard"
              userRole="admin"
              userName={profile?.full_name}
              userAvatar={profile?.avatar_url}
              showPartner={showPartner}
              partnerNavLabel={navPartnerLabel}
              partnerNavHref={navPartnerHref}
            />
          ) : (
            <header className="border-b border-border bg-white">
              <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
                    ShootPortal Partners
                  </p>
                  <p className="text-sm font-medium text-heading">{brandName}</p>
                </div>
                <form action="/api/auth/signout" method="POST">
                  <Button type="submit" variant="ghost" size="sm" className="min-h-11">
                    Sign out
                  </Button>
                </form>
              </div>
            </header>
          )}

          <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
            <div className="flex flex-col gap-6 md:flex-row md:items-start">
              <aside className="w-full shrink-0 md:sticky md:top-20 md:w-56">
                <p className="mb-3 hidden text-xs font-semibold uppercase tracking-[0.18em] text-accent md:block">
                  Partner program
                </p>
                <PartnerTabNav />
              </aside>

              <div
                className="min-w-0 flex-1 rounded-xl border border-indigo-200/80 bg-gradient-to-b from-indigo-50/40 to-white p-4 sm:p-6"
                data-partner-program-surface
              >
                <div className="mb-4 flex flex-wrap items-center gap-2 border-b border-indigo-100 pb-4">
                  <span className="rounded-full bg-indigo-600 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                    ShootPortal Partner Program
                  </span>
                  <span className="text-sm font-medium text-heading">{brandName}</span>
                </div>
                {children}
              </div>
            </div>
          </div>
        </div>
      </AdminCapabilitiesProvider>
    </BrandProvider>
  );
}
