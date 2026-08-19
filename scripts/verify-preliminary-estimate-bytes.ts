/**
 * Byte-identical check: FALLBACK_SERVICE_TEMPLATES vs business_services rows
 * for Swift. Run: npx tsx --env-file=.env.local scripts/verify-preliminary-estimate-bytes.ts
 */
import {
  FALLBACK_SERVICE_TEMPLATES,
  buildPreliminaryEstimatePayloadFromTemplate,
} from "../src/lib/service-templates";
import { listServiceTemplatesForBusiness } from "../src/lib/business-services";

const SWIFT = "00000000-0000-0000-0000-000000000001";
const BRAND = { portalName: "Swift Portal", businessName: "Swift Aerial Media" };

function payloadKey(p: ReturnType<typeof buildPreliminaryEstimatePayloadFromTemplate>) {
  return {
    title: p.title,
    description: p.description,
    line_items: p.line_items,
    total_cents: p.total_cents,
    notes: p.notes,
  };
}

async function main() {
  const dbTemplates = await listServiceTemplatesForBusiness(SWIFT);
  const bySlug = new Map(dbTemplates.map((t) => [t.id, t]));

  const diffs: string[] = [];
  for (const fallback of FALLBACK_SERVICE_TEMPLATES) {
    const dbTemplate = bySlug.get(fallback.id);
    if (!dbTemplate) {
      diffs.push(`${fallback.id}: MISSING in business_services`);
      continue;
    }
    const before = payloadKey(buildPreliminaryEstimatePayloadFromTemplate(fallback, BRAND));
    const after = payloadKey(buildPreliminaryEstimatePayloadFromTemplate(dbTemplate, BRAND));
    const left = JSON.stringify(before);
    const right = JSON.stringify(after);
    if (left !== right) {
      diffs.push(`--- ${fallback.id} BEFORE ---\n${left}\n--- AFTER ---\n${right}`);
    } else {
      console.log(`ok  ${fallback.id}`);
    }
  }

  if (diffs.length) {
    console.error(diffs.join("\n\n"));
    throw new Error(`${diffs.length} service(s) differ`);
  }
  console.log(`BYTE-IDENTICAL: all ${FALLBACK_SERVICE_TEMPLATES.length} Swift services match.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
