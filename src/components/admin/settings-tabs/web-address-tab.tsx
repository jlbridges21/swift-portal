"use client";

import { ShieldCheck } from "lucide-react";
import { ListingDomainSection } from "@/components/admin/listing-domain-section";
import { WebsiteDomainSection } from "@/components/admin/website-domain-section";
import { WebAddressSubdomainCard } from "@/components/admin/settings-tabs/web-address-subdomain-card";
import { SectionHeading, useSettingsTab } from "@/components/admin/settings-tabs/shared";

export function WebAddressTab() {
  const { savedSettings, canUseCustomDomain, customDomainState, listingDomain, website } = useSettingsTab();
  const fallback = customDomainState.fallbackSubdomain || website.domainState.fallbackSubdomain;
  return (
    <div className="space-y-5">
      <div>
        <SectionHeading id="custom_domain">Use your own web address</SectionHeading>
        <p className="mt-1 text-sm text-muted">Three optional addresses. Each one is set up on its own.</p>
      </div>

      <div className="space-y-3">
        <WebsiteDomainSection
          entitled={canUseCustomDomain}
          initialState={website.domainState}
          setupRequired={website.domain.setupRequired}
          websiteLive={savedSettings.website.launched}
        />
        <WebAddressSubdomainCard
          kind="portal"
          anchorId="settings-custom-domain"
          entitled={canUseCustomDomain}
          initialState={customDomainState}
          apiBase="/api/admin/custom-domain"
        />
        <ListingDomainSection
          entitled={canUseCustomDomain}
          state={listingDomain.state}
          setupRequired={listingDomain.setupRequired}
          suggestedRootDomain={listingDomain.suggestedRootDomain}
          returnTo={listingDomain.returnTo}
        />
      </div>

      <p className="flex items-start gap-2 text-[13px] text-muted">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <span>
          Your ShootPortal address <span className="break-all font-semibold text-heading">{fallback}</span> always keeps working, even while a
          domain is pending or removed.
        </span>
      </p>
    </div>
  );
}
