/**
 * US time zone for an address when Google doesn't return one. Single-zone states map directly;
 * split states use the longitude of the address (approximate, good for picking a default the
 * owner can still change). Pure and client-safe.
 */

const SINGLE: Record<string, string> = {
  AL: "America/Chicago", AR: "America/Chicago", IA: "America/Chicago", IL: "America/Chicago", LA: "America/Chicago",
  MN: "America/Chicago", MO: "America/Chicago", MS: "America/Chicago", OK: "America/Chicago", WI: "America/Chicago",
  CT: "America/New_York", DC: "America/New_York", DE: "America/New_York", GA: "America/New_York", MA: "America/New_York",
  MD: "America/New_York", ME: "America/New_York", NC: "America/New_York", NH: "America/New_York", NJ: "America/New_York",
  NY: "America/New_York", OH: "America/New_York", PA: "America/New_York", RI: "America/New_York", SC: "America/New_York",
  VA: "America/New_York", VT: "America/New_York", WV: "America/New_York",
  AZ: "America/Phoenix", CO: "America/Denver", MT: "America/Denver", NM: "America/Denver", UT: "America/Denver", WY: "America/Denver",
  CA: "America/Los_Angeles", NV: "America/Los_Angeles", WA: "America/Los_Angeles",
  HI: "Pacific/Honolulu", AK: "America/Anchorage", PR: "America/Puerto_Rico",
};

/** Split states: zone east of the boundary longitude, zone west of it. */
const SPLIT: Record<string, { boundary: number; east: string; west: string }> = {
  FL: { boundary: -85.0, east: "America/New_York", west: "America/Chicago" }, // panhandle west of the Apalachicola
  TN: { boundary: -85.3, east: "America/New_York", west: "America/Chicago" },
  KY: { boundary: -85.9, east: "America/New_York", west: "America/Chicago" },
  IN: { boundary: -87.0, east: "America/Indiana/Indianapolis", west: "America/Chicago" },
  MI: { boundary: -87.6, east: "America/Detroit", west: "America/Chicago" },
  TX: { boundary: -104.9, east: "America/Chicago", west: "America/Denver" },
  KS: { boundary: -101.5, east: "America/Chicago", west: "America/Denver" },
  NE: { boundary: -101.0, east: "America/Chicago", west: "America/Denver" },
  SD: { boundary: -100.4, east: "America/Chicago", west: "America/Denver" },
  ND: { boundary: -101.0, east: "America/Chicago", west: "America/Denver" },
  ID: { boundary: -115.5, east: "America/Boise", west: "America/Los_Angeles" },
  OR: { boundary: -117.4, east: "America/Boise", west: "America/Los_Angeles" },
};

export function usTimeZoneFor(state: string | null | undefined, lng?: number | null): string | null {
  const s = (state ?? "").trim().toUpperCase();
  if (SINGLE[s]) return SINGLE[s];
  const split = SPLIT[s];
  if (!split) return null;
  if (lng == null || !Number.isFinite(lng)) return split.east;
  return lng >= split.boundary ? split.east : split.west;
}

/** Common zones for a picker (US first). */
export const COMMON_TIME_ZONES: { id: string; label: string }[] = [
  { id: "America/New_York", label: "Eastern Time" },
  { id: "America/Chicago", label: "Central Time" },
  { id: "America/Denver", label: "Mountain Time" },
  { id: "America/Phoenix", label: "Arizona (no DST)" },
  { id: "America/Los_Angeles", label: "Pacific Time" },
  { id: "America/Anchorage", label: "Alaska Time" },
  { id: "Pacific/Honolulu", label: "Hawaii Time" },
  { id: "America/Detroit", label: "Eastern Time (Michigan)" },
  { id: "America/Indiana/Indianapolis", label: "Eastern Time (Indiana)" },
  { id: "America/Boise", label: "Mountain Time (Boise)" },
  { id: "America/Puerto_Rico", label: "Atlantic Time (Puerto Rico)" },
];

export function timeZoneName(id: string): string {
  return COMMON_TIME_ZONES.find((z) => z.id === id)?.label ?? id.replace(/_/g, " ");
}
