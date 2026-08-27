import { notFound } from "next/navigation";
import { Suspense } from "react";
import { requireSuperAdminPage } from "@/lib/admin-access";
import { loadPlatformPartnerDetail } from "@/lib/partner-program";
import { Card, CardContent } from "@/components/ui/card";
import { PartnerCommissionHistory } from "@/components/partner/partner-commission-history";

export const dynamic = "force-dynamic";

export default async function PlatformPartnerCommissionsPage({
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
        <h2 className="text-lg font-semibold text-heading">Commissions</h2>
        <p className="mt-1 text-sm text-muted">Commission ledger history for this partner.</p>
      </div>
      <Card>
        <CardContent className="pt-6">
          <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>
            <PartnerCommissionHistory
              rows={detail.commissions.rows}
              total={detail.commissions.total}
              page={1}
              pageSize={100}
            />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}
