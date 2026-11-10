import type { Viewport } from "next";
import { getAppSettings } from "@/lib/app-settings";
import { getPublicHostContext } from "@/lib/host-resolution";
import { appChromeThemeColor } from "@/lib/pwa/metadata";

/** Status-bar color for app screens on a business host (matches the app header). */
export async function tenantAppViewport(): Promise<Viewport> {
  const host = await getPublicHostContext();
  if (host.kind !== "tenant" || !host.businessId) return {};
  const settings = await getAppSettings(host.businessId);
  return appChromeThemeColor(settings.business);
}
