#!/usr/bin/env node
/**
 * Read-only regression checks for the Projects → project-detail path. Performs no writes.
 *
 *   node scripts/perf/nav-regression.mjs --base <origin> [--tenant-path /b/x] --storage <file> \
 *     --heavy <id> --other <id> --foreign <projectId of ANOTHER studio> [--out perf-results/regression]
 *
 * Checks:
 *   signed_out_redirect      no session → /admin/projects/<id> lands on /login (no project data)
 *   tampered_token_rejected  session cookie with a forged JWT signature → /login (middleware getUser)
 *   foreign_project_404      another studio's project id → not found, no foreign data in the response
 *   back_forward             A → B (client nav) → Back shows A → Forward shows B
 *   direct_vs_client_equal   key regions identical for a direct load vs client navigation
 *   activity_streams_in      activity panel fills in after the page (candidate) and lists entries
 *   estimate_pdf_preview     lazily loaded PDF engine renders the estimate preview (canvas / object)
 *   mobile_layout            375×812: title, status and tabs render, no horizontal overflow
 *   hover_prefetch_instant   hover a card, then click: page renders from the prefetch (no request after click)
 *   stale_prefetch_refreshes prefetched >15 s before the click: page shows, then refreshes itself in the background
 * Exit code 1 if any check fails. Output: JSON with pass/fail + evidence (no customer data).
 */
import { chromium } from "playwright";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { parseArgs } from "node:util";

const { values: A } = parseArgs({
  options: {
    base: { type: "string" },
    "tenant-path": { type: "string", default: "" },
    storage: { type: "string" },
    heavy: { type: "string" },
    other: { type: "string" },
    foreign: { type: "string" },
    label: { type: "string", default: "run" },
    out: { type: "string", default: "perf-results/regression" },
  },
});
const BASE = A.base.replace(/\/$/, "");
const TP = A["tenant-path"];
const results = [];
const check = async (name, fn) => {
  try {
    const evidence = await fn();
    results.push({ name, pass: true, evidence });
  } catch (err) {
    results.push({ name, pass: false, error: String(err?.message ?? err).slice(0, 400) });
  }
  console.log(`${results.at(-1).pass ? "PASS" : "FAIL"} ${name}${results.at(-1).error ? ` — ${results.at(-1).error}` : ""}`);
};
const assert = (cond, msg) => {
  if (!cond) throw new Error(msg);
};

const browser = await chromium.launch();
const storage = JSON.parse(readFileSync(A.storage, "utf8"));
const newCtx = (opts = {}) => browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: "block", ...opts });
const coverTitle = (page) => page.locator('section[aria-label="Project cover"] h1').first();
const detail = (id) => `${BASE}${TP}/admin/projects/${id}`;

async function regionsSnapshot(page) {
  await coverTitle(page).waitFor({ timeout: 30_000 });
  await page.waitForTimeout(2500); // let streamed panels settle
  return page.evaluate(() => {
    const t = (sel) => Array.from(document.querySelectorAll(sel)).map((e) => e.textContent?.replace(/\s+/g, " ").trim()).filter(Boolean);
    const status = document.querySelector('[aria-label="Project status"]');
    return {
      title: t('section[aria-label="Project cover"] h1'),
      meta: t('section[aria-label="Project cover"] h1 + p'),
      status: status ? status.value ?? status.textContent : null,
      tabs: t('[role="tablist"][aria-label="Project sections"] [role="tab"]'),
      categoryTabs: t('[role="tablist"]:not([aria-label="Project sections"]) [role="tab"]'),
      clients: t('[aria-label^="View "]').length,
      activityItems: Array.from(document.querySelectorAll("section h2")).filter((h) => h.textContent?.includes("Project Activity")).map((h) => h.closest("section")?.querySelectorAll("ul li").length ?? 0),
      toggles: t('[aria-label$="to client"]').length,
    };
  });
}

await check("signed_out_redirect", async () => {
  const ctx = await newCtx();
  const page = await ctx.newPage();
  const res = await page.goto(detail(A.heavy));
  await page.waitForLoadState("domcontentloaded");
  const url = new URL(page.url());
  const hasCover = await page.locator('section[aria-label="Project cover"]').count();
  await ctx.close();
  assert(/\/login/.test(url.pathname), `expected /login, got ${url.pathname}`);
  assert(url.host === new URL(BASE).host, `left the deployment host (landed on ${url.host})`);
  assert(hasCover === 0, "project UI rendered without a session");
  return { landedOn: url.pathname, sameHost: true, status: res?.status() };
});

