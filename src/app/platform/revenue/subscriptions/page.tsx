import Link from "next/link";
import { Suspense } from "react";
import { requireSuperAdminPage } from "@/lib/admin-access";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listShootPortalSubscriptionPayments } from "@/lib/platform-revenue";
import { createServiceClient } from "@/lib/supabase/server";
import { formatCurrency, formatDate } from "@/lib/utils";
import { RevenueFilters } from "@/components/platform/revenue-filters";

export const dynamic = "force-dynamic";

export default async function PlatformSubscriptionRevenuePage({
  searchParams,
}: {
  searchParams: Promise<{ business?: string; from?: string; to?: string }>;
}) {
  await requireSuperAdminPage();
  const params = await searchParams;
  const rows = await listShootPortalSubscriptionPayments({
    businessId: params.business,
    from: params.from,
    to: params.to,
  });
  const totalCents = rows.reduce((s, r) => s + r.amountPaidCents, 0);

  const raw = await createServiceClient();
  const { data: businesses } = await raw
    .from("businesses")
    .select("id, name")
    .is("deleted_at", null)
    .order("name");

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <Link href="/platform" className="text-sm text-muted hover:text-heading">
          ← Platform dashboard
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-heading">ShootPortal revenue</h1>
        <p className="text-muted">
          Subscription payments businesses pay ShootPortal. <strong>Charged</strong> is the Stripe
          invoice amount (what was actually billed). Catalog list price is shown for comparison —
          they can differ when a subscriber is still on an older Price.
        </p>
      </div>

      <Suspense fallback={null}>
        <RevenueFilters businesses={businesses ?? []} />
      </Suspense>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted">Filtered total (charged)</CardTitle>
        </CardHeader>
        <CardContent className="text-3xl font-semibold">{formatCurrency(totalCents)}</CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Subscription payments ({rows.length})</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-muted">
                <th className="py-2 pr-3 font-medium">Business</th>
                <th className="py-2 pr-3 font-medium">Plan</th>
                <th className="py-2 pr-3 font-medium">Charged</th>
                <th className="py-2 pr-3 font-medium">Catalog /mo</th>
                <th className="py-2 pr-3 font-medium">Paid</th>
                <th className="py-2 pr-3 font-medium">Stripe invoice</th>
                <th className="py-2 font-medium">Mode</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-border/60">
                  <td className="py-2.5 pr-3">
                    <Link
                      href={`/platform/businesses/${row.businessId}`}
                      className="font-medium text-heading hover:underline"
                    >
                      {row.businessName}
                    </Link>
                  </td>
                  <td className="py-2.5 pr-3">{row.plan}</td>
                  <td className="py-2.5 pr-3 font-medium">{formatCurrency(row.amountPaidCents)}</td>
                  <td className="py-2.5 pr-3 text-muted">
                    {row.catalogMonthlyCents != null
                      ? formatCurrency(row.catalogMonthlyCents)
                      : "—"}
                  </td>
                  <td className="py-2.5 pr-3">{formatDate(row.paidAt)}</td>
                  <td className="py-2.5 pr-3 font-mono text-xs">{row.stripeInvoiceId}</td>
                  <td className="py-2.5">{row.stripeMode}</td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-muted">
                    No subscription payments in this range.
                  </td>
                </tr>
              )}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr className="border-t border-border font-semibold">
                  <td className="py-3 pr-3" colSpan={2}>
                    Sum charged
                  </td>
                  <td className="py-3 pr-3">{formatCurrency(totalCents)}</td>
                  <td colSpan={4} />
                </tr>
              </tfoot>
            )}
          </table>
        </CardContent>
      </Card>
    </main>
  );
}
