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
  previewUrl?: string | null;
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
  previewUrl,
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
      previewUrl={previewUrl ?? null}
      updatedAt={updatedAt ?? initial?.updated_at ?? null}
      updatedByLabel={updatedByLabel}
    />
  );
}
