import { getProfile } from "@/lib/auth";
import { getCapabilities } from "@/lib/capabilities";
import { resolvePartnerAccess } from "@/lib/partner-dashboard";
import { PartnerShell } from "@/components/partner/partner-dashboard-shell";

export const dynamic = "force-dynamic";

/**
 * Partner surface shell — Header + main nav (+ partner section nav when active).
 * Entry (/partner) and guarded dashboard routes share this layout.
 * Partner DATA guards live in (dashboard)/layout.tsx only.
 */
export default async function PartnerLayout({ children }: { children: React.ReactNode }) {
  const profile = await getProfile();
  const caps = await getCapabilities();

  let partnerBrandName: string | null = null;
  if (profile && (caps.partner.active || caps.partner.suspended)) {
    const access = await resolvePartnerAccess(profile.id);
    if (access.kind !== "none") {
      partnerBrandName = access.partner.brand_name;
    }
  }

  return (
    <PartnerShell
      showPartnerSectionNav={caps.partner.active}
      partnerBrandName={partnerBrandName}
    >
      {children}
    </PartnerShell>
  );
}
