/**
 * Straight-line miles between ZIP centroids stored in zip_codes.
 * Returns one-way miles. Round-trip doubling lives only in travel-fee.ts.
 * No cache: each call reads the two rows.
 */

const EARTH_RADIUS_MILES = 3958.7613;

export type ZipPoint = { latitude: number; longitude: number };

export function haversineMiles(origin: ZipPoint, destination: ZipPoint): number {
  const toRad = (degrees: number) => (degrees * Math.PI) / 180;
  const lat1 = toRad(origin.latitude);
  const lat2 = toRad(destination.latitude);
  const dLat = lat2 - lat1;
  const dLon = toRad(destination.longitude - origin.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Five-digit US ZIP, or null when the value is not one. */
export function normalizeUsZip(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const match = raw.trim().match(/^(\d{5})(?:-\d{4})?$/);
  return match ? match[1] : null;
}

const NON_US_COUNTRY = /\b(canada|mexico|united kingdom|australia|uk)\b/i;
const CANADIAN_POSTAL = /\b[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d\b/;

export function isUsCountry(country: string | null | undefined): boolean {
  const value = (country ?? "").trim().toLowerCase();
  if (!value) return true;
  return (
    value === "us" ||
    value === "usa" ||
    value === "u.s." ||
    value === "u.s.a." ||
    value === "united states" ||
    value === "united states of america"
  );
}

export type AddressZip =
  | { ok: true; zip: string }
  | { ok: false; reason: "missing" | "malformed" | "non_us" };

/** Last 5-digit ZIP in a property address. Canadian and named non-US countries fail as non-US. */
export function extractAddressZip(address: string | null | undefined): AddressZip {
  const text = (address ?? "").trim();
  if (!text) return { ok: false, reason: "missing" };
  if (CANADIAN_POSTAL.test(text) || NON_US_COUNTRY.test(text)) {
    return { ok: false, reason: "non_us" };
  }
  const matches = [...text.matchAll(/\b(\d{5})(?:-\d{4})?\b/g)];
  if (!matches.length) {
    if (/\d/.test(text)) return { ok: false, reason: "malformed" };
    return { ok: false, reason: "missing" };
  }
  return { ok: true, zip: matches[matches.length - 1][1] };
}

export type ZipQuery = {
  from: (table: string) => {
    select: (columns: string) => {
      in: (
        column: string,
        values: string[]
      ) => PromiseLike<{
        data: { zip: string; latitude: number; longitude: number }[] | null;
        error: { message: string } | null;
      }>;
    };
  };
};

export type ZipDistanceResult =
  | { ok: true; oneWayMiles: number }
  | {
      ok: false;
      reason:
        | "business_zip_missing"
        | "business_zip_invalid"
        | "business_zip_non_us"
        | "business_zip_unknown"
        | "property_zip_missing"
        | "property_zip_malformed"
        | "property_zip_non_us"
        | "property_zip_unknown"
        | "lookup_failed";
    };

export function zipDistanceFailureMessage(result: Extract<ZipDistanceResult, { ok: false }>): string {
  switch (result.reason) {
    case "business_zip_missing":
      return "Travel fee was not added because the business postal code is missing.";
    case "business_zip_invalid":
      return "Travel fee was not added because the business postal code is not a US ZIP code.";
    case "business_zip_non_us":
      return "Travel fee was not added because the business address is outside the United States.";
    case "business_zip_unknown":
      return "Travel fee was not added because the business ZIP code is not in the ZIP table.";
    case "property_zip_missing":
      return "Travel fee was not added because the property address has no ZIP code.";
    case "property_zip_malformed":
      return "Travel fee was not added because the property ZIP code is not a US ZIP code.";
    case "property_zip_non_us":
      return "Travel fee was not added because the property address is outside the United States.";
    case "property_zip_unknown":
      return "Travel fee was not added because that ZIP code is not in the ZIP table. PO Box-only ZIPs and typos are missing.";
    case "lookup_failed":
      return "Travel fee was not added because the ZIP lookup failed.";
  }
}

/**
 * One-way straight-line miles between two ZIPs.
 * `businessCountry` empty is treated as the United States.
 */
export async function oneWayMilesBetweenZips(
  db: ZipQuery,
  input: {
    businessPostalCode: string | null | undefined;
    businessCountry?: string | null;
    propertyAddress: string | null | undefined;
  }
): Promise<ZipDistanceResult> {
  if (!isUsCountry(input.businessCountry)) {
    return { ok: false, reason: "business_zip_non_us" };
  }
  const businessRaw = (input.businessPostalCode ?? "").trim();
  if (!businessRaw) return { ok: false, reason: "business_zip_missing" };
  const businessZip = normalizeUsZip(businessRaw);
  if (!businessZip) return { ok: false, reason: "business_zip_invalid" };

  const property = extractAddressZip(input.propertyAddress);
  if (!property.ok) {
    if (property.reason === "non_us") return { ok: false, reason: "property_zip_non_us" };
    if (property.reason === "malformed") return { ok: false, reason: "property_zip_malformed" };
    return { ok: false, reason: "property_zip_missing" };
  }

  const { data, error } = await db
    .from("zip_codes")
    .select("zip, latitude, longitude")
    .in("zip", [...new Set([businessZip, property.zip])]);

  if (error) return { ok: false, reason: "lookup_failed" };

  const points = new Map<string, ZipPoint>();
  for (const row of data ?? []) {
    points.set(row.zip, { latitude: Number(row.latitude), longitude: Number(row.longitude) });
  }
  const origin = points.get(businessZip);
  const destination = points.get(property.zip);
  if (!origin) return { ok: false, reason: "business_zip_unknown" };
  if (!destination) return { ok: false, reason: "property_zip_unknown" };

  const miles = haversineMiles(origin, destination);
  return { ok: true, oneWayMiles: Math.round(miles * 100) / 100 };
}
