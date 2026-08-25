import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { loadPartnerDashboardSummary, resolvePartnerAccess } from "@/lib/partner-dashboard";
import { listPartnerPayouts } from "@/lib/partner-payouts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { PartnerPayoutHistory } from "@/components/partner/partner-payout-history";

export const dynamic = "force-dynamic";

export default async function PartnerPayoutsPage() {
  const profile = await getProfile();
  if (!profile) redirect("/login?redirect=/partner/payouts");

  const access = await resolvePartnerAccess(profile.id);
  if (access.kind !== "active") return null;

  const [summary, payouts] = await Promise.all([
    loadPartnerDashboardSummary(access),
    listPartnerPayouts(access),
  ]);

  return (
    <>
      <h1 className="text-2xl font-bold text-heading">Payouts</h1>
      <p className="mt-1 text-sm text-muted">
        Manual payouts recorded by ShootPortal when your payable balance is sent.
      </p>

      <p className="mt-4 rounded-lg border border-border bg-subtle/50 px-4 py-3 text-sm text-muted">
        Payable balance: <strong>{formatCurrency(summary.balance.payableCents)}</strong> (after{" "}
        {summary.holdDays}-day hold). Payout details for how we pay you are under Payout details.
      </p>

      <section className="mt-8">
        <Card>
          <CardHeader>
            <CardTitle>Payout history</CardTitle>
            <p className="text-sm text-muted">
              Amounts match the payable balance at the time of each payout.
            </p>
          </CardHeader>
          <CardContent>
            <PartnerPayoutHistory payouts={payouts} />
          </CardContent>
        </Card>
      </section>
    </>
  );
}
