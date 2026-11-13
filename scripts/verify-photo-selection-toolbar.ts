/**
 * Regression test: selecting a photo must not move the admin photo grid.
 *
 * Opens the dev-only harness (/dev/photo-grid-harness, 404 in production builds) in Chromium and checks:
 *   1. The first click on a photo leaves its bounding rect exactly where it was (no layout shift).
 *   2. A double-click on that same photo opens it in the lightbox.
 *   3. The floating toolbar is fixed to the viewport, takes no space in the page, shows the right
 *      count for one and several photos, keeps one row, stays inside the viewport, and clearing hides it.
 *   4. Narrow widths fold Top/Bottom/Place into "More"; phones sit above the PWA tab bar.
 *
 * Needs a dev server: `npm run dev`, then
 *   BASE_URL=http://localhost:3000 npm run test:photo-selection-toolbar
 * Pure UI test — no database or network access (thumbnail requests are answered locally).
 */
import { chromium, type Page } from "playwright";

const BASE = (process.env.BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const COLORS = ["#0ea5e9", "#f97316", "#22c55e", "#a855f7", "#ef4444", "#eab308", "#14b8a6", "#6366f1"];

let failures = 0;
function check(ok: boolean, label: string, detail?: unknown) {
  if (ok) console.log(`  ✓ ${label}`);
  else {
    failures += 1;
    console.log(`  ✗ ${label}${detail === undefined ? "" : ` — ${JSON.stringify(detail)}`}`);
  }
}

function svgThumb(i: number) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="${COLORS[i % COLORS.length]}"/><text x="20" y="60" font-size="40" fill="white" font-family="sans-serif">Photo ${i + 1}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

async function openHarness(page: Page, query = "") {
  await page.route("**/api/**", async (route) => {
    const req = route.request();
    let ids: string[] = [];
    try {
      ids = (req.postDataJSON() as { ids?: string[] })?.ids ?? [];
    } catch {
      ids = [];
    }
    const urls = Object.fromEntries(ids.map((id) => [id, svgThumb(Number(id.split("-").pop()) - 1)]));
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ urls }) });
  });
  const res = await page.goto(`${BASE}/dev/photo-grid-harness${query}`, { waitUntil: "networkidle" });
  if (!res || res.status() !== 200) throw new Error(`harness returned ${res?.status()} — is a dev server running at ${BASE}?`);
  await page.addStyleTag({ content: "*,*::before,*::after{transition:none!important;animation:none!important}" });
  await page.locator("[data-photo-id]").first().waitFor();
}

const tile = (page: Page, n: number) => page.locator(`[data-photo-id="harness-photo-${n}"]`);
const toolbar = (page: Page) => page.locator("[data-photo-selection-toolbar]");

async function rectOf(page: Page, n: number) {
  return tile(page, n).evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  });
}

