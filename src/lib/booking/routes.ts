/**
 * Google Routes API (driving distance + time) and Maps Static API (route images).
 *
 * Server-only. Key: GOOGLE_MAPS_API_KEY (Routes API + Maps Static API enabled).
 * Results are cached per business in route_cache for 30 days (TRAFFIC_UNAWARE, so a
 * cached value stays meaningful; the travel safety margin covers traffic).
 *
 * Every function fails soft: a missing key, quota error or timeout yields "unknown",
 * never an exception. Callers decide what unknown means (the engine uses a conservative
 * fallback drive time; pricing leaves the travel fee for the business to quote).
 */

import type { TenantServiceClient } from "@/lib/supabase/tenant-service";

const ROUTES_URL = "https://routes.googleapis.com/directions/v2:computeRoutes";
const MATRIX_URL = "https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix";
const STATIC_MAP_URL = "https://maps.googleapis.com/maps/api/staticmap";
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 8_000;
const METERS_PER_MILE = 1609.344;
const MAX_PAIRS_PER_PREFETCH = 400;

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export type RouteLeg = {
  distanceMeters: number;
  durationSeconds: number;
  polyline: string | null;
};

export function routesConfigured(): boolean {
  return Boolean(process.env.GOOGLE_MAPS_API_KEY?.trim());
}

function apiKey(): string {
  return process.env.GOOGLE_MAPS_API_KEY?.trim() ?? "";
}

export function addressKey(address: string): string {
  return address.trim().toLowerCase().replace(/\s+/g, " ").replace(/\s*,\s*/g, ", ").slice(0, 400);
}

export function metersToMiles(meters: number): number {
  return Math.round((meters / METERS_PER_MILE) * 10) / 10;
}

function parseDuration(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const match = value.match(/^(\d+(?:\.\d+)?)s$/);
  return match ? Math.round(Number(match[1])) : null;
}

function timedFetch(transport: FetchLike): FetchLike {
  return (input, init) => transport(input, { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
}

/** One driving route with its polyline (used for the route map and pricing). */
export async function computeRoute(
  origin: string,
  destination: string,
  transport: FetchLike = fetch
): Promise<RouteLeg | null> {
  if (!routesConfigured() || !origin.trim() || !destination.trim()) return null;
  try {
    const res = await timedFetch(transport)(ROUTES_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey(),
        "X-Goog-FieldMask": "routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline",
      },
      body: JSON.stringify({
        origin: { address: origin },
        destination: { address: destination },
        travelMode: "DRIVE",
        routingPreference: "TRAFFIC_UNAWARE",
        units: "IMPERIAL",
      }),
    });
    if (!res.ok) {
      console.error("[routes] computeRoutes failed", res.status);
      return null;
    }
    const json = (await res.json()) as {
      routes?: { distanceMeters?: number; duration?: string; polyline?: { encodedPolyline?: string } }[];
    };
    const route = json.routes?.[0];
    const seconds = parseDuration(route?.duration);
    if (!route || typeof route.distanceMeters !== "number" || seconds == null) return null;
    return { distanceMeters: route.distanceMeters, durationSeconds: seconds, polyline: route.polyline?.encodedPolyline ?? null };
  } catch (err) {
    console.error("[routes] computeRoutes error", err instanceof Error ? err.message : err);
    return null;
  }
}

type MatrixElement = {
  originIndex?: number;
  destinationIndex?: number;
  distanceMeters?: number;
  duration?: string;
  condition?: string;
};

async function computeMatrix(
  origins: string[],
  destinations: string[],
  transport: FetchLike
): Promise<MatrixElement[] | null> {
  try {
    const res = await timedFetch(transport)(MATRIX_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey(),
        "X-Goog-FieldMask": "originIndex,destinationIndex,distanceMeters,duration,condition",
      },
      body: JSON.stringify({
        origins: origins.map((address) => ({ waypoint: { address } })),
        destinations: destinations.map((address) => ({ waypoint: { address } })),
        travelMode: "DRIVE",
        routingPreference: "TRAFFIC_UNAWARE",
      }),
    });
    if (!res.ok) {
      console.error("[routes] computeRouteMatrix failed", res.status);
      return null;
    }
    const json = (await res.json()) as MatrixElement[] | MatrixElement;
    return Array.isArray(json) ? json : [json];
  } catch (err) {
    console.error("[routes] computeRouteMatrix error", err instanceof Error ? err.message : err);
    return null;
  }
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

type Entry = { distanceMeters: number; durationSeconds: number } | null;

/**
 * Drive-time table for one request. `prefetch` everything first (one DB read, then
 * batched matrix calls for misses), then read synchronously from the engine.
 */
export class TravelTable {
  private readonly entries = new Map<string, Entry>();
  private readonly addresses = new Map<string, string>();

  constructor(
    private readonly db: TenantServiceClient | null,
    private readonly transport: FetchLike = fetch
  ) {}

  private pairKey(from: string, to: string) {
    return `${addressKey(from)}→${addressKey(to)}`;
  }

