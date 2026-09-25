/**
 * Temporary signed-in screenshots for the calendar UI. Deletes its probe admin.
 * Does not print tokens or the password.
 */
import { createClient } from "@supabase/supabase-js";
import { spawn, type ChildProcess } from "node:child_process";
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

const SWIFT_ID = "00000000-0000-0000-0000-000000000001";
const ROOT = "http://127.0.0.1:3000";
const OUT = "/tmp/cal-shots";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

function loadEnv() {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq < 0) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!process.env[k]) process.env[k] = v;
  }
}

type Pending = { resolve: (value: unknown) => void; reject: (err: Error) => void };

class Cdp {
  private ws: WebSocket | null = null;
  private seq = 0;
  private pending = new Map<number, Pending>();

  async connect(url: string) {
    this.ws = new WebSocket(url);
    await new Promise<void>((resolve, reject) => {
      this.ws!.addEventListener("open", () => resolve());
      this.ws!.addEventListener("error", () => reject(new Error("cdp socket failed")));
    });
    this.ws.addEventListener("message", (event) => {
      const msg = JSON.parse(String(event.data)) as {
        id?: number;
        method?: string;
        params?: { exceptionDetails?: { text?: string; exception?: { description?: string } }; args?: { value?: unknown; description?: string }[]; entry?: { text?: string; level?: string } };
        result?: unknown;
        error?: { message: string };
      };
      if (!msg.id && msg.method) {
        if (msg.method === "Runtime.exceptionThrown") {
          const detail = msg.params?.exceptionDetails;
          appendFileSync(`${OUT}/log.txt`, `exception ${detail?.text || ""} ${detail?.exception?.description || ""}\n`);
        } else if (msg.method === "Runtime.consoleAPICalled") {
          const text = (msg.params?.args || []).map((arg) => arg.value ?? arg.description ?? "").join(" ").slice(0, 400);
          if (/error|hydrat|mismatch|failed/i.test(text)) appendFileSync(`${OUT}/log.txt`, `console ${text}\n`);
        }
        return;
      }
      if (!msg.id) return;
      const waiter = this.pending.get(msg.id);
      if (!waiter) return;
      this.pending.delete(msg.id);
      if (msg.error) waiter.reject(new Error(msg.error.message));
      else waiter.resolve(msg.result);
    });
  }

  send(method: string, params: Record<string, unknown> = {}, timeoutMs = 45000) {
    const id = ++this.seq;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`cdp timeout ${method}`));
      }, timeoutMs);
      this.pending.set(id, {
        resolve: (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        reject: (err) => {
          clearTimeout(timer);
          reject(err);
        },
      });
      this.ws!.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    this.ws?.close();
  }
}

async function evalJson(cdp: Cdp, expression: string) {
  const result = (await cdp.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  })) as { result?: { value?: unknown }; exceptionDetails?: { text?: string } };
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || "evaluate failed");
  return result.result?.value;
}

async function shot(cdp: Cdp, name: string) {
  const result = (await cdp.send("Page.captureScreenshot", { format: "png" })) as { data: string };
  const path = `${OUT}/${name}.png`;
  writeFileSync(path, Buffer.from(result.data, "base64"));
  appendFileSync(`${OUT}/log.txt`, `shot ${path}\n`);
}

function log(message: string) {
  appendFileSync(`${OUT}/log.txt`, `${message}\n`);
  console.log(message);
}

