import { notFound } from "next/navigation";
import { requireSuperAdminPage } from "@/lib/admin-access";
import { loadPlatformPartnerDetail } from "@/lib/partner-program";
import { Card, CardContent } from "@/components/ui/card";
import { PartnerPayoutAdjustForms } from "@/components/platform/partner-payout-adjust-forms";
import { PartnerPayThisPartnerButton } from "@/components/platform/partner-pay-this-partner-button";
import { PartnerPayoutHistory } from "@/components/partner/partner-payout-history";

export const dynamic = "force-dynamic";

export default async function PlatformPartnerPayoutsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireSuperAdminPage();
  const { id } = await params;
  const detail = await loadPlatformPartnerDetail(id);
  if (!detail) notFound();

  const { partner, balance } = detail;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-heading">Payouts</h2>
        <p className="mt-1 text-sm text-muted">
          Stripe transfers send real money. Recording a payout is bookkeeping only — they are not
          interchangeable.
        </p>
      </div>

      <section className="space-y-3">
        <h3 className="text-base font-semibold text-heading">
          Pay this partner (Stripe transfer)
        </h3>
        <Card className="border-2 border-heading/15">
          <CardContent className="space-y-3 pt-6">
            <p className="text-sm text-muted">
              Dry run first, then execute. Uses the same payout run path, idempotency key, and audit
              trail as bulk &quot;Execute transfers now&quot;. Sends a real Stripe transfer to the
              partner&apos;s Express account.
            </p>
            <PartnerPayThisPartnerButton
              partnerId={partner.id}
              partnerLabel={partner.brand_name || partner.name}
            />
          </CardContent>
        </Card>
      </section>

      <section className="space-y-3">
        <h3 className="text-base font-semibold text-heading">
          Record a payout (bookkeeping only)
        </h3>
        <PartnerPayoutAdjustForms
          partnerId={partner.id}
          payableCents={balance.payableCents}
          openNetCents={balance.openNetCents}
          currency={balance.currency}
        />
      </section>

      <section>
        <h3 className="mb-3 text-base font-semibold text-heading">Payout history</h3>
        <Card>
          <CardContent className="pt-6">
            <PartnerPayoutHistory payouts={detail.payouts} />
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
