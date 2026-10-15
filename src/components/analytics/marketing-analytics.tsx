"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * First-party marketing analytics for the platform marketing site.
 *
 * Default (no choice, declined, or Global Privacy Control): cookieless. Nothing is
 * stored in the browser; the server derives a daily-rotating anonymous key.
 * Accepted: a first-party `sp_vid` visitor cookie + per-tab session id, which is
 * what allows a later signup to be attributed to earlier visits.
 *
 * Skipped entirely for signed-in users, automation, localhost (unless
 * NEXT_PUBLIC_ANALYTICS_DEV=1), and browsers marked internal via ?sp_internal=1.
 * See docs/ANALYTICS.md.
 */

const ENDPOINT = "/api/analytics/collect";
const CONSENT_KEY = "sp_analytics_consent";
const INTERNAL_KEY = "sp_analytics_internal";
const SESSION_KEY = "sp_sid";
const VISITOR_COOKIE = "sp_vid";
const SESSION_IDLE_MS = 30 * 60 * 1000;
const VISITOR_MAX_AGE_S = 395 * 24 * 60 * 60;
const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;
const CONSENT_EVENT = "sp-analytics-consent";

type Consent = "granted" | "denied" | null;

function safeGet(store: Storage | undefined, key: string): string | null {
  try {
    return store?.getItem(key) ?? null;
  } catch {
    return null;
  }
}
function safeSet(store: Storage | undefined, key: string, value: string | null) {
  try {
    if (value === null) store?.removeItem(key);
    else store?.setItem(key, value);
  } catch {
    /* storage blocked: stay cookieless */
  }
}

function uuid(): string {
  const c: Crypto = globalThis.crypto;
  if (typeof c.randomUUID === "function") return c.randomUUID();
  const b = c.getRandomValues(new Uint8Array(16));
  b[6] = (b[6]! & 0x0f) | 0x40;
  b[8] = (b[8]! & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

function gpcEnabled(): boolean {
  return typeof navigator !== "undefined" && (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true;
}

export function readConsent(): Consent {
  if (typeof window === "undefined") return null;
  if (gpcEnabled()) return "denied";
  const v = safeGet(window.localStorage, CONSENT_KEY);
  return v === "granted" || v === "denied" ? v : null;
}

function readCookie(name: string): string | null {
  const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]!) : null;
}

function setVisitorCookie(value: string | null) {
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie =
    value === null
      ? `${VISITOR_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax${secure}`
      : `${VISITOR_COOKIE}=${value}; Path=/; Max-Age=${VISITOR_MAX_AGE_S}; SameSite=Lax${secure}`;
}

export function setAnalyticsConsent(choice: "granted" | "denied") {
  safeSet(window.localStorage, CONSENT_KEY, choice);
  if (choice === "denied") {
    setVisitorCookie(null);
    safeSet(window.sessionStorage, SESSION_KEY, null);
  }
  window.dispatchEvent(new Event(CONSENT_EVENT));
}

function trackingDisabled(): boolean {
  if (typeof window === "undefined") return true;
  const host = location.hostname;
  if ((host === "localhost" || host === "127.0.0.1") && process.env.NEXT_PUBLIC_ANALYTICS_DEV !== "1") return true;
  if ((navigator as Navigator & { webdriver?: boolean }).webdriver) return true;
  if (safeGet(window.localStorage, INTERNAL_KEY) === "1") return true;
  // Signed-in users (Supabase auth cookie) are customers or staff, not marketing traffic.
  if (/(?:^|; )sb-[^=]+-auth-token(?:\.\d+)?=/.test(document.cookie)) return true;
  return false;
}

/** Persistent ids when consent is granted; null otherwise. */
function persistentIds(): { visitorId: string; sessionId: string } | null {
  if (readConsent() !== "granted") return null;
  let visitorId = readCookie(VISITOR_COOKIE);
  if (!visitorId || !/^[0-9a-f-]{36}$/i.test(visitorId)) {
    visitorId = uuid();
  }
  setVisitorCookie(visitorId); // refresh expiry
  const now = Date.now();
  let sessionId: string | null = null;
  try {
    const raw = safeGet(window.sessionStorage, SESSION_KEY);
    const parsed = raw ? (JSON.parse(raw) as { id?: string; last?: number }) : null;
    if (parsed?.id && typeof parsed.last === "number" && now - parsed.last < SESSION_IDLE_MS) sessionId = parsed.id;
  } catch {
    sessionId = null;
  }
  sessionId ??= uuid();
  safeSet(window.sessionStorage, SESSION_KEY, JSON.stringify({ id: sessionId, last: now }));
  return { visitorId, sessionId };
}

type EventType = "pageview" | "cta_click" | "signup_start";

function send(type: EventType, extra: { path: string; referrer?: string; utm?: Record<string, string>; cta?: { id: string; location: string } }) {
  if (trackingDisabled()) return;
  const ids = persistentIds();
  const body = JSON.stringify({
    v: 1,
    type,
    eventId: uuid(),
    mode: ids ? "persistent" : "cookieless",
    ...(ids ?? {}),
    ...extra,
  });
  try {
    const blob = new Blob([body], { type: "application/json" });
    if (navigator.sendBeacon?.(ENDPOINT, blob)) return;
  } catch {
    /* fall through */
  }
  void fetch(ENDPOINT, { method: "POST", body, keepalive: true, headers: { "Content-Type": "application/json" } }).catch(() => {});
}

function utmFrom(params: URLSearchParams): Record<string, string> | undefined {
  const out: Record<string, string> = {};
  for (const k of UTM_KEYS) {
    const v = params.get(k);
    if (v) out[k] = v.slice(0, 160);
  }
  return Object.keys(out).length ? out : undefined;
}

function whenVisible(fn: () => void) {
  if (document.visibilityState === "visible") return fn();
  const onChange = () => {
    if (document.visibilityState === "visible") {
      document.removeEventListener("visibilitychange", onChange);
      fn();
    }
  };
  document.addEventListener("visibilitychange", onChange);
}

// Module-level so React strict-mode double effects and re-renders never double count.
let lastTrackedKey: string | null = null;
let initialLoadSent = false;

function PageTracker({ eventType }: { eventType: EventType }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!pathname) return;
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    const internal = params.get("sp_internal");
    if (internal === "1") safeSet(window.localStorage, INTERNAL_KEY, "1");
    if (internal === "0") safeSet(window.localStorage, INTERNAL_KEY, null);

    const key = `${eventType}:${pathname}`;
    if (key === lastTrackedKey) return;
    lastTrackedKey = key;

    const isInitial = !initialLoadSent;
    initialLoadSent = true;
    whenVisible(() =>
      send(eventType, {
        path: pathname,
        // document.referrer is only meaningful for the first page of a load.
        referrer: isInitial && document.referrer ? document.referrer.slice(0, 600) : undefined,
        utm: utmFrom(params),
      })
    );
  }, [pathname, searchParams, eventType]);

  return null;
}

