import { requireSuperAdminPage } from "@/lib/admin-access";
import { NewBusinessForm } from "@/components/platform/new-business-form";
import { listActivePlans } from "@/lib/entitlements";
import { listActivePartnersForSelect } from "@/lib/partners";

export const dynamic = "force-dynamic";

export default async function NewBusinessPage() {
  await requireSuperAdminPage();
  const [plans, partners] = await Promise.all([
    listActivePlans(),
    listActivePartnersForSelect(),
  ]);
  return (
    <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="mb-2 text-2xl font-bold text-heading">Onboard a business</h1>
      <p className="mb-8 text-muted">
        Creates the tenant row, valid platform-generic settings, Stripe stub, starter catalog, and
        invites the first admin. Does not copy another business&apos;s sender email. Optional partner
        attribution is written once at create (manual source).
      </p>
      <NewBusinessForm plans={plans} partners={partners} />
    </main>
  );
}
