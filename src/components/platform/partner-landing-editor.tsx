"use client";

import { PartnerLandingEditorForm } from "@/components/partner/partner-landing-editor-form";
import type { PartnerLandingDefaults } from "@/lib/partner-landing.constants";
import type { PartnerLandingPageRow } from "@/lib/partner-landing";

type Props = {
  partnerId: string;
  brandName: string;
  initial: PartnerLandingPageRow | null;
  defaults: PartnerLandingDefaults;
  suggestedSlug?: string;
  updatedAt?: string | null;
  updatedByLabel?: string | null;
};

/** Super-admin landing editor — full slug / is_active control. */
export function PartnerLandingEditor({
  partnerId,
  brandName,
  initial,
  defaults,
  suggestedSlug,
  updatedAt,
  updatedByLabel,
}: Props) {
  return (
    <PartnerLandingEditorForm
      mode="admin"
      partnerId={partnerId}
      brandName={brandName}
      initial={initial}
      defaults={defaults}
      suggestedSlug={suggestedSlug}
      previewPath={initial?.slug ? `/${initial.slug}` : null}
      updatedAt={updatedAt ?? initial?.updated_at ?? null}
      updatedByLabel={updatedByLabel}
    />
  );
}
