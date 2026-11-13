#!/usr/bin/env node
/**
 * Focused benchmark: admin Projects list → click one project → project-detail page.
 *
 *   node scripts/perf/project-nav-bench.mjs \
 *     --base https://<deployment> [--tenant-path /b/<slug>] \
 *     --storage ~/.shootportal-perf/<host>.json \
 *     --heavy <projectId> --other <projectId> \
 *     --label baseline [--iterations 10] [--profiles desktop,fast4g] \
 *     [--scenarios cold,warm,direct] [--out perf-results]
 *
 * Scenarios (each: 1 discarded warm-up + N measured iterations):
 *   cold    fresh browser context (empty HTTP cache), full load of Projects, click heavy project
 *   warm    warmed context (JS cached), full load of Projects (empty router cache), click heavy
 *           project; then, client-side, back to Projects and:
 *             repeat  click the same heavy project again
 *             other   back again and click a different project
 *   direct  fresh context, direct document load of the heavy project (TTFB / FCP / LCP)
 * Profiles: desktop = unthrottled; fast4g = DevTools "Fast 4G" (165 ms, 9 / 1.5 Mbps × 0.9) + 4× CPU.
 *
 * Milestones (epoch ms, from rAF polling in the page; click_start = pointerdown):
 *   feedback_visible  a NEW aria-busy loading region appears, or the destination title renders
 *   primary_ready     project title (correct name), status control, actions menu, section tabs
 *                     and — when the project has them — client link and date/address, visible
 *                     and enabled, on the right URL
 *   secondary_ready   initial-view secondary UI present (selectors learned from a full load)
 *   media_ready       cover image (or first visible thumbnail) decoded with natural size > 0
 * networkidle is never used.
 *
 * Never writes credentials: --storage is a session file created by scripts/perf/login.mjs.
 * Output: <out>/<label>-<timestamp>.json (raw) — summarize with compare.mjs.
 */
import { chromium } from "playwright";
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { execSync } from "node:child_process";

const { values: A } = parseArgs({
  options: {
    base: { type: "string" },
    "tenant-path": { type: "string", default: "" },
    storage: { type: "string" },
    heavy: { type: "string" },
    other: { type: "string" },
    label: { type: "string", default: "run" },
    iterations: { type: "string", default: "10" },
    profiles: { type: "string", default: "desktop,fast4g" },
    scenarios: { type: "string", default: "cold,warm,direct" },
    out: { type: "string", default: "perf-results" },
    dwell: { type: "string", default: "2000" },
    "hover-ms": { type: "string", default: "0" }, // cursor rests on the link this long before clicking (human hover-to-click time)
    "milestone-timeout": { type: "string", default: "30000" },
    sha: { type: "string", default: "" },
    headed: { type: "boolean", default: false },
  },
});
for (const k of ["base", "storage", "heavy", "other"]) {
  if (!A[k]) {
    console.error(`--${k} is required`);
    process.exit(2);
  }
}
if (!existsSync(A.storage)) {
  console.error(`session file not found: ${A.storage} (run scripts/perf/login.mjs)`);
  process.exit(2);
}

const BASE = A.base.replace(/\/$/, "");
const TP = A["tenant-path"];
const N = Number(A.iterations);
const DWELL = Number(A.dwell);
const HOVER_MS = Number(A["hover-ms"]);
const MS_TIMEOUT = Number(A["milestone-timeout"]);
const PROFILES = A.profiles.split(",").filter(Boolean);
const SCENARIOS = A.scenarios.split(",").filter(Boolean);
const VIEWPORT = { width: 1440, height: 900 };
const PROJECTS_URL = `${BASE}${TP}/admin/projects`;
const detailPath = (id) => `/admin/projects/${id}`;
const FAST_4G = {
  offline: false,
  latency: 60 * 2.75,
  downloadThroughput: ((9 * 1000 * 1000) / 8) * 0.9,
  uploadThroughput: ((1.5 * 1000 * 1000) / 8) * 0.9,
};
const PROJECT_ALIAS = { [A.heavy]: "heavy", [A.other]: "other" };
const alias = (s) => Object.entries(PROJECT_ALIAS).reduce((acc, [id, name]) => acc.split(id).join(`<${name}>`), s);

