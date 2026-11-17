/**
 * Business time zone. By default it follows the business address (state/province, with
 * city overrides for the few split states), so a Texas business books in Central Time and a
 * California one in Pacific. Owners can pin a specific zone in Workflow settings instead.
 *
 * Pure and client-safe: no server imports.
 */

export const FALLBACK_TIMEZONE = "America/New_York";

export type TimeZoneMode = "auto" | "manual";

type Zone = string;

const ET = "America/New_York";
const CT = "America/Chicago";
const MT = "America/Denver";
const PT = "America/Los_Angeles";

/** Majority zone per US state / territory, keyed by postal code. */
const US_STATE_ZONES: Record<string, Zone> = {
  AL: CT, AK: "America/Anchorage", AZ: "America/Phoenix", AR: CT, CA: PT, CO: MT, CT: ET, DE: ET,
  DC: ET, FL: ET, GA: ET, HI: "Pacific/Honolulu", ID: MT, IL: CT, IN: "America/Indiana/Indianapolis",
  IA: CT, KS: CT, KY: ET, LA: CT, ME: ET, MD: ET, MA: ET, MI: "America/Detroit", MN: CT, MS: CT,
  MO: CT, MT: MT, NE: CT, NV: PT, NH: ET, NJ: ET, NM: MT, NY: ET, NC: ET, ND: CT, OH: ET, OK: CT,
  OR: PT, PA: ET, RI: ET, SC: ET, SD: CT, TN: CT, TX: CT, UT: MT, VT: ET, VA: ET, WA: PT, WV: ET,
  WI: CT, WY: MT, PR: "America/Puerto_Rico", VI: "America/St_Thomas", GU: "Pacific/Guam",
  AS: "Pacific/Pago_Pago", MP: "Pacific/Saipan",
};

const US_STATE_NAMES: Record<string, string> = {
  alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR", california: "CA", colorado: "CO",
  connecticut: "CT", delaware: "DE", "district of columbia": "DC", "washington dc": "DC",
  "washington d.c.": "DC", florida: "FL", georgia: "GA", hawaii: "HI", idaho: "ID", illinois: "IL",
  indiana: "IN", iowa: "IA", kansas: "KS", kentucky: "KY", louisiana: "LA", maine: "ME",
  maryland: "MD", massachusetts: "MA", michigan: "MI", minnesota: "MN", mississippi: "MS",
  missouri: "MO", montana: "MT", nebraska: "NE", nevada: "NV", "new hampshire": "NH",
  "new jersey": "NJ", "new mexico": "NM", "new york": "NY", "north carolina": "NC",
  "north dakota": "ND", ohio: "OH", oklahoma: "OK", oregon: "OR", pennsylvania: "PA",
  "rhode island": "RI", "south carolina": "SC", "south dakota": "SD", tennessee: "TN", texas: "TX",
  utah: "UT", vermont: "VT", virginia: "VA", washington: "WA", "west virginia": "WV",
  wisconsin: "WI", wyoming: "WY", "puerto rico": "PR", "us virgin islands": "VI", guam: "GU",
  "american samoa": "AS", "northern mariana islands": "MP",
};

/** Cities in split states that sit outside their state's majority zone. */
const CITY_OVERRIDES: Record<string, Record<string, Zone>> = {
  TN: Object.fromEntries(
    ["knoxville", "chattanooga", "johnson city", "kingsport", "bristol", "maryville", "morristown",
      "cleveland", "oak ridge", "sevierville", "gatlinburg", "pigeon forge", "athens", "greeneville",
      "elizabethton", "farragut", "alcoa", "lenoir city", "dandridge", "jefferson city"].map((c) => [c, ET])
  ),
  FL: Object.fromEntries(
    ["pensacola", "panama city", "panama city beach", "fort walton beach", "destin", "navarre",
      "crestview", "niceville", "milton", "gulf breeze", "defuniak springs", "santa rosa beach",
      "lynn haven", "marianna", "chipley", "pace", "miramar beach", "mexico beach"].map((c) => [c, CT])
  ),
  TX: Object.fromEntries(["el paso", "horizon city", "socorro", "canutillo", "anthony", "van horn"].map((c) => [c, MT])),
  KY: Object.fromEntries(
    ["bowling green", "paducah", "owensboro", "hopkinsville", "henderson", "madisonville",
      "murray", "mayfield", "glasgow", "elizabethtown", "radcliff", "fort campbell", "oak grove",
      "russellville", "franklin"].map((c) => [c, CT])
  ),
  IN: Object.fromEntries(
    ["evansville", "gary", "hammond", "merrillville", "crown point", "valparaiso", "portage",
      "michigan city", "east chicago", "hobart", "schererville", "munster", "highland", "dyer",
      "st. john", "saint john", "cedar lake", "chesterton", "la porte", "newburgh", "jasper",
      "tell city", "mount vernon", "princeton", "boonville"].map((c) => [c, CT])
  ),
  MI: Object.fromEntries(["iron mountain", "menominee", "ironwood", "kingsford", "norway"].map((c) => [c, CT])),
  ID: Object.fromEntries(
    ["coeur d'alene", "coeur d’alene", "post falls", "moscow", "lewiston", "sandpoint", "hayden",
      "rathdrum", "bonners ferry", "orofino", "grangeville"].map((c) => [c, PT])
  ),
  OR: Object.fromEntries(["ontario", "nyssa", "vale"].map((c) => [c, MT])),
  NE: Object.fromEntries(["scottsbluff", "gering", "alliance", "sidney", "chadron", "ogallala", "kimball"].map((c) => [c, MT])),
  SD: Object.fromEntries(["rapid city", "spearfish", "sturgis", "box elder", "hot springs", "custer", "deadwood", "lead", "belle fourche"].map((c) => [c, MT])),
  ND: Object.fromEntries(["dickinson", "williston", "watford city", "bowman", "beach"].map((c) => [c, MT])),
  KS: Object.fromEntries(["goodland", "sharon springs", "tribune", "st. francis", "saint francis"].map((c) => [c, MT])),
};

