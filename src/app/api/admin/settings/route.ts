import { NextResponse } from "next/server";
import { getProfile } from "@/lib/auth";
import {
  getAppSettings,
  saveAppSettings,
  type AppSettings,
  NOTIFICATION_EVENT_DEFINITIONS,
} from "@/lib/app-settings";

export async function GET() {
  const profile = await getProfile();
  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const settings = await getAppSettings();
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

    const saved = await saveAppSettings(body.settings, profile.id);
    return NextResponse.json({ settings: saved });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save settings";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
