import { requireSuperAdminPage } from "@/lib/admin-access";
import { loadPlatformAudit, loadPlatformBusinesses } from "@/lib/platform-dashboard";
import { formatDate } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export const dynamic = "force-dynamic";

export default async function PlatformAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ actor?: string; action?: string; business?: string; from?: string; to?: string }>;
}) {
  await requireSuperAdminPage();
  const sp = await searchParams;
  const [rows, businesses] = await Promise.all([
    loadPlatformAudit({
      actor: sp.actor,
      action: sp.action,
      businessId: sp.business,
      from: sp.from,
      to: sp.to,
    }),
    loadPlatformBusinesses(),
  ]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="mb-6 text-2xl font-bold text-heading">Platform audit log</h1>
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5" method="get">
            <div>
              <Label htmlFor="actor">Actor email</Label>
              <Input id="actor" name="actor" defaultValue={sp.actor ?? ""} className="mt-1" />
            </div>
            <div>
              <Label htmlFor="action">Action</Label>
              <Input id="action" name="action" defaultValue={sp.action ?? ""} className="mt-1" />
            </div>
            <div>
              <Label htmlFor="business">Business id</Label>
              <Input id="business" name="business" defaultValue={sp.business ?? ""} className="mt-1" />
            </div>
            <div>
              <Label htmlFor="from">From</Label>
              <Input id="from" name="from" type="date" defaultValue={sp.from ?? ""} className="mt-1" />
            </div>
            <div>
              <Label htmlFor="to">To</Label>
              <Input id="to" name="to" type="date" defaultValue={sp.to ?? ""} className="mt-1" />
            </div>
            <div className="flex items-end">
              <Button type="submit">Apply</Button>
            </div>
          </form>
          <p className="mt-3 text-xs text-muted">{businesses.length} businesses in the directory for reference.</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="overflow-x-auto pt-6">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-muted">
                <th className="py-2 pr-3 font-medium">When</th>
                <th className="py-2 pr-3 font-medium">Actor</th>
                <th className="py-2 pr-3 font-medium">Action</th>
                <th className="py-2 pr-3 font-medium">Business</th>
                <th className="py-2 font-medium">Metadata</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-border align-top last:border-0">
                  <td className="py-2 pr-3">{formatDate(row.created_at)}</td>
                  <td className="py-2 pr-3">{row.actor_email}</td>
                  <td className="py-2 pr-3 font-medium">{row.action}</td>
                  <td className="py-2 pr-3 font-mono text-xs">{row.target_business_id}</td>
                  <td className="py-2 font-mono text-xs">{JSON.stringify(row.metadata)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && <p className="text-sm text-muted">No matching events.</p>}
        </CardContent>
      </Card>
    </main>
  );
}