// ---------------------------------------------------------------------------------------------
// In-page instrumentation
// ---------------------------------------------------------------------------------------------
const INIT_SCRIPT = () => {
  const w = window;
  if (w.__perf) return;
  w.__perf = { longtasks: [], lcp: [], clickAt: null, armed: false, ms: null };
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) w.__perf.longtasks.push({ s: performance.timeOrigin + e.startTime, d: e.duration });
    }).observe({ type: "longtask", buffered: true });
  } catch {}
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) w.__perf.lcp.push({ t: performance.timeOrigin + e.startTime, size: e.size, el: e.element?.tagName ?? null });
    }).observe({ type: "largest-contentful-paint", buffered: true });
  } catch {}
  addEventListener(
    "pointerdown",
    (e) => {
      if (w.__perf.armed && w.__perf.clickAt == null) w.__perf.clickAt = performance.timeOrigin + e.timeStamp;
    },
    true
  );
};

/** Runs in the page: arms the rAF milestone watcher. `spec` comes from the learned profile. */
const ARM = (spec) => {
  const w = window;
  const now = () => performance.timeOrigin + performance.now();
  const visible = (el) => {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return false;
    const cs = getComputedStyle(el);
    return cs.visibility !== "hidden" && cs.display !== "none" && Number(cs.opacity) > 0;
  };
  // Rendered = laid out with a box. Native selects styled at opacity 0 over a pill, and
  // hover-revealed controls, are usable even though they are not "visible" pixels.
  const rendered = (el) => {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && getComputedStyle(el).display !== "none";
  };
  const preBusy = new WeakSet(document.querySelectorAll('[aria-busy="true"]'));
  const q = (sel) => document.querySelector(sel);
  const qa = (sel) => Array.from(document.querySelectorAll(sel));
  const titleOk = () => {
    const h = spec.mode === "new" ? q('section[aria-label="Project cover"] h1') : qa("main h1").find((x) => x.textContent?.trim() === spec.name);
    return visible(h) && h.textContent?.trim() === spec.name;
  };
  const onUrl = () => location.pathname.endsWith(spec.path);
  const primary = () => {
    if (!onUrl() || !titleOk()) return false;
    for (const sel of spec.primarySelectors) {
      const ok = qa(sel).some((el) => rendered(el) && !el.disabled && el.getAttribute("aria-disabled") !== "true");
      if (!ok) return false;
    }
    if (spec.mode === "new" && qa('[role="tablist"][aria-label="Project sections"] [role="tab"]').filter(visible).length < 2) return false;
    return true;
  };
  // "@activity": the Project Activity card shows its entries (streamed separately in the candidate).
  const activityReady = () =>
    qa("section h2").some((h) => h.textContent?.includes("Project Activity") && h.closest("section")?.querySelector("ul li") && visible(h));
  const secondary = () =>
    onUrl() && spec.secondarySelectors.every((sel) => (sel === "@activity" ? activityReady() : qa(sel).some(visible)));
  const media = () => {
    if (!onUrl()) return false;
    const img = spec.mediaSelector ? q(spec.mediaSelector) : null;
    return Boolean(img && img.complete && img.naturalWidth > 0 && visible(img));
  };
  const feedback = () => {
    if (titleOk() && onUrl()) return true;
    return qa('[aria-busy="true"]').some((el) => !preBusy.has(el) && visible(el));
  };
  w.__perf.clickAt = null;
  w.__perf.armed = true;
  w.__perf.ms = { feedback_visible: null, primary_ready: null, secondary_ready: null, media_ready: null };
  const checks = { feedback_visible: feedback, primary_ready: primary, secondary_ready: secondary, media_ready: media };
  const started = now();
  const tick = () => {
    if (w.__perf.clickAt != null) {
      for (const [k, fn] of Object.entries(checks)) {
        if (w.__perf.ms[k] == null) {
          try {
            if (fn()) w.__perf.ms[k] = now();
          } catch {}
        }
      }
    }
    const done = Object.values(w.__perf.ms).every((v) => v != null);
    if (!done && now() - started < spec.timeout) requestAnimationFrame(tick);
    else w.__perf.armed = false;
  };
  requestAnimationFrame(tick);
};

