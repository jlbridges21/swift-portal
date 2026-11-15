"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { WebAddressSubdomainCard } from "@/components/admin/settings-tabs/web-address-subdomain-card";
import type { CustomDomainPublicState } from "@/lib/custom-domain";

/**
 * Settings → Use your own web address → Property Websites (listings.yourstudio.com).
 * Same Vercel registration, DNS instructions and verification as the portal domain;
 * it stores businesses.listing_domain and never touches the portal domain.
 */
export function ListingDomainSection({
  entitled,
  state,
  setupRequired,
  suggestedRootDomain,
  returnTo,
}: {
  entitled: boolean;
  state: CustomDomainPublicState;
  setupRequired: boolean;
  suggestedRootDomain: string | null;
  returnTo: string | null;
}) {
  return (
    <WebAddressSubdomainCard
      kind="listing"
      anchorId="settings-listing-domain"
      entitled={entitled}
      initialState={state}
      apiBase="/api/admin/listing-domain"
      setupRequired={setupRequired}
      suggestedRootDomain={suggestedRootDomain}
      forceOpen={Boolean(returnTo)}
      header={
        returnTo ? (
          <Link href={returnTo} className="inline-flex min-h-9 items-center gap-1.5 text-[13px] font-medium text-accent hover:underline">
            <ArrowLeft className="h-4 w-4" /> Back to the website you were editing
          </Link>
        ) : null
      }
    />
  );
}
