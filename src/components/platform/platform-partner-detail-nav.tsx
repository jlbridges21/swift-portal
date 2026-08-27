"use client";

import { usePathname, useRouter } from "next/navigation";
import { SettingsTabNav } from "@/components/admin/settings-tab-nav";
import {
  PLATFORM_PARTNER_DETAIL_SECTIONS,
  platformPartnerDetailHref,
  platformPartnerDetailSectionFromPathname,
  type PlatformPartnerDetailSectionId,
} from "@/lib/platform-partners-nav";
import { PLATFORM_BUSINESS_DEFAULTS } from "@/lib/portal-brand";
import { sanitizeCssColor } from "@/lib/brand-color";

export function PlatformPartnerDetailNav({ partnerId }: { partnerId: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const active = platformPartnerDetailSectionFromPathname(pathname, partnerId);
  const accent = sanitizeCssColor(
    PLATFORM_BUSINESS_DEFAULTS.brandAccentColor,
    "#4F46E5"
  );

  function onChange(id: PlatformPartnerDetailSectionId) {
    router.push(platformPartnerDetailHref(partnerId, id));
  }

  return (
    <SettingsTabNav
      sections={PLATFORM_PARTNER_DETAIL_SECTIONS}
      active={active}
      onChange={onChange}
      accentColor={accent}
      ariaLabel="Partner detail sections"
      selectId="partner-detail-section-select"
      idPrefix="partner-detail"
      hrefFor={(id) => platformPartnerDetailHref(partnerId, id)}
    />
  );
}
