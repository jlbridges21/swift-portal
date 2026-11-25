/**
 * Team pay — who may do what (API routes).
 *
 * - Settings (plans, rates, who's on which plan): the business owner only.
 * - Reviewing and approving pay: the owner, or staff given "Review & approve team pay".
 * - My pay: any active team member, for their own pay only.
 */
import { NextResponse } from "next/server";
import { getProfile } from "@/lib/auth";
import { getTenantContext, missingTenantResponse } from "@/lib/tenant";
import { isActiveStaff, isOwnerAdmin, staffCan } from "@/lib/staff-access";
import { TeamPayError, TeamPayNotReady } from "./server";

export type TeamPayLevel = "owner" | "manager" | "member";

export async function teamPayActor(level: TeamPayLevel, write = false) {
  const profile = await getProfile();
  if (!profile) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) } as const;
  const tenant = await getTenantContext();
  if (!tenant || tenant.isSharedViewer) return { error: missingTenantResponse(profile.role) } as const;
  const owner = isOwnerAdmin(profile);
  const staff = isActiveStaff(profile);
  const manager = owner || (staff && staffCan(profile, "teampay.approve"));
  const allowed = level === "owner" ? owner : level === "manager" ? manager : owner || staff;
  if (!allowed) return { error: NextResponse.json({ error: "You don't have access to this." }, { status: 403 }) } as const;
  if (write && tenant.impersonating && !tenant.allowWrites) {
    return { error: NextResponse.json({ error: "Read-only impersonation." }, { status: 403 }) } as const;
  }
  return { profile, tenant, businessId: tenant.businessId, owner, manager } as const;
}

export function teamPayFailure(err: unknown) {
  if (err instanceof TeamPayNotReady) return NextResponse.json({ error: err.message, notReady: true }, { status: 503 });
  if (err instanceof TeamPayError) return NextResponse.json({ error: err.message }, { status: 400 });
  console.error("[team-pay]", err instanceof Error ? err.message.slice(0, 300) : "unknown error");
  return NextResponse.json({ error: "Something went wrong. Try again." }, { status: 500 });
}
