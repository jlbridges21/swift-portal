"use client";

import Link from "next/link";
import { PartnerReferralCopy } from "@/components/partner/partner-referral-copy";
import { PartnerPromoCodeEditor } from "@/components/partner/partner-promo-code-editor";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Props = {
  referralLink: string;
  landingUrl: string | null;
  referralCode: string;
  promoCode: string | null;
};

export function PartnerShareLinks({ referralLink, landingUrl, referralCode, promoCode }: Props) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Your referral tools</CardTitle>
        <p className="text-sm text-muted">
          Links, landing pages, and promo codes all earn the same commission when someone signs up
          and becomes a paying ShootPortal customer. Use whichever fits your audience.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Referral link</p>
          <p className="text-sm text-muted">
            Sends people to ShootPortal with your code <strong>{referralCode}</strong> attached.
            Best for short mentions, link-in-bio, and email signatures.
          </p>
          <PartnerReferralCopy link={referralLink} />
        </div>
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Landing page</p>
          {landingUrl ? (
            <>
              <p className="text-sm text-muted">
                A co-branded page with your messaging and photo. Same attribution as the referral
                link — commissions are identical.
              </p>
              <PartnerReferralCopy link={landingUrl} />
            </>
          ) : (
            <p className="text-sm text-muted">
              You do not have a custom landing page yet.{" "}
              <Link href="/partner/landing" className="font-medium text-accent hover:underline">
                Create one on the Landing page tab
              </Link>{" "}
              for a richer first impression than the plain referral link alone.
            </p>
          )}
        </div>
        <div className="border-t border-border pt-5">
          <PartnerPromoCodeEditor initialPromoCode={promoCode} />
        </div>
      </CardContent>
    </Card>
  );
}
