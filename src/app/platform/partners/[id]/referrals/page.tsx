import { notFound } from "next/navigation";
import { Suspense } from "react";
import { requireSuperAdminPage } from "@/lib/admin-access";
import { loadPlatformPartnerDetail } from "@/lib/partner-program";
import { Card, CardContent } from "@/components/ui/card";
import { PartnerReferralsTable } from "@/components/partner/partner-referrals-table";

export const dynamic = "force-dynamic";

export default async function PlatformPartnerReferralsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireSuperAdminPage();
  const { id } = await params;
  const detail = await loadPlatformPartnerDetail(id);
  if (!detail) notFound();

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-heading">Referrals</h2>
        <p className="mt-1 text-sm text-muted">Businesses referred by this partner.</p>
      </div>
      <Card>
        <CardContent className="pt-6">
          <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>
            <PartnerReferralsTable
              rows={detail.referrals}
              total={detail.referrals.length}
              page={1}
              pageSize={100}
              sort="joinedAt"
              dir="desc"
            />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}
