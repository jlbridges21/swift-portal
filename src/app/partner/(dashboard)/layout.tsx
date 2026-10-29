import { redirect } from "next/navigation";
import { requirePartnerCapability } from "@/lib/capabilities";
import { isPartnerCommissionEligible } from "@/lib/partner-commissions";

export const dynamic = "force-dynamic";

/**
 * Guarded partner dashboard routes. requirePartnerCapability stays on this layout —
 * do not re-gate page by page. Shell lives in ../layout.tsx.
 */
export default async function PartnerDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const capability = await requirePartnerCapability();
  if (capability.kind === "suspended") {
    redirect("/partner");
  }

  // Commission-ineligible (demo) partner: same dashboard, but every amount is clearly non-payable.
  if (!isPartnerCommissionEligible(capability.partner)) {
    return (
      <>
        <div
          role="note"
          className="mx-auto mb-4 max-w-6xl rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
        >
          <strong>Demo partner account.</strong> This account shows how the partner program works.
          Commissions are not earned or paid out here, so any commission amounts are demo examples only,
          not real earnings.
        </div>
        {children}
      </>
    );
  }

  return children;
}
