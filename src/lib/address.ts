export interface ParsedAddress {
  address: string;
  city: string | null;
  state: string | null;
  zip: string | null;
  normalized: string;
}

/** Normalize an address for deduplication lookups. */
export function normalizeAddress(address: string): string {
  return address
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[.#]/g, "");
}

/** Best-effort US address parsing from a single-line string. */
export function parseAddress(fullAddress: string): ParsedAddress {
  const address = fullAddress.trim();
  const normalized = normalizeAddress(address);
  const parts = address.split(",").map((p) => p.trim()).filter(Boolean);

  if (parts.length < 2) {
    return { address, city: null, state: null, zip: null, normalized };
  }

  const street = parts[0];
  const city = parts.length >= 3 ? parts[1] : null;
  const stateZip = parts.length >= 3 ? parts[2] : parts[1];
  const stateZipMatch = stateZip?.match(/^([A-Za-z]{2})\s*(\d{5}(?:-\d{4})?)?$/);

  return {
    address: street,
    city: city ?? (stateZipMatch ? null : parts[1] ?? null),
    state: stateZipMatch?.[1]?.toUpperCase() ?? null,
    zip: stateZipMatch?.[2] ?? null,
    normalized,
  };
}

export function buildFullAddress(fields: {
  street_address: string;
  city: string;
  state?: string;
  zip_code: string;
}): string {
  const street = fields.street_address.trim();
  const cityZip = [fields.city.trim(), fields.zip_code.trim()].filter(Boolean).join(", ");
  if (fields.state?.trim()) {
    const cityStateZip = [fields.city.trim(), fields.state.trim().toUpperCase(), fields.zip_code.trim()]
      .filter(Boolean)
      .join(", ");
    return [street, cityStateZip].filter(Boolean).join(", ");
  }
  return [street, cityZip].filter(Boolean).join(", ");
}

export function validateStreetCityZip(fields: {
  street_address?: string;
  city?: string;
  zip?: string;
}): string | null {
  if (!fields.street_address?.trim()) return "Street address is required.";
  if (!fields.city?.trim()) return "City is required.";
  if (!fields.zip?.trim()) return "ZIP code is required.";
  return null;
}

export function validateStructuredAddress(fields: {
  street_address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
}): string | null {
  if (!fields.street_address?.trim()) return "Street address is required.";
  if (!fields.city?.trim()) return "City is required.";
  if (!fields.state?.trim()) return "State is required.";
  if (!fields.zip_code?.trim()) return "ZIP code is required.";
  return null;
}

export function resolveAddressFromBody(body: Record<string, unknown>): {
  property_address: string;
  error?: string;
} {
  const street = String(body.street_address ?? "").trim();
  const city = String(body.city ?? "").trim();
  const zip = String(body.zip ?? body.zip_code ?? "").trim();
  const state = String(body.state ?? "").trim();
  const legacy = String(body.property_address ?? "").trim();

  if (street && city && zip) {
    return {
      property_address: buildFullAddress({
        street_address: street,
        city,
        state: state || undefined,
        zip_code: zip,
      }),
    };
  }

  if (legacy) return { property_address: legacy };

  const err =
    validateStreetCityZip({ street_address: street, city, zip }) ??
    (street || city || zip ? "Street address, city, and ZIP are required." : "Complete address is required.");
  return { property_address: "", error: err };
}

/** Auto project title: "Client Name - Street Address - Service" */
export function formatAutoProjectName(
  clientName: string,
  streetAddress: string,
  serviceType: string
): string {
  return [clientName.trim(), streetAddress.trim(), serviceType.trim()].filter(Boolean).join(" - ");
}

export function defaultProjectTitle(propertyAddress: string, serviceType: string): string {
  const label = propertyAddress.split(",")[0]?.trim() || propertyAddress.trim();
  return `${label} — ${serviceType}`;
}

export function formatPropertyLabel(property: {
  nickname?: string | null;
  address: string;
  city?: string | null;
  state?: string | null;
}): string {
  if (property.nickname) return property.nickname;
  const parts = [property.address, property.city, property.state].filter(Boolean);
  return parts.join(", ");
}
