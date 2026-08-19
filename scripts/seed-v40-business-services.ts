/**
 * Apply v40 catalog rows from FALLBACK_SERVICE_TEMPLATES (placeholders intact).
 * Run: npx tsx --env-file=.env.local scripts/seed-v40-business-services.ts
 */
import { createClient } from "@supabase/supabase-js";
import { FALLBACK_SERVICE_TEMPLATES } from "../src/lib/service-templates";
import { DEFAULT_PRELIMINARY_DISCLAIMER } from "../src/lib/preliminary-disclaimer";

const SWIFT = "00000000-0000-0000-0000-000000000001";
const PILOT = "00000000-0000-0000-0000-0000000000aa";

const PILOT_STARTER = [
  {
    slug: "aerial_photography",
    name: "Aerial Photography",
    description: "Professional aerial stills for listings, sites, and marketing.",
    cents: 24900,
    starting_label: "Starting at $249",
    includes: ["Licensed drone pilot", "Edited aerial stills", "Digital delivery via {{portalName}}"],
    notes: "Final pricing depends on property size, access, and shot list.",
    hide: false,
    recommended: true,
    aliases: ["Aerial Photography"],
  },
  {
    slug: "aerial_videography",
    name: "Aerial Videography",
    description: "Cinematic aerial video for marketing and social media.",
    cents: 39900,
    starting_label: "Starting at $399",
    includes: ["Cinematic drone flight", "Edited highlight video", "{{portalName}} delivery"],
    notes: "",
    hide: false,
    recommended: false,
    aliases: ["Aerial Videography"],
  },
  {
    slug: "drone_mapping",
    name: "Aerial Mapping",
    description: "Orthomosaic mapping and site documentation.",
    cents: 59900,
    starting_label: "Starting at $599",
    includes: ["Mapping mission", "Orthomosaic map", "Organized digital deliverables"],
    notes: "",
    hide: false,
    recommended: false,
    aliases: ["Aerial Mapping", "Drone Mapping"],
  },
  {
    slug: "custom_project",
    name: "Custom Project",
    description:
      "{{businessName}} will review your request and prepare a custom proposal based on the project scope.",
    cents: 0,
    starting_label: "Custom Quote",
    includes: [] as string[],
    notes: "Final pricing will be confirmed after scope review and scheduling.",
    hide: true,
    recommended: false,
    aliases: ["Other", "Custom Project"],
  },
];

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const db = createClient(url, key);

  const swiftRows = FALLBACK_SERVICE_TEMPLATES.map((t, i) => ({
    business_id: SWIFT,
    name: t.title,
    slug: t.id,
    description: t.description ?? null,
    preliminary_estimate_cents: t.startingAtCents,
    starting_label: t.startingLabel,
    includes: t.includes,
    line_items: t.lineItems,
    notes: t.notes,
    hide_pricing: Boolean(t.hidePricing),
    is_recommended: Boolean(t.recommended),
    display_order: i,
    is_active: true,
    aliases: t.serviceNames,
  }));

  const { error: swiftError } = await db.from("business_services").upsert(swiftRows, {
    onConflict: "business_id,slug",
    ignoreDuplicates: true,
  });
  if (swiftError) throw swiftError;

  const pilotRows = PILOT_STARTER.map((t, i) => ({
    business_id: PILOT,
    name: t.name,
    slug: t.slug,
    description: t.description,
    preliminary_estimate_cents: t.cents,
    starting_label: t.starting_label,
    includes: t.includes,
    line_items: [{ description: t.name === "Custom Project" ? "Custom Proposal Required" : t.name, amount_cents: t.cents }],
    notes: t.notes,
    hide_pricing: t.hide,
    is_recommended: t.recommended,
    display_order: i,
    is_active: true,
    aliases: t.aliases,
  }));

  const { error: pilotError } = await db.from("business_services").upsert(pilotRows, {
    onConflict: "business_id,slug",
    ignoreDuplicates: true,
  });
  if (pilotError) throw pilotError;

  for (const businessId of [SWIFT, PILOT]) {
    const { data: settingsRow } = await db
      .from("business_settings")
      .select("settings")
      .eq("business_id", businessId)
      .maybeSingle();
    const settings = (settingsRow?.settings ?? {}) as Record<string, unknown>;
    const proposals = (settings.proposals ?? {}) as Record<string, unknown>;
    if (!proposals.preliminaryDisclaimer) {
      const next = {
        ...settings,
        proposals: { ...proposals, preliminaryDisclaimer: DEFAULT_PRELIMINARY_DISCLAIMER },
      };
      const { error } = await db.from("business_settings").update({ settings: next }).eq("business_id", businessId);
      if (error) throw error;
    }
  }

  const { count: swiftCount } = await db
    .from("business_services")
    .select("id", { count: "exact", head: true })
    .eq("business_id", SWIFT);
  const { count: pilotCount } = await db
    .from("business_services")
    .select("id", { count: "exact", head: true })
    .eq("business_id", PILOT);
  console.log(`seeded catalog: swift=${swiftCount} pilot=${pilotCount}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
