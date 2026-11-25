import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getTenantContext, missingTenantResponse } from "@/lib/tenant";
import { isOwnerAdmin } from "@/lib/staff-access";
import { getAppSettings, saveAppSettings } from "@/lib/app-settings";

/**
 * The business's Google "block" calendars (Settings → Instant Booking → calendars that block
 * availability), so the Shoot Calendar's Connect calendar modal edits the same setting.
 */
async function ownerContext() {
  const profile = await requireAdmin({ adminOnly: true }).catch(() => null);
  if (!profile || !isOwnerAdmin(profile)) {
    return { error: NextResponse.json({ error: "Only the business owner can change this." }, { status: 403 }) } as const;
  }
  const tenant = await getTenantContext();
  if (!tenant) return { error: missingTenantResponse(profile.role) } as const;
  return { profile, tenant } as const;
}

export async function GET() {
  const ctx = await ownerContext();
  if ("error" in ctx) return ctx.error;
  const settings = await getAppSettings(ctx.tenant.businessId);
  return NextResponse.json({ blockCalendarIds: settings.booking.blockCalendarIds });
}

export async function PATCH(request: Request) {
  const ctx = await ownerContext();
  if ("error" in ctx) return ctx.error;
  if (ctx.tenant.impersonating && !ctx.tenant.allowWrites) {
    return NextResponse.json({ error: "Read-only impersonation." }, { status: 403 });
  }
  const body = (await request.json().catch(() => ({}))) as { blockCalendarIds?: unknown };
  if (!Array.isArray(body.blockCalendarIds)) {
    return NextResponse.json({ error: "blockCalendarIds required" }, { status: 400 });
  }
  const blockCalendarIds = [
    ...new Set(body.blockCalendarIds.filter((id): id is string => typeof id === "string" && id.trim().length > 0).map((id) => id.trim())),
  ].slice(0, 20);
  const settings = await getAppSettings(ctx.tenant.businessId);
  await saveAppSettings({ booking: { ...settings.booking, blockCalendarIds } }, ctx.profile.id, ctx.tenant.businessId);
  return NextResponse.json({ blockCalendarIds });
}
