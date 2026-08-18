import { createTenantServiceClient } from "@/lib/supabase/tenant-service";
import { normalizeAddress, parseAddress } from "@/lib/address";
import type { Property, PropertyType } from "@/lib/types";

export { normalizeAddress, parseAddress };

export async function findOrCreateProperty(options: {
  businessId: string;
  clientId: string;
  fullAddress: string;
  propertyType?: PropertyType;
  nickname?: string | null;
  notes?: string | null;
}): Promise<Property | null> {
  const fullAddress = options.fullAddress?.trim();
  if (!fullAddress) return null;

  const db = await createTenantServiceClient(options.businessId);
  const parsed = parseAddress(fullAddress);
  const normalized = parsed.normalized || normalizeAddress(fullAddress);

  const { data: existing } = await db
    .from("properties")
    .select("*")
    .eq("client_id", options.clientId)
    .eq("normalized_address", normalized)
    .maybeSingle();

  if (existing) return existing as Property;

  const insertRow = {
    client_id: options.clientId,
    address: fullAddress,
    normalized_address: normalized,
    city: parsed.city,
    state: parsed.state,
    zip: parsed.zip,
    property_type: options.propertyType ?? "Other",
    nickname: options.nickname ?? parsed.address.split(",")[0] ?? null,
    notes: options.notes ?? null,
  };

  const { data: created, error } = await db
    .from("properties")
    .insert(insertRow)
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      const { data: retry } = await db
        .from("properties")
        .select("*")
        .eq("client_id", options.clientId)
        .eq("normalized_address", normalized)
        .maybeSingle();
      return (retry as Property) ?? null;
    }
    console.warn("[properties] create failed:", error.message);
    return null;
  }

  return created as Property;
}

export async function linkProjectToProperty(
  projectId: string,
  clientId: string,
  fullAddress: string,
  businessId: string,
  propertyType?: PropertyType
): Promise<string | null> {
  const property = await findOrCreateProperty({
    businessId,
    clientId,
    fullAddress,
    propertyType,
  });
  if (!property) return null;

  const db = await createTenantServiceClient(businessId);
  await db.from("projects").update({ property_id: property.id }).eq("id", projectId);

  return property.id;
}

export { formatPropertyLabel } from "@/lib/address";
