import { notFound, redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { getActivePartnerByUserId, getPartnerByUserId } from "@/lib/partners";
import { BrandProvider } from "@/components/brand/brand-provider";
import { getPortalBrandFromSettings } from "@/lib/portal-brand";
import { DEFAULT_APP_SETTINGS } from "@/lib/app-settings";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

/**
 * Partner access shell (phase 1 placeholder).
 * Requires an active partners row for the signed-in user.
 * Users without a partner record get 404 — do not leak that /partner exists.
 */
export default async function PartnerHomePage() {
  const profile = await getProfile();
  if (!profile) redirect("/login?redirect=/partner");

  const active = await getActivePartnerByUserId(profile.id);
  if (!active) {
    // Suspended partners also 404 (same as never-partner) to avoid leaking status.
    const any = await getPartnerByUserId(profile.id);
    if (any) notFound();
    notFound();
  }

  const brand = getPortalBrandFromSettings(DEFAULT_APP_SETTINGS);

  return (
    <BrandProvider brand={brand}>
      <main className="mx-auto max-w-lg px-4 py-12 sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
          ShootPortal Partners
        </p>
        <h1 className="mt-2 text-2xl font-bold text-heading">Partner home</h1>
        <p className="mt-2 text-sm text-muted">
          Your partner dashboard arrives in a later phase. For now, here is your referral code and
          commission rate.
        </p>

        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="text-base">{active.brand_name}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>
              <span className="text-muted">Referral code</span>
              <br />
              <span className="font-mono text-lg font-semibold text-heading">
                {active.referral_code}
              </span>
            </p>
            <p>
              <span className="text-muted">Commission rate</span>
              <br />
              <span className="font-semibold text-heading">{active.commission_rate_pct}%</span>
            </p>
            <p className="text-muted">Status: {active.status}</p>
          </CardContent>
        </Card>

        <form action="/api/auth/signout" method="POST" className="mt-6">
          <Button type="submit" variant="outline" className="min-h-11">
            Sign out
          </Button>
        </form>
      </main>
    </BrandProvider>
  );
}
