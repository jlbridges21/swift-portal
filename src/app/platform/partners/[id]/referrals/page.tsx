import { notFound } from "next/navigation";
import { requireSuperAdminPage } from "@/lib/admin-access";
import { getPartnerById } from "@/lib/partners";
import { isPartnerCommissionEligible } from "@/lib/partner-commissions";
import {
  loadPartnerReferralRemovals,
  loadPlatformPartnerReferralRows,
} from "@/lib/partner-referral-admin";
import { Card, CardContent } from "@/components/ui/card";
import { PlatformPartnerReferralsManager } from "@/components/platform/platform-partner-referrals-manager";

export const dynamic = "force-dynamic";

export default async function PlatformPartnerReferralsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireSuperAdminPage();
  const { id } = await params;
  const partner = await getPartnerById(id);
  if (!partner) notFound();

  const [rows, removals] = await Promise.all([
    loadPlatformPartnerReferralRows(partner.id),
    loadPartnerReferralRemovals(partner.id),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-heading">Referrals</h2>
        <p className="mt-1 text-sm text-muted">
          Businesses referred by this partner. Remove a referral if it was created by mistake, for example
          during a demo. The business and its account aren’t affected.
        </p>
      </div>
      <Card>
        <CardContent className="pt-6">
          <PlatformPartnerReferralsManager
            partnerId={partner.id}
            partnerName={partner.brand_name || partner.name}
            commissionEligible={isPartnerCommissionEligible(partner)}
            rows={rows}
            removals={removals}
          />
        </CardContent>
      </Card>
    </div>
  );
}
