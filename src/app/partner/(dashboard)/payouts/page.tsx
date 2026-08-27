import { redirect } from "next/navigation";
import Link from "next/link";
import { getProfile } from "@/lib/auth";
import {
  loadPartnerCommissionHistory,
  loadPartnerDashboardSummary,
  resolvePartnerAccess,
} from "@/lib/partner-dashboard";
import { listPartnerPayouts } from "@/lib/partner-payouts";
import { loadPartnerNextPayoutInfo } from "@/lib/partner-payout-run";
import { PARTNER_COMMISSION_HOLD_DAYS } from "@/lib/partner-commissions";
import { PARTNER_PAYOUT_SCHEDULE_LABEL } from "@/lib/partner-stripe-connect";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { PartnerPayoutHistory } from "@/components/partner/partner-payout-history";

export const dynamic = "force-dynamic";

export default async function PartnerPayoutsPage() {
  const profile = await getProfile();
  if (!profile) redirect("/login?redirect=/partner/payouts");

  const access = await resolvePartnerAccess(profile.id);
  if (access.kind !== "active") return null;

  const [summary, payouts, history, nextPayout] = await Promise.all([
    loadPartnerDashboardSummary(access),
    listPartnerPayouts(access),
    loadPartnerCommissionHistory(access, { page: 1, pageSize: 50 }),
    loadPartnerNextPayoutInfo(access.partner.id),
  ]);

  const balance = summary.balance;
  const openNet = balance.openNetCents;

  return (
    <>
      <h1 className="text-2xl font-bold text-heading">Payouts</h1>
      <p className="mt-1 text-sm text-muted">
        Ledger-derived balances and payout history. Connect your payout account under{" "}
        <Link href="/partner/payout-details" className="text-accent underline">
          Payout details
        </Link>
        .
      </p>

      <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <BalanceCard
          label="Pending"
          value={formatCurrency(balance.pendingCents)}
          hint={`In ${summary.holdDays}-day hold`}
        />
        <BalanceCard
          label={openNet < 0 ? "Open (negative)" : "Payable"}
          value={formatCurrency(openNet)}
          hint={openNet < 0 ? "Carries forward" : "Past hold, unpaid"}
          warn={openNet < 0}
        />
        <BalanceCard label="Paid to date" value={formatCurrency(balance.paidCents)} />
        <BalanceCard
          label="UI payable (floor 0)"
          value={formatCurrency(balance.payableCents)}
          hint="max(0, open) — amount a payout can cover"
        />
      </section>

      <section className="mt-6">
        <Card>
          <CardHeader>
            <CardTitle>
              {nextPayout.automationEnabled ? "Next automated payout" : "Payout status"}
            </CardTitle>
            <p className="text-sm text-muted">
              {nextPayout.automationEnabled
                ? `ShootPortal runs automated payouts ${PARTNER_PAYOUT_SCHEDULE_LABEL}. Minimum threshold: ${formatCurrency(nextPayout.minimumCents)}.`
                : `Automated monthly payouts are not enabled yet. ShootPortal records payouts manually once your Stripe Express account is ready and your payable balance reaches ${formatCurrency(nextPayout.minimumCents)}.`}
            </p>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {nextPayout.automationEnabled ? (
              <>
                <p>
                  <span className="text-muted">Scheduled date:</span>{" "}
                  {new Date(nextPayout.nextRunDate).toLocaleDateString(undefined, {
                    dateStyle: "medium",
                  })}
                </p>
                <p>
                  <span className="text-muted">Estimated amount:</span>{" "}
                  <span className="font-medium tabular-nums">
                    {formatCurrency(nextPayout.estimatedAmountCents)}
                  </span>
                </p>
                <p>
                  <span className="text-muted">Status:</span>{" "}
                  {nextPayout.eligible
                    ? "Eligible for the next run"
                    : nextPayout.skipReason
                      ? nextPayout.skipReason.replace(/_/g, " ")
                      : "Not eligible yet"}
                </p>
              </>
            ) : (
              <>
                <p>
                  <span className="text-muted">Payable now:</span>{" "}
                  <span className="font-medium tabular-nums">
                    {formatCurrency(Math.max(0, nextPayout.estimatedAmountCents))}
                  </span>
                </p>
                <p>
                  <span className="text-muted">Status:</span>{" "}
                  {nextPayout.eligible
                    ? "Ready for a recorded payout when ShootPortal processes it"
                    : nextPayout.skipReason
                      ? nextPayout.skipReason.replace(/_/g, " ")
                      : "Not ready yet"}
                </p>
                <p className="text-muted">
                  Connect onboarding and the commission ledger are live. Automatic transfers turn
                  on when ShootPortal enables the payout automation switch.
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="mt-8">
        <Card>
          <CardHeader>
            <CardTitle>Commission hold window</CardTitle>
            <p className="text-sm text-muted">
              Each commission becomes payable {PARTNER_COMMISSION_HOLD_DAYS} days after it is earned.
              Refunds create negative ledger rows that reduce the open balance.
            </p>
          </CardHeader>
          <CardContent>
            {history.rows.length === 0 ? (
              <p className="text-sm text-muted">No commission rows yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[36rem] text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
                      <th className="py-2 pr-3 font-medium">Earned</th>
                      <th className="py-2 pr-3 font-medium">Kind</th>
                      <th className="py-2 pr-3 font-medium">Amount</th>
                      <th className="py-2 pr-3 font-medium">Status</th>
                      <th className="py-2 font-medium">Payable at</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.rows.map((row) => (
                      <tr key={row.id} className="border-b border-border/70">
                        <td className="py-2 pr-3 text-muted">
                          {new Date(row.earnedAt).toLocaleDateString()}
                        </td>
                        <td className="py-2 pr-3">{row.kind}</td>
                        <td className="py-2 pr-3 font-medium tabular-nums">
                          {formatCurrency(row.amountCents)}
                        </td>
                        <td className="py-2 pr-3 capitalize">{row.status}</td>
                        <td className="py-2 text-muted">
                          {row.payableAt
                            ? new Date(row.payableAt).toLocaleDateString()
                            : row.kind === "reversal" || row.kind === "adjustment"
                              ? "Immediate"
                              : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="mt-8">
        <Card>
          <CardHeader>
            <CardTitle>Payout history</CardTitle>
            <p className="text-sm text-muted">
              Amounts match the payable balance stamped onto the ledger at payout time.
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

function BalanceCard({
  label,
  value,
  hint,
  warn,
}: {
  label: string;
  value: string;
  hint?: string;
  warn?: boolean;
}) {
  return (
    <div className={`rounded-xl border px-4 py-3 ${warn ? "border-amber-300 bg-amber-50" : "border-border bg-card"}`}>
      <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
      <p className={`mt-1 text-xl font-semibold tabular-nums ${warn ? "text-amber-950" : "text-heading"}`}>
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}
