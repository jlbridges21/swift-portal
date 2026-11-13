/**
 * Installed-app (PWA) top safe area: one solid surface, no translucency or blur.
 *
 * Static checks (no server): status-bar style, viewport-fit and theme-color wiring.
 * Browser checks (dev server at BASE_URL, default http://localhost:3000): loads /login (which uses the
 * shared sticky app header) in Chromium, emulates the installed app (display-mode: standalone via CDP,
 * plus <html data-standalone> for iOS builds that don't report display-mode) and an iPhone-sized top
 * inset (Chromium can't fake env(safe-area-inset-top), so --sat is set to 59px), then verifies:
 *   - the status-bar strip (body::before) covers exactly the inset, opaque, in the header colour;
 *   - the header directly below it is opaque with no backdrop blur and no gradient;
 *   - in a normal browser tab nothing changes (strip is 0px, header keeps its usual style).
 *
 *   BASE_URL=http://localhost:3000 npm run test:pwa-safe-area      (SKIP_BROWSER=1 for static only)
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { chromium, type Page } from "playwright";

const ROOT = join(__dirname, "..");
const BASE = (process.env.BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

let failures = 0;
function check(ok: boolean, label: string, detail?: unknown) {
  if (ok) console.log(`  ✓ ${label}`);
  else {
    failures += 1;
    console.log(`  ✗ ${label}${detail === undefined ? "" : ` — ${JSON.stringify(detail)}`}`);
  }
}

function staticChecks() {
  console.log("\nConfiguration");
  const layout = read("src/app/layout.tsx");
  check(/statusBarStyle:\s*"default"/.test(layout), "root layout: opaque status bar (statusBarStyle default)");
  check(!/statusBarStyle:\s*"black-translucent"/.test(layout), "root layout: no black-translucent status bar");
  check(/viewportFit:\s*"cover"/.test(layout), "root layout: viewport-fit=cover kept");
  const meta = read("src/lib/pwa/metadata.ts");
  check(/statusBarStyle:\s*"default"/.test(meta), "business PWA metadata: statusBarStyle default");
  check(/appChromeThemeColor[\s\S]*\.card/.test(meta), "theme-color = header surface (--color-card)");
  const manifest = read("src/app/manifest.ts");
  check(/theme_color:[^\n]*appChromeThemeColor\(business\)\.themeColor/.test(manifest), "portal manifest theme_color = header surface");
  const css = read("src/app/globals.css");
  const before = css.match(/body::before\s*\{[^}]*\}/)?.[0] ?? "";
  check(/height:\s*var\(--sat\)/.test(before) && /background:\s*var\(--color-card\)/.test(before), "body::before strip: --sat tall, solid --color-card");
  check(!/gradient|backdrop-filter|opacity|transparent/.test(before), "body::before strip: no gradient / blur / transparency");
  const shell = read("src/components/admin/app-shell/admin-app-shell.tsx");
  const header = shell.match(/<header className="([^"]*)"/)?.[1] ?? "";
  check(header.includes("bg-card") && !/bg-card\/|backdrop-blur|gradient/.test(header), "New interface top bar: solid bg-card, no blur", header);
}

async function headerStyles(page: Page) {
  return page.evaluate(() => {
    const before = getComputedStyle(document.body, "::before");
    const header = document.querySelector("header.app-sticky-top")!;
    const hs = getComputedStyle(header);
    const hr = header.getBoundingClientRect();
    const card = getComputedStyle(document.documentElement).getPropertyValue("--color-card").trim();
    const probe = document.createElement("div");
    probe.style.color = card;
    document.body.appendChild(probe);
    const cardRgb = getComputedStyle(probe).color;
    probe.remove();
    return {
      stripHeight: before.height,
      stripBg: before.backgroundColor,
      stripBgImage: before.backgroundImage,
      stripPosition: before.position,
      stripTop: before.top,
      headerBg: hs.backgroundColor,
      headerBgImage: hs.backgroundImage,
      headerBackdrop: hs.backdropFilter || (hs as unknown as Record<string, string>).webkitBackdropFilter || "none",
      headerTop: hr.top,
      cardRgb,
    };
  });
}

const opaque = (c: string) => /^rgb\(/.test(c) || /^rgba\(.*,\s*1\)$/.test(c);

async function browserChecks() {
  const browser = await chromium.launch();

  console.log("\nInstalled app (standalone, emulated 59px top inset) — /login");
  const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("Emulation.setEmulatedMedia", { features: [{ name: "display-mode", value: "standalone" }] });
  const res = await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  if (!res || res.status() !== 200) throw new Error(`/login returned ${res?.status()} — is a dev server running at ${BASE}?`);
  if (!(await page.evaluate(() => matchMedia("(display-mode: standalone)").matches))) {
    console.log("  · this Chromium can't emulate display-mode; testing via <html data-standalone> (same rules)");
  }
  await page.evaluate(() => {
    document.documentElement.setAttribute("data-standalone", "");
    document.documentElement.style.setProperty("--sat", "59px");
  });
  const s = await headerStyles(page);
  check(s.stripPosition === "fixed" && s.stripTop === "0px", "strip is fixed to the very top", s);
  check(s.stripHeight === "59px", "strip covers the whole top inset", s.stripHeight);
  check(opaque(s.stripBg) && s.stripBg === s.cardRgb, "strip is opaque, header colour", { strip: s.stripBg, card: s.cardRgb });
  check(s.stripBgImage === "none", "strip has no gradient", s.stripBgImage);
  check(Math.abs(s.headerTop - 59) <= 1, "header starts right below the inset (no gap)", s.headerTop);
  check(opaque(s.headerBg) && s.headerBg === s.cardRgb, "header is opaque, same colour as the strip", { header: s.headerBg, card: s.cardRgb });
  check(s.headerBackdrop === "none", "header has no backdrop blur", s.headerBackdrop);
  check(s.headerBgImage === "none", "header has no gradient", s.headerBgImage);
  await page.evaluate(() => window.scrollTo(0, 600));
  await page.waitForTimeout(100);
  const scrolled = await headerStyles(page);
  check(Math.abs(scrolled.headerTop - 59) <= 1, "after scrolling the header stays stuck under the strip", scrolled.headerTop);
  await ctx.close();

  console.log("\nNormal mobile browser tab — /login (unchanged)");
  const tab = await browser.newPage({ viewport: { width: 393, height: 852 } });
  await tab.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  const b = await headerStyles(tab);
  check(b.stripHeight === "0px", "no status-bar strip in a browser tab", b.stripHeight);
  check(b.headerTop === 0, "header at the top of the page", b.headerTop);
  check(b.headerBackdrop !== "none", "browser header keeps its usual translucent blur (not changed)", b.headerBackdrop);
  await browser.close();
}

(async () => {
  staticChecks();
  if (!process.env.SKIP_BROWSER) await browserChecks();
  console.log(failures ? `\n${failures} check(s) failed` : "\nAll checks passed");
  process.exit(failures ? 1 : 0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