async function desktop() {
  console.log("\nDesktop (1440×900, New interface shell)");
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await openHarness(page, "?shell=new");

  const before = await rectOf(page, 3);
  const docHeightBefore = await page.evaluate(() => document.documentElement.scrollHeight);
  const box = await tile(page, 3).boundingBox();
  if (!box) throw new Error("photo 3 not visible");
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;

  await page.mouse.click(cx, cy);
  await page.waitForFunction(() => document.querySelector('[data-photo-id="harness-photo-3"]')?.getAttribute("aria-pressed") === "true");
  await page.waitForTimeout(150); // let any selection chrome render before measuring
  const after = await rectOf(page, 3);
  check(JSON.stringify(before) === JSON.stringify(after), "first click: selected photo keeps its exact rect", { before, after });
  check((await tile(page, 3).getAttribute("aria-pressed")) === "true", "first click selects the photo");
  check(
    (await page.evaluate(() => document.documentElement.scrollHeight)) === docHeightBefore,
    "selecting adds no height to the page"
  );
  await toolbar(page).waitFor({ timeout: 3000 });
  check((await toolbar(page).innerText()).includes("1 photo selected"), "toolbar shows “1 photo selected”");

  const tb = await toolbar(page).evaluate((el) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    const sidebar = parseFloat(getComputedStyle(el).getPropertyValue("--admin-sidebar-w")) || 0;
    return {
      position: cs.position,
      zIndex: Number(cs.zIndex),
      bg: cs.backgroundColor,
      left: r.left,
      right: r.right,
      top: r.top,
      bottom: r.bottom,
      height: r.height,
      vw: innerWidth,
      vh: innerHeight,
      sidebar,
    };
  });
  check(tb.position === "fixed", "toolbar is position: fixed", tb.position);
  check(tb.zIndex >= 40 && tb.zIndex < 100, "toolbar z-index sits above content, below modals (100)", tb.zIndex);
  check(!/rgba\(.*,\s*0(\.\d+)?\)$/.test(tb.bg), "toolbar background is solid", tb.bg);
  check(tb.bottom <= tb.vh && tb.vh - tb.bottom <= 24, "toolbar floats near the bottom of the viewport", tb);
  check(tb.height <= 60, "toolbar is a single row", tb.height);
  const areaCenter = tb.sidebar + (tb.vw - tb.sidebar) / 2;
  check(Math.abs((tb.left + tb.right) / 2 - areaCenter) <= 2, "toolbar is centred in the area beside the sidebar", {
    center: (tb.left + tb.right) / 2,
    areaCenter,
  });
  for (const label of ["Edit Photo", "Move to folder", "Top", "Bottom", "Place", "Hide", "Select all", "Clear", "Delete"]) {
    check(await toolbar(page).getByRole("button", { name: label, exact: true }).isVisible(), `desktop toolbar shows ${label}`);
  }

  // Outside its visible box the toolbar must not catch clicks.
  const outsideHit = await page.evaluate(({ x, y }) => {
    const el = document.elementFromPoint(x, y);
    return Boolean(el?.closest("[data-photo-selection-toolbar]"));
  }, { x: Math.max(tb.sidebar + 4, tb.left - 6), y: tb.top + tb.height / 2 });
  check(!outsideHit, "space beside the toolbar is not intercepted");

  // Second click of a double-click lands on the same photo and opens it.
  await page.mouse.dblclick(cx, cy);
  const lightbox = page.locator("div.fixed.inset-0.bg-black");
  await lightbox.waitFor({ timeout: 3000 }).catch(() => {});
  check(await lightbox.isVisible(), "double-click opens the lightbox");
  const lightboxText = await lightbox.innerText({ timeout: 2000 }).catch(() => "");
  check(/\bPhoto 3\b/.test(lightboxText), "lightbox shows the double-clicked photo", lightboxText.slice(0, 80));
  await page.keyboard.press("Escape");
  await lightbox.waitFor({ state: "hidden", timeout: 3000 }).catch(() => {});

  // Rect still unchanged after the double-click round trip.
  check(JSON.stringify(await rectOf(page, 3)) === JSON.stringify(before), "photo rect unchanged after double-click");

  // Multi-select: shift-click a range.
  await page.mouse.click(cx, cy); // make sure 3 is the anchor and selected
  if ((await tile(page, 3).getAttribute("aria-pressed")) !== "true") await page.mouse.click(cx, cy);
  const box6 = (await tile(page, 6).boundingBox())!;
  const rect6Before = await rectOf(page, 6);
  await page.keyboard.down("Shift");
  await page.mouse.click(box6.x + box6.width / 2, box6.y + box6.height / 2);
  await page.keyboard.up("Shift");
  check((await toolbar(page).innerText()).includes("4 photos selected"), "shift-click range → “4 photos selected”");
  check(JSON.stringify(await rectOf(page, 6)) === JSON.stringify(rect6Before), "shift-click does not move the grid");

  // Clear dismisses the toolbar.
  await toolbar(page).getByRole("button", { name: "Clear", exact: true }).click();
  await toolbar(page).waitFor({ state: "detached", timeout: 2000 }).catch(() => {});
  check((await toolbar(page).count()) === 0, "Clear dismisses the toolbar");

  // Keyboard: Space on a focused tile selects; toolbar buttons are focusable with a label.
  await tile(page, 2).focus();
  await page.keyboard.press(" ");
  check((await toolbar(page).count()) === 1, "keyboard selection shows the toolbar");
  const editBtn = toolbar(page).getByRole("button", { name: "Edit Photo", exact: true });
  await editBtn.focus();
  check(await editBtn.evaluate((el) => el === document.activeElement), "toolbar buttons are keyboard-focusable");
  check((await toolbar(page).getAttribute("role")) === "toolbar", "toolbar has role=toolbar and a label");
  await page.keyboard.press("Escape");
  await toolbar(page).waitFor({ state: "detached", timeout: 2000 }).catch(() => {});
  check((await toolbar(page).count()) === 0, "Escape (no menu open) still clears the selection");

  await browser.close();
}

