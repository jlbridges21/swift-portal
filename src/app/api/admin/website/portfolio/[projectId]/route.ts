import { NextResponse } from "next/server";
import { getProfile } from "@/lib/auth";
import { isOwnerAdmin } from "@/lib/staff-access";
import { getTenantContext, missingTenantResponse } from "@/lib/tenant";
import { getAppSettings } from "@/lib/app-settings";
import { loadProjectMediaChoices } from "@/lib/website/portfolio-server";

export const dynamic = "force-dynamic";

/** What COULD be shown publicly for one Delivered project (client-visible delivery media + tours). */
export async function GET(_request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const profile = await getProfile();
  if (!profile || !isOwnerAdmin(profile)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const tenant = await getTenantContext();
  if (!tenant) return missingTenantResponse(profile.role);
  const { projectId } = await params;
  const choices = await loadProjectMediaChoices(tenant.businessId, projectId);
  if (!choices) return NextResponse.json({ error: "Only Delivered projects can be added to your portfolio." }, { status: 404 });
  const settings = await getAppSettings(tenant.businessId);
  const entry = settings.portfolio.entries.find((e) => e.projectId === projectId) ?? null;
  return NextResponse.json({ ...choices, entry });
}
