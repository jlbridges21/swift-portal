import { requirePartnerCapability } from "@/lib/capabilities";
import { getProfile } from "@/lib/auth";
import { BrandProvider } from "@/components/brand/brand-provider";
import { getPortalBrandFromSettings } from "@/lib/portal-brand";
import { DEFAULT_APP_SETTINGS } from "@/lib/app-settings";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export const dynamic = "force-dynamic";

/**
 * Partner surface layout.
 * - Missing capability → 404 (not 403).
 * - Suspended → distinct message, no dashboard children.
 * - ShootPortal branding always (platform surface), even on a tenant host.
 */
export default async function PartnerLayout({ children }: { children: React.ReactNode }) {
  const capability = await requirePartnerCapability();
  const brand = getPortalBrandFromSettings(DEFAULT_APP_SETTINGS);
  const profile = await getProfile();
  const isBusinessAdmin = profile?.role === "admin" || profile?.role === "super_admin";

  if (capability.kind === "suspended") {
    return (
      <BrandProvider brand={brand}>
        <main className="mx-auto max-w-lg px-4 py-12 sm:px-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
            ShootPortal Partners
          </p>
          <h1 className="mt-2 text-2xl font-bold text-heading">Partner account suspended</h1>
          <p className="mt-3 text-sm text-muted">
            Your partner account for <strong>{capability.partner.brand_name}</strong> is suspended.
            Existing commission history is retained, but new referrals will not earn commissions
            until the account is reactivated. Contact ShootPortal support if you have questions.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            {isBusinessAdmin ? (
              <Link href="/admin">
                <Button type="button" variant="accent" className="min-h-11">
                  Go to business admin
                </Button>
              </Link>
            ) : null}
            <form action="/api/auth/signout" method="POST">
              <Button type="submit" variant="outline" className="min-h-11">
                Sign out
              </Button>
            </form>
          </div>
        </main>
      </BrandProvider>
    );
  }

  return <BrandProvider brand={brand}>{children}</BrandProvider>;
}
