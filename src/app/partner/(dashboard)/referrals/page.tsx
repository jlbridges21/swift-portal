import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getProfile } from "@/lib/auth";
import { loadPartnerReferrals, resolvePartnerAccess } from "@/lib/partner-dashboard";
import {
  resolveReferralDiscountForPartner,
  PARTNER_COMMISSION_ON_NET_COLLECTED,
  formatPartnerReferralAnnualBillingPolicy,
} from "@/lib/partner-referral-discount";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { PartnerReferralsTable } from "@/components/partner/partner-referrals-table";

export const dynamic = "force-dynamic";

export default async function PartnerReferralsPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; dir?: string; page?: string }>;
}) {
  const profile = await getProfile();
  if (!profile) redirect("/login?redirect=/partner/referrals");

  const access = await resolvePartnerAccess(profile.id);
  if (access.kind !== "active") return null;

  const params = await searchParams;
  const sort = params.sort || "joinedAt";
  const dir = params.dir === "asc" ? "asc" : "desc";
  const page = Math.max(1, Number(params.page) || 1);
  const pageSize = 10;

  const [referrals, referralDiscount] = await Promise.all([
    loadPartnerReferrals(access, { sort, dir, page, pageSize }),
    resolveReferralDiscountForPartner(access.partner.id),
  ]);

  return (
    <>
      <h1 className="text-2xl font-bold text-heading">Referrals</h1>
      <p className="mt-1 text-sm text-muted">
        Businesses you referred — names and subscription status only.
      </p>

      <section className="mt-8">
        <Card>
          <CardHeader>
            <CardTitle>Referred businesses</CardTitle>
            {referralDiscount.eligible && referralDiscount.config ? (
              <div className="mt-3 space-y-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                <p>
                  <strong>Referral signup offer:</strong> businesses that join through your link
                  get {formatCurrency(referralDiscount.config.amountOffCents)}/mo off for their
                  first {referralDiscount.config.durationMonths} paid months on{" "}
                  <strong>monthly</strong> billing
                  {referralDiscount.config.annualEnabled &&
                  referralDiscount.config.annualAmountOffCents > 0
                    ? `, or ${formatCurrency(referralDiscount.config.annualAmountOffCents)} off the first annual invoice (once) on annual billing`
                    : ""}
                  .
                </p>
                <p>{PARTNER_COMMISSION_ON_NET_COLLECTED}</p>
                <p className="text-xs text-amber-900">
                  {formatPartnerReferralAnnualBillingPolicy({
                    annualEnabled: referralDiscount.config.annualEnabled,
                    annualAmountOffCents: referralDiscount.config.annualAmountOffCents,
                  })}
                </p>
              </div>
            ) : referralDiscount.config?.enabled ? (
              <div className="mt-3 rounded-lg border border-border bg-subtle/40 px-3 py-2 text-sm text-muted">
                <p>
                  <strong>Referral signup offer:</strong> temporarily unavailable — contact
                  ShootPortal support if this persists.
                </p>
              </div>
            ) : null}
          </CardHeader>
          <CardContent>
            <Suspense fallback={null}>
              <PartnerReferralsTable
                rows={referrals.rows}
                total={referrals.total}
                page={page}
                pageSize={pageSize}
                sort={sort}
                dir={dir}
              />
            </Suspense>
          </CardContent>
        </Card>
      </section>
    </>
  );
}
