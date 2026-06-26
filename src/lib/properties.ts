import { createServiceClient } from "@/lib/supabase/server";
import { normalizeAddress, parseAddress, type ParsedAddress } from "@/lib/address";
import type { Property, PropertyType } from "@/lib/types";

export { normalizeAddress, parseAddress };

export async function findOrCreateProperty(options: {
  clientId: string;
  fullAddress: string;
  propertyType?: PropertyType;
  nickname?: string | null;
  notes?: string | null;
}): Promise<Property | null> {
  const fullAddress = options.fullAddress?.trim();
  if (!fullAddress) return null;

  const supabase = await createServiceClient();
  const parsed = parseAddress(fullAddress);
  const normalized = parsed.normalized || normalizeAddress(fullAddress);

  const { data: existing } = await supabase
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

  const { data: created, error } = await supabase
    .from("properties")
    .insert(insertRow)
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      const { data: retry } = await supabase
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
  propertyType?: PropertyType
): Promise<string | null> {
  const property = await findOrCreateProperty({
    clientId,
    fullAddress,
    propertyType,
  });
  if (!property) return null;

  const supabase = await createServiceClient();
  await supabase.from("projects").update({ property_id: property.id }).eq("id", projectId);

  return property.id;
}

export { formatPropertyLabel } from "@/lib/address";