function ctaLocation(el: Element): string {
  const explicit = el.closest<HTMLElement>("[data-sp-cta-location]")?.dataset.spCtaLocation;
  if (explicit) return explicit;
  if (el.closest("header")) return "header";
  if (el.closest("footer")) return "footer";
  if (el.closest("nav[aria-label='Mobile']")) return "mobile_nav";
  return "inline";
}

function useCtaClicks() {
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const target = e.target instanceof Element ? e.target : null;
      const a = target?.closest<HTMLAnchorElement>("a[href]");
      if (!a) return;
      let url: URL;
      try {
        url = new URL(a.href, location.href);
      } catch {
        return;
      }
      if (url.origin !== location.origin || !/^\/signup\/?$/.test(url.pathname)) return;
      const location_ = ctaLocation(a);
      const id = a.closest<HTMLElement>("[data-sp-cta]")?.dataset.spCta ?? `signup:${location_}`;
      send("cta_click", { path: location.pathname, cta: { id: id.slice(0, 80), location: location_ } });
    };
    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, []);
}

function CtaTracker() {
  useCtaClicks();
  return null;
}

/** Mount once per marketing page (MarketingShell) and on /signup with eventType="signup_start". */
export function MarketingAnalytics({ eventType = "pageview" }: { eventType?: EventType }) {
  return (
    <Suspense fallback={null}>
      <PageTracker eventType={eventType} />
      {eventType === "pageview" ? <CtaTracker /> : null}
    </Suspense>
  );
}

/** Small opt-in banner. Hidden once a choice exists or when GPC is on. */
export function AnalyticsConsentBanner() {
  const [open, setOpen] = useState(false);
  const shownRef = useRef(false);

  useEffect(() => {
    const sync = () => setOpen(!trackingDisabled() && readConsent() === null);
    if (!shownRef.current) {
      shownRef.current = true;
      sync();
    }
    const reopen = () => {
      safeSet(window.localStorage, CONSENT_KEY, null);
      setOpen(true);
    };
    window.addEventListener("sp-analytics-preferences", reopen);
    window.addEventListener(CONSENT_EVENT, sync);
    return () => {
      window.removeEventListener("sp-analytics-preferences", reopen);
      window.removeEventListener(CONSENT_EVENT, sync);
    };
  }, []);

  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Analytics preferences"
      className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-md rounded-2xl border border-[#E2E8F0] bg-white p-4 text-sm text-[#334155] shadow-[0_24px_60px_-24px_rgba(15,23,42,0.45)] sm:inset-x-auto sm:left-4 sm:mx-0"
    >
      <p className="font-semibold text-[#0F172A]">Help us improve ShootPortal&apos;s site?</p>
      <p className="mt-1 leading-relaxed">
        With your OK we set one first-party analytics cookie to see which pages help people find us. No ads and no
        cross-site tracking. Without it we only count anonymous, cookieless visits.{" "}
        <Link href="/privacy#cookies" className="font-medium text-[#4F46E5] underline underline-offset-2">
          Privacy policy
        </Link>
      </p>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => {
            setAnalyticsConsent("granted");
            setOpen(false);
          }}
          className="min-h-10 rounded-lg bg-[#4F46E5] px-4 font-semibold text-white hover:bg-[#4338CA] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F46E5] focus-visible:ring-offset-2"
        >
          Allow analytics
        </button>
        <button
          type="button"
          onClick={() => {
            setAnalyticsConsent("denied");
            setOpen(false);
          }}
          className="min-h-10 rounded-lg border border-[#E2E8F0] px-4 font-medium text-[#0F172A] hover:bg-[#F8FAFC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F46E5] focus-visible:ring-offset-2"
        >
          No thanks
        </button>
      </div>
    </div>
  );
}

/** Footer link that reopens the banner. */
export function AnalyticsPreferencesLink({ className }: { className?: string }) {
  return (
    <button
      type="button"
      className={className}
      onClick={() => window.dispatchEvent(new Event("sp-analytics-preferences"))}
    >
      Analytics preferences
    </button>
  );
}
