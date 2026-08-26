import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { resolvePartnerAccess } from "@/lib/partner-dashboard";
import { PARTNER_COMMISSION_HOLD_DAYS } from "@/lib/partner-commissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function PartnerPayoutDetailsPage() {
  const profile = await getProfile();
  if (!profile) redirect("/login?redirect=/partner/payout-details");

  const access = await resolvePartnerAccess(profile.id);
  if (access.kind !== "active") return null;

  return (
    <>
      <h1 className="text-2xl font-bold text-heading">Payout details</h1>
      <p className="mt-1 text-sm text-muted">
        How ShootPortal pays partner commissions (manual payouts — not Stripe Connect).
      </p>

      <section className="mt-8 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>How payouts work</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted">
            <p>
              Commissions enter a <strong>{PARTNER_COMMISSION_HOLD_DAYS}-day hold</strong> after each
              referred customer payment (refunds and chargebacks can reverse earnings during this
              window).
            </p>
            <p>
              After the hold, earned amounts become <strong>payable</strong>. ShootPortal records
              manual payouts when your payable balance is sent — typically via ACH, PayPal, or wire
              as arranged with our partner team.
            </p>
            <p>
              To update your payout method or tax details, email{" "}
              <a href="mailto:support@shootportal.app" className="text-accent underline">
                support@shootportal.app
              </a>{" "}
              from <strong>{access.partner.email}</strong>.
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
