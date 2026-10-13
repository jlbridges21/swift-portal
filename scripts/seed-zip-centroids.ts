/**
 * Idempotent load of Census ZCTA centroids into public.zip_codes.
 *
 * Source file: data/us-zcta-centroids-2026.csv
 * Built from the 2026 Gazetteer national ZCTA file (public domain):
 *   https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2026_Gazetteer/2026_Gaz_zcta_national.zip
 * The gazetteer has no city or state. Those columns were dropped in
 * migration v101. This script writes zip, latitude, and longitude only.
 *
 * Upserts on the zip primary key. Running this again updates coordinates and
 * does not insert a second row for the same ZIP.
 *
 * Run: npm run db:seed-zips
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const BATCH = 1000;

type Row = {
  zip: string;
  latitude: number;
  longitude: number;
};

function loadRows(): Row[] {
  const file = resolve(process.cwd(), "data/us-zcta-centroids-2026.csv");
  const lines = readFileSync(file, "utf8").trim().split("\n");
  const header = lines[0]?.split(",") ?? [];
  if (header[0] !== "zip" || header[1] !== "latitude" || header[2] !== "longitude") {
    throw new Error(`Unexpected CSV header: ${lines[0]}`);
  }
  const rows: Row[] = [];
  for (const line of lines.slice(1)) {
    if (!line.trim()) continue;
    const [zip, latitude, longitude] = line.split(",");
    if (!zip || latitude == null || longitude == null) throw new Error(`Bad CSV row: ${line}`);
    rows.push({
      zip: zip.padStart(5, "0"),
      latitude: Number(latitude),
      longitude: Number(longitude),
    });
  }
  return rows;
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase service credentials");

  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const rows = loadRows();
  console.log(`csv rows ${rows.length}`);

  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const { error } = await supabase.from("zip_codes").upsert(batch, { onConflict: "zip" });
    if (error) throw new Error(`upsert failed at ${i}: ${error.message}`);
    console.log(`upserted ${Math.min(i + BATCH, rows.length)} / ${rows.length}`);
  }

  const { count, error: countError } = await supabase
    .from("zip_codes")
    .select("zip", { count: "exact", head: true });
  if (countError) throw new Error(countError.message);
  console.log(`zip_codes count ${count}`);

  const { data: samples, error: sampleError } = await supabase
    .from("zip_codes")
    .select("zip, latitude, longitude")
    .in("zip", ["00601", "10001", "36549"]);
  if (sampleError) throw new Error(sampleError.message);
  console.log(JSON.stringify(samples, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