// ---------------------------------------------------------------------------------------------
// Network capture via CDP (transfer sizes, timings, prefetch classification)
// ---------------------------------------------------------------------------------------------
async function attachNetwork(page, profile) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.setCacheDisabled", { cacheDisabled: false });
  if (profile === "fast4g") {
    await cdp.send("Network.emulateNetworkConditions", FAST_4G);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  }
  const reqs = new Map();
  cdp.on("Network.requestWillBeSent", (e) => {
    const h = Object.fromEntries(Object.entries(e.request.headers).map(([k, v]) => [k.toLowerCase(), v]));
    const offset = e.wallTime * 1000 - e.timestamp * 1000;
    const prev = reqs.get(e.requestId);
    if (prev && e.redirectResponse) prev.redirected = true;
    reqs.set(e.requestId, {
      id: e.requestId,
      url: e.request.url,
      method: e.request.method,
      type: e.type,
      start: e.wallTime * 1000,
      offset,
      rsc: h["rsc"] === "1" || /[?&]_rsc=/.test(e.request.url),
      prefetch: Boolean(h["next-router-prefetch"] || h["next-router-segment-prefetch"]),
      bodyHash: e.request.postData ? createHash("sha1").update(e.request.postData).digest("hex").slice(0, 10) : null,
      frame: e.frameId,
      isMainDoc: e.type === "Document",
      status: null,
      ttfb: null,
      end: null,
      bytes: 0,
      failed: null,
      fromCache: false,
      serverTiming: null,
    });
  });
  cdp.on("Network.responseReceived", (e) => {
    const r = reqs.get(e.requestId);
    if (!r) return;
    r.status = e.response.status;
    r.fromCache = Boolean(e.response.fromDiskCache || e.response.fromServiceWorker || e.response.fromPrefetchCache);
    const t = e.response.timing;
    if (t) r.ttfb = t.requestTime * 1000 + t.receiveHeadersEnd + r.offset;
    const h = Object.fromEntries(Object.entries(e.response.headers).map(([k, v]) => [k.toLowerCase(), v]));
    if (h["server-timing"]) r.serverTiming = h["server-timing"];
    r.vercelId = h["x-vercel-id"] ?? null;
  });
  cdp.on("Network.loadingFinished", (e) => {
    const r = reqs.get(e.requestId);
    if (!r) return;
    r.end = e.timestamp * 1000 + r.offset;
    r.bytes = e.encodedDataLength;
  });
  cdp.on("Network.loadingFailed", (e) => {
    const r = reqs.get(e.requestId);
    if (!r) return;
    r.end = e.timestamp * 1000 + r.offset;
    r.failed = e.canceled ? "canceled" : e.errorText;
  });
  return { cdp, reqs };
}

function normalizeUrl(u) {
  try {
    const url = new URL(u);
    url.searchParams.delete("_rsc");
    // Signed storage URLs: token/expiry differ per request but the object is the same.
    for (const k of ["token", "t", "expires", "Expires", "Signature", "X-Amz-Signature", "X-Amz-Date", "X-Amz-Credential"]) url.searchParams.delete(k);
    return alias(`${url.origin === new URL(BASE).origin ? "" : url.origin}${url.pathname}${url.search}`);
  } catch {
    return u;
  }
}

