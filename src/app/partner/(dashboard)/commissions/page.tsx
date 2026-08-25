import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getProfile } from "@/lib/auth";
import { loadPartnerCommissionHistory, resolvePartnerAccess } from "@/lib/partner-dashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PartnerCommissionHistory } from "@/components/partner/partner-commission-history";

export const dynamic = "force-dynamic";

export default async function PartnerCommissionsPage({
  searchParams,
}: {
  searchParams: Promise<{ cpage?: string }>;
}) {
  const profile = await getProfile();
  if (!profile) redirect("/login?redirect=/partner/commissions");

  const access = await resolvePartnerAccess(profile.id);
  if (access.kind !== "active") return null;

  const params = await searchParams;
  const cpage = Math.max(1, Number(params.cpage) || 1);
  const historyPageSize = 20;

  const history = await loadPartnerCommissionHistory(access, {
    page: cpage,
    pageSize: historyPageSize,
  });

  return (
    <>
      <h1 className="text-2xl font-bold text-heading">Commissions</h1>
      <p className="mt-1 text-sm text-muted">
        Every ledger row — rates are snapshotted when earned.
      </p>

      <section className="mt-8">
        <Card>
          <CardHeader>
            <CardTitle>Commission history</CardTitle>
          </CardHeader>
          <CardContent>
            <Suspense fallback={null}>
              <PartnerCommissionHistory
                rows={history.rows}
                total={history.total}
                page={cpage}
                pageSize={historyPageSize}
              />
            </Suspense>
          </CardContent>
        </Card>
      </section>
    </>
  );
}
