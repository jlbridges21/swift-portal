import Link from "next/link";
import { redirect } from "next/navigation";
import { BrandProvider } from "@/components/brand/brand-provider";
import { PartnerLandingEditorForm } from "@/components/partner/partner-landing-editor-form";
import { Button } from "@/components/ui/button";
import { getProfile } from "@/lib/auth";
import { platformPortalBrand } from "@/lib/public-host-chrome";
import { resolvePartnerAccess } from "@/lib/partner-dashboard";
import {
  buildPartnerLandingDefaultsWithOffer,
  getPartnerLandingByPartnerId,
  getPartnerLandingUpdatedByLabel,
} from "@/lib/partner-landing";

export const dynamic = "force-dynamic";

export default async function PartnerLandingEditorPage() {
  const profile = await getProfile();
  if (!profile) redirect("/login");

  const access = await resolvePartnerAccess(profile.id);
  if (access.kind === "none") redirect("/");
  if (access.kind === "suspended") redirect("/partner");

  const landing = await getPartnerLandingByPartnerId(access.partner.id);
  const defaults = await buildPartnerLandingDefaultsWithOffer(
    access.partner.id,
    access.partner.brand_name
  );
  let updatedByLabel: string | null = null;
  if (landing?.updated_by) {
    updatedByLabel = await getPartnerLandingUpdatedByLabel(landing.updated_by);
  }

  const brand = platformPortalBrand();

  return (
    <BrandProvider brand={brand}>
      <div className="min-h-screen bg-background">
        <header className="border-b border-border bg-white">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
                ShootPortal Partners
              </p>
              <p className="text-sm font-medium text-heading">{access.partner.brand_name}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link href="/partner">
                <Button type="button" variant="outline" size="sm" className="min-h-11">
                  Dashboard
                </Button>
              </Link>
              <form action="/api/auth/signout" method="POST">
                <Button type="submit" variant="ghost" size="sm" className="min-h-11">
                  Sign out
                </Button>
              </form>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
          <h1 className="text-2xl font-bold text-heading">Landing page</h1>
          <p className="mt-1 text-sm text-muted">
            Customize how your co-branded ShootPortal page looks to referrals.
          </p>
          <div className="mt-6">
            <PartnerLandingEditorForm
              mode="partner"
              partnerId={access.partner.id}
              brandName={access.partner.brand_name}
              initial={landing}
              defaults={defaults}
              previewPath={landing?.slug ? `/${landing.slug}` : null}
              updatedAt={landing?.updated_at ?? null}
              updatedByLabel={updatedByLabel}
            />
          </div>
        </main>
      </div>
    </BrandProvider>
  );
}