const CA_PROVINCE_ZONES: Record<string, Zone> = {
  BC: "America/Vancouver", AB: "America/Edmonton", SK: "America/Regina", MB: "America/Winnipeg",
  ON: "America/Toronto", QC: "America/Toronto", NB: "America/Moncton", NS: "America/Halifax",
  PE: "America/Halifax", NL: "America/St_Johns", YT: "America/Whitehorse", NT: "America/Yellowknife",
  NU: "America/Iqaluit",
};

const CA_PROVINCE_NAMES: Record<string, string> = {
  "british columbia": "BC", alberta: "AB", saskatchewan: "SK", manitoba: "MB", ontario: "ON",
  quebec: "QC", "québec": "QC", "new brunswick": "NB", "nova scotia": "NS",
  "prince edward island": "PE", "newfoundland and labrador": "NL", newfoundland: "NL", yukon: "YT",
  "northwest territories": "NT", nunavut: "NU",
};

function norm(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function countryKind(country: string): "us" | "ca" | "unknown" | "other" {
  const c = norm(country).replace(/\./g, "");
  if (!c) return "unknown";
  if (["us", "usa", "united states", "united states of america", "america"].includes(c)) return "us";
  if (["ca", "can", "canada"].includes(c)) return "ca";
  return "other";
}

export type AddressForTimeZone = {
  city?: string | null;
  state?: string | null;
  country?: string | null;
};

/** IANA zone for a business address, or null when the address doesn't pin one down. */
export function timeZoneFromAddress(address: AddressForTimeZone): string | null {
  const stateRaw = norm(address.state).replace(/\./g, "");
  if (!stateRaw) return null;
  const kind = countryKind(address.country ?? "");
  if (kind === "other") return null;

  if (kind !== "ca") {
    const code = stateRaw.length === 2 ? stateRaw.toUpperCase() : US_STATE_NAMES[stateRaw];
    if (code && US_STATE_ZONES[code]) {
      const city = norm(address.city);
      return CITY_OVERRIDES[code]?.[city] ?? US_STATE_ZONES[code];
    }
    if (kind === "us") return null;
  }

  const province = stateRaw.length === 2 ? stateRaw.toUpperCase() : CA_PROVINCE_NAMES[stateRaw];
  return (province && CA_PROVINCE_ZONES[province]) || null;
}

export function isValidTimeZone(zone: string | null | undefined): zone is string {
  const z = (zone ?? "").trim();
  if (!z) return false;
  try {
    Intl.DateTimeFormat("en-US", { timeZone: z }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

/**
 * Settings saved before the automatic mode existed carry no mode. The old default was
 * "America/New_York", saved for everyone who touched Workflow settings, so that value (or an
 * empty one) means "never chosen" and follows the address. Anything else was typed on purpose.
 */
export function inferTimeZoneMode(storedMode: unknown, storedZone: unknown): TimeZoneMode {
  if (storedMode === "auto" || storedMode === "manual") return storedMode;
  const zone = typeof storedZone === "string" ? storedZone.trim() : "";
  return !zone || zone === FALLBACK_TIMEZONE ? "auto" : "manual";
}

/** The zone the business actually runs on. */
export function effectiveBusinessTimeZone(input: {
  mode: TimeZoneMode;
  storedZone: string | null | undefined;
  address: AddressForTimeZone;
}): string {
  const stored = isValidTimeZone(input.storedZone) ? input.storedZone.trim() : null;
  if (input.mode === "manual" && stored) return stored;
  return timeZoneFromAddress(input.address) ?? stored ?? FALLBACK_TIMEZONE;
}

/** Zones offered when an owner picks one by hand. */
export const COMMON_TIME_ZONES: { value: string; label: string }[] = [
  { value: "America/New_York", label: "Eastern Time" },
  { value: "America/Chicago", label: "Central Time" },
  { value: "America/Denver", label: "Mountain Time" },
  { value: "America/Phoenix", label: "Mountain Time – Arizona (no DST)" },
  { value: "America/Los_Angeles", label: "Pacific Time" },
  { value: "America/Anchorage", label: "Alaska Time" },
  { value: "Pacific/Honolulu", label: "Hawaii Time" },
  { value: "America/Puerto_Rico", label: "Atlantic Time – Puerto Rico" },
  { value: "America/Halifax", label: "Atlantic Time – Canada" },
  { value: "America/St_Johns", label: "Newfoundland Time" },
  { value: "America/Regina", label: "Central Time – Saskatchewan (no DST)" },
];

export function timeZoneDisplayName(zone: string): string {
  const known = COMMON_TIME_ZONES.find((z) => z.value === zone);
  if (known) return known.label;
  try {
    const name = new Intl.DateTimeFormat("en-US", { timeZone: zone, timeZoneName: "long" })
      .formatToParts(new Date())
      .find((p) => p.type === "timeZoneName")?.value;
    return name ? `${name} (${zone})` : zone;
  } catch {
    return zone;
  }
}
