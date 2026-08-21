import { createServiceClient } from "@/lib/supabase/server";
import { listBusinessServices } from "@/lib/business-services";
import {
  mergeLandingSettings,
  resolveLandingPage,
  type LandingSettings,
  type ResolvedLandingPage,
} from "@/lib/landing-content";
import type { AppSettings } from "@/lib/app-settings";

async function loadPropertyTypes(businessId: string): Promise<string[]> {
  try {
    const raw = await createServiceClient();
    const { data } = await raw
      .from("properties")
      .select("property_type")
      .eq("business_id", businessId)
      .not("property_type", "is", null)
      .limit(100);
    const out: string[] = [];
    for (const row of data ?? []) {
      const v = typeof row.property_type === "string" ? row.property_type.trim() : "";
      if (v && !out.includes(v)) out.push(v);
    }
    return out;
  } catch {
    return [];
  }
}

async function loadBusinessName(businessId: string): Promise<string | null> {
  try {
    const raw = await createServiceClient();
    const { data } = await raw.from("businesses").select("name").eq("id", businessId).maybeSingle();
    return typeof data?.name === "string" && data.name.trim() ? data.name.trim() : null;
  } catch {
    return null;
  }
}

/** Build the client landing view model for a tenant (derived defaults, live services). */
export async function loadResolvedLandingPage(
  businessId: string,
  settings: AppSettings,
  businessNameOverride?: string | null
): Promise<{ page: ResolvedLandingPage; businessName: string }> {
  const landing = mergeLandingSettings(settings.landing as LandingSettings);
  const serviceRows = await listBusinessServices(businessId, { activeOnly: true });
  const active = serviceRows.filter((s) => s.is_active);
  const serviceNames = active.map((s) => s.name);
  const propertyTypes = await loadPropertyTypes(businessId);
  const fromDb = businessNameOverride?.trim() || (await loadBusinessName(businessId));
  const businessName =
    fromDb ||
    settings.business.businessName ||
    settings.business.portalName ||
    "Studio";

  const page = resolveLandingPage({
    landing,
    businessName,
    portalName: settings.business.portalName || businessName,
    serviceNames,
    propertyTypes,
    services: active.map((s) => ({
      name: s.name,
      startingLabel: s.starting_label ?? "",
      description: s.description ?? "",
    })),
  });

  return { page, businessName };
}
