import Link from "next/link";
import { requireSuperAdminPage } from "@/lib/admin-access";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { loadPlatformAudit, loadPlatformBusinesses, platformTotals } from "@/lib/platform-dashboard";
import { formatCurrency, formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function PlatformHomePage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>;
}) {
  await requireSuperAdminPage();
  const { notice } = await searchParams;
  const businesses = await loadPlatformBusinesses();
  const totals = platformTotals(businesses);
  const recent = await loadPlatformAudit({ limit: 12 });

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {notice === "impersonate" && (
        <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-slate-900">
          Super-admins have no business of their own. Use <strong>View as</strong> on a business
          before opening /admin.
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

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
            <CardTitle className="text-sm font-medium text-muted">Lifetime revenue</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{formatCurrency(totals.revenueCents)}</CardContent>
        </Card>
      </div>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>All businesses</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[880px] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-muted">
                <th className="py-2 pr-3 font-medium">Business</th>
                <th className="py-2 pr-3 font-medium">Status</th>
                <th className="py-2 pr-3 font-medium">Subscription</th>
                <th className="py-2 pr-3 font-medium">Plan</th>
                <th className="py-2 pr-3 font-medium">Clients</th>
                <th className="py-2 pr-3 font-medium">Projects</th>
                <th className="py-2 pr-3 font-medium">Media</th>
                <th className="py-2 pr-3 font-medium">Revenue</th>
                <th className="py-2 pr-3 font-medium">Stripe</th>
                <th className="py-2 pr-3 font-medium">Created</th>
                <th className="py-2 font-medium">Last activity</th>
              </tr>
            </thead>
            <tbody>
              {businesses.map((b) => (
                <tr key={b.id} className="border-b border-border last:border-0">
                  <td className="py-3 pr-3">
                    <Link href={`/platform/businesses/${b.id}`} className="font-medium text-heading underline">
                      {b.name}
                    </Link>
                    <div className="text-xs text-muted">{b.slug}</div>
                  </td>
                  <td className="py-3 pr-3">
                    <Badge variant={b.deleted_at ? "default" : b.status === "active" ? "success" : "warning"}>
                      {b.deleted_at ? "deleted" : b.status}
                    </Badge>
                  </td>
                  <td className="py-3 pr-3">
                    <div className="flex flex-col gap-1">
                      <Badge variant={b.requiresPayment ? "warning" : "success"}>
                        {b.subscription_status}
                      </Badge>
                      {b.daysLeftInTrial != null && !b.requiresPayment && (
                        <span className="text-xs text-muted">{b.daysLeftInTrial}d left</span>
                      )}
                      {b.requiresPayment && <span className="text-xs text-amber-700">paywalled</span>}
                    </div>
                  </td>
                  <td className="py-3 pr-3">{b.plan}</td>
                  <td className="py-3 pr-3">{b.clientCount}</td>
                  <td className="py-3 pr-3">{b.projectCount}</td>
                  <td className="py-3 pr-3">{b.mediaCount}</td>
                  <td className="py-3 pr-3">{formatCurrency(b.lifetimeRevenueCents)}</td>
                  <td className="py-3 pr-3">{b.stripeStatus}</td>
                  <td className="py-3 pr-3">{formatDate(b.created_at)}</td>
                  <td className="py-3">{formatDate(b.lastActivityAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
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
