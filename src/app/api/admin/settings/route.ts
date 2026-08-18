import { NextResponse } from "next/server";
import { getProfile } from "@/lib/auth";
import {
  getAppSettings,
  saveAppSettings,
  type AppSettings,
  NOTIFICATION_EVENT_DEFINITIONS,
} from "@/lib/app-settings";
import { getTenantContext } from "@/lib/tenant";

function missingTenantResponse(role: string) {
  const message =
    role === "super_admin"
      ? "No business context. Super admins must impersonate a business before reading or writing settings."
      : "No business context on this account. Cannot load or save settings.";
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function GET() {
  const profile = await getProfile();
  if (!profile || (profile.role !== "admin" && profile.role !== "super_admin")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenant = await getTenantContext();
  if (!tenant) return missingTenantResponse(profile.role);

  const settings = await getAppSettings(tenant.businessId);
  return NextResponse.json({
    settings,
    notificationEvents: NOTIFICATION_EVENT_DEFINITIONS,
  });
}

export async function PATCH(request: Request) {
  const profile = await getProfile();
  if (!profile || (profile.role !== "admin" && profile.role !== "super_admin")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenant = await getTenantContext();
  if (!tenant) return missingTenantResponse(profile.role);

  try {
    const body = (await request.json()) as { settings?: Partial<AppSettings> };
    if (!body.settings) {
      return NextResponse.json({ error: "Missing settings" }, { status: 400 });
    }

    const saved = await saveAppSettings(body.settings, profile.id, tenant.businessId);
    return NextResponse.json({ settings: saved });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save settings";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
