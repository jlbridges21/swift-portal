/**
 * Marketing demo seed: fills ONE demo business ("Coastal Light Media") with fake
 * agents, fictional Gulf Coast addresses, projects in every pipeline stage, quotes,
 * payments, shoot times, messages and activity, so landing-page captures look real
 * without showing any customer data.
 *
 * Writes to the database in .env.local (the LIVE project). Safety rails:
 *  - Only touches the business whose slug is passed AND whose name is "Coastal Light Media".
 *  - Refuses protected businesses and any business with real (non-demo) clients.
 *  - Every row id is a deterministic UUID, so re-running updates rows instead of duplicating.
 *  - `--dry-run` prints the plan and writes nothing. `--wipe` deletes only rows this script owns.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/marketing-demo/seed-coastal-light.ts --slug <slug> --dry-run
 *   npx tsx --env-file=.env.local scripts/marketing-demo/seed-coastal-light.ts --slug <slug>
 *   npx tsx --env-file=.env.local scripts/marketing-demo/seed-coastal-light.ts --slug <slug> --wipe
 */
import { createHash, randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const DEMO_NAME = "Coastal Light Media";
const DEMO_EMAIL_DOMAIN = "example.com"; // reserved domain: never a real inbox
const CRED_FILE = path.join(__dirname, "demo-credentials.local.json"); // gitignored

const args = process.argv.slice(2);
const flag = (n: string) => args.includes(`--${n}`);
const opt = (n: string) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const SLUG = opt("slug");
const DRY = flag("dry-run");
const WIPE = flag("wipe");

/** Deterministic UUID (v4-shaped) from the business id + a stable key. */
let NS = "";
function uid(key: string): string {
  const h = createHash("sha256").update(`${NS}:${key}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

// ---------------------------------------------------------------- calendar helpers
const TODAY = new Date("2026-11-15T12:00:00-06:00");
const day = (offset: number) => {
  const d = new Date(TODAY);
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
};
/** ISO timestamp `offset` days from today at local (Central) hh:mm. */
const at = (offset: number, hhmm = "10:00") => `${day(offset)}T${hhmm}:00-06:00`;

// ---------------------------------------------------------------- catalog
type Line = { description: string; amount_cents: number };
const SERVICES: {
  slug: string; name: string; cents: number; desc: string; includes: string[]; recommended?: boolean; lines?: Line[];
}[] = [
  { slug: "listing_photography", name: "Listing Photography", cents: 22500, desc: "Bright, true-to-life interior and exterior photos for MLS.", includes: ["25–40 edited HDR photos", "Interior and exterior coverage", "MLS-ready and full-size files", "Next-day delivery"] },
  { slug: "aerial_photography", name: "Aerial Photography", cents: 24900, desc: "Drone photos that show the lot, the water and the neighborhood.", includes: ["FAA Part 107 licensed pilot", "15–25 edited aerial photos", "Property lines on request", "24–48 hour delivery"] },
  { slug: "listing_video", name: "Listing Video", cents: 39900, desc: "A cinematic walkthrough with ground and drone footage.", includes: ["60–90 second edited film", "Ground gimbal and drone footage", "Licensed music", "Branded and unbranded versions"] },
  { slug: "aerial_videography", name: "Aerial Videography", cents: 39900, desc: "Drone-only highlight film for listings, marinas and resorts.", includes: ["Cinematic drone flight", "Edited highlight video", "Color grading", "Vertical cut for social"] },
  { slug: "twilight_photography", name: "Twilight Photography", cents: 17500, desc: "Dusk exteriors with every light on.", includes: ["8–12 twilight photos", "Ground and aerial angles", "Sky and window glow editing"] },
  { slug: "virtual_tour", name: "3D Virtual Tour", cents: 29900, desc: "An interactive walkthrough buyers can explore online.", includes: ["Full interior 3D capture", "Hosted tour link", "MLS-compliant unbranded link", "Dollhouse view"] },
  { slug: "floor_plan", name: "Floor Plan", cents: 9900, desc: "A clean 2D floor plan with room measurements.", includes: ["2D floor plan", "Room dimensions", "PDF and JPG"] },
  { slug: "commercial_drone", name: "Commercial Drone Package", cents: 65000, desc: "Aerial photo and video for commercial sites, marinas and construction.", includes: ["Half-day flight window", "Aerial photos and 4K video", "Site overview map", "Commercial usage rights"] },
  {
    slug: "luxury_listing_package", name: "Luxury Listing Package", cents: 89500, recommended: true,
    desc: "Everything a waterfront listing needs in one visit.",
    includes: ["Listing photography", "Aerial photos", "Listing video", "Twilight photos", "Priority 24-hour delivery"],
    lines: [
      { description: "Listing Photography", amount_cents: 22500 },
      { description: "Aerial Photography", amount_cents: 24900 },
      { description: "Listing Video", amount_cents: 39900 },
      { description: "Twilight Photography", amount_cents: 17500 },
      { description: "Package savings", amount_cents: -15300 },
    ],
  },
];
const svc = (slug: string) => SERVICES.find((s) => s.slug === slug)!;
const linesFor = (slug: string): Line[] => svc(slug).lines ?? [{ description: svc(slug).name, amount_cents: svc(slug).cents }];

// ---------------------------------------------------------------- clients (all fake)
const CLIENTS = [
  { key: "sarah", first: "Sarah", last: "Mitchell", company: "Gulfside Realty Group", phone: "(251) 555-0142", portal: true },
  { key: "marcus", first: "Marcus", last: "Bennett", company: "Harbor & Main Real Estate", phone: "(251) 555-0178", portal: false },
  { key: "olivia", first: "Olivia", last: "Tran", company: "Tran Luxury Homes", phone: "(850) 555-0119", portal: true },
  { key: "james", first: "James", last: "Whitaker", company: "Whitaker Commercial", phone: "(850) 555-0163", portal: false },
  { key: "emily", first: "Emily", last: "Carter", company: "Shoreline Property Partners", phone: "(251) 555-0127", portal: false },
  { key: "rachel", first: "Rachel", last: "Kim", company: "Kim Coastal Stays", phone: "(251) 555-0191", portal: false },
  { key: "priya", first: "Priya", last: "Shah", company: "Bayfront Realty", phone: "(251) 555-0135", portal: false },
  { key: "tom", first: "Tom", last: "Reynolds", company: "Reynolds Marina", phone: "(251) 555-0156", portal: false },
  { key: "laura", first: "Laura", last: "Gibson", company: "Gibson & Co. Realtors", phone: "(251) 555-0184", portal: false },
  { key: "david", first: "David", last: "Alvarez", company: "Coastline Builders", phone: "(850) 555-0102", portal: false },
] as const;
type ClientKey = (typeof CLIENTS)[number]["key"];
const emailOf = (c: (typeof CLIENTS)[number]) => `${c.first}.${c.last}`.toLowerCase() + `@${DEMO_EMAIL_DOMAIN}`;

// ---------------------------------------------------------------- projects (fictional addresses)
type Stage =
  | "new_request" | "quote_sent" | "proposal_approved" | "scheduled"
  | "shoot_complete_editing" | "ready_for_review" | "awaiting_payment" | "delivered";
const ORDER: Stage[] = ["new_request", "quote_sent", "proposal_approved", "scheduled", "shoot_complete_editing", "ready_for_review", "awaiting_payment", "delivered"];
const reached = (s: Stage, min: Stage) => ORDER.indexOf(s) >= ORDER.indexOf(min);

type P = {
  key: string; client: ClientKey; street: string; city: string; state: "AL" | "FL"; zip: string;
  type: string; service: string; stage: Stage; created: number; shoot?: number; shootTime?: string;
  deposit?: number; notes?: string;
};
const PROJECTS: P[] = [
  { key: "pelican-point", client: "sarah", street: "1428 Pelican Point Drive", city: "Orange Beach", state: "AL", zip: "36561", type: "Waterfront", service: "luxury_listing_package", stage: "delivered", created: -24, shoot: -18, shootTime: "16:30", deposit: 50 },
  { key: "harbor-light", client: "marcus", street: "27 Harbor Light Lane", city: "Gulf Shores", state: "AL", zip: "36542", type: "Residential", service: "listing_photography", stage: "delivered", created: -21, shoot: -16, shootTime: "10:00" },
  { key: "bayou-vista", client: "laura", street: "61 Bayou Vista Drive", city: "Pensacola", state: "FL", zip: "32507", type: "Waterfront", service: "aerial_photography", stage: "delivered", created: -30, shoot: -26, shootTime: "09:00" },
  { key: "gulf-mist", client: "priya", street: "2208 Gulf Mist Lane", city: "Perdido Key", state: "FL", zip: "32507", type: "Residential", service: "listing_video", stage: "delivered", created: -19, shoot: -12, shootTime: "11:00" },
  { key: "bayfront-plaza", client: "james", street: "312 Bayfront Parkway", city: "Pensacola", state: "FL", zip: "32502", type: "Commercial", service: "commercial_drone", stage: "awaiting_payment", created: -17, shoot: -9, shootTime: "08:00", deposit: 30 },
  { key: "sea-oats", client: "olivia", street: "9 Sea Oats Cove", city: "Perdido Key", state: "FL", zip: "32507", type: "Waterfront", service: "aerial_videography", stage: "ready_for_review", created: -14, shoot: -5, shootTime: "17:15", deposit: 50 },
  { key: "dune-crest", client: "rachel", street: "85 Dune Crest Way", city: "Orange Beach", state: "AL", zip: "36561", type: "Resort", service: "listing_photography", stage: "ready_for_review", created: -12, shoot: -4, shootTime: "10:30" },
  { key: "magnolia-springs", client: "emily", street: "4410 Magnolia Springs Road", city: "Foley", state: "AL", zip: "36535", type: "Residential", service: "twilight_photography", stage: "shoot_complete_editing", created: -9, shoot: -2, shootTime: "17:00" },
  { key: "reynolds-marina", client: "tom", street: "700 Marina Way", city: "Orange Beach", state: "AL", zip: "36561", type: "Marina", service: "aerial_videography", stage: "shoot_complete_editing", created: -10, shoot: -1, shootTime: "07:30", deposit: 50 },
  { key: "lagoon-view", client: "sarah", street: "1601 Lagoon View Court", city: "Gulf Shores", state: "AL", zip: "36542", type: "Waterfront", service: "luxury_listing_package", stage: "scheduled", created: -6, shoot: 3, shootTime: "10:00", deposit: 50 },
  { key: "osprey-ridge", client: "priya", street: "22 Osprey Ridge Drive", city: "Fairhope", state: "AL", zip: "36532", type: "Residential", service: "aerial_photography", stage: "scheduled", created: -5, shoot: 4, shootTime: "14:00" },
  { key: "coastal-hwy", client: "david", street: "919 Coastal Highway, Lot 4", city: "Navarre", state: "FL", zip: "32566", type: "Construction Site", service: "commercial_drone", stage: "scheduled", created: -7, shoot: 6, shootTime: "08:30", deposit: 30 },
  { key: "cypress-bend", client: "laura", street: "18 Cypress Bend", city: "Daphne", state: "AL", zip: "36526", type: "Residential", service: "listing_photography", stage: "proposal_approved", created: -3 },
  { key: "shoreline-blvd", client: "marcus", street: "5205 Shoreline Boulevard", city: "Gulf Breeze", state: "FL", zip: "32561", type: "Waterfront", service: "luxury_listing_package", stage: "quote_sent", created: -2, deposit: 50 },
  { key: "heron-bay", client: "olivia", street: "140 Heron Bay Loop", city: "Orange Beach", state: "AL", zip: "36561", type: "Waterfront", service: "twilight_photography", stage: "quote_sent", created: -2 },
  { key: "sandpiper", client: "emily", street: "3 Sandpiper Court", city: "Gulf Shores", state: "AL", zip: "36542", type: "Residential", service: "listing_photography", stage: "new_request", created: 0 },
  { key: "pelican-cove-lot", client: "david", street: "Pelican Cove Lots 12–18", city: "Orange Beach", state: "AL", zip: "36561", type: "Construction Site", service: "commercial_drone", stage: "new_request", created: 0, notes: "Monthly progress aerials for the new townhome phase." },
];

/** Older delivered jobs (last ~3 months) so revenue, charts and growth look like a working business. */
const HISTORY: [string, ClientKey, string, string, "AL" | "FL", string, string, string][] = [
  ["gulf-vista", "sarah", "212 Gulf Vista Lane", "Orange Beach", "AL", "36561", "Waterfront", "luxury_listing_package"],
  ["live-oak", "laura", "47 Live Oak Circle", "Fairhope", "AL", "36532", "Residential", "listing_photography"],
  ["pier-point", "marcus", "908 Pier Point Road", "Gulf Shores", "AL", "36542", "Waterfront", "aerial_photography"],
  ["sunset-bay", "olivia", "15 Sunset Bay Drive", "Perdido Key", "FL", "32507", "Waterfront", "listing_video"],
  ["tidewater", "priya", "330 Tidewater Court", "Daphne", "AL", "36526", "Residential", "listing_photography"],
  ["marina-tower", "james", "1 Marina Tower Plaza", "Pensacola", "FL", "32502", "Commercial", "commercial_drone"],
  ["seagrove", "rachel", "6 Seagrove Walk", "Orange Beach", "AL", "36561", "Resort", "virtual_tour"],
  ["palmetto", "emily", "2140 Palmetto Street", "Foley", "AL", "36535", "Residential", "listing_photography"],
  ["egret-landing", "sarah", "19 Egret Landing", "Gulf Shores", "AL", "36542", "Waterfront", "aerial_videography"],
  ["windward", "marcus", "77 Windward Way", "Gulf Breeze", "FL", "32561", "Residential", "twilight_photography"],
  ["coral-reef", "tom", "Coral Reef Boat Club", "Orange Beach", "AL", "36561", "Marina", "aerial_videography"],
  ["blue-heron", "laura", "501 Blue Heron Drive", "Pensacola", "FL", "32507", "Waterfront", "luxury_listing_package"],
  ["shell-bank", "priya", "28 Shell Bank Road", "Fairhope", "AL", "36532", "Residential", "aerial_photography"],
  ["harbor-ridge", "david", "Harbor Ridge Phase 2", "Navarre", "FL", "32566", "Construction Site", "commercial_drone"],
  ["sandcastle", "olivia", "8 Sandcastle Lane", "Perdido Key", "FL", "32507", "Waterfront", "listing_photography"],
  ["oyster-bay", "emily", "1120 Oyster Bay Road", "Gulf Shores", "AL", "36542", "Residential", "floor_plan"],
  ["mariner", "rachel", "64 Mariner Drive", "Orange Beach", "AL", "36561", "Resort", "listing_video"],
  ["cypress-point", "sarah", "300 Cypress Point", "Daphne", "AL", "36526", "Residential", "listing_photography"],
];
for (const [i, [key, client, street, city, state, zip, type, service]] of HISTORY.entries()) {
  const shoot = -88 + i * 4;
  PROJECTS.push({ key, client, street, city, state, zip, type, service, stage: "delivered", created: shoot - 6, shoot, shootTime: i % 2 ? "10:00" : "15:30", deposit: i % 3 === 0 ? 50 : undefined });
}

/** Client inbox threads (client_messages). Only clients with a demo login can author. */
const INBOX: { client: ClientKey; who: "client" | "admin"; body: string; day: number; time: string; project?: string }[] = [
  { client: "sarah", who: "client", body: "Can we add twilight photos to Lagoon View? The sellers would love them.", day: -1, time: "19:02", project: "lagoon-view" },
  { client: "sarah", who: "admin", body: "Absolutely. I've added twilight to the proposal for Wednesday evening.", day: -1, time: "19:20", project: "lagoon-view" },
  { client: "olivia", who: "client", body: "Just left notes on the Sea Oats film. Otherwise it's perfect!", day: 0, time: "08:14", project: "sea-oats" },
  { client: "olivia", who: "admin", body: "Thanks Olivia! v3 will be in your portal by this afternoon.", day: 0, time: "08:31", project: "sea-oats" },
  { client: "sarah", who: "client", body: "Pelican Point photos are already getting showings. Thank you!", day: -12, time: "10:45", project: "pelican-point" },
];

const MESSAGES: Record<string, { who: "client" | "admin"; body: string; day: number; time: string }[]> = {
  "sea-oats": [
    { who: "admin", body: "Your sunset film is ready for review. Leave notes right on the video and I'll turn the edit around tomorrow.", day: -1, time: "18:40" },
    { who: "client", body: "This looks incredible! I left two small notes on the timeline.", day: 0, time: "08:12" },
  ],
  "lagoon-view": [
    { who: "client", body: "Gate code is 4127. The sellers will be out by 9:30.", day: -1, time: "15:05" },
    { who: "admin", body: "Perfect, thank you! We'll do twilight the same evening around 5:15.", day: -1, time: "15:22" },
  ],
  "bayfront-plaza": [
    { who: "client", body: "The aerials came out great. Can you also send a vertical cut for Instagram?", day: -2, time: "11:47" },
    { who: "admin", body: "Already in your gallery as Bayfront_Vertical_Cut.mp4.", day: -2, time: "12:10" },
  ],
  "cypress-bend": [
    { who: "client", body: "Any morning next week works for the sellers.", day: -1, time: "09:30" },
  ],
};

// ---------------------------------------------------------------- main
async function main() {
  if (!SLUG) throw new Error("Pass --slug <demo business slug>.");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env (run with --env-file=.env.local).");
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  const { data: biz, error: bizErr } = await db.from("businesses").select("id, slug, name, is_protected, owner_user_id, created_at").eq("slug", SLUG).maybeSingle();
  if (bizErr || !biz) throw new Error(`Business "${SLUG}" not found.`);
  if (biz.name !== DEMO_NAME) throw new Error(`Refusing: business name is "${biz.name}", expected "${DEMO_NAME}".`);
  if (biz.is_protected) throw new Error("Refusing: business is protected.");
  if (!biz.owner_user_id) throw new Error("Business has no owner yet. Finish signup first.");
  NS = biz.id;
  const B = biz.id as string;

  // Any client NOT on the demo domain means this is a real business. Stop.
  const { data: existingClients } = await db.from("clients").select("email").eq("business_id", B).is("deleted_at", null);
  const foreign = (existingClients ?? []).filter((c) => !String(c.email).toLowerCase().endsWith(`@${DEMO_EMAIL_DOMAIN}`));
  if (foreign.length) throw new Error(`Refusing: ${foreign.length} non-demo client(s) exist in this business.`);

  const { data: owner } = await db.from("profiles").select("id, full_name, role, business_id").eq("id", biz.owner_user_id).single();
  if (!owner || owner.business_id !== B || owner.role !== "admin") throw new Error("Owner profile does not belong to this business.");
  const OWNER = owner.id as string;

  console.log(`Demo business: ${biz.name} (${B}), owner ${owner.full_name}. ${DRY ? "DRY RUN" : WIPE ? "WIPE" : "WRITE"}`);

  if (WIPE) return wipe(db, B);

  const plan: [string, Record<string, unknown>[]][] = [];
  const put = (table: string, rows: Record<string, unknown>[]) => plan.push([table, rows]);

  // business row: comped (no trial banners/charges), lifecycle emails off
  // settings: branding + every email channel off so nothing is mailed to fake addresses
  const { data: settingsRow } = await db.from("business_settings").select("settings").eq("business_id", B).maybeSingle();
  const settings = (settingsRow?.settings ?? {}) as Record<string, any>;
  // Every event key, so emails stay off even when the new business has no saved matrix yet.
  const EVENT_KEYS = [
    "new_project_request", "preliminary_estimate_created", "official_proposal_sent", "proposal_approved", "proposal_changes_requested",
    "shoot_time_proposed", "shoot_time_confirmed", "shoot_time_declined", "shoot_scheduled", "shoot_rescheduled", "shoot_completed",
    "deliverables_ready", "revision_requested", "revision_completed", "payment_link_sent", "payment_received", "payment_failed",
    "project_delivered", "project_message", "client_added_to_project", "video_review_client_comment", "video_review_business_reply",
    "video_review_reopened", "video_review_new_version", "video_review_feedback_resolved",
  ];
  const savedNotif = (settings.notifications ?? {}) as Record<string, any>;
  const notifications = Object.fromEntries(
    EVENT_KEYS.map((k) => [k, { inApp: true, push: false, ...(savedNotif[k] ?? {}), email: false }])
  );
  const nextSettings = {
    ...settings,
    notifications,
    business: {
      ...(settings.business ?? {}),
      businessName: DEMO_NAME, portalName: DEMO_NAME, legalName: "Coastal Light Media LLC",
      tagline: "Real estate and drone media on the Gulf Coast",
      primaryContactEmail: `hello@${DEMO_EMAIL_DOMAIN}`, supportEmail: `hello@${DEMO_EMAIL_DOMAIN}`,
      phoneNumber: "(251) 555-0100", websiteUrl: "https://coastallightmedia.example.com",
      city: "Orange Beach", state: "AL", postalCode: "36561", country: "US",
      brandPrimaryColor: "#0E3B5C", brandAccentColor: "#F2994A",
    },
    proposals: { ...(settings.proposals ?? {}), autoPreliminaryEstimate: true, showPreliminaryToClients: true },
  };

  // services
  const svcId = (slug: string) => uid(`service:${slug}`);
  const { data: existingSvcs } = await db.from("business_services").select("id, slug").eq("business_id", B);
  const svcIdBySlug = new Map((existingSvcs ?? []).map((s) => [s.slug as string, s.id as string]));
  const serviceRows = SERVICES.map((s, i) => ({
    id: svcIdBySlug.get(s.slug) ?? svcId(s.slug), business_id: B, name: s.name, slug: s.slug, description: s.desc,
    preliminary_estimate_cents: s.cents, starting_label: `Starting at $${Math.round(s.cents / 100)}`, includes: s.includes,
    line_items: linesFor(s.slug), hide_pricing: false, is_recommended: !!s.recommended, display_order: i, is_active: true, aliases: [],
  }));
  // Hide signup-default services that are not part of the demo catalog.
  const extraSvcs = (existingSvcs ?? []).filter((s) => !SERVICES.some((d) => d.slug === s.slug)).map((s) => s.id as string);
  put("business_services", serviceRows);

  // clients + properties
  const clientId = (k: string) => uid(`client:${k}`);
  put("clients", CLIENTS.map((c) => ({
    id: clientId(c.key), business_id: B, name: `${c.first} ${c.last}`, full_name: `${c.first} ${c.last}`, first_name: c.first, last_name: c.last,
    email: emailOf(c), phone: c.phone, company: c.company, referral_source: "Referral",
    created_at: at(-60 + CLIENTS.indexOf(c) * 3, "09:00"), last_activity_at: at(-CLIENTS.indexOf(c), "12:00"),
  })));
  const propId = (k: string) => uid(`property:${k}`);
  put("properties", PROJECTS.map((p) => {
    const address = `${p.street}, ${p.city}, ${p.state} ${p.zip}`;
    return { id: propId(p.key), business_id: B, client_id: clientId(p.client), address: p.street, normalized_address: address.toLowerCase(), city: p.city, state: p.state, zip: p.zip, property_type: p.type, created_at: at(p.created, "08:55") };
  }));

  // projects and everything hanging off them
  const projectRows: Record<string, unknown>[] = [];
  const pc: Record<string, unknown>[] = [], ps: Record<string, unknown>[] = [], quotes: Record<string, unknown>[] = [];
  const pays: Record<string, unknown>[] = [], props: Record<string, unknown>[] = [], msgs: Record<string, unknown>[] = [];
  const acts: Record<string, unknown>[] = [];
  const act = (p: P, type: string, title: string, description: string, when: string, metadata: Record<string, unknown> | null = null, visibility = "both") =>
    acts.push({ id: uid(`act:${p.key}:${type}:${when}`), business_id: B, project_id: uid(`project:${p.key}`), client_id: clientId(p.client), property_id: propId(p.key), activity_type: type, title, description, metadata, visibility, user_id: OWNER, created_at: when, idempotency_key: `demo:${p.key}:${type}:${when}` });

  for (const p of PROJECTS) {
    const pid = uid(`project:${p.key}`);
    const s = svc(p.service);
    const lines = linesFor(p.service);
    const total = lines.reduce((a, l) => a + l.amount_cents, 0);
    const created = at(p.created, "09:12");
    const status = p.stage;
    projectRows.push({
      id: pid, business_id: B, client_id: clientId(p.client), property_id: propId(p.key), service_id: svcIdBySlug.get(p.service) ?? svcId(p.service),
      property_address: `${p.street}, ${p.city}, ${p.state} ${p.zip}`, project_name: p.street, service_type: s.name, status,
      shoot_date: p.shoot !== undefined && reached(status, "scheduled") ? day(p.shoot) : null,
      delivery_date: status === "delivered" && p.shoot !== undefined ? day(p.shoot + 2) : null,
      notes: p.notes ?? null, created_at: created, updated_at: at(Math.min(0, (p.shoot ?? p.created) + 1), "12:00"),
      deliverables_approved_at: reached(status, "awaiting_payment") ? at((p.shoot ?? 0) + 2, "15:00") : null,
      client_section_photos: true, client_section_videos: true, client_section_tours: false, client_section_documents: false,
      client_section_models: false, client_section_estimates: true, client_section_payments: true, ghl_sync_status: "skipped",
      request_key: `demo:${p.key}`,
    });
    pc.push({ id: uid(`pc:${p.key}`), business_id: B, project_id: pid, client_id: clientId(p.client), is_primary: true, created_at: created });
    ps.push({ id: uid(`ps:${p.key}`), business_id: B, project_id: pid, service_id: svcIdBySlug.get(p.service) ?? svcId(p.service), service_name: s.name, position: 0, created_at: created });
    act(p, "project_created", "Project created", `${CLIENTS.find((c) => c.key === p.client)!.first} requested ${s.name}`, created);

    // preliminary estimate (automatic at request time)
    const prelim = uid(`quote:prelim:${p.key}`);
    quotes.push({ id: prelim, business_id: B, project_id: pid, quote_kind: "preliminary", title: `Preliminary estimate · ${s.name}`, line_items: lines, total_cents: total, status: "sent", sent_at: created, created_at: created, updated_at: created });
    act(p, "preliminary_estimate_created", "Preliminary estimate created", `Automatic estimate for ${s.name}`, at(p.created, "09:13"), { quoteId: prelim, serviceType: s.name });

    // official proposal
    let official: string | null = null;
    if (reached(status, "quote_sent")) {
      official = uid(`quote:official:${p.key}`);
      const sent = at(p.created + 1, "10:05");
      const approved = reached(status, "proposal_approved") ? at(p.created + 1, "16:42") : null;
      quotes.push({
        id: official, business_id: B, project_id: pid, quote_kind: "official", title: `${s.name} · ${p.street}`,
        description: "Thanks for the opportunity! Here is everything included for this listing.", line_items: lines, total_cents: total,
        status: approved ? "approved" : "sent", sent_at: sent, approved_at: approved, created_by: OWNER, created_at: sent, updated_at: approved ?? sent,
        expires_at: day(p.created + 15),
        deposit_mode: p.deposit ? "percent" : "none", deposit_percent: p.deposit ?? null,
      });
      act(p, "official_proposal_sent", "Proposal sent", `Official proposal for $${(total / 100).toFixed(2)}`, sent, { quoteId: official, total_cents: total });
      if (approved) act(p, "quote_approved", "Proposal approved", "Client approved the proposal", approved, { to: "proposal_approved", from: "quote_sent", automated: true });
    }

    // shoot time
    if (p.shoot !== undefined && reached(status, "proposal_approved")) {
      const when = at(p.shoot, p.shootTime ?? "10:00");
      const confirmed = reached(status, "scheduled");
      props.push({ id: uid(`shoot:${p.key}`), business_id: B, project_id: pid, proposed_by: "admin", proposed_at: when, message: confirmed ? null : "Does this time work for the sellers?", status: confirmed ? "confirmed" : "pending", created_by: OWNER, created_at: at(p.created + 2, "09:30"), updated_at: at(p.created + 2, "13:10") });
      act(p, "shoot_proposed", "Shoot time proposed", `Proposed ${day(p.shoot)} at ${p.shootTime}`, at(p.created + 2, "09:30"), { proposed_by: "admin" });
      if (confirmed) act(p, "shoot_confirmed", "Shoot confirmed", `Shoot confirmed for ${day(p.shoot)}`, at(p.created + 2, "13:10"), { to: "scheduled", from: "proposal_approved", automated: true });
    } else if (status === "proposal_approved") {
      props.push({ id: uid(`shoot:${p.key}`), business_id: B, project_id: pid, proposed_by: "admin", proposed_at: at(5, "09:00"), message: "Morning light is best for the front of the house. Does Friday at 9 work?", status: "pending", created_by: OWNER, created_at: at(-1, "10:20"), updated_at: at(-1, "10:20") });
    }
    if (p.shoot !== undefined && reached(status, "shoot_complete_editing")) {
      act(p, "shoot_completed", "Shoot complete", "Field work finished. Editing has started.", at(p.shoot, "19:00"), { to: "shoot_complete_editing", from: "scheduled" });
    }
    if (p.shoot !== undefined && reached(status, "ready_for_review")) {
      act(p, "sent_for_review", "Sent for review", "Deliverables are ready for your review", at(p.shoot + 1, "18:30"), { to: "ready_for_review", from: "shoot_complete_editing" });
    }

    // payments
    const clientIdP = clientId(p.client);
    const mkPay = (k: string, amount: number, description: string, statusP: string, paidAt: string | null, due: string | null) =>
      pays.push({
        id: uid(`pay:${p.key}:${k}`), business_id: B, project_id: pid, client_id: clientIdP, quote_id: official, amount, description, status: statusP,
        paid_at: paidAt, due_date: due, payment_method_type: paidAt ? "card" : null, card_last4: paidAt ? "4242" : null, client_fee_cents: 0,
        created_at: at(p.created + 1, "16:45"), updated_at: paidAt ?? at(p.created + 1, "16:45"),
      });
    if (official && reached(status, "proposal_approved")) {
      const dep = p.deposit ? Math.round((total * p.deposit) / 100) : 0;
      if (dep) {
        mkPay("deposit", dep, `Deposit (${p.deposit}%) · ${s.name}`, "paid", at(p.created + 1, "17:03"), day(p.created + 2));
        act(p, "payment_received", "Deposit paid", `$${(dep / 100).toFixed(2)} deposit paid by card`, at(p.created + 1, "17:03"), null);
      }
      const bal = total - dep;
      if (status === "delivered") {
        mkPay("balance", bal, dep ? `Balance · ${s.name}` : s.name, "paid", at((p.shoot ?? 0) + 2, "10:24"), day((p.shoot ?? 0) + 3));
        act(p, "payment_received", "Payment received", `$${(bal / 100).toFixed(2)} paid by card. Downloads unlocked.`, at((p.shoot ?? 0) + 2, "10:24"), { to: "delivered", from: "awaiting_payment", automated: true });
      } else if (reached(status, "ready_for_review")) {
        mkPay("balance", bal, dep ? `Balance · ${s.name}` : s.name, "sent", null, day((p.shoot ?? 0) + 5));
        act(p, "invoice_sent", "Invoice sent", `Balance of $${(bal / 100).toFixed(2)} due on delivery`, at((p.shoot ?? 0) + 1, "18:31"), null);
      }
    }

    for (const [i, m] of (MESSAGES[p.key] ?? []).entries()) {
      msgs.push({ id: uid(`msg:${p.key}:${i}`), business_id: B, project_id: pid, sender_role: m.who, sender_user_id: m.who === "admin" ? OWNER : null, body: m.body, created_at: at(m.day, m.time) });
    }
  }

  put("projects", projectRows);
  put("project_clients", pc);
  put("project_services", ps);
  put("project_quotes", quotes);
  put("shoot_proposals", props);
  put("payments", pays);
  put("activity_logs", acts);

  // Fake client portal logins (needed as authors of client messages / video comments,
  // and to capture the client side on a LOCAL dev server). Password lives only in the
  // gitignored demo-credentials file.
  const portalClients = CLIENTS.filter((c) => c.portal);

  console.log("\nPlan:");
  for (const [t, rows] of plan) console.log(`  upsert ${rows.length.toString().padStart(3)} ${t}`);
  console.log(`  upsert   ${msgs.length} project_messages`);
  console.log(`  create   ${portalClients.length} client portal logins (${portalClients.map(emailOf).join(", ")})`);
  console.log(`  update   businesses (comped, onboarding done, lifecycle emails off) + business_settings (branding, email notifications off)`);
  if (extraSvcs.length) console.log(`  hide     ${extraSvcs.length} signup-default services not in the demo catalog`);
  if (DRY) return;

  await must(db.from("businesses").update({ subscription_status: "comped", comped_reason: "Marketing demo account (Coastal Light Media)", comped_at: new Date().toISOString(), lifecycle_emails_suppressed: true, onboarding_completed_at: new Date().toISOString(), setup_checklist_completed_at: new Date().toISOString() }).eq("id", B));
  await must(db.from("business_settings").upsert({ business_id: B, settings: nextSettings, updated_at: new Date().toISOString(), updated_by: OWNER }));
  if (extraSvcs.length) await must(db.from("business_services").update({ is_active: false }).in("id", extraSvcs));
  for (const [t, rows] of plan) await must(db.from(t).upsert(rows, { onConflict: "id" }));

  // client logins
  const creds: Record<string, string> = existsSync(CRED_FILE) ? JSON.parse(readFileSync(CRED_FILE, "utf8")) : {};
  const userByClient = new Map<string, string>();
  for (const c of portalClients) {
    const email = emailOf(c);
    const { data: prof } = await db.from("profiles").select("id, business_id").ilike("email", email).maybeSingle();
    let userId = prof?.id as string | undefined;
    if (prof && prof.business_id && prof.business_id !== B) throw new Error(`${email} already belongs to another business.`);
    if (!userId) {
      const password = creds[email] ?? randomBytes(12).toString("base64url");
      const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { role: "client", full_name: `${c.first} ${c.last}` } });
      if (error || !data.user) throw new Error(`createUser ${email}: ${error?.message}`);
      userId = data.user.id;
      creds[email] = password;
    }
    await must(db.from("profiles").update({ role: "client", client_id: clientId(c.key), business_id: B, full_name: `${c.first} ${c.last}`, email_notifications_enabled: false, push_notifications_enabled: false }).eq("id", userId));
    await must(db.from("clients").update({ user_id: userId, last_login_at: at(0, "08:10") }).eq("id", clientId(c.key)));
    userByClient.set(c.key, userId);
  }
  writeFileSync(CRED_FILE, JSON.stringify(creds, null, 2) + "\n", { mode: 0o600 });

  // messages need a client author id; clients without a login only appear as admin-side threads
  const projectClient = new Map(PROJECTS.map((p) => [uid(`project:${p.key}`), p.client]));
  const msgRows = msgs
    .map((m) => (m.sender_role === "client" ? { ...m, sender_user_id: userByClient.get(projectClient.get(m.project_id as string)!) ?? null } : m))
    .filter((m) => m.sender_user_id);
  await must(db.from("project_messages").upsert(msgRows, { onConflict: "id" }));
  const inboxRows = INBOX.map((m, i) => ({
    id: uid(`inbox:${i}`), business_id: B, client_id: clientId(m.client), project_id: m.project ? uid(`project:${m.project}`) : null,
    sender_role: m.who, sender_user_id: m.who === "admin" ? OWNER : userByClient.get(m.client), body: m.body, created_at: at(m.day, m.time),
  })).filter((m) => m.sender_user_id);
  await must(db.from("client_messages").upsert(inboxRows, { onConflict: "id" }));

  console.log(`\nDone. Client logins saved to ${path.relative(process.cwd(), CRED_FILE)} (gitignored).`);
}

async function must<T extends { error: { message: string } | null }>(p: PromiseLike<T>): Promise<T> {
  const r = await p;
  if (r.error) throw new Error(r.error.message);
  return r;
}

/** Deletes only rows whose ids this script generates (plus media/reviews on demo projects). */
async function wipe(db: SupabaseClient, B: string) {
  const projectIds = PROJECTS.map((p) => uid(`project:${p.key}`));
  for (const t of ["video_review_comments", "video_review_versions", "video_reviews", "media_assets", "media_folders", "project_messages", "activity_logs", "payments", "shoot_proposals", "project_quotes", "project_services", "project_clients"]) {
    if (DRY) { console.log(`would delete ${t} on demo projects`); continue; }
    await must(db.from(t).delete().eq("business_id", B).in("project_id", projectIds));
  }
  if (DRY) return;
  await must(db.from("projects").delete().eq("business_id", B).in("id", projectIds));
  await must(db.from("properties").delete().eq("business_id", B).in("id", PROJECTS.map((p) => uid(`property:${p.key}`))));
  await must(db.from("clients").delete().eq("business_id", B).in("id", CLIENTS.map((c) => uid(`client:${c.key}`))));
  console.log("Wiped demo rows. Client auth users are left in place (delete them in Supabase Auth if wanted).");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