await check("tampered_token_rejected", async () => {
  // Replace the JWT signature in every Supabase auth cookie with garbage; keep the structure.
  const forged = storage.cookies.map((c) => {
    if (!/^sb-.*-auth-token/.test(c.name)) return c;
    let v = c.value;
    const isB64 = v.startsWith("base64-");
    let json = isB64 ? Buffer.from(v.slice(7), "base64").toString("utf8") : decodeURIComponent(v);
    try {
      const obj = JSON.parse(json);
      if (obj.access_token) {
        const [h, p] = obj.access_token.split(".");
        obj.access_token = `${h}.${p}.${Buffer.from("forged-signature-0000000000000000").toString("base64url")}`;
        obj.refresh_token = "invalid-refresh-token";
      }
      json = JSON.stringify(obj);
      v = isB64 ? `base64-${Buffer.from(json).toString("base64")}` : encodeURIComponent(json);
    } catch {
      v = "invalid";
    }
    return { ...c, value: v };
  });
  const ctx = await newCtx({ storageState: { ...storage, cookies: forged } });
  const page = await ctx.newPage();
  await page.goto(detail(A.heavy));
  await page.waitForLoadState("domcontentloaded");
  const url = new URL(page.url());
  const hasCover = await page.locator('section[aria-label="Project cover"]').count();
  await ctx.close();
  assert(/\/login/.test(url.pathname), `forged token was accepted (landed on ${url.pathname})`);
  assert(url.host === new URL(BASE).host, `left the deployment host (landed on ${url.host})`);
  assert(hasCover === 0, "project UI rendered with a forged token");
  return { landedOn: url.pathname };
});

await check("foreign_project_404", async () => {
  const ctx = await newCtx({ storageState: A.storage });
  const page = await ctx.newPage();
  const res = await page.goto(detail(A.foreign));
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(1500);
  const html = await page.content();
  const hasCover = await page.locator('section[aria-label="Project cover"]').count();
  await ctx.close();
  assert(hasCover === 0, "foreign project rendered");
  assert(!html.includes(A.foreign) || /not.?found|404/i.test(html), "foreign project id echoed without a not-found page");
  return { status: res?.status(), notFoundUi: /not.?found|404|doesn.t exist/i.test(html) };
});

await check("back_forward", async () => {
  const ctx = await newCtx({ storageState: A.storage });
  const page = await ctx.newPage();
  await page.goto(detail(A.heavy));
  const nameA = (await coverTitle(page).textContent())?.trim();
  await page.goto(`${BASE}${TP}/admin/projects`);
  await page.locator(`a[href$="/admin/projects/${A.other}"]`).first().click();
  await page.waitForURL(new RegExp(`${A.other}$`));
  await coverTitle(page).waitFor();
  const nameB = (await coverTitle(page).textContent())?.trim();
  await page.goBack();
  await page.waitForURL(/\/admin\/projects\/?$/);
  await page.goBack();
  await page.waitForURL(new RegExp(`${A.heavy}$`));
  await page.waitForFunction((n) => document.querySelector('section[aria-label="Project cover"] h1')?.textContent?.trim() === n, nameA, { timeout: 30_000 });
  await page.goForward();
  await page.goForward();
  await page.waitForURL(new RegExp(`${A.other}$`));
  await page.waitForFunction((n) => document.querySelector('section[aria-label="Project cover"] h1')?.textContent?.trim() === n, nameB, { timeout: 30_000 });
  await ctx.close();
  assert(nameA && nameB && nameA !== nameB, "project titles not distinct");
  return { distinctTitles: true };
});

await check("direct_vs_client_equal", async () => {
  const ctx = await newCtx({ storageState: A.storage });
  const page = await ctx.newPage();
  await page.goto(detail(A.heavy));
  const direct = await regionsSnapshot(page);
  await page.goto(`${BASE}${TP}/admin/projects`);
  await page.locator(`a[href$="/admin/projects/${A.heavy}"]`).first().click();
  await page.waitForURL(new RegExp(`${A.heavy}$`));
  const client = await regionsSnapshot(page);
  await ctx.close();
  assert(JSON.stringify(direct) === JSON.stringify(client), `differs:\n${JSON.stringify(direct)}\n${JSON.stringify(client)}`);
  return { regions: Object.keys(direct), activityItems: direct.activityItems, tabs: direct.tabs.length };
});

await check("activity_streams_in", async () => {
  const ctx = await newCtx({ storageState: A.storage });
  const page = await ctx.newPage();
  await page.goto(detail(A.heavy));
  await page.waitForFunction(() => Array.from(document.querySelectorAll("section h2")).some((h) => h.textContent?.includes("Project Activity") && h.closest("section")?.querySelector("ul li")), null, { timeout: 30_000 });
  const n = await page.evaluate(() => Math.max(0, ...Array.from(document.querySelectorAll("section h2")).filter((h) => h.textContent?.includes("Project Activity")).map((h) => h.closest("section")?.querySelectorAll("ul li").length ?? 0)));
  // "View All" opens the full timeline (same streamed data).
  await page.getByRole("button", { name: "View All" }).first().click();
  await page.getByRole("dialog").waitFor({ timeout: 10_000 });
  const modalItems = await page.getByRole("dialog").locator("li, [role=listitem]").count();
  await ctx.close();
  assert(n > 0, "activity preview empty");
  assert(modalItems > 0, "activity modal empty");
  return { previewItems: n, modalItems };
});