function windowStats(reqs, from, until) {
  const list = [...reqs.values()].filter((r) => r.start >= from && r.start <= until);
  const finished = list.filter((r) => r.end != null && r.end <= until);
  const dupKeys = new Map();
  for (const r of list) {
    if (r.prefetch) continue; // prefetches reported separately
    const key = `${r.method} ${normalizeUrl(r.url)}${r.bodyHash ? ` #${r.bodyHash}` : ""}${r.rsc ? " [rsc]" : ""}`;
    dupKeys.set(key, (dupKeys.get(key) ?? 0) + 1);
  }
  return {
    requests: list.length,
    finishedBytes: finished.reduce((s, r) => s + (r.bytes || 0), 0),
    duplicates: [...dupKeys.entries()].filter(([, n]) => n > 1).map(([k, n]) => ({ key: k, n })),
    sameUrlDifferentBody: (() => {
      const byUrl = new Map();
      for (const r of list) {
        if (!r.bodyHash) continue;
        const k = `${r.method} ${normalizeUrl(r.url)}`;
        byUrl.set(k, (byUrl.get(k) ?? 0) + 1);
      }
      return [...byUrl.entries()].filter(([, n]) => n > 1).map(([k, n]) => ({ key: k, n }));
    })(),
    jsChunks: list.filter((r) => /\/_next\/static\/chunks\/.+\.js/.test(r.url)).map((r) => ({ url: normalizeUrl(r.url), bytes: r.bytes, ms: r.end != null ? Math.round(r.end - from) : null })),
    failed: list.filter((r) => r.failed && r.failed !== "canceled" || (r.status ?? 0) >= 400).map((r) => ({ url: normalizeUrl(r.url), status: r.status, err: r.failed })),
    canceled: list.filter((r) => r.failed === "canceled").length,
    prefetchRsc: list.filter((r) => r.rsc && r.prefetch).length,
  };
}

// ---------------------------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------------------------
async function newContext(browser) {
  const context = await browser.newContext({ viewport: VIEWPORT, storageState: A.storage, serviceWorkers: "block" });
  await context.addInitScript(INIT_SCRIPT);
  return context;
}

async function setRunCookie(context, runId) {
  const u = new URL(BASE);
  await context.addCookies([{ name: "sp_perf_trace", value: runId, domain: u.hostname, path: "/", secure: u.protocol === "https:", sameSite: "Lax" }]);
}

function wireConsole(page, sink) {
  page.on("console", (m) => {
    const t = m.type();
    const text = m.text();
    if (t === "error" || /hydrat/i.test(text)) sink.push({ t: Date.now(), type: t, text: alias(text).slice(0, 300) });
  });
  page.on("pageerror", (err) => sink.push({ t: Date.now(), type: "pageerror", text: alias(String(err?.message ?? err)).slice(0, 300) }));
}

async function projectLink(page, id) {
  const links = page.locator(`a[href$="${detailPath(id)}"]`);
  await links.first().waitFor({ state: "attached", timeout: 30_000 });
  const n = await links.count();
  for (let i = 0; i < n; i++) {
    const l = links.nth(i);
    if (await l.isVisible()) return l;
  }
  await links.first().scrollIntoViewIfNeeded();
  return links.first();
}

async function measureClick(page, net, spec, linkLocator, label, consoleSink) {
  await linkLocator.scrollIntoViewIfNeeded();
  await page.evaluate(ARM, spec);
  const consoleFrom = consoleSink.length;
  if (HOVER_MS > 0) {
    await linkLocator.hover();
    await page.waitForTimeout(HOVER_MS);
  }
  await linkLocator.click({ noWaitAfter: true });
  const deadline = Date.now() + MS_TIMEOUT + 2000;
  let ms = null;
  let clickAt = null;
  while (Date.now() < deadline) {
    await page.waitForTimeout(100);
    const s = await page.evaluate(() => ({ ms: window.__perf?.ms, clickAt: window.__perf?.clickAt, armed: window.__perf?.armed })).catch(() => null);
    if (!s) continue; // document replaced (full reload) — recorded below
    ms = s.ms;
    clickAt = s.clickAt;
    if (!s.armed) break;
  }
  if (clickAt == null) return { label, error: "click was not registered (no pointerdown)", milestones: {} };
  const docReloads = [...net.reqs.values()].filter((r) => r.isMainDoc && clickAt && r.start >= clickAt).length;
  const rel = (v) => (v != null && clickAt != null ? Math.round(v - clickAt) : null);
  const milestones = Object.fromEntries(Object.entries(ms ?? {}).map(([k, v]) => [k, rel(v)]));
  const endAt = clickAt + Math.max(...Object.values(milestones).filter((v) => v != null), 0);
  // Includes a hover-intent prefetch issued while the cursor rested on the link (started before the click).
  const rscNav = [...net.reqs.values()].filter((r) => r.rsc && clickAt && r.url.includes(detailPath(spec.id)) && r.start >= clickAt - (HOVER_MS ? HOVER_MS + 50 : 5));
  const perStage = {};
  for (const [k, v] of Object.entries(milestones)) if (v != null) perStage[k] = windowStats(net.reqs, clickAt, clickAt + v);
  const all = windowStats(net.reqs, clickAt, endAt + 500);
  const longtasks = (await page.evaluate(() => window.__perf?.longtasks ?? []).catch(() => [])).filter((t) => t.s >= clickAt && t.s <= endAt);
  const serverTrace = await page
    .evaluate(() => Array.from(document.querySelectorAll("script[data-perf-trace]")).map((s) => { try { return JSON.parse(s.textContent || "null"); } catch { return null; } }))
    .catch(() => []);
  return {
    label,
    milestones,
    fullDocumentNavigation: docReloads > 0,
    rsc: rscNav.map((r) => ({ ttfb: r.ttfb != null ? Math.round(r.ttfb - clickAt) : null, done: r.end != null ? Math.round(r.end - clickAt) : null, bytes: r.bytes, startedAfterClick: Math.round(r.start - clickAt), prefetch: r.prefetch, serverTiming: r.serverTiming, vercelId: r.vercelId })),
    perStage,
    window: all,
    longTasks: { count: longtasks.length, totalMs: Math.round(longtasks.reduce((s, t) => s + t.d, 0)), maxMs: Math.round(Math.max(0, ...longtasks.map((t) => t.d))) },
    console: consoleSink.slice(consoleFrom),
    serverTrace: serverTrace.filter(Boolean),
  };
}

