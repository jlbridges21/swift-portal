/**
 * Step 2 of the marketing demo seed: uploads photos and video into the Coastal Light Media
 * demo projects (created by seed-coastal-light.ts), sets project covers, and creates a
 * video review with time-stamped client comments.
 *
 * Media sources (passed in, never committed):
 *   --photos <dir>  free-license Pexels photos named <pexelsId>.jpg
 *   --drone <dir>   stills from the business's own drone b-roll (<clip>-<pos>.jpg)
 *   --videos <dir>  short H.264 clips (sea-oats-v1.mp4, sea-oats-v2.mp4, bayfront.mp4, gulf-mist.mp4)
 *
 * Same safety rails as step 1 (exact demo name, no non-demo clients). Re-running skips
 * files that are already uploaded (deterministic ids). `--dry-run` writes nothing.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const DEMO_NAME = "Coastal Light Media";
const args = process.argv.slice(2);
const opt = (n: string) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : undefined; };
const DRY = args.includes("--dry-run");
const SLUG = opt("slug");
const DIRS = { photos: opt("photos"), drone: opt("drone"), videos: opt("videos") };

let NS = "";
function uid(key: string): string {
  const h = createHash("sha256").update(`${NS}:${key}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

type Src = { dir: "photos" | "drone"; file: string; name: string };
const px = (id: string, name: string): Src => ({ dir: "photos", file: `${id}.jpg`, name });
const dr = (file: string, name: string): Src => ({ dir: "drone", file: `${file}.jpg`, name });

/** Photos per demo project, in gallery order. File names read like a real delivery. */
const GALLERIES: Record<string, Src[]> = {
  "pelican-point": [
    px("19219055", "Front Exterior"), dr("30-second-boat-compilation-0.45", "Aerial Waterfront"), px("8082312", "Great Room"),
    px("18285958", "Living Room"), px("7166645", "Kitchen"), px("4119832", "Breakfast Nook"), px("6957083", "Foyer"),
    px("8089268", "Primary Suite"), px("7045908", "Primary Bath"), px("9400976", "Aerial Pool Deck"),
    dr("sunset-0.45", "Aerial Sunset"), px("1612351", "Twilight Exterior"), px("20049160", "Twilight Street View"),
  ],
  "harbor-light": [
    px("8082328", "Front Exterior"), px("6980724", "Living Room"), px("18285887", "Kitchen"), px("6207816", "Kitchen and Dining"),
    px("7174113", "Family Room"), px("8092431", "Entry Hall"), px("7174386", "Open Floor Plan"), px("34377945", "Lounge"),
    px("6903157", "Guest Bedroom"), px("6957081", "Guest Bath"),
  ],
  "dune-crest": [
    px("19119706", "Aerial Overview"), px("28456460", "Loft Living"), px("28456461", "Gallery Wall"), px("7587828", "Den"),
    px("8089172", "Kitchen and Living"), px("8135492", "Great Room"), px("39829574", "Chef Kitchen"), px("7045703", "Sitting Room"),
    px("8092437", "Upper Landing"), px("6588580", "Hallway"), px("8146330", "Flex Room"),
  ],
  "bayou-vista": [
    dr("perdido-bay-park-0.15", "Aerial Bay View"), dr("perdido-bay-park-0.45", "Aerial Park and Shoreline"), dr("perdido-bay-park-0.75", "Aerial Neighborhood"),
    dr("sunset-0.15", "Aerial Sunset West"), dr("sunset-0.75", "Aerial Sunset Water"), dr("flying-under-bridge-0.45", "Aerial Bridge Approach"),
  ],
  "gulf-mist": [px("40619552", "Front Exterior"), px("20296321", "Street View"), px("36060480", "Side Yard")],
  "bayfront-plaza": [
    dr("cars-driving-on-bridge-0.15", "Bay Bridge North"), dr("cars-driving-on-bridge-0.75", "Bay Bridge South"),
    dr("flying-under-bridge-0.15", "Waterway Approach"), dr("flying-under-bridge-0.75", "Under the Bridge"),
    dr("circling-boat-0.45", "Marina Channel"), dr("circling-boat-0.75", "Harbor Overview"),
  ],
  "sea-oats": [
    dr("circling-boat-0.15", "Aerial Dock"), dr("chasing-down-boat-0.45", "Aerial Channel"), dr("30-second-boat-compilation-0.15", "Aerial Sunset Cove"),
    dr("30-second-boat-compilation-0.75", "Aerial Beach Approach"),
  ],
};
/** One cover photo for each older delivered job (keys match HISTORY in step 1). */
const HISTORY_COVERS: [string, Src][] = [
  ["gulf-vista", px("19219055", "Front Exterior")], ["live-oak", px("8082328", "Front Exterior")], ["pier-point", dr("perdido-bay-park-0.45", "Aerial")],
  ["sunset-bay", dr("sunset-0.45", "Aerial Sunset")], ["tidewater", px("36060480", "Front Exterior")], ["marina-tower", dr("cars-driving-on-bridge-0.45", "Aerial Site")],
  ["seagrove", px("9400976", "Aerial Pool")], ["palmetto", px("20296321", "Front Exterior")], ["egret-landing", dr("30-second-boat-compilation-0.45", "Aerial Water")],
  ["windward", px("1612351", "Twilight Exterior")], ["coral-reef", dr("circling-boat-0.45", "Marina")], ["blue-heron", px("40619552", "Front Exterior")],
  ["shell-bank", px("19119706", "Aerial Overview")], ["harbor-ridge", dr("flying-under-bridge-0.45", "Aerial Site")], ["sandcastle", px("20049160", "Twilight Street")],
  ["oyster-bay", px("8082312", "Great Room")], ["mariner", px("7166645", "Kitchen")], ["cypress-point", px("6980724", "Living Room")],
];
for (const [k, src] of HISTORY_COVERS) GALLERIES[k] = [src];
/** Listing cover for active jobs (the agent's existing listing photo), so pipeline cards aren't blank. */
const ACTIVE_COVERS: [string, Src][] = [
  ["sandpiper", px("20296321", "Listing Photo")], ["pelican-cove-lot", dr("zooming-in-0.45", "Site Aerial")], ["heron-bay", px("1612351", "Listing Photo")],
  ["shoreline-blvd", px("40619552", "Listing Photo")], ["cypress-bend", px("8082328", "Listing Photo")], ["lagoon-view", px("20049160", "Listing Photo")],
  ["osprey-ridge", px("36060480", "Listing Photo")], ["coastal-hwy", dr("perdido-bay-park-0.15", "Site Aerial")], ["magnolia-springs", px("9580899", "Twilight Preview")],
  ["reynolds-marina", dr("circling-boat-0.15", "Marina Aerial")],
];
for (const [k, src] of ACTIVE_COVERS) GALLERIES[k] = [src];

