import { notFound } from "next/navigation";
import { requireSuperAdminPage } from "@/lib/admin-access";
import { getPartnerById } from "@/lib/partners";
import { PartnerPlatformSettingsForm } from "@/components/platform/partner-platform-settings-form";
import { PartnerCommissionEligibilityCard } from "@/components/platform/partner-commission-eligibility-card";

export const dynamic = "force-dynamic";

export default async function PlatformPartnerSettingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireSuperAdminPage();
  const { id } = await params;
  const partner = await getPartnerById(id);
  if (!partner) notFound();

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-heading">Settings</h2>
        <p className="mt-1 text-sm text-muted">
          Commission rate override, status, notes, and referral discount override. Same API and
          audit trail as editing from the partners list.
        </p>
      </div>
      <PartnerCommissionEligibilityCard
        partnerId={partner.id}
        eligible={partner.commission_eligible !== false}
        note={partner.commission_eligibility_note ?? null}
        updatedAt={partner.commission_eligibility_updated_at ?? null}
        migrationPending={partner.commission_eligible === undefined}
      />
      <PartnerPlatformSettingsForm partner={partner} />
    </div>
  );
}
