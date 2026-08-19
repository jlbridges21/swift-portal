/**
 * Emits the Swift SERVICE_TEMPLATES jsonb payload for migration-v40.
 * Run: npx tsx scripts/emit-v40-service-seed.ts
 */
import { SERVICE_TEMPLATES } from "../src/lib/service-templates";

const rows = SERVICE_TEMPLATES.map((t, index) => ({
  slug: t.id,
  name: t.title,
  description: t.description ?? null,
  preliminary_estimate_cents: t.startingAtCents,
  starting_label: t.startingLabel,
  includes: t.includes,
  line_items: t.lineItems,
  notes: t.notes,
  hide_pricing: Boolean(t.hidePricing),
  is_recommended: Boolean(t.recommended),
  display_order: index,
  aliases: t.serviceNames,
}));

process.stdout.write(JSON.stringify(rows, null, 2));
process.stdout.write("\n");
