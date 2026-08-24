import { requireSuperAdminPage } from "@/lib/admin-access";
import { listPartnerApplications, listPartners } from "@/lib/partners";
import { PartnersManager } from "@/components/platform/partners-manager";

export const dynamic = "force-dynamic";

export default async function PlatformPartnersPage() {
  await requireSuperAdminPage();
  const [applications, partners] = await Promise.all([
    listPartnerApplications("all"),
    listPartners("all"),
  ]);

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="mb-2 text-2xl font-bold text-heading">Partners</h1>
      <p className="mb-8 text-muted">
        Review partner applications, invite partners, and manage referral codes and commission
        rates. Referral attribution is inspectable here and on each business; commissions and
        partner dashboards come later.
      </p>
      <PartnersManager initialApplications={applications} initialPartners={partners} />
    </main>
  );
}
