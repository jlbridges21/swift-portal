import { redirect } from "next/navigation";
import Link from "next/link";
import { getProfile } from "@/lib/auth";
import { loadPartnerDashboardSummary, resolvePartnerAccess } from "@/lib/partner-dashboard";
import {
  getLivePartnerConnectStatus,
  partnerConnectNextStep,
  partnerConnectStatusLabel,
  partnerTaxDocumentStatusLabel,
  PARTNER_PAYOUT_MINIMUM_CENTS,
  PARTNER_PAYOUT_SCHEDULE_LABEL,
} from "@/lib/partner-stripe-connect";
import { PARTNER_COMMISSION_HOLD_DAYS } from "@/lib/partner-commissions";
import { loadPartnerPayoutAutomationSettings } from "@/lib/partner-payout-automation";
import { PartnerConnectOnboardButton } from "@/components/partner/partner-connect-onboard-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

export const dynamic = "force-dynamic";

function statusTone(status: string): string {
  if (status === "ready") return "bg-teal-50 text-teal-900 border-teal-200";
  if (status === "action_required" || status === "restricted") {
    return "bg-amber-50 text-amber-950 border-amber-200";
  }
  if (status === "disabled") return "bg-red-50 text-red-900 border-red-200";
  return "bg-subtle text-heading border-border";
}

export default async function PartnerPayoutDetailsPage() {
  const profile = await getProfile();
  if (!profile) redirect("/login?redirect=/partner/payout-details");

  const access = await resolvePartnerAccess(profile.id);
  if (access.kind !== "active") return null;

  const [connect, summary, automation] = await Promise.all([
    getLivePartnerConnectStatus(access.partner.id),
    loadPartnerDashboardSummary(access),
    loadPartnerPayoutAutomationSettings(),
  ]);

  const balance = summary.balance;
  const openNet = balance.openNetCents;
  const automationOn = automation.automated_payouts_enabled;
  const transferMinimumCents = automation.automated_payouts_minimum_cents || PARTNER_PAYOUT_MINIMUM_CENTS;

  return (
    <>
      <h1 className="text-2xl font-bold text-heading">Payout details</h1>
      <p className="mt-1 text-sm text-muted">
        Connect a Stripe Express account to receive commission payouts. Bank details stay with
        Stripe — ShootPortal never stores them.
      </p>

      <section className="mt-8 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Payout account</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div
              className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${statusTone(connect.status)}`}
            >
              {partnerConnectStatusLabel(connect.status)}
            </div>
            <p className="text-sm text-muted">{partnerConnectNextStep(connect.status)}</p>
            {connect.modeMismatch ? (
              <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                Your saved payout account was connected with different Stripe keys.
                Connect again from this page.
              </p>
            ) : null}
            {connect.requirementsDue && connect.requirementsSummary ? (
              <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                Stripe requirements: <strong>{connect.requirementsSummary}</strong>
              </p>
            ) : null}
            {connect.hasAccount && !connect.modeMismatch ? (
              <div className="rounded-md border border-border px-3 py-2 text-sm">
                <p className="font-medium text-heading">
                  {partnerTaxDocumentStatusLabel(connect.taxDocumentStatus)}
                </p>
                {connect.taxDocumentSummary ? (
                  <p className="mt-1 text-muted">
                    Stripe still needs: {connect.taxDocumentSummary}
                  </p>
                ) : null}
                <p className="mt-2 text-muted">
                  W-9 / equivalent forms are collected inside Stripe Express — not in ShootPortal.
                  For 1099 forms and tax documents, use your{" "}
                  <a
                    href="https://support.stripe.com/express/topics/1099-tax-forms"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent underline"
                  >
                    Stripe Express tax docs
                  </a>
                  . ShootPortal does not give tax advice.
                </p>
              </div>
            ) : null}
            <PartnerConnectOnboardButton status={connect.status} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Balance from the commission ledger</CardTitle>
            <p className="text-sm text-muted">
              Figures come from the append-only commission ledger — not a second balance store.
            </p>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <Metric
              label="Pending (in hold)"
              value={formatCurrency(balance.pendingCents)}
              hint={`${PARTNER_COMMISSION_HOLD_DAYS}-day hold after each referred payment`}
            />
            <Metric
              label={openNet < 0 ? "Open balance (negative)" : "Payable (past hold, unpaid)"}
              value={formatCurrency(openNet)}
              hint={
                openNet < 0
                  ? "Refunds exceeded unpaid earnings — carries forward against future commissions"
                  : "Available for a Stripe transfer when ShootPortal pays you"
              }
              warn={openNet < 0}
            />
            <Metric label="Paid to date" value={formatCurrency(balance.paidCents)} />
            <Metric
              label="Next payout"
              value={
                connect.status !== "ready"
                  ? "Connect Stripe first"
                  : openNet < transferMinimumCents
                    ? `Below ${formatCurrency(transferMinimumCents)} transfer minimum`
                    : automationOn
                      ? PARTNER_PAYOUT_SCHEDULE_LABEL
                      : "Paid when ShootPortal sends a transfer"
              }
              hint={
                automationOn
                  ? `Automated transfers run ${PARTNER_PAYOUT_SCHEDULE_LABEL} when enabled`
                  : "Monthly auto-pay is off — ShootPortal sends Stripe transfers when an operator processes your payout"
              }
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>How payouts work</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted">
            <p>
              Commissions enter a <strong>{PARTNER_COMMISSION_HOLD_DAYS}-day hold</strong> after each
              referred customer payment so refunds and chargebacks can reverse earnings before money
              moves.
            </p>
            <p>
              After the hold, amounts become <strong>payable</strong>. ShootPortal pays that ledger
              balance to your Stripe Express account as a <strong>Stripe transfer</strong> (bank
              details stay with Stripe).
              {automationOn ? (
                <>
                  {" "}
                  Automated transfers run <strong>{PARTNER_PAYOUT_SCHEDULE_LABEL}</strong> when your
                  payable balance is at or above{" "}
                  <strong>{formatCurrency(transferMinimumCents)}</strong>.
                </>
              ) : (
                <>
                  {" "}
                  Automated monthly transfers are <strong>not enabled</strong> — ShootPortal sends
                  transfers when an operator processes your payout (not on a fixed calendar). The{" "}
                  <strong>{formatCurrency(transferMinimumCents)}</strong> minimum applies to those
                  Stripe transfers.
                </>
              )}
            </p>
            <p>
              A refund after a commission is payable can drive your open balance{" "}
              <strong>negative</strong>; that deficit carries forward against future earnings — we
              do not claw back prior paid amounts in a separate invoice.
            </p>
            <p>
              See also{" "}
              <Link href="/partner/payouts" className="text-accent underline">
                Payouts
              </Link>{" "}
              for history and per-commission hold dates.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Your partner account</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              <span className="text-muted">Name:</span> {access.partner.name}
            </p>
            <p>
              <span className="text-muted">Email:</span> {access.partner.email}
            </p>
            <p>
              <span className="text-muted">Brand:</span> {access.partner.brand_name}
            </p>
            <p>
              <span className="text-muted">Commission rate:</span>{" "}
              {access.partner.commission_rate_pct}%
            </p>
          </CardContent>
        </Card>
      </section>
    </>
  );
}

function Metric({
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
    <div className={`rounded-lg border px-3 py-3 ${warn ? "border-amber-300 bg-amber-50" : "border-border"}`}>
      <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
      <p className={`mt-1 text-lg font-semibold ${warn ? "text-amber-950" : "text-heading"}`}>
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}
