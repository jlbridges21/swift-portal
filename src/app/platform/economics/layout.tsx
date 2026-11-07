import type { ReactNode } from "react";
import { requireSuperAdminPage } from "@/lib/admin-access";
import { EconomicsTabs } from "@/components/platform/economics/tabs";

export const dynamic = "force-dynamic";

export default async function EconomicsLayout({ children }: { children: ReactNode }) {
  await requireSuperAdminPage();
  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-5">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600">Platform economics</p>
        <h1 className="mt-1 text-2xl font-bold text-heading">Infrastructure, revenue &amp; pricing</h1>
        <p className="mt-1 text-sm text-muted">
          What ShootPortal stores, delivers and earns — and what each business costs to serve. Internal only.
        </p>
      </div>
      <EconomicsTabs />
      <div className="mt-6">{children}</div>
    </main>
  );
}
