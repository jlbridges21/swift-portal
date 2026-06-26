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
