#!/usr/bin/env node
/**
 * Save a signed-in browser session for the navigation benchmark — WITHOUT handling credentials.
 *
 * Opens a visible Chromium window at the deployment's sign-in page. You sign in yourself; once
 * the browser reaches /admin, the session (cookies + storage) is written to --out, which must be
 * OUTSIDE the repository (default: ~/.shootportal-perf/<host>.json, mode 600).
 *
 *   node scripts/perf/login.mjs --base https://www.example.app [--tenant-path /b/my-studio]
 *
 * Session cookies are host-scoped: run this once per deployment host you benchmark.
 */
import { chromium } from "playwright";
import { mkdirSync, chmodSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: {
    base: { type: "string" },
    "tenant-path": { type: "string", default: "" },
    out: { type: "string" },
    "timeout-min": { type: "string", default: "10" },
  },
});
if (!values.base) {
  console.error("--base is required (deployment origin, e.g. https://studio.shootportal.app)");
  process.exit(2);
}
const base = values.base.replace(/\/$/, "");
const host = new URL(base).host;
const out = resolve(values.out ?? join(homedir(), ".shootportal-perf", `${host}.json`));
if (out.startsWith(resolve("."))) {
  console.error("Refusing to write a session inside the repository. Pass --out outside it.");
  process.exit(2);
}
mkdirSync(join(out, ".."), { recursive: true, mode: 0o700 });

const browser = await chromium.launch({ headless: false });
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await context.newPage();
await page.goto(`${base}${values["tenant-path"]}/login`);
console.log(`Sign in in the browser window (${host}). Waiting for /admin …`);
await page.waitForURL(/\/admin(\/|$|\?)/, { timeout: Number(values["timeout-min"]) * 60_000 });
await page.waitForLoadState("domcontentloaded");
await context.storageState({ path: out });
chmodSync(out, 0o600);
console.log(`Session saved to ${out}`);
await browser.close();
