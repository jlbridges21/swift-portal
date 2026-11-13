#!/usr/bin/env node
/**
 * One signed-in visit to the Projects page (no click), held for --dwell ms, recording every
 * request the page makes. Pair with a read-only pg_stat_statements snapshot before/after to
 * measure the database cost of the visit (including link prefetches).
 *   node scripts/perf/projects-visit-cost.mjs --base <origin> [--tenant-path /b/x] --storage <file>
 */
import { chromium } from "playwright";
import { parseArgs } from "node:util";
const { values: A } = parseArgs({ options: { base: { type: "string" }, "tenant-path": { type: "string", default: "" }, storage: { type: "string" }, dwell: { type: "string", default: "6000" } } });
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, storageState: A.storage, serviceWorkers: "block" });
const page = await ctx.newPage();
const reqs = [];
page.on("request", (r) => {
  const h = r.headers();
  reqs.push({ url: r.url(), rsc: h["rsc"] === "1" || /[?&]_rsc=/.test(r.url()), prefetch: Boolean(h["next-router-prefetch"] || h["next-router-segment-prefetch"]) });
});
const t = Date.now();
await page.goto(`${A.base}${A["tenant-path"]}/admin/projects`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(Number(A.dwell));
const sameOrigin = reqs.filter((r) => r.url.startsWith(A.base));
const routes = new Set(sameOrigin.filter((r) => r.rsc && r.prefetch).map((r) => new URL(r.url).pathname));
console.log(JSON.stringify({ ms: Date.now() - t, requests: reqs.length, sameOrigin: sameOrigin.length, rscPrefetch: sameOrigin.filter((r) => r.rsc && r.prefetch).length, rscPrefetchRoutes: routes.size, rscOther: sameOrigin.filter((r) => r.rsc && !r.prefetch).length }));
await browser.close();