const VIDEOS: { project: string; file: string; name: string; review?: boolean }[] = [
  { project: "sea-oats", file: "sea-oats-v1.mp4", name: "Sea Oats Cove Sunset Film" },
  { project: "bayfront-plaza", file: "bayfront.mp4", name: "Bayfront Parkway Site Film" },
  { project: "gulf-mist", file: "gulf-mist.mp4", name: "Gulf Mist Listing Video" },
];

async function main() {
  if (!SLUG) throw new Error("Pass --slug.");
  for (const [k, d] of Object.entries(DIRS)) if (!d || !existsSync(d)) throw new Error(`Missing --${k} dir.`);
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

  const { data: biz } = await db.from("businesses").select("id, name, is_protected, owner_user_id").eq("slug", SLUG).single();
  if (!biz || biz.name !== DEMO_NAME || biz.is_protected) throw new Error("Not the demo business.");
  const B = biz.id as string; NS = B; const OWNER = biz.owner_user_id as string;
  const { data: cl } = await db.from("clients").select("email").eq("business_id", B).is("deleted_at", null);
  if ((cl ?? []).some((c) => !String(c.email).endsWith("@example.com"))) throw new Error("Refusing: non-demo clients present.");
  const pid = (k: string) => uid(`project:${k}`);
  const { data: projects } = await db.from("projects").select("id, request_key, shoot_date").eq("business_id", B);
  const have = new Set((projects ?? []).map((p) => p.id));
  for (const k of [...Object.keys(GALLERIES), ...VIDEOS.map((v) => v.project)]) if (!have.has(pid(k))) throw new Error(`Run step 1 first (missing ${k}).`);
  const shootDate = new Map((projects ?? []).map((p) => [p.id as string, p.shoot_date as string | null]));

  const tmp = path.join(process.env.TMPDIR ?? "/tmp", "cl-thumbs");
  execFileSync("mkdir", ["-p", tmp]);
  let uploaded = 0, skipped = 0;

  async function uploadAsset(projectKey: string, localPath: string, fileName: string, title: string, media: "photo" | "video", order: number) {
    const id = uid(`media:${projectKey}:${fileName}`);
    const { data: exists } = await db.from("media_assets").select("id").eq("id", id).maybeSingle();
    if (exists) { skipped++; return id; }
    const P = pid(projectKey);
    const safe = fileName.replace(/[^A-Za-z0-9._-]+/g, "_");
    const objectPath = `${B}/${P}/${1794800000000 + order}-${id.slice(0, 8)}-${safe}`;
    const size = statSync(localPath).size;
    let width: number | null = null, height: number | null = null, duration: number | null = null, thumbPath: string | null = null;
    const probe = JSON.parse(execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height:format=duration", "-of", "json", localPath]).toString());
    width = probe.streams?.[0]?.width ?? null; height = probe.streams?.[0]?.height ?? null;
    if (media === "video") duration = Math.round(Number(probe.format?.duration ?? 0)) || null;
    if (DRY) { console.log(`  would upload ${projectKey}/${fileName} (${(size / 1e6).toFixed(1)} MB)`); return id; }

    const body = readFileSync(localPath);
    const mime = media === "photo" ? "image/jpeg" : "video/mp4";
    const up = await db.storage.from("project-media").upload(objectPath, body, { contentType: mime, upsert: true });
    if (up.error) throw new Error(`upload ${fileName}: ${up.error.message}`);
    if (media === "photo") {
      const thumbLocal = path.join(tmp, `${id}.webp`);
      execFileSync("cwebp", ["-quiet", "-q", "82", "-resize", "800", "0", localPath, "-o", thumbLocal]);
      thumbPath = objectPath.replace(/\.[^.]+$/, "") + "-thumb.webp";
      const t = await db.storage.from("project-media").upload(thumbPath, readFileSync(thumbLocal), { contentType: "image/webp", upsert: true });
      if (t.error) throw new Error(`thumb ${fileName}: ${t.error.message}`);
    }
    const shot = shootDate.get(P);
    const ins = await db.from("media_assets").insert({
      id, business_id: B, project_id: P, file_name: fileName, file_path: objectPath, storage_path: objectPath, file_size: size, mime_type: mime,
      media_type: media, media_source: "upload", title, display_order: order, downloadable: true, visibility: "client", thumbnail_url: thumbPath,
      width, height, duration_seconds: duration, orientation: width && height ? (width >= height ? "landscape" : "portrait") : null,
      captured_at: shot ? `${shot}T16:00:00Z` : null, created_at: shot ? `${shot}T23:30:00Z` : new Date().toISOString(),
    });
    if (ins.error) throw new Error(`insert ${fileName}: ${ins.error.message}`);
    uploaded++;
    return id;
  }

  for (const [projectKey, items] of Object.entries(GALLERIES)) {
    const street = projectKey.split("-").map((w) => w[0].toUpperCase() + w.slice(1)).join("-");
    let cover: string | null = null;
    for (const [i, s] of items.entries()) {
      const n = String(i + 1).padStart(2, "0");
      const fileName = `${street}_${n}_${s.name.replace(/ /g, "-")}.jpg`;
      const id = await uploadAsset(projectKey, path.join(DIRS[s.dir]!, s.file), fileName, s.name, "photo", i);
      cover ??= id;
    }
    if (!DRY && cover) await db.from("projects").update({ cover_image_id: cover }).eq("id", pid(projectKey));
  }

  const videoIds: Record<string, string> = {};
  for (const [i, v] of VIDEOS.entries()) {
    videoIds[v.project] = await uploadAsset(v.project, path.join(DIRS.videos!, v.file), `${v.name.replace(/ /g, "_")}.mp4`, v.name, "video", 100 + i);
  }
  const v2 = await uploadAsset("sea-oats", path.join(DIRS.videos!, "sea-oats-v2.mp4"), "Sea_Oats_Cove_Sunset_Film_v2.mp4", "Sea Oats Cove Sunset Film v2", "video", 110);

  // Video review on Sea Oats Cove: v1 notes resolved, v2 has two open client notes.
  const { data: olivia } = await db.from("profiles").select("id").eq("email", "olivia.tran@example.com").maybeSingle();
  if (!olivia) throw new Error("Olivia's demo login is missing (step 1 creates it).");
  const R = uid("review:sea-oats"), V1 = uid("review:sea-oats:v1"), V2 = uid("review:sea-oats:v2");
  const P = pid("sea-oats");
  const c = (k: string, version: string, who: "client" | "admin", t: number | null, body: string, status: "resolved" | "unresolved", created: string, extra: Record<string, unknown> = {}) => ({
    id: uid(`comment:${k}`), business_id: B, review_id: R, version_id: version, project_id: P, author_kind: who,
    author_user_id: who === "client" ? olivia.id : OWNER, timestamp_seconds: t, body, status,
    resolved_by: status === "resolved" ? OWNER : null, resolved_at: status === "resolved" ? created : null, created_at: created, updated_at: created, ...extra,
  });
  const comments = [
    c("v1-dock", V1, "client", 4, "Can we hold on the dock shot a little longer?", "resolved", "2026-11-11T14:05:00Z", { point_x: 0.42, point_y: 0.58 }),
    c("v1-transition", V1, "client", 12, "Love this transition into the sunset!", "resolved", "2026-11-11T14:07:00Z"),
    c("v2-music", V2, "client", 9, "Could the music fade out a little earlier here?", "unresolved", "2026-11-15T14:12:00Z"),
    c("v2-orbit", V2, "client", 21, "Slow the orbit here so buyers can see the pool and the dock.", "unresolved", "2026-11-15T14:14:00Z", { point_x: 0.61, point_y: 0.47 }),
  ];
  const replies = [
    { ...c("v1-dock-reply", V1, "admin", null, "Yes! Extended to about four seconds in v2.", "unresolved", "2026-11-11T16:20:00Z"), parent_comment_id: uid("comment:v1-dock") },
    { ...c("v2-orbit-reply", V2, "admin", null, "Got it, I'll ease the speed ramp on that orbit.", "unresolved", "2026-11-15T14:40:00Z"), parent_comment_id: uid("comment:v2-orbit") },
  ];
  if (DRY) { console.log(`  would create review + 2 versions + ${comments.length + replies.length} comments`); }
  else {
    const must = async (p: PromiseLike<{ error: { message: string } | null }>) => { const r = await p; if (r.error) throw new Error(r.error.message); };
    await must(db.from("video_reviews").upsert({ id: R, business_id: B, project_id: P, title: "Sea Oats Cove Sunset Film", created_by: OWNER, created_at: "2026-11-10T23:40:00Z", updated_at: "2026-11-15T14:40:00Z" }));
    await must(db.from("video_review_versions").upsert([
      { id: V1, business_id: B, review_id: R, media_asset_id: videoIds["sea-oats"], version_number: 1, uploaded_by: OWNER, notes: "First cut", created_at: "2026-11-10T23:40:00Z" },
      { id: V2, business_id: B, review_id: R, media_asset_id: v2, version_number: 2, uploaded_by: OWNER, notes: "Longer dock shot, new color grade", created_at: "2026-11-14T22:10:00Z" },
    ]));
    await must(db.from("video_review_comments").upsert(comments));
    await must(db.from("video_review_comments").upsert(replies));
  }
  console.log(`\nMedia: ${uploaded} uploaded, ${skipped} already there.${DRY ? " (dry run)" : ""}`);
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
