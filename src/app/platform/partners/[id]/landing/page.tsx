import { notFound } from "next/navigation";
import { requireSuperAdminPage } from "@/lib/admin-access";
import { loadPlatformPartnerDetail } from "@/lib/partner-program";
import { PartnerLandingEditor } from "@/components/platform/partner-landing-editor";
import {
  buildPartnerLandingDefaultsWithOffer,
  getPartnerLandingByPartnerId,
  getPartnerLandingUpdatedByLabel,
} from "@/lib/partner-landing";
import { partnerLandingPublicUrl } from "@/lib/partner-urls";

export const dynamic = "force-dynamic";

export default async function PlatformPartnerLandingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireSuperAdminPage();
  const { id } = await params;
  const detail = await loadPlatformPartnerDetail(id);
  if (!detail) notFound();

  const { partner } = detail;
  const landing = await getPartnerLandingByPartnerId(id);
  const landingDefaults = await buildPartnerLandingDefaultsWithOffer(id, partner.brand_name);
  const landingUpdatedByLabel = landing?.updated_by
    ? await getPartnerLandingUpdatedByLabel(landing.updated_by)
    : null;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-heading">Landing page</h2>
        <p className="mt-1 text-sm text-muted">
          Custom partner landing content shown on the public partner URL.
        </p>
      </div>
      <PartnerLandingEditor
        partnerId={partner.id}
        brandName={partner.brand_name}
        initial={landing}
        defaults={landingDefaults}
        suggestedSlug={partner.referral_code}
        previewUrl={landing?.slug ? partnerLandingPublicUrl(landing.slug) : null}
        updatedAt={landing?.updated_at ?? null}
        updatedByLabel={landingUpdatedByLabel}
      />
    </div>
  );
}
