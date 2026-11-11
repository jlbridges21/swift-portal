import type { Metadata } from "next";
import { requireAdminPage } from "@/lib/admin-access";
import { loadPropertyWebsites } from "@/lib/sites-server";
import { PropertyWebsitesLibrary } from "@/components/admin/sites/property-websites-library";

export const metadata: Metadata = { title: "Property Websites · Sites" };
export const dynamic = "force-dynamic";

/**
 * Every eligible project and its property website (Marketing Kit). Open/Edit go to the
 * existing editor at /admin/projects/{id}/marketing — nothing is edited or created here.
 */
export default async function AdminSitesPropertyPage() {
  const { tenant } = await requireAdminPage({ adminOnly: true });
  const result = await loadPropertyWebsites(tenant.businessId);

  if (!result.ok) {
    return (
      <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted">
        Property websites could not be loaded. Refresh the page to try again.
      </p>
    );
  }
  return <PropertyWebsitesLibrary rows={result.rows} setupRequired={result.setupRequired} />;
}
