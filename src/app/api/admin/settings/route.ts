import { NextResponse } from "next/server";
import { getProfile } from "@/lib/auth";
import {
  getAppSettings,
  saveAppSettings,
  type AppSettings,
  NOTIFICATION_EVENT_DEFINITIONS,
} from "@/lib/app-settings";
import { getTenantContext, LEGACY_DEFAULT_BUSINESS_ID } from "@/lib/tenant";

export async function GET() {
  const profile = await getProfile();
  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenant = await getTenantContext();
  const businessId =
    tenant?.businessId ?? LEGACY_DEFAULT_BUSINESS_ID; // TODO(tenant): require tenant on settings API
  const settings = await getAppSettings(businessId);
  return NextResponse.json({
    settings,
    notificationEvents: NOTIFICATION_EVENT_DEFINITIONS,
  });
}

export async function PATCH(request: Request) {
  const profile = await getProfile();
  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as { settings?: Partial<AppSettings> };
    if (!body.settings) {
      return NextResponse.json({ error: "Missing settings" }, { status: 400 });
    }

    const tenant = await getTenantContext();
    const businessId =
      tenant?.businessId ?? LEGACY_DEFAULT_BUSINESS_ID; // TODO(tenant): require tenant on settings API
    const saved = await saveAppSettings(body.settings, profile.id, businessId);
    return NextResponse.json({ settings: saved });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save settings";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