async function gotoProjects(page) {
  await page.goto(PROJECTS_URL, { waitUntil: "domcontentloaded" });
}

async function backToProjects(page) {
  const link = page.locator('nav a[href$="/admin/projects"], a[href$="/admin/projects"]').filter({ hasNot: page.locator("[aria-hidden=true]") });
  const n = await link.count();
  for (let i = 0; i < n; i++) {
    if (await link.nth(i).isVisible()) {
      await link.nth(i).click();
      await page.waitForURL(/\/admin\/projects\/?(\?|$)/, { timeout: 30_000 });
      return "sidebar";
    }
  }
  await page.goBack();
  await page.waitForURL(/\/admin\/projects\/?(\?|$)/, { timeout: 30_000 });
  return "history";
}

/** Full load of the heavy project to learn which selectors exist (mode, client, date, media). */
async function learnSpec(browser, id) {
  const context = await newContext(browser);
  const page = await context.newPage();
  for (let attempt = 1; ; attempt++) {
    try {
      await page.goto(`${BASE}${TP}${detailPath(id)}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
      break;
    } catch (err) {
      if (attempt >= 3) throw err;
    }
  }
  await page.waitForTimeout(8000);
  const spec = await page.evaluate(({ path }) => {
    const q = (s) => document.querySelector(s);
    const mode = q('section[aria-label="Project cover"]') ? "new" : "classic";
    const name = (mode === "new" ? q('section[aria-label="Project cover"] h1') : q("main h1"))?.textContent?.trim() ?? "";
    const primarySelectors = [];
    const secondarySelectors = [];
    if (mode === "new") {
      primarySelectors.push('[aria-label="Project status"]', '[aria-label="More project actions"]');
      const vis = (sel) => Array.from(document.querySelectorAll(sel)).some((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; });
      if (vis('section[aria-label="Project cover"] h1 + p')) primarySelectors.push('section[aria-label="Project cover"] h1 + p');
      if (vis('[aria-label^="View "]')) primarySelectors.push('[aria-label^="View "]');
      for (const s of ['[aria-label="Search clients to add"]', '[aria-label$="to client"]', '[aria-label="Client download access"]']) if (vis(s)) secondarySelectors.push(s);
      if (Array.from(document.querySelectorAll("section h2")).some((h) => h.textContent?.includes("Project Activity") && h.closest("section")?.querySelector("ul li"))) secondarySelectors.push("@activity");
    }
    let mediaSelector = null;
    if (q('section[aria-label="Project cover"] img')) mediaSelector = 'section[aria-label="Project cover"] img';
    else if (q('[id^="project-panel-media"] img')) mediaSelector = '[id^="project-panel-media"] img';
    return { mode, name, path, primarySelectors, secondarySelectors, mediaSelector };
  }, { path: detailPath(id) });
  await context.close();
  return { ...spec, id, timeout: MS_TIMEOUT };
}

// ---------------------------------------------------------------------------------------------
// Scenarios
// ---------------------------------------------------------------------------------------------
async function scenarioCold(browser, profile, specs, iter) {
  const context = await newContext(browser);
  await setRunCookie(context, `cold-${profile}-${iter}`);
  const page = await context.newPage();
  const consoleSink = [];
  wireConsole(page, consoleSink);
  const net = await attachNetwork(page, profile);
  const t0 = Date.now();
  await gotoProjects(page);
  const link = await projectLink(page, A.heavy);
  await page.waitForTimeout(DWELL);
  const projectsLoad = windowStats(net.reqs, t0, Date.now());
  const rscPrefetchRoutes = new Set([...net.reqs.values()].filter((r) => r.rsc && r.prefetch && r.start >= t0).map((r) => normalizeUrl(r.url).split("?")[0]));
  const m = await measureClick(page, net, specs.heavy, link, "cold", consoleSink);
  m.projectsPage = { requests: projectsLoad.requests, rscPrefetchRequests: projectsLoad.prefetchRsc, rscPrefetchRoutes: rscPrefetchRoutes.size, bytes: projectsLoad.finishedBytes };
  await context.close();
  return [m];
}

async function scenarioWarm(browser, profile, specs, iter, shared) {
  if (!shared.context) {
    shared.context = await newContext(browser);
    shared.page = await shared.context.newPage();
    shared.console = [];
    wireConsole(shared.page, shared.console);
    shared.net = await attachNetwork(shared.page, profile);
  }
  const { page, net } = shared;
  await setRunCookie(shared.context, `warm-${profile}-${iter}`);
  await gotoProjects(page); // full load: resets the client router cache, keeps HTTP cache
  let link = await projectLink(page, A.heavy);
  await page.waitForTimeout(DWELL);
  const out = [];
  out.push(await measureClick(page, net, specs.heavy, link, "warm", shared.console));
  const via1 = await backToProjects(page);
  link = await projectLink(page, A.heavy);
  await page.waitForTimeout(500);
  const repeat = await measureClick(page, net, specs.heavy, link, "repeat", shared.console);
  repeat.backVia = via1;
  out.push(repeat);
  const via2 = await backToProjects(page);
  link = await projectLink(page, A.other);
  await page.waitForTimeout(500);
  const other = await measureClick(page, net, specs.other, link, "other", shared.console);
  other.backVia = via2;
  out.push(other);
  return out;
}

async function scenarioDirect(browser, profile, specs, iter) {
  const context = await newContext(browser);
  await setRunCookie(context, `direct-${profile}-${iter}`);
  const page = await context.newPage();
  const consoleSink = [];
  wireConsole(page, consoleSink);
  const net = await attachNetwork(page, profile);
  const spec = specs.heavy;
  await page.addInitScript((s) => {
    // Arm on document start: navigationStart counts as the "click".
    window.__perfDirectSpec = s;
  }, spec);
  await page.goto(`${BASE}${TP}${detailPath(A.heavy)}`, { waitUntil: "commit" });
  await page.evaluate(ARM, spec);
  await page.evaluate(() => { window.__perf.clickAt = performance.timeOrigin; });
  const deadline = Date.now() + MS_TIMEOUT + 2000;
  let ms = null;
  while (Date.now() < deadline) {
    await page.waitForTimeout(100);
    const s = await page.evaluate(() => ({ ms: window.__perf?.ms, armed: window.__perf?.armed })).catch(() => null);
    if (!s) continue;
    ms = s.ms;
    if (!s.armed) break;
  }
  const nav = await page.evaluate(() => {
    const n = performance.getEntriesByType("navigation")[0];
    const fcp = performance.getEntriesByName("first-contentful-paint")[0];
    const lcp = window.__perf.lcp.at(-1);
    return { ttfb: n ? Math.round(n.responseStart) : null, fcp: fcp ? Math.round(fcp.startTime) : null, lcp: lcp ? Math.round(lcp.t - performance.timeOrigin) : null, lcpEl: lcp?.el ?? null, origin: performance.timeOrigin };
  });
  const rel = (v) => (v != null ? Math.round(v - nav.origin) : null);
  const milestones = Object.fromEntries(Object.entries(ms ?? {}).map(([k, v]) => [k, rel(v)]));
  const doc = [...net.reqs.values()].find((r) => r.isMainDoc && r.url.includes(detailPath(A.heavy)));
  const result = {
    label: "direct",
    milestones,
    document: { ttfb: nav.ttfb, fcp: nav.fcp, lcp: nav.lcp, lcpElement: nav.lcpEl, serverTiming: doc?.serverTiming ?? null, vercelId: doc?.vercelId ?? null },
    window: windowStats(net.reqs, nav.origin, nav.origin + Math.max(0, ...Object.values(milestones).filter((v) => v != null)) + 500),
    console: consoleSink,
    serverTrace: (await page.evaluate(() => Array.from(document.querySelectorAll("script[data-perf-trace]")).map((s) => JSON.parse(s.textContent || "null"))).catch(() => [])).filter(Boolean),
  };
  await context.close();
  return [result];
}

// ---------------------------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------------------------
const browser = await chromium.launch({ headless: !A.headed });
const meta = {
  label: A.label,
  deployment: BASE,
  tenantPath: TP ? "<tenant-path>" : "",
  sha: A.sha || null,
  browser: `chromium ${browser.version()}`,
  playwright: execSync("npx playwright --version").toString().trim(),
  viewport: VIEWPORT,
  startedAt: new Date().toISOString(),
  iterations: N,
  warmupDiscarded: 1,
  dwellMs: DWELL,
  hoverMs: HOVER_MS,
  profiles: { desktop: "unthrottled", fast4g: { ...FAST_4G, cpuThrottlingRate: 4 } },
  clientHost: execSync("uname -sm").toString().trim(),
};

const specs = { heavy: await learnSpec(browser, A.heavy), other: await learnSpec(browser, A.other) };
meta.specs = Object.fromEntries(Object.entries(specs).map(([k, s]) => [k, { mode: s.mode, nameLength: s.name.length, primarySelectors: s.primarySelectors, secondarySelectors: s.secondarySelectors, mediaSelector: s.mediaSelector }]));
if (!specs.heavy.name || !specs.other.name) {
  console.error("Could not read the project titles — check the session and project ids.");
  process.exit(1);
}
console.log(`[${A.label}] mode=${specs.heavy.mode} browser=${meta.browser}`);

const results = [];
for (const profile of PROFILES) {
  for (const scenario of SCENARIOS) {
    const shared = {};
    for (let i = 0; i <= N; i++) {
      const warmup = i === 0;
      let samples;
      try {
        if (scenario === "cold") samples = await scenarioCold(browser, profile, specs, i);
        else if (scenario === "warm") samples = await scenarioWarm(browser, profile, specs, i, shared);
        else if (scenario === "direct") samples = await scenarioDirect(browser, profile, specs, i);
        else throw new Error(`unknown scenario ${scenario}`);
      } catch (err) {
        samples = [{ label: scenario, error: String(err?.message ?? err).slice(0, 300) }];
      }
      for (const s of samples) {
        results.push({ profile, scenario: s.label, iteration: i, warmup, ...s });
        const m = s.milestones ?? {};
        console.log(`[${A.label}] ${profile} ${s.label.padEnd(6)} #${i}${warmup ? " (warm-up)" : ""} fb=${m.feedback_visible} primary=${m.primary_ready} secondary=${m.secondary_ready} media=${m.media_ready}${s.error ? ` ERROR ${s.error}` : ""}`);
      }
    }
    if (shared.context) await shared.context.close();
  }
}
await browser.close();
meta.finishedAt = new Date().toISOString();

mkdirSync(A.out, { recursive: true });
const file = join(A.out, `${A.label}-${meta.startedAt.replace(/[:.]/g, "-")}.json`);
writeFileSync(file, JSON.stringify({ meta, results }, null, 2));
console.log(`wrote ${file}`);
