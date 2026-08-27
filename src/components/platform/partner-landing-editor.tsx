"use client";

import Link from "next/link";
import { PartnerLandingEditorForm } from "@/components/partner/partner-landing-editor-form";
import { PlatformPartnerDetailNav } from "@/components/platform/platform-partner-detail-nav";
import type { PartnerLandingDefaults } from "@/lib/partner-landing.constants";
import type { PartnerLandingPageRow } from "@/lib/partner-landing";

type Props = {
  partnerId: string;
  brandName: string;
  partnerName: string;
  partnerEmail: string;
  referralCode: string;
  status: string;
  commissionRatePct: number;
  initial: PartnerLandingPageRow | null;
  defaults: PartnerLandingDefaults;
  suggestedSlug?: string;
  previewUrl?: string | null;
  updatedAt?: string | null;
  updatedByLabel?: string | null;
};

/**
 * Super-admin landing editor — full slug / is_active control.
 * Supplies the same partner-detail section nav used on other /platform/partners/[id]/* pages.
 */
export function PartnerLandingEditor({
  partnerId,
  brandName,
  partnerName,
  partnerEmail,
  referralCode,
  status,
  commissionRatePct,
  initial,
  defaults,
  suggestedSlug,
  previewUrl,
  updatedAt,
  updatedByLabel,
}: Props) {
  const sectionNav = (
    <div className="space-y-4">
      <div className="px-1">
        <nav className="text-xs text-muted" aria-label="Breadcrumb">
          <Link href="/platform/partners" className="hover:text-heading">
            Partners
          </Link>
          <span className="mx-1" aria-hidden>
            /
          </span>
          <span className="text-heading">{brandName}</span>
        </nav>
        <p className="mt-2 text-sm font-semibold text-heading">{brandName}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-muted">
          {partnerName} · {partnerEmail} ·{" "}
          <span className="font-mono">{referralCode}</span> · {commissionRatePct}% · {status}
        </p>
      </div>
      <PlatformPartnerDetailNav partnerId={partnerId} />
    </div>
  );

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
      sectionNav={sectionNav}
      // Layout already shows PlatformPartnerDetailNav (md select / md+ rail) below lg.
      // Shell is lg:fixed and covers the layout rail — so shell nav is needed at lg+.
      hideNavBelowLg
    />
  );
}
