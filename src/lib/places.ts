/**
 * Google Places API (New) — address autocomplete for property and base addresses.
 * Server-only: the browser talks to /api/places, never to Google, so GOOGLE_MAPS_API_KEY stays
 * private. Uses session tokens so a typing session + one details lookup bills as one session.
 *
 * Needs "Places API (New)" enabled on the key (and allowed in its API restrictions).
 */

import { usTimeZoneFor } from "@/lib/us-time-zones";

const AUTOCOMPLETE_URL = "https://places.googleapis.com/v1/places:autocomplete";
const DETAILS_URL = "https://places.googleapis.com/v1/places/";
const TIMEOUT_MS = 5000;

export type AddressSuggestion = { placeId: string; main: string; secondary: string };

export type ParsedAddress = {
  placeId: string;
  /** "123 Main St, Gulf Shores, AL 36542" (country dropped for US). */
  formatted: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  lat: number | null;
  lng: number | null;
  /** IANA zone of the address (Google, else from the state). */
  timeZone: string | null;
};

export function placesConfigured(): boolean {
  return Boolean(process.env.GOOGLE_MAPS_API_KEY?.trim());
}

function key(): string {
  return process.env.GOOGLE_MAPS_API_KEY!.trim();
}

/** Session tokens are client-generated UUID-ish strings; anything else is dropped. */
export function cleanSessionToken(raw: unknown): string | undefined {
  return typeof raw === "string" && /^[A-Za-z0-9_-]{8,64}$/.test(raw) ? raw : undefined;
}

export async function autocompleteAddresses(
  input: string,
  options: { sessionToken?: string; bias?: { lat: number; lng: number } | null } = {}
): Promise<AddressSuggestion[] | null> {
  const text = input.trim().slice(0, 200);
  if (!placesConfigured() || text.length < 3) return [];
  const body: Record<string, unknown> = {
    input: text,
    includedRegionCodes: ["us"],
    // Addresses only (no businesses or landmarks): street addresses, buildings, units.
    includedPrimaryTypes: ["street_address", "premise", "subpremise"],
    ...(options.sessionToken ? { sessionToken: options.sessionToken } : {}),
    ...(options.bias
      ? { locationBias: { circle: { center: { latitude: options.bias.lat, longitude: options.bias.lng }, radius: 50000 } } }
      : {}),
  };
  try {
    const res = await fetch(AUTOCOMPLETE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key() },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      console.error("[places] autocomplete", res.status, (await res.text()).slice(0, 200));
      return null;
    }
    const json = (await res.json()) as {
      suggestions?: {
        placePrediction?: {
          placeId?: string;
          structuredFormat?: { mainText?: { text?: string }; secondaryText?: { text?: string } };
          text?: { text?: string };
        };
      }[];
    };
    return (json.suggestions ?? [])
      .map((s) => s.placePrediction)
      .filter((p): p is NonNullable<typeof p> => Boolean(p?.placeId))
      .slice(0, 5)
      .map((p) => ({
        placeId: p.placeId!,
        main: p.structuredFormat?.mainText?.text ?? p.text?.text ?? "",
        secondary: (p.structuredFormat?.secondaryText?.text ?? "").replace(/, USA$/, ""),
      }));
  } catch (err) {
    console.error("[places] autocomplete failed", err instanceof Error ? err.message : err);
    return null;
  }
}

type AddressComponent = { longText?: string; shortText?: string; types?: string[] };

/** Pure: Google address components → our fields. */
export function parseAddressComponents(
  components: AddressComponent[],
  fallbackFormatted: string
): Omit<ParsedAddress, "placeId" | "lat" | "lng" | "timeZone"> {
  const get = (type: string, short = false) => {
    const c = components.find((x) => x.types?.includes(type));
    return (short ? c?.shortText : c?.longText) ?? "";
  };
  const number = get("street_number");
  const route = get("route", true) || get("route");
  const unit = get("subpremise", true).replace(/^(unit|apt|suite|ste|#)\s*/i, "");
  const street = [[number, route].filter(Boolean).join(" "), unit ? `#${unit}` : ""].filter(Boolean).join(" ") || fallbackFormatted.split(",")[0]?.trim() || "";
  const city = get("locality") || get("postal_town") || get("sublocality_level_1") || get("sublocality") || get("administrative_area_level_3");
  const state = get("administrative_area_level_1", true);
  const zip = get("postal_code");
  const country = get("country", true);
  const formatted =
    street && city && state ? `${street}, ${city}, ${state}${zip ? ` ${zip}` : ""}${country && country !== "US" ? `, ${country}` : ""}` : fallbackFormatted.replace(/, USA$/, "");
  return { formatted, street, city, state, zip, country };
}

export async function addressDetails(placeId: string, sessionToken?: string): Promise<ParsedAddress | null> {
  if (!placesConfigured() || !/^[A-Za-z0-9_-]{10,300}$/.test(placeId)) return null;
  const url = new URL(`${DETAILS_URL}${encodeURIComponent(placeId)}`);
  if (sessionToken) url.searchParams.set("sessionToken", sessionToken);
  const request = (fields: string) =>
    fetch(url, { headers: { "X-Goog-Api-Key": key(), "X-Goog-FieldMask": fields }, signal: AbortSignal.timeout(TIMEOUT_MS) });
  try {
    let res = await request("id,formattedAddress,addressComponents,location,timeZone");
    // If this API version doesn't know timeZone, ask without it (the state decides instead).
    if (res.status === 400) res = await request("id,formattedAddress,addressComponents,location");
    if (!res.ok) {
      console.error("[places] details", res.status, (await res.text()).slice(0, 200));
      return null;
    }
    const json = (await res.json()) as {
      id?: string;
      formattedAddress?: string;
      addressComponents?: AddressComponent[];
      location?: { latitude?: number; longitude?: number };
      timeZone?: { id?: string };
    };
    const parsed = parseAddressComponents(json.addressComponents ?? [], json.formattedAddress ?? "");
    const lng = json.location?.longitude ?? null;
    return {
      placeId: json.id ?? placeId,
      ...parsed,
      lat: json.location?.latitude ?? null,
      lng,
      timeZone: json.timeZone?.id || (parsed.country === "US" || !parsed.country ? usTimeZoneFor(parsed.state, lng) : null),
    };
  } catch (err) {
    console.error("[places] details failed", err instanceof Error ? err.message : err);
    return null;
  }
}

// ── Abuse limits for the public proxy (best effort, per instance) ─────────

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

export function allowPlacesRequest(ip: string, kind: "autocomplete" | "details"): boolean {
  const max = kind === "autocomplete" ? 90 : 30;
  const k = `${kind}:${ip || "unknown"}`;
  const now = Date.now();
  const cur = buckets.get(k);
  if (!cur || now >= cur.resetAt) {
    if (buckets.size > 5000) buckets.clear();
    buckets.set(k, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (cur.count >= max) return false;
  cur.count += 1;
  return true;
}