async function main() {
  loadEnv();
  mkdirSync(OUT, { recursive: true });
  writeFileSync(`${OUT}/log.txt`, "");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  const anon = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  let chrome: ChildProcess | null = null;
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const stamp = Date.now();
  const email = `cal-ui-${stamp}@example.test`;
  const password = `Cal-Ui-${stamp}!Aa`;
  let userId = "";
  try {
    const existing = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    for (const user of existing.data.users) {
      if (user.email?.startsWith("cal-ui-")) {
        await admin.auth.admin.deleteUser(user.id);
        log("removed leftover probe");
      }
    }
    const createdUser = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (createdUser.error || !createdUser.data.user) throw new Error(createdUser.error?.message || "create failed");
    userId = createdUser.data.user.id;
    const { error: profileErr } = await admin
      .from("profiles")
      .update({
        role: "admin",
        business_id: SWIFT_ID,
        client_id: null,
        full_name: "Calendar UI probe",
        disabled_at: null,
      })
      .eq("id", userId);
    if (profileErr) throw new Error(profileErr.message);
    const signed = await anon.auth.signInWithPassword({ email, password });
    if (signed.error || !signed.data.session) throw new Error(signed.error?.message || "login failed");
    const projectRef = new URL(url).hostname.split(".")[0];
    const cookieValue = JSON.stringify(signed.data.session);
    chrome = spawn(
      CHROME,
      [
        "--headless=new",
        "--remote-debugging-port=9223",
        "--user-data-dir=/tmp/cal-chrome-profile",
        "--no-first-run",
        "--disable-gpu",
        "--hide-scrollbars",
        "about:blank",
      ],
      { stdio: "ignore" }
    );
    let version: { webSocketDebuggerUrl: string } | null = null;
    for (let attempt = 0; attempt < 20; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 300));
      try {
        version = (await fetch("http://127.0.0.1:9223/json/version").then((r) => r.json())) as { webSocketDebuggerUrl: string };
        break;
      } catch {
        version = null;
      }
    }
    if (!version) throw new Error("chrome debugger did not start");
    const browser = new Cdp();
    await browser.connect(version.webSocketDebuggerUrl);
    const created = (await browser.send("Target.createTarget", { url: "about:blank" })) as { targetId: string };
    const targets = (await fetch("http://127.0.0.1:9223/json/list").then((r) => r.json())) as { id: string; webSocketDebuggerUrl: string }[];
    const page = targets.find((target) => target.id === created.targetId);
    if (!page) throw new Error("no page target");
    const cdp = new Cdp();
    await cdp.connect(page.webSocketDebuggerUrl);
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("Network.enable");
    await cdp.send("Page.addScriptToEvaluateOnNewDocument", {
      source: "window.__errs=[];window.addEventListener('error',(e)=>window.__errs.push(String(e.message)));",
    });
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: 375,
      height: 812,
      deviceScaleFactor: 2,
      mobile: true,
    });
    for (const cookie of [
      { name: `sb-${projectRef}-auth-token`, value: cookieValue },
      { name: "sp_path_tenant", value: "swift-aerial-media" },
    ]) {
      const set = (await cdp.send("Network.setCookie", { ...cookie, url: ROOT, path: "/" })) as { success?: boolean };
      if (!set.success) throw new Error(`cookie ${cookie.name} rejected`);
    }
    log("navigating");
    await cdp.send("Page.navigate", { url: `${ROOT}/b/swift-aerial-media/admin/calendar` }, 180000);
    let hydrated = false;
    for (let attempt = 0; attempt < 40; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      const state = await evalJson(
        cdp,
        `(() => {
          const btn = document.querySelector('[data-mobile-view="day"]');
          const fiber = btn && Object.keys(btn).some((name) => name.startsWith("__reactFiber"));
          const sample = [...document.querySelectorAll("a,button")].slice(0, 8).map((el) => ({
            t: (el.textContent || "").trim().slice(0, 24),
            react: Object.getOwnPropertyNames(el).some((name) => name.startsWith("__react")),
          }));
          return { ready: document.readyState, fiber: !!fiber, errs: window.__errs || [], sample };
        })()`
      );
      log(`hydrate ${JSON.stringify(state)}`);
      if (state && typeof state === "object" && (state as { fiber?: boolean }).fiber) {
        hydrated = true;
        break;
      }
    }
    if (!hydrated) log("hydration did not attach");
    const title = await evalJson(cdp, "document.title + ' | ' + location.pathname");
    log(`landed ${title}`);
    const marker = await evalJson(cdp, "!!document.querySelector('[data-mobile-calendar]')");
    console.log("mobile calendar present", marker);
    if (!marker) {
      const text = await evalJson(cdp, "document.body.innerText.slice(0, 400)");
      console.log("page text", text);
      await shot(cdp, "mobile-not-calendar");
      return;
    }

    const views = ["schedule", "day", "three", "week", "month"] as const;
    for (const view of views) {
      const selected = await evalJson(
        cdp,
        `(() => {
          const btn = document.querySelector('[data-mobile-view="${view}"]');
          if (!btn) return { missing: true };
          const propKey = Object.keys(btn).find((name) => name.startsWith("__reactProps"));
          const fiberKey = Object.keys(btn).find((name) => name.startsWith("__reactFiber"));
          let onClick = propKey && btn[propKey] && btn[propKey].onClick;
          if (!onClick && fiberKey) {
            let fiber = btn[fiberKey];
            while (fiber) {
              if (fiber.memoizedProps && fiber.memoizedProps.onClick) { onClick = fiber.memoizedProps.onClick; break; }
              fiber = fiber.return;
            }
          }
          let error = "";
          try { if (onClick) onClick(); else btn.click(); }
          catch (err) { error = String(err); }
          const scroller = document.querySelector("[data-mobile-calendar] .overflow-y-auto");
          return {
            prop: !!propKey,
            fiber: !!fiberKey,
            hasOnClick: !!onClick,
            error,
            scrollerH: scroller && Math.round(scroller.clientHeight),
            scrollH: scroller && Math.round(scroller.scrollHeight),
          };
        })()`
      );
      await evalJson(cdp, `new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))`);
      await new Promise((resolve) => setTimeout(resolve, 250));
      const now = await evalJson(
        cdp,
        `document.querySelector('[data-mobile-calendar]')?.getAttribute('data-mobile-calendar')`
      );
      log(`view ${view} ${JSON.stringify(selected)} now ${now}`);
      await shot(cdp, `mobile-${view}`);
    }

    await evalJson(cdp, `document.querySelector('[data-mobile-view="schedule"]')?.click(); true`);
    await new Promise((resolve) => setTimeout(resolve, 400));
    const scheduleFacts = await evalJson(
      cdp,
      `(() => {
        const days = [...document.querySelectorAll('[data-schedule-day]')].map(el => el.getAttribute('data-schedule-day'));
        const today = document.querySelector('[data-schedule-today]');
        const scroller = document.querySelector('[data-mobile-calendar] .overflow-y-auto');
        const todayTop = today && scroller ? Math.round(today.getBoundingClientRect().top - scroller.getBoundingClientRect().top) : null;
        const months = [...new Set(days.map(day => (day || '').slice(0, 7)))];
        return {
          count: days.length,
          months,
          todayTop,
          first: days[0],
          last: days[days.length - 1],
          scrollerH: scroller && Math.round(scroller.clientHeight),
          scrollH: scroller && Math.round(scroller.scrollHeight),
          scrollTop: scroller && Math.round(scroller.scrollTop),
        };
      })()`
    );
    log(`schedule ${JSON.stringify(scheduleFacts)}`);
    await shot(cdp, "mobile-schedule-today");
    await evalJson(cdp, `document.querySelector('[aria-label="Google Calendar warning"]')?.click(); true`);
    await new Promise((resolve) => setTimeout(resolve, 200));
    await shot(cdp, "mobile-degraded-tooltip");

    await evalJson(cdp, `document.querySelector('[data-mobile-view="month"]')?.click(); true`);
    await new Promise((resolve) => setTimeout(resolve, 300));
    await shot(cdp, "month-dots");
    await evalJson(
      cdp,
      `(() => {
        const days = [...document.querySelectorAll('[data-month-day]')];
        const day = days.find((el) => (el.getAttribute('data-month-day') || '').endsWith('-15')) || days[0];
        day?.click();
        return day?.getAttribute('data-month-day');
      })()`
    );
    await new Promise((resolve) => setTimeout(resolve, 300));
    const dayTap = await evalJson(
      cdp,
      `document.querySelector('[data-month-day-events]')?.getAttribute('data-month-day-events')`
    );
    log(`month day tapped ${dayTap}`);
    await shot(cdp, "month-day-list");

    const swipeBefore = await evalJson(
      cdp,
      `(() => {
        document.querySelector('[data-mobile-view="day"]')?.click();
        return document.querySelector('[data-mobile-calendar] h2')?.textContent;
      })()`
    );
    await new Promise((resolve) => setTimeout(resolve, 200));
    await evalJson(
      cdp,
      `(() => {
        const scroller = document.querySelector('[data-mobile-calendar] .overflow-y-auto');
        const rect = scroller.getBoundingClientRect();
        const fire = (type, x, y) => {
          const touch = new Touch({ identifier: 1, target: scroller, clientX: x, clientY: y });
          scroller.dispatchEvent(new TouchEvent(type, { bubbles: true, cancelable: true, touches: type === 'touchend' ? [] : [touch], changedTouches: [touch] }));
        };
        fire('touchstart', rect.left + 300, rect.top + 80);
        fire('touchend', rect.left + 40, rect.top + 80);
        return true;
      })()`
    );
    await new Promise((resolve) => setTimeout(resolve, 300));
    const swipeAfter = await evalJson(cdp, `document.querySelector('[data-mobile-calendar] h2')?.textContent`);
    log(`swipe ${JSON.stringify({ before: swipeBefore, after: swipeAfter })}`);

    await evalJson(
      cdp,
      `(() => {
        const scroller = document.querySelector('[data-mobile-calendar] .overflow-y-auto');
        scroller.scrollTop = 0;
        const rect = scroller.getBoundingClientRect();
        const fire = (type, x, y) => {
          const touch = new Touch({ identifier: 2, target: scroller, clientX: x, clientY: y });
          scroller.dispatchEvent(new TouchEvent(type, { bubbles: true, cancelable: true, touches: type === 'touchend' ? [] : [touch], changedTouches: [touch] }));
        };
        fire('touchstart', rect.left + 40, rect.top + 20);
        fire('touchmove', rect.left + 40, rect.top + 120);
        fire('touchend', rect.left + 40, rect.top + 120);
        return true;
      })()`
    );
    await new Promise((resolve) => setTimeout(resolve, 300));
    const pull = await evalJson(
      cdp,
      `document.querySelector('[data-pull-refresh]')?.getAttribute('data-pull-refresh') || document.body.innerText.includes('Refreshing')`
    );
    log(`pull ${JSON.stringify(pull)}`);

    await evalJson(cdp, `document.querySelector('[data-create-shoot]')?.click(); true`);
    await new Promise((resolve) => setTimeout(resolve, 300));
    const fab = await evalJson(
      cdp,
      `(() => ({
        open: !!document.querySelector('[role="dialog"][aria-label="Create shoot"]'),
        hasProject: !!document.querySelector('#mobile-shoot-project'),
      }))()`
    );
    log(`fab ${JSON.stringify(fab)}`);
    await shot(cdp, "mobile-create-sheet");

    const chromeBits = await evalJson(
      cdp,
      `(() => ({
        googleBadge: document.body.innerText.includes('Google'),
        shootBadge: document.body.innerText.includes('Shoot'),
        pending: document.body.innerText.includes('Pending'),
        degraded: !!document.querySelector('[data-gcal-degraded]'),
        banner: document.body.innerText.includes('Google Calendar is rate limiting'),
        subtitle: document.body.innerText.includes('drag a shoot to reschedule'),
        calendarList: document.body.innerText.includes('Google calendars'),
      }))()`
    );
    log(`mobile chrome ${JSON.stringify(chromeBits)}`);

    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: 1280,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await new Promise((resolve) => setTimeout(resolve, 500));
    const desktop = await evalJson(
      cdp,
      `(() => ({
        mobileHidden: getComputedStyle(document.querySelector('[data-mobile-calendar]').parentElement).display === 'none',
        hasMonth: document.body.innerText.includes('Month'),
        hasAgenda: document.body.innerText.includes('Agenda'),
        hasScheduleSwitcher: !!document.querySelector('[data-mobile-view="schedule"]') && getComputedStyle(document.querySelector('[data-mobile-calendar]').parentElement).display !== 'none',
        banner: document.body.innerText.includes('Google Calendar is rate limiting'),
        subtitle: document.body.innerText.includes('Month, week, day, and agenda'),
        degraded: !!document.querySelector('[data-gcal-degraded]'),
      }))()`
    );
    log(`desktop ${JSON.stringify(desktop)}`);
    await shot(cdp, "desktop-calendar");

    const nav = await evalJson(
      cdp,
      `(() => {
        const bar = document.querySelector('[aria-label="Admin mobile navigation"]');
        return {
          items: bar?.getAttribute('data-nav-items'),
          sheet: bar?.getAttribute('data-sheet-actions'),
          display: bar ? getComputedStyle(bar).display : null,
        };
      })()`
    );
    log(`desktop nav css ${JSON.stringify(nav)}`);

    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: 375,
      height: 812,
      deviceScaleFactor: 2,
      mobile: true,
    });
    await new Promise((resolve) => setTimeout(resolve, 300));
    await evalJson(cdp, `document.querySelector('[aria-label="Create"]')?.click(); true`);
    await new Promise((resolve) => setTimeout(resolve, 300));
    await shot(cdp, "mobile-plus-sheet");
    const plus = await evalJson(
      cdp,
      `document.querySelector('[aria-label="Admin mobile navigation"]')?.getAttribute('data-sheet-actions')`
    );
    log(`plus sheet ${plus}`);
    await shot(cdp, "mobile-bottom-bar");
    await evalJson(cdp, `document.querySelector('[role="dialog"][aria-label="Create"]')?.parentElement?.querySelector('[aria-label="Close menu"]')?.click(); document.querySelector('button[aria-label="Close menu"]')?.click(); true`);
    await new Promise((resolve) => setTimeout(resolve, 200));
    await evalJson(
      cdp,
      `(() => {
        const buttons = [...document.querySelectorAll('[aria-label="Open menu"]')];
        const btn = buttons.find((el) => el.getClientRects().length > 0) || buttons[0];
        btn?.click();
        return true;
      })()`
    );
    await new Promise((resolve) => setTimeout(resolve, 300));
    const menu = await evalJson(
      cdp,
      `(() => ({
        partner: [...document.querySelectorAll('a')].some((el) => el.textContent?.includes('Partner') && el.getClientRects().length > 0),
        calendar: [...document.querySelectorAll('a')].some((el) => el.textContent?.trim() === 'Calendar' && el.getClientRects().length > 0),
        settings: [...document.querySelectorAll('a')].some((el) => /Settings|Preferences/.test(el.textContent || '') && el.getClientRects().length > 0),
      }))()`
    );
    log(`hamburger ${JSON.stringify(menu)}`);
    await shot(cdp, "mobile-hamburger");

    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: 375,
      height: 812,
      deviceScaleFactor: 2,
      mobile: true,
    });
    await evalJson(cdp, `document.querySelector('[data-gcal-degraded]')?.remove(); true`);
    await new Promise((resolve) => setTimeout(resolve, 200));
    const healthy = await evalJson(
      cdp,
      `(() => ({
        indicator: !!document.querySelector('[data-gcal-degraded]'),
        banner: document.body.innerText.includes('Google Calendar is rate limiting'),
      }))()`
    );
    log(`healthy ${JSON.stringify(healthy)}`);
    await shot(cdp, "mobile-healthy");

    cdp.close();
    browser.close();
  } finally {
    chrome?.kill("SIGKILL");
    if (userId) {
      await admin.auth.admin.deleteUser(userId);
      const { data: left } = await admin.from("profiles").select("id").eq("id", userId).maybeSingle();
      log(`probe admin removed ${!left}`);
    }
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : "shots failed");
  process.exit(1);
});
