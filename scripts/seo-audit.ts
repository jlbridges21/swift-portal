/**
 * Repeatable SEO audit from the command line (read-only). Crawls the marketing site the way
 * the dashboard does, optionally asks Google's URL Inspection API, and prints page health,
 * site checks, content checklist counts, and ranked opportunities.
 *
 *   npx tsx scripts/seo-audit.ts                         # production (canonical host)
 *   npx tsx scripts/seo-audit.ts --base http://localhost:3000   # a local `next start` build
 *   npx tsx --env-file=.env.local scripts/seo-audit.ts --google # + URL Inspection (~60 of 2,000/day quota)
 *   ... --json out.json                                   # save the full result
 *
 * Exits 1 when a site-side critical issue is found (noindex, wrong canonical, robots block,
 * non-200, broken internal link), so it can gate a pre-deploy check. Google's "not indexed
 * yet" never fails the run: it isn't something a deploy can fix.
 */

import { writeFileSync } from "node:fs";
import { buildInventory } from "../src/lib/seo-growth/inventory";
import { crawlSite } from "../src/lib/seo-growth/crawl";
import { inspectUrls, type InspectionRun } from "../src/lib/seo-growth/url-inspection";
import { assessPages, siteChecks } from "../src/lib/seo-growth/health";
import { auditContent } from "../src/lib/seo-growth/content-audit";
import { buildOpportunities } from "../src/lib/seo-growth/opportunities";
import { getCanonicalSiteUrl } from "../src/lib/site-metadata";

function arg(name: string): string | null {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] ?? "" : null;
}

async function main() {
  const canonical = getCanonicalSiteUrl();
  const base = (arg("--base") ?? canonical).replace(/\/$/, "");
  const useGoogle = process.argv.includes("--google");
  const inventory = buildInventory();
  const baseHost = new URL(base).hostname;
  const canonicalHost = new URL(canonical).hostname;
  const hosts = [...new Set([baseHost, canonicalHost, canonicalHost.replace(/^www\./, "")])];

  console.log(`Crawling ${inventory.length} pages on ${base}…`);
  const crawl = await crawlSite({ baseUrl: base, paths: inventory.map((p) => p.path), hosts, checkExternal: !process.argv.includes("--no-external") });

  let inspection: InspectionRun | null = null;
  if (useGoogle) {
    console.log("Asking Google URL Inspection…");
    inspection = await inspectUrls(inventory.filter((p) => p.monitor).map((p) => `${canonical}${p.path === "/" ? "/" : p.path}`));
    if (inspection.status === "not_configured") console.log("  Search Console env vars not set; skipping.");
  }

  // Canonicals always point at the production host, even when crawling a local build.
  const health = assessPages({ inventory, crawl, inspection, canonicalOrigin: canonical });
  // Sitemap URLs from a local build still use the canonical host, so compare against it.
  const checks = siteChecks({ crawl, sitemaps: null, canonicalOrigin: canonical, inventory });
  const content = auditContent({ inventory, crawl });
  const opps = buildOpportunities({ inventory, health, siteChecks: checks, content, gsc: null, organic: null, inspectedAt: inspection?.status === "ok" ? inspection.checkedAt : null });

  const counts: Record<string, number> = {};
  for (const h of health.filter((x) => x.page.monitor)) counts[h.status] = (counts[h.status] ?? 0) + 1;
  console.log("\nSite checks");
  for (const c of checks) console.log(`  ${c.ok === true ? "✓" : c.ok === false ? "✗" : "·"} ${c.title}${c.ok === false ? ` — ${c.detail}` : ""}`);
  console.log(`\nPage health: ${Object.entries(counts).map(([k, v]) => `${k} ${v}`).join(", ")}`);
  for (const h of health) {
    const serious = h.issues.filter((i) => i.severity !== "info");
    if (serious.length) console.log(`  ${h.path}: ${serious.map((i) => `[${i.severity}/${i.source}] ${i.title}`).join("; ")}`);
  }
  console.log(`\nContent checklist: ${content.filter((c) => c.items.length).length} of ${content.length} pages have items`);
  console.log(`\nOpportunities (${opps.length}, internal heuristic order)`);
  for (const o of opps) console.log(`  [${o.priority.padEnd(6)}] ${o.title}  (${o.evidenceType})`);

  const json = arg("--json");
  if (json) {
    writeFileSync(json, JSON.stringify({ base, crawl, inspection, health, checks, content, opportunities: opps }, null, 2));
    console.log(`\nSaved ${json}`);
  }

  const siteCritical = health.some((h) => h.issues.some((i) => i.severity === "critical" && i.source === "site")) || checks.some((c) => c.ok === false && c.severity === "critical");
  if (siteCritical) {
    console.error("\nSite-side critical issues found.");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
