/**
 * Server-side setup checklist for admin pages — no client fetch flash.
 */

import { createServiceClient } from "@/lib/supabase/server";
import { getAppSettings, type AppSettings } from "@/lib/app-settings";
import { listBusinessServices } from "@/lib/business-services";
import {
  buildSetupChecklistItems,
  type ChecklistItem,
  type ServiceCompletenessRow,
} from "@/lib/setup-completeness";
import { getLiveConnectStatus, isPlatformStripeBusiness } from "@/lib/stripe-connect";

export type SetupChecklistSnapshot = {
  items: ChecklistItem[];
  incomplete: boolean;
  /** When set, banner must never show again. */
  completedAt: string | null;
};

export async function loadSetupChecklistSnapshot(
  businessId: string,
  settings?: AppSettings
): Promise<SetupChecklistSnapshot> {
  const raw = await createServiceClient();
  const [{ data: biz }, appSettings, services] = await Promise.all([
    raw
      .from("businesses")
      .select("setup_checklist_completed_at, custom_domain, custom_domain_status")
      .eq("id", businessId)
      .maybeSingle(),
    settings ? Promise.resolve(settings) : getAppSettings(businessId),
    listBusinessServices(businessId, { activeOnly: false }),
  ]);

  const completedAt = biz?.setup_checklist_completed_at ?? null;
  if (completedAt) {
    return { items: [], incomplete: false, completedAt };
  }

  let stripeOk = false;
  try {
    if (isPlatformStripeBusiness(businessId)) {
      stripeOk = true;
    } else {
      const live = await getLiveConnectStatus(businessId);
      stripeOk = live.status === "active";
    }
  } catch {
    stripeOk = false;
  }

  const serviceRows: ServiceCompletenessRow[] = services.map((s) => ({
    slug: s.slug,
    is_active: s.is_active,
    hide_pricing: s.hide_pricing,
    preliminary_estimate_cents: s.preliminary_estimate_cents,
  }));

  const customDomainConnected =
    Boolean(biz?.custom_domain?.trim()) &&
    (biz?.custom_domain_status === "connected" || biz?.custom_domain_status == null);

  const items = buildSetupChecklistItems({
    settings: appSettings,
    stripeOk,
    services: serviceRows,
    customDomainConnected,
  });
  const incomplete = items.some((item) => !item.done);

  if (!incomplete) {
    const stamp = new Date().toISOString();
    await raw
      .from("businesses")
      .update({ setup_checklist_completed_at: stamp })
      .eq("id", businessId)
      .is("setup_checklist_completed_at", null);
    return { items, incomplete: false, completedAt: stamp };
  }

  return { items, incomplete: true, completedAt: null };
}
