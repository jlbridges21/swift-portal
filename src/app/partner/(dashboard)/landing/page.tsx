import { notFound, redirect } from "next/navigation";
import { PartnerLandingEditorForm } from "@/components/partner/partner-landing-editor-form";
import { PartnerTabNav } from "@/components/partner/partner-tab-nav";
import { PartnerShareLinks } from "@/components/partner/partner-share-links";
import { getProfile } from "@/lib/auth";
import {
  partnerLandingPublicUrl,
  partnerReferralLink,
  resolvePartnerAccess,
} from "@/lib/partner-dashboard";
import {
  buildPartnerLandingDefaultsWithOffer,
  getPartnerLandingForAccess,
  getPartnerLandingUpdatedByLabel,
} from "@/lib/partner-landing";
import { suggestReferralCodeFromBrand } from "@/lib/reserved-subdomains";

export const dynamic = "force-dynamic";

export default async function PartnerLandingEditorPage() {
  const profile = await getProfile();
  if (!profile) redirect("/login?redirect=/partner/landing");

  const access = await resolvePartnerAccess(profile.id);
  if (access.kind !== "active") notFound();

  const landing = await getPartnerLandingForAccess(access);
  const defaults = await buildPartnerLandingDefaultsWithOffer(
    access.partner.id,
    access.partner.brand_name
  );
  let updatedByLabel: string | null = null;
  if (landing?.updated_by) {
    updatedByLabel = await getPartnerLandingUpdatedByLabel(landing.updated_by);
  }

  const referralLink = partnerReferralLink(access.partner.referral_code);
  const landingUrl =
    landing?.slug && landing.is_active ? partnerLandingPublicUrl(landing.slug) : null;
  const previewUrl = landing?.slug ? partnerLandingPublicUrl(landing.slug) : null;
  const suggestedSlug = suggestReferralCodeFromBrand(access.partner.brand_name);

  return (
    <>
      <div className="lg:hidden">
        <h1 className="text-2xl font-bold text-heading">Landing page</h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted">
          A landing page is your co-branded ShootPortal pitch at{" "}
          <strong>shootportal.app/your-slug</strong> — photo, headline, benefits, and signup CTA.
          Use it when you want more context than a bare <code className="text-xs">?ref=</code> link.
          Both URLs track the same way and pay the same commission.
        </p>

        <div className="mt-6">
          <PartnerShareLinks
            referralLink={referralLink}
            landingUrl={landingUrl}
            referralCode={access.partner.referral_code}
          />
        </div>
      </div>

      <div className="mt-8 lg:mt-0">
        <PartnerLandingEditorForm
          mode="partner"
          partnerId={access.partner.id}
          brandName={access.partner.brand_name}
          initial={landing}
          defaults={defaults}
          suggestedSlug={suggestedSlug}
          previewUrl={previewUrl}
          updatedAt={landing?.updated_at ?? null}
          updatedByLabel={updatedByLabel}
          sectionNav={
            <>
              <p className="mb-3 hidden text-xs font-semibold uppercase tracking-[0.18em] text-accent lg:block">
                Partner program
              </p>
              <PartnerTabNav />
            </>
          }
          // Partner dashboard shell already shows PartnerTabNav below lg.
          // Shell is lg:fixed and covers that rail — so shell nav is needed at lg+.
          hideNavBelowLg
        />
      </div>
    </>
  );
}
