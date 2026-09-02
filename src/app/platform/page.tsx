import Link from "next/link";
import { requireSuperAdminPage } from "@/lib/admin-access";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { loadPlatformAudit, loadPlatformBusinesses, platformTotals } from "@/lib/platform-dashboard";
import { sumShootPortalSubscriptionRevenueCents } from "@/lib/platform-revenue";
import { formatCurrency, formatDate } from "@/lib/utils";
import { PlatformBusinessesTable } from "@/components/platform/platform-businesses-table";

export const dynamic = "force-dynamic";

export default async function PlatformHomePage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; name?: string }>;
}) {
  await requireSuperAdminPage();
  const { notice, name } = await searchParams;
  const businesses = await loadPlatformBusinesses();
  const totals = platformTotals(businesses);
  const shootPortalRevenueCents = await sumShootPortalSubscriptionRevenueCents();
  const recent = await loadPlatformAudit({ limit: 12 });
  const named = name?.trim() || "Business";

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {notice === "impersonate" && (
        <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-slate-900">
          Super-admins have no business of their own. Use <strong>View as</strong> on a business
          before opening /admin.
        </div>
      )}
      {notice === "deleted" && (
        <div className="mb-6 rounded-lg border border-teal-300 bg-teal-50 px-4 py-3 text-sm text-slate-900">
          Hard-deleted <strong>{named}</strong>. It no longer appears in the list.
        </div>
      )}
      {notice === "soft_deleted" && (
        <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-slate-900">
          Soft-deleted <strong>{named}</strong>. Login is blocked; data is retained.
        </div>
      )}
      {notice === "suspended" && (
        <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-slate-900">
          Suspended <strong>{named}</strong>. Admins and clients cannot sign in until reactivated.
        </div>
      )}

      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-heading">Businesses</h1>
          <p className="text-muted">Cross-tenant visibility. Onboarding replaces the SQL runbook.</p>
        </div>
        <Link href="/platform/businesses/new">
          <Button>Create a business</Button>
        </Link>
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted">Live businesses</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{totals.live}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted">Clients</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{totals.clients}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted">Projects</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{totals.projects}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted">
              <Link href="/platform/revenue/subscriptions" className="hover:underline">
                ShootPortal revenue
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Link href="/platform/revenue/subscriptions" className="block hover:opacity-90">
              <p className="text-2xl font-semibold">{formatCurrency(shootPortalRevenueCents)}</p>
              <p className="mt-1 text-xs text-muted">Subscription income — click to audit</p>
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted">
              <Link href="/platform/revenue/client-payments" className="hover:underline">
                Client payments processed
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Link href="/platform/revenue/client-payments" className="block hover:opacity-90">
              <p className="text-2xl font-semibold">
                {formatCurrency(totals.clientPaymentsProcessedCents)}
              </p>
              <p className="mt-1 text-xs text-muted">GMV — click to audit by business / client</p>
            </Link>
          </CardContent>
        </Card>
      </div>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>All businesses</CardTitle>
        </CardHeader>
        <CardContent>
          <PlatformBusinessesTable businesses={businesses} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Recent platform activity</CardTitle>
          <Link href="/platform/audit" className="text-sm text-accent underline">
            View audit log
          </Link>
        </CardHeader>
        <CardContent className="space-y-3">
          {recent.length === 0 && <p className="text-sm text-muted">No audit events yet.</p>}
          {recent.map((row) => (
            <div key={row.id} className="flex flex-wrap justify-between gap-2 border-b border-border pb-2 text-sm last:border-0">
              <div>
                <span className="font-medium text-heading">{row.action}</span>
                <span className="ml-2 text-muted">{row.actor_email}</span>
              </div>
              <span className="text-muted">{formatDate(row.created_at)}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </main>
  );
}