async function classic() {
  console.log("\nDesktop (1280×800, Classic layout — no sidebar)");
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await openHarness(page);
  const before = await rectOf(page, 4);
  await tile(page, 4).click();
  check(JSON.stringify(await rectOf(page, 4)) === JSON.stringify(before), "first click: no layout shift");
  const tb = await toolbar(page).evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { center: (r.left + r.right) / 2, height: r.height, vw: innerWidth };
  });
  check(Math.abs(tb.center - tb.vw / 2) <= 2, "toolbar centred in the viewport", tb);
  check(tb.height <= 60, "single row", tb.height);
  const scroll = await toolbar(page).locator("[data-selection-actions]").evaluate((el) => ({ sw: el.scrollWidth, cw: el.clientWidth }));
  check(scroll.sw <= scroll.cw + 1, "every action fits without scrolling", scroll);
  await browser.close();
}

async function narrow() {
  console.log("\nTablet (1024×768, New interface shell)");
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1024, height: 768 } });
  await openHarness(page, "?shell=new");
  const before = await rectOf(page, 1);
  await tile(page, 1).click();
  check(JSON.stringify(await rectOf(page, 1)) === JSON.stringify(before), "first click: no layout shift");
  const tb = await toolbar(page).evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { left: r.left, right: r.right, height: r.height, vw: innerWidth };
  });
  check(tb.height <= 56, "single row at tablet width", tb.height);
  check(tb.left >= 0 && tb.right <= tb.vw, "toolbar stays inside the viewport", tb);
  check(await toolbar(page).getByRole("button", { name: "More", exact: true }).isVisible(), "Top/Bottom/Place fold into More");
  check(!(await toolbar(page).getByRole("button", { name: "Top", exact: true }).isVisible()), "inline Top hidden below xl");
  await toolbar(page).getByRole("button", { name: "More", exact: true }).click();
  for (const label of ["Move to top", "Move to bottom", "Place…"]) {
    check(await page.getByRole("menuitem", { name: label }).or(page.getByRole("button", { name: label })).first().isVisible(), `More menu has ${label}`);
  }
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
  check((await tile(page, 1).getAttribute("aria-pressed")) === "true", "closing More keeps the selection");
  check(await toolbar(page).getByRole("button", { name: "Delete", exact: true }).isVisible(), "Delete stays visible");
  const scroll = await toolbar(page).locator("[data-selection-actions]").evaluate((el) => ({ sw: el.scrollWidth, cw: el.clientWidth }));
  check(scroll.sw <= scroll.cw + 1, "every action fits without scrolling at 1024px", scroll);
  await browser.close();
}

async function phone() {
  console.log("\nPhone (390×844 touch, admin tab bar)");
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  await openHarness(page, "?nav=1");
  // Long-press enters select mode on touch.
  const select = page.getByRole("button", { name: /^Select$/ });
  if (await select.count()) await select.first().tap();
  else {
    const b = (await tile(page, 1).boundingBox())!;
    await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
  }
  await tile(page, 1).tap();
  await toolbar(page).waitFor();
  const geo = await page.evaluate(() => {
    const t = document.querySelector("[data-photo-selection-toolbar]")!.getBoundingClientRect();
    const n = document.querySelector(".admin-mobile-pwa-nav")!.getBoundingClientRect();
    return { tbBottom: t.bottom, tbHeight: t.height, tbLeft: t.left, tbRight: t.right, navTop: n.top, vw: innerWidth };
  });
  check(geo.tbBottom <= geo.navTop, "toolbar sits above the bottom tab bar", geo);
  check(geo.tbHeight <= 56, "single row on phones (actions scroll sideways)", geo.tbHeight);
  check(geo.tbLeft >= 0 && geo.tbRight <= geo.vw, "toolbar inside the viewport on phones", geo);
  await browser.close();
}

(async () => {
  await desktop();
  await classic();
  await narrow();
  await phone();
  console.log(failures ? `\n${failures} check(s) failed` : "\nAll checks passed");
  process.exit(failures ? 1 : 0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
