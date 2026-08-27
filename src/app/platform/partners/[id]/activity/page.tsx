import { notFound } from "next/navigation";
import { requireSuperAdminPage } from "@/lib/admin-access";
import { getPartnerById } from "@/lib/partners";
import { loadPartnerPlatformActivity } from "@/lib/partner-program";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function PlatformPartnerActivityPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireSuperAdminPage();
  const { id } = await params;
  const partner = await getPartnerById(id);
  if (!partner) notFound();

  const rows = await loadPartnerPlatformActivity(id);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-heading">Activity</h2>
        <p className="mt-1 text-sm text-muted">
          Platform audit events for this partner (updates, payouts, adjustments, landing changes).
        </p>
      </div>
      <Card>
        <CardContent className="overflow-x-auto pt-6">
          {rows.length === 0 ? (
            <p className="text-sm text-muted">No audit activity for this partner yet.</p>
          ) : (
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-border text-muted">
                  <th className="py-2 pr-3 font-medium">When</th>
                  <th className="py-2 pr-3 font-medium">Actor</th>
                  <th className="py-2 pr-3 font-medium">Action</th>
                  <th className="py-2 font-medium">Metadata</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-border align-top last:border-0">
                    <td className="py-2 pr-3 whitespace-nowrap">{formatDate(row.created_at)}</td>
                    <td className="py-2 pr-3">{row.actor_email || "—"}</td>
                    <td className="py-2 pr-3 font-mono text-xs">{row.action}</td>
                    <td className="py-2 font-mono text-xs text-muted">
                      {row.metadata ? JSON.stringify(row.metadata) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
