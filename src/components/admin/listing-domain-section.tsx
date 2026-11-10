"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CustomDomainSettingsCard } from "@/components/admin/custom-domain-settings-card";
import type { CustomDomainPublicState } from "@/lib/custom-domain";

/**
 * Settings → Use your own web address → Property Website Address (below the portal address).
 * Same component, Vercel registration, DNS instructions and verification as the portal domain;
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
    <div id="settings-listing-domain" tabIndex={-1} className="scroll-mt-24 space-y-4 rounded-xl pt-6 outline-none">
      <div className="border-t border-border pt-6">
        <h2 className="text-lg font-semibold text-heading">Property Website Address</h2>
        <p className="mt-1 text-sm text-muted">
          Used for public property websites — separate from your client portal address above. Connect it once and every listing
          you publish uses it automatically.
        </p>
      </div>
      {returnTo ? (
        <Link href={returnTo} className={buttonVariants({ variant: "outline", size: "sm" })}>
          <ArrowLeft className="h-4 w-4" /> Back to the website you were editing
        </Link>
      ) : null}
      {setupRequired ? (
        <Card className="shadow-sm">
          <CardContent className="pt-6 text-sm text-muted">
            This needs a one-time database update (migration v118). Property websites still work at your ShootPortal address.
          </CardContent>
        </Card>
      ) : (
        <CustomDomainSettingsCard
          entitled={entitled}
          initialState={state}
          apiBase="/api/admin/listing-domain"
          kind="listing"
          suggestedRootDomain={suggestedRootDomain}
        />
      )}
    </div>
  );
}
