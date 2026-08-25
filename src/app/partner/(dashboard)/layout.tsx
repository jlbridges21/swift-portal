import { redirect } from "next/navigation";
import { requirePartnerCapability } from "@/lib/capabilities";

export const dynamic = "force-dynamic";

/**
 * Guarded partner dashboard routes (/partner/dashboard, /partner/landing, …).
 * requirePartnerCapability stays on the layout — do not re-gate page by page.
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
