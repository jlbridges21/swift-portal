import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getPublicHostContext, lookupBusinessById } from "@/lib/host-resolution";
import { getPlatformRootDomain } from "@/lib/site-metadata";
import { resolvePartnerAccess } from "@/lib/partner-dashboard";
import { adminHomePath } from "@/lib/onboarding";
import { getBusinessPortalOrigin, joinPortalPath } from "@/lib/portal-url";
import { FinishSetupForm } from "./finish-setup-form";

export const dynamic = "force-dynamic";

export default async function FinishSetupPage() {
  const host = await getPublicHostContext();
  if (host.kind === "tenant") {
    redirect("/login");
  }

  const profile = await getProfile();
  if (!profile) {
    redirect("/login");
  }

  if (profile.role === "super_admin") {
    redirect("/platform");
  }

  if (profile.business_id) {
    const biz = await lookupBusinessById(profile.business_id);
    const path = adminHomePath({
      onboardingCompletedAt: biz?.onboarding_completed_at,
      onboardingState: biz?.onboarding_state,
    });
    if (biz) {
      redirect(joinPortalPath(getBusinessPortalOrigin(biz), path));
    }
    redirect(path);
  }

  const partnerAccess = await resolvePartnerAccess(profile.id);
  if (partnerAccess.kind === "active" || partnerAccess.kind === "suspended") {
    redirect("/partner");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) {
    redirect("/login");
  }

  return (
    <FinishSetupForm
      platformRootDomain={getPlatformRootDomain()}
      defaultOwnerName={profile.full_name || ""}
      email={user.email}
    />
  );
}
