/**
 * Verify partner search index gating + keywords (no browser required).
 * Run: npx tsx scripts/verify-partner-search-index.ts
 */
import { searchSettingsIndex } from "../src/lib/settings-search-index";
import {
  resolvePartnerSearchMode,
  searchPartnerIndex,
} from "../src/lib/partner-search-index";

function formatHits(
  partner: ReturnType<typeof searchPartnerIndex>,
  settings: ReturnType<typeof searchSettingsIndex>
) {
  const lines: string[] = [];
  if (settings.length) {
    lines.push("  Settings:");
    for (const e of settings) lines.push(`    - ${e.label} → ${e.href}`);
  }
  if (partner.length) {
    lines.push("  Partner:");
    for (const e of partner) lines.push(`    - ${e.label} → ${e.href}`);
  }
  if (!lines.length) lines.push("  (no destination hits)");
  return lines.join("\n");
}

const QUERIES = [
  "partner",
  "affiliate",
  "commission",
  "payout",
  "referral",
  "landing page",
  "earnings",
] as const;

console.log("=== ACTIVE PARTNER ===");
const activeMode = resolvePartnerSearchMode({ showPartner: true, partnerActive: true });
console.log("mode:", activeMode);
for (const q of QUERIES) {
  console.log(`\nquery: "${q}"`);
  console.log(formatHits(searchPartnerIndex(q, activeMode), searchSettingsIndex(q, 8)));
}

console.log("\n=== NON-PARTNER BUSINESS ADMIN ===");
const pitchMode = resolvePartnerSearchMode({ showPartner: true, partnerActive: false });
console.log("mode:", pitchMode);
for (const q of QUERIES) {
  const partner = searchPartnerIndex(q, pitchMode);
  console.log(`\nquery: "${q}"`);
  console.log(formatHits(partner, searchSettingsIndex(q, 8)));
  const deep = partner.filter((e) => e.href.startsWith("/partner/"));
  if (deep.length) {
    console.error("FAIL: deep partner links for non-partner:", deep.map((d) => d.href));
    process.exit(1);
  }
}

console.log("\n=== SUSPENDED PARTNER (same as pitch — no deep links) ===");
const suspendedMode = resolvePartnerSearchMode({ showPartner: true, partnerActive: false });
console.log("mode:", suspendedMode, "→ Partner Program @ /partner only when keywords match");

console.log("\n=== CLIENT-ONLY ===");
const noneMode = resolvePartnerSearchMode({ showPartner: false, partnerActive: false });
console.log("mode:", noneMode);
const clientPartnerHits = searchPartnerIndex("partner", noneMode);
console.log("partner hits for 'partner':", clientPartnerHits.length);
if (clientPartnerHits.length) {
  console.error("FAIL: client-only saw partner entries");
  process.exit(1);
}

console.log("\n=== landing page disambiguation (active) ===");
const lpPartner = searchPartnerIndex("landing page", "active");
const lpSettings = searchSettingsIndex("landing page", 8);
const hasSettingsLanding = lpSettings.some((e) => e.id === "landing" || /landing/i.test(e.label));
const hasPartnerLanding = lpPartner.some((e) => e.id === "landing");
console.log("settings landing:", hasSettingsLanding, lpSettings.map((e) => e.label));
console.log("partner landing:", hasPartnerLanding, lpPartner.map((e) => e.label));
if (!hasSettingsLanding || !hasPartnerLanding) {
  console.error("FAIL: both landing entries required");
  process.exit(1);
}

console.log("\nOK");
