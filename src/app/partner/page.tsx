import { notFound, redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { canAccessPartnerEntry, getCapabilities } from "@/lib/capabilities";
import {
  loadPartnerApplyPrefill,
  resolvePartnerEntryState,
} from "@/lib/partner-entry";
import { loadPartnerProgramMarketingData } from "@/lib/partner-program-marketing";
import {
  PartnerApplicationDeclined,
  PartnerApplicationPending,
  PartnerApplicationWithdrawn,
  PartnerProgramPitch,
  PartnerSuspendedEntry,
} from "@/components/partner/partner-program-pitch";

export const dynamic = "force-dynamic";
/** Revalidate so plan / default-rate / referral-discount edits show without redeploy. */
export const revalidate = 60;

export default async function PartnerEntryPage() {
  const profile = await getProfile();
  if (!profile) redirect("/login?redirect=/partner");

  const caps = await getCapabilities();
  if (!canAccessPartnerEntry(caps)) notFound();

  const state = await resolvePartnerEntryState();
  if (!state) notFound();

  const isBusinessAdmin = profile.role === "admin" || profile.role === "super_admin";

  if (state.kind === "active") {
    redirect("/partner/dashboard");
  }

  if (state.kind === "suspended") {
    return (
      <PartnerSuspendedEntry
        brandName={state.partner.brand_name}
        isBusinessAdmin={isBusinessAdmin}
      />
    );
  }

  if (state.kind === "application_pending") {
    return (
      <PartnerApplicationPending
        appliedAt={state.application.created_at}
        isBusinessAdmin={isBusinessAdmin}
      />
    );
  }

  if (state.kind === "application_declined") {
    return <PartnerApplicationDeclined isBusinessAdmin={isBusinessAdmin} />;
  }

  const [data, prefill] = await Promise.all([
    loadPartnerProgramMarketingData(),
    loadPartnerApplyPrefill(),
  ]);
  if (!prefill) notFound();

  if (state.kind === "application_withdrawn") {
    return (
      <PartnerApplicationWithdrawn
        data={data}
        prefill={prefill}
        isBusinessAdmin={isBusinessAdmin}
      />
    );
  }

  return <PartnerProgramPitch data={data} prefill={prefill} isBusinessAdmin={isBusinessAdmin} />;
}