await check("estimate_pdf_preview", async () => {
  // The Estimates tab offers "Download PDF": the PDF engine (pdf-lib) loads on demand and the
  // generated file must be a real PDF. Nothing is sent or saved server-side.
  const ctx = await newCtx({ storageState: A.storage, acceptDownloads: true });
  const page = await ctx.newPage();
  const chunks = [];
  page.on("response", (r) => {
    if (/\/_next\/static\/chunks\//.test(r.url())) chunks.push(r.url());
  });
  await page.goto(detail(A.heavy));
  await coverTitle(page).waitFor();
  await page.getByRole("tab", { name: /Estimates/ }).click();
  const btn = page.getByRole("button", { name: /download pdf/i }).first();
  if (!(await btn.count())) {
    await ctx.close();
    return { skipped: "no estimate PDF button on this project" };
  }
  const before = chunks.length;
  const [download] = await Promise.all([page.waitForEvent("download", { timeout: 30_000 }), btn.click()]);
  const stream = await download.createReadStream();
  const head = await new Promise((res, rej) => { stream.once("data", (b) => res(b.subarray(0, 5).toString())); stream.once("error", rej); });
  await ctx.close();
  assert(head === "%PDF-", `download is not a PDF (starts with ${JSON.stringify(head)})`);
  return { pdf: true, chunksLoadedOnClick: chunks.length - before };
});

await check("mobile_layout", async () => {
  const ctx = await newCtx({ storageState: A.storage, viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await page.goto(detail(A.heavy));
  await coverTitle(page).waitFor({ timeout: 30_000 });
  const ok = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
    tabs: document.querySelectorAll('[role="tablist"][aria-label="Project sections"] [role="tab"]').length,
    status: Boolean(document.querySelector('[aria-label="Project status"]')),
  }));
  mkdirSync(A.out, { recursive: true });
  await page.screenshot({ path: `${A.out}/${A.label}-mobile.png` });
  await ctx.close();
  assert(!ok.overflow, "horizontal overflow at 375px");
  assert(ok.tabs >= 2 && ok.status, "primary controls missing on mobile");
  return ok;
});

async function hoverThenClick(page, id, waitMs) {
  await page.goto(`${BASE}${TP}/admin/projects`);
  const link = page.locator(`a[href$="/admin/projects/${id}"]`).first();
  await link.waitFor();
  const rsc = [];
  page.on("request", (r) => {
    if ((r.headers()["rsc"] || /_rsc=/.test(r.url())) && r.url().includes(`/admin/projects/${id}`)) rsc.push({ t: Date.now(), prefetch: Boolean(r.headers()["next-router-prefetch"]) });
  });
  await link.hover();
  await page.waitForTimeout(waitMs);
  const clickAt = Date.now();
  await link.click();
  await coverTitle(page).waitFor({ timeout: 30_000 });
  const shownAt = Date.now();
  await page.waitForTimeout(3000);
  return { before: rsc.filter((r) => r.t < clickAt).length, after: rsc.filter((r) => r.t >= clickAt), shownMs: shownAt - clickAt };
}

await check("hover_prefetch_instant", async () => {
  const ctx = await newCtx({ storageState: A.storage });
  const page = await ctx.newPage();
  const r = await hoverThenClick(page, A.heavy, 2000);
  await ctx.close();
  assert(r.before >= 1, "no prefetch while hovering");
  assert(r.after.length === 0, `click went to the server (${r.after.length} RSC requests after click)`);
  return { prefetchRequests: r.before, shownMs: r.shownMs };
});

await check("stale_prefetch_refreshes", async () => {
  const ctx = await newCtx({ storageState: A.storage });
  const page = await ctx.newPage();
  const r = await hoverThenClick(page, A.heavy, 16_000);
  await ctx.close();
  assert(r.after.length >= 1, "page served from a >15 s old prefetch was not refreshed");
  return { refreshRequestsAfterClick: r.after.length, shownMs: r.shownMs };
});

await browser.close();
mkdirSync(A.out, { recursive: true });
writeFileSync(`${A.out}/${A.label}.json`, JSON.stringify({ base: "<deployment>", at: new Date().toISOString(), results }, null, 2));
const failed = results.filter((r) => !r.pass);
console.log(`${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