  async prefetch(pairs: [string | null | undefined, string | null | undefined][]): Promise<void> {
    const wanted = new Map<string, [string, string]>();
    for (const [from, to] of pairs) {
      if (!from?.trim() || !to?.trim()) continue;
      if (addressKey(from) === addressKey(to)) continue;
      const key = this.pairKey(from, to);
      if (this.entries.has(key) || wanted.has(key)) continue;
      this.addresses.set(addressKey(from), from);
      this.addresses.set(addressKey(to), to);
      wanted.set(key, [from, to]);
      if (wanted.size >= MAX_PAIRS_PER_PREFETCH) break;
    }
    if (!wanted.size) return;

    // 1. Cache.
    if (this.db) {
      const originKeys = [...new Set([...wanted.values()].map(([f]) => addressKey(f)))];
      for (const keys of chunk(originKeys, 100)) {
        try {
          const { data } = await this.db
            .from("route_cache")
            .select("origin_key, destination_key, distance_meters, duration_seconds, computed_at")
            .in("origin_key", keys);
          for (const row of data ?? []) {
            const key = `${row.origin_key}→${row.destination_key}`;
            if (!wanted.has(key)) continue;
            if (Date.now() - Date.parse(row.computed_at as string) > CACHE_TTL_MS) continue;
            this.entries.set(key, {
              distanceMeters: Number(row.distance_meters),
              durationSeconds: Number(row.duration_seconds),
            });
            wanted.delete(key);
          }
        } catch {
          // Cache table missing (pre-v132) or unavailable: go to Google.
        }
      }
    }
    if (!wanted.size || !routesConfigured()) return;

    // 2. Google, grouped by origin so each matrix call is dense.
    const byOrigin = new Map<string, string[]>();
    for (const [from, to] of wanted.values()) {
      const list = byOrigin.get(from) ?? [];
      list.push(to);
      byOrigin.set(from, list);
    }
    const fresh: { origin_key: string; destination_key: string; distance_meters: number; duration_seconds: number }[] = [];
    const originGroups = chunk([...byOrigin.keys()], 10);
    for (const origins of originGroups) {
      const destinations = [...new Set(origins.flatMap((o) => byOrigin.get(o) ?? []))];
      for (const dests of chunk(destinations, 25)) {
        const elements = await computeMatrix(origins, dests, this.transport);
        if (!elements) continue;
        for (const el of elements) {
          if (el.originIndex == null || el.destinationIndex == null) continue;
          const from = origins[el.originIndex];
          const to = dests[el.destinationIndex];
          const seconds = parseDuration(el.duration);
          const key = this.pairKey(from, to);
          if (el.condition && el.condition !== "ROUTE_EXISTS") {
            this.entries.set(key, null);
            continue;
          }
          if (typeof el.distanceMeters !== "number" || seconds == null) continue;
          this.entries.set(key, { distanceMeters: el.distanceMeters, durationSeconds: seconds });
          fresh.push({
            origin_key: addressKey(from),
            destination_key: addressKey(to),
            distance_meters: el.distanceMeters,
            duration_seconds: seconds,
          });
        }
      }
    }
    if (fresh.length && this.db) {
      try {
        await this.db
          .from("route_cache")
          .upsert(
            fresh.map((r) => ({ ...r, computed_at: new Date().toISOString() })),
            { onConflict: "business_id,origin_key,destination_key" }
          );
      } catch {
        // Best effort.
      }
    }
  }

  private entry(from: string | null, to: string | null): Entry | undefined {
    if (!from || !to) return undefined;
    if (addressKey(from) === addressKey(to)) return { distanceMeters: 0, durationSeconds: 0 };
    return this.entries.get(this.pairKey(from, to));
  }

  minutes = (from: string | null, to: string | null): number | null => {
    const e = this.entry(from, to);
    return e ? Math.ceil(e.durationSeconds / 60) : null;
  };

  miles = (from: string | null, to: string | null): number | null => {
    const e = this.entry(from, to);
    return e ? metersToMiles(e.distanceMeters) : null;
  };
}

/** One-way driving miles + minutes for a single pair, cached. */
export async function driveBetween(
  db: TenantServiceClient | null,
  from: string | null | undefined,
  to: string | null | undefined
): Promise<{ miles: number; minutes: number } | null> {
  if (!from?.trim() || !to?.trim()) return null;
  const table = new TravelTable(db);
  await table.prefetch([[from, to]]);
  const miles = table.miles(from, to);
  const minutes = table.minutes(from, to);
  return miles == null || minutes == null ? null : { miles, minutes };
}

export type MapMarker = { address: string; label: string; color: string };

/** Maps Static API URL. Server-side only (contains the key); proxy the bytes to the browser. */
export function staticMapUrl(input: {
  markers: MapMarker[];
  polylines: string[];
  width?: number;
  height?: number;
  zoom?: number;
}): string | null {
  if (!routesConfigured()) return null;
  const params = new URLSearchParams();
  params.set("size", `${input.width ?? 640}x${input.height ?? 400}`);
  params.set("scale", "2");
  params.set("maptype", "roadmap");
  if (input.zoom) params.set("zoom", String(input.zoom));
  params.append("style", "feature:poi|visibility:off");
  params.append("style", "feature:transit|visibility:off");
  for (const line of input.polylines) params.append("path", `color:0x2563ebff|weight:5|enc:${line}`);
  for (const m of input.markers) params.append("markers", `color:${m.color}|label:${m.label}|${m.address}`);
  params.set("key", apiKey());
  const url = `${STATIC_MAP_URL}?${params.toString()}`;
  return url.length > 16_000 ? null : url;
}
