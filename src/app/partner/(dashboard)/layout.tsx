import { redirect } from "next/navigation";
import { requirePartnerCapability } from "@/lib/capabilities";

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

  return children;
}
