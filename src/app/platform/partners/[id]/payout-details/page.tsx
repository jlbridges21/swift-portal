import { notFound } from "next/navigation";
import { requireSuperAdminPage } from "@/lib/admin-access";
import { getPartnerById } from "@/lib/partners";
import {
  getLivePartnerConnectStatus,
  partnerConnectNextStep,
  partnerConnectStatusLabel,
  partnerTaxDocumentStatusLabel,
} from "@/lib/partner-stripe-connect";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

function statusTone(status: string): string {
  if (status === "ready") return "bg-teal-50 text-teal-900 border-teal-200";
  if (status === "action_required" || status === "restricted") {
    return "bg-amber-50 text-amber-950 border-amber-200";
  }
  if (status === "disabled") return "bg-red-50 text-red-900 border-red-200";
  return "bg-subtle text-heading border-border";
}

export default async function PlatformPartnerPayoutDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireSuperAdminPage();
  const { id } = await params;
  const partner = await getPartnerById(id);
  if (!partner) notFound();

  const connect = await getLivePartnerConnectStatus(partner.id);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-heading">Payout details (Connect)</h2>
        <p className="mt-1 text-sm text-muted">
          Read-only Stripe Connect status for this partner. The partner completes onboarding from
          their partner portal — this page does not change Connect setup.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Payout account</CardTitle>
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
              Saved payout account was connected with different Stripe keys than this deploy mode.
              Partner must reconnect from their portal.
            </p>
          ) : null}
          {connect.requirementsDue && connect.requirementsSummary ? (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
              Stripe requirements: <strong>{connect.requirementsSummary}</strong>
            </p>
          ) : null}
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted">Connect account</dt>
              <dd className="font-mono text-heading">
                {partner.stripe_connect_account_id || (connect.hasAccount ? "Linked" : "—")}
              </dd>
            </div>
            <div>
              <dt className="text-muted">Mode</dt>
              <dd className="text-heading">
                {connect.stripeMode || partner.stripe_connect_mode || "—"}
              </dd>
            </div>
            <div>
              <dt className="text-muted">Payouts enabled</dt>
              <dd className="text-heading">{connect.payoutsEnabled ? "Yes" : "No"}</dd>
            </div>
            <div>
              <dt className="text-muted">Tax documents</dt>
              <dd className="text-heading">
                {partnerTaxDocumentStatusLabel(connect.taxDocumentStatus)}
              </dd>
            </div>
            {connect.connectedAt ? (
              <div>
                <dt className="text-muted">Connected at</dt>
                <dd className="text-heading">
                  {new Date(connect.connectedAt).toLocaleString()}
                </dd>
              </div>
            ) : null}
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
