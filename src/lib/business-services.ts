import { createServiceClient } from "@/lib/supabase/server";
import type { BusinessServiceRow, QuoteLineItem } from "@/lib/types";
import {
  buildPreliminaryEstimatePayloadFromTemplate,
  FALLBACK_SERVICE_TEMPLATES,
  getServicePaymentDescription,
  matchServiceTemplate,
  type ServiceTemplate,
} from "@/lib/service-templates";

export type { BusinessServiceRow };

/**
 * No process TTL. Same class of bug as app-settings: a Map hit on another
 * isolate after save returned the previous catalog. Reads always go to the DB
 * (one small query, already filtered by business_id).
 */
export function invalidateBusinessServicesCache(_businessId?: string) {
  // No process cache.
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item));
}

function asLineItems(value: unknown): QuoteLineItem[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    const row = item as { description?: unknown; amount_cents?: unknown };
    return {
      description: String(row.description ?? ""),
      amount_cents: Number(row.amount_cents ?? 0),
    };
  });
}

export function rowToServiceTemplate(row: BusinessServiceRow): ServiceTemplate {
  return {
    id: row.slug,
    dbId: row.id,
    serviceNames: row.aliases.length ? row.aliases : [row.name],
    title: row.name,
    startingAtCents: row.preliminary_estimate_cents,
    startingLabel: row.starting_label ?? "",
    lineItems: row.line_items,
    includes: row.includes,
    description: row.description ?? undefined,
    notes: row.notes ?? "",
    hidePricing: row.hide_pricing,
    recommended: row.is_recommended,
  };
}

function parseRow(raw: Record<string, unknown>): BusinessServiceRow {
  return {
    id: String(raw.id),
    business_id: String(raw.business_id),
    name: String(raw.name),
    slug: String(raw.slug),
    description: raw.description == null ? null : String(raw.description),
    preliminary_estimate_cents:
      raw.preliminary_estimate_cents == null ? null : Number(raw.preliminary_estimate_cents),
    starting_label: raw.starting_label == null ? null : String(raw.starting_label),
    includes: asStringArray(raw.includes),
    line_items: asLineItems(raw.line_items),
    notes: raw.notes == null ? null : String(raw.notes),
    hide_pricing: Boolean(raw.hide_pricing),
    is_recommended: Boolean(raw.is_recommended),
    display_order: Number(raw.display_order ?? 0),
    is_active: raw.is_active !== false,
    aliases: asStringArray(raw.aliases),
  };
}

export async function listBusinessServices(
  businessId: string,
  options?: { activeOnly?: boolean; bypassCache?: boolean }
): Promise<BusinessServiceRow[]> {
  const supabase = await createServiceClient();
  let query = supabase
    .from("business_services")
    .select(
      "id, business_id, name, slug, description, preliminary_estimate_cents, starting_label, includes, line_items, notes, hide_pricing, is_recommended, display_order, is_active, aliases"
    )
    .eq("business_id", businessId)
    .order("display_order", { ascending: true });

  if (options?.activeOnly) query = query.eq("is_active", true);

  const { data, error } = await query;
  if (error) {
    console.warn("[business-services] load failed:", error.message);
    return [];
  }

  return (data ?? []).map((row) => parseRow(row as Record<string, unknown>));
}

export async function listServiceTemplatesForBusiness(
  businessId: string
): Promise<ServiceTemplate[]> {
  const rows = await listBusinessServices(businessId);
  if (rows.length === 0) {
    return FALLBACK_SERVICE_TEMPLATES.map((template) => ({ ...template }));
  }
  return rows.map(rowToServiceTemplate);
}

export async function listActiveServiceOptions(
  businessId: string
): Promise<{ value: string; label: string }[]> {
  const all = await listBusinessServices(businessId, { bypassCache: true });
  if (all.length === 0) {
    return FALLBACK_SERVICE_TEMPLATES.map((t) => ({ value: t.title, label: t.title }));
  }
  return all
    .filter((row) => row.is_active)
    .map((row) => ({ value: row.name, label: row.name }));
}

export function slugifyServiceName(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return slug || "service";
}

export async function resolveServiceId(
  businessId: string,
  serviceType: string
): Promise<string | null> {
  const rows = await listBusinessServices(businessId);
  if (!rows.length) return null;
  const templates = rows.map(rowToServiceTemplate);
  const matched = matchServiceTemplate(serviceType, templates);
  return matched.dbId ?? null;
}

export async function getServiceTemplate(
  serviceType: string,
  businessId: string
): Promise<ServiceTemplate> {
  const templates = await listServiceTemplatesForBusiness(businessId);
  return matchServiceTemplate(serviceType, templates);
}

export async function buildPreliminaryEstimatePayload(
  serviceType: string,
  brand: { portalName: string; businessName: string } | undefined,
  businessId: string
) {
  const template = await getServiceTemplate(serviceType, businessId);
  return buildPreliminaryEstimatePayloadFromTemplate(template, brand);
}

export async function getServicePaymentDescriptionForBusiness(
  serviceType: string,
  businessId: string
): Promise<string> {
  const template = await getServiceTemplate(serviceType, businessId);
  return getServicePaymentDescription(serviceType, template);
}
