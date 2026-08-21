import Link from "next/link";
import { Suspense } from "react";
import { requireSuperAdminPage } from "@/lib/admin-access";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listClientPaymentsProcessed } from "@/lib/platform-revenue";
import { createServiceClient } from "@/lib/supabase/server";
import { formatCurrency, formatDate } from "@/lib/utils";
import { RevenueFilters } from "@/components/platform/revenue-filters";

export const dynamic = "force-dynamic";

export default async function PlatformClientPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{
    business?: string;
    from?: string;
    to?: string;
    status?: string;
  }>;
}) {
  await requireSuperAdminPage();
  const params = await searchParams;
  const status = params.status || "paid";
  const { totalCents, byBusiness } = await listClientPaymentsProcessed({
    businessId: params.business,
    from: params.from,
    to: params.to,
    status,
  });

  const raw = await createServiceClient();
  const { data: businesses } = await raw
    .from("businesses")
    .select("id, name")
    .is("deleted_at", null)
    .order("name");

  const businessSum = byBusiness.reduce((s, b) => s + b.totalCents, 0);
  const reconciled = businessSum === totalCents;

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <Link href="/platform" className="text-sm text-muted hover:text-heading">
          ← Platform dashboard
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-heading">Client payments processed</h1>
        <p className="text-muted">
          GMV studios collected from their clients (Connect). Default filter is paid — that matches
          the dashboard headline when date/business filters are cleared.
        </p>
      </div>

      <Suspense fallback={null}>
        <RevenueFilters businesses={businesses ?? []} showStatus />
      </Suspense>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted">Filtered total</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-semibold">{formatCurrency(totalCents)}</p>
          <p className={`mt-1 text-xs ${reconciled ? "text-muted" : "text-red-600"}`}>
            {reconciled
              ? "Business subtotals sum to this total."
              : `Mismatch: business subtotals = ${formatCurrency(businessSum)}`}
          </p>
        </CardContent>
      </Card>

      <div className="space-y-6">
        {byBusiness.map((biz) => {
          const clientSum = biz.clients.reduce((s, c) => s + c.totalCents, 0);
          const bizOk = clientSum === biz.totalCents;
          return (
            <Card key={biz.businessId}>
              <CardHeader className="flex flex-row flex-wrap items-baseline justify-between gap-2">
                <CardTitle>
                  <Link
                    href={`/platform/businesses/${biz.businessId}`}
                    className="hover:underline"
                  >
                    {biz.businessName}
                  </Link>
                </CardTitle>
                <p className="text-lg font-semibold">{formatCurrency(biz.totalCents)}</p>
              </CardHeader>
              <CardContent className="space-y-4">
                {!bizOk && (
                  <p className="text-xs text-red-600">
                    Client subtotals ({formatCurrency(clientSum)}) do not match business total.
                  </p>
                )}
                {biz.clients.map((client) => (
                  <div key={client.clientId ?? "none"} className="rounded-md border border-border p-3">
                    <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                      <div>
                        <p className="font-medium text-heading">{client.clientName}</p>
                        {client.clientEmail && (
                          <p className="text-xs text-muted">{client.clientEmail}</p>
                        )}
                      </div>
                      <p className="font-semibold">{formatCurrency(client.totalCents)}</p>
                    </div>
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="text-muted">
                          <th className="py-1 pr-2 font-medium">Amount</th>
                          <th className="py-1 pr-2 font-medium">Status</th>
                          <th className="py-1 pr-2 font-medium">When</th>
                          <th className="py-1 font-medium">Description</th>
                        </tr>
                      </thead>
                      <tbody>
                        {client.payments.map((p) => (
                          <tr key={p.id} className="border-t border-border/50">
                            <td className="py-1.5 pr-2">{formatCurrency(p.amountCents)}</td>
                            <td className="py-1.5 pr-2">{p.status}</td>
                            <td className="py-1.5 pr-2">
                              {formatDate(p.paidAt || p.createdAt)}
                            </td>
                            <td className="py-1.5 text-muted">{p.description || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </CardContent>
            </Card>
          );
        })}
        {!byBusiness.length && (
          <Card>
            <CardContent className="py-10 text-center text-muted">
              No client payments in this range.
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}
