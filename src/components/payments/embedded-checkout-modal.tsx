"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  loadStripe,
  type Appearance,
  type Stripe as StripeJs,
  type StripeCheckoutElementsSdk,
  type StripeCheckoutLoadActionsSuccess,
  type StripePaymentElement,
} from "@stripe/stripe-js";
import { AlertCircle, ArrowRight, CheckCircle2, Clock, CreditCard, Download, Landmark, Loader2, Lock, Receipt, X } from "lucide-react";
import { usePortalBrand } from "@/components/brand/brand-provider";
import { Button } from "@/components/ui/button";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import type { CheckoutOutcome, EmbeddedCheckoutStart } from "@/lib/client-checkout";

/**
 * ShootPortal's in-app checkout: Stripe's Payment Element (Checkout Sessions, ui_mode
 * "elements") inside a modal branded for the photography business. Card numbers never touch
 * ShootPortal — they go straight from Stripe's iframe to the business's Stripe account.
 *
 * The success screen is driven only by the server's verified status (statusUrl), never by
 * the browser's own confirmation, so nothing unlocks unless Stripe and the record agree.
 */

type Method = "card" | "bank";

export type StartCheckoutResult = { ok: true; data: EmbeddedCheckoutStart } | { ok: false; error: string; status: number };

export type EmbeddedCheckoutModalProps = {
  open: boolean;
  onClose: () => void;
  /** Ask the server for a session. `first` is true for the modal's first request. */
  startCheckout: (args: { method: Method; first: boolean }) => Promise<StartCheckoutResult>;
  /** Server-verified status for a session (or the payment's current session when omitted). */
  statusUrl: (sessionId: string | null) => string;
  /** Heading above the line items, e.g. the project name or "Marketing Kit". */
  title: string;
  initialMethod?: Method;
  /** Resume after a redirect-based payment method returned to ShootPortal. */
  resumeSessionId?: string | null;
  /** Called once the payment is verified (paid or processing) so the page can refresh. */
  onSettled?: (outcome: CheckoutOutcome) => void;
  /** Downloads were locked before paying; show the unlock message when the server says they're open. */
  downloadsWereLocked?: boolean;
  onDownloadMedia?: () => void;
  /** ShootPortal receipt page for this payment (preferred over Stripe's expiring receipt_url). */
  fallbackReceiptHref?: string | null;
  doneLabel?: string;
  /** Shown in the success note once the server confirms payment (e.g. "Your Marketing Kit is unlocked."). */
  paidMessage?: string;
};

type Phase = "starting" | "ready" | "confirming" | "verifying" | "paid" | "processing" | "uncertain" | "notCompleted" | "fatal";

type VerifyMode =
  /** Stripe.js said the confirmation succeeded; wait for the record. */
  | "afterConfirm"
  /** Back from a redirect-based method, a refresh mid-payment, or "Check again". */
  | "resume"
  /** The server refused to open a new checkout (409) — find out what's really going on. */
  | "blocked";

const IN_FLIGHT_KEY = "sp-checkout-inflight";
const IN_FLIGHT_MAX_AGE_MS = 30 * 60 * 1000;

function rememberInFlight(paymentId: string | undefined, sessionId: string | null) {
  if (!paymentId || !sessionId) return;
  try {
    window.sessionStorage.setItem(IN_FLIGHT_KEY, JSON.stringify({ paymentId, sessionId, at: Date.now() }));
  } catch {
    // storage unavailable (private mode) — the server-side guards still apply
  }
}

function forgetInFlight() {
  try {
    window.sessionStorage.removeItem(IN_FLIGHT_KEY);
  } catch {
    // ignore
  }
}

function readInFlight(): { paymentId: string; sessionId: string } | null {
  try {
    const raw = window.sessionStorage.getItem(IN_FLIGHT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { paymentId?: string; sessionId?: string; at?: number };
    if (!parsed.paymentId || !parsed.sessionId || !parsed.at || Date.now() - parsed.at > IN_FLIGHT_MAX_AGE_MS) {
      forgetInFlight();
      return null;
    }
    return { paymentId: parsed.paymentId, sessionId: parsed.sessionId };
  } catch {
    return null;
  }
}

function withThorough(url: string): string {
  return url + (url.includes("?") ? "&" : "?") + "thorough=1";
}

const stripeByAccount = new Map<string, Promise<StripeJs | null>>();

function stripeFor(accountId: string | null): Promise<StripeJs | null> {
  const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  if (!key) return Promise.resolve(null);
  const cacheKey = accountId ?? "platform";
  let promise = stripeByAccount.get(cacheKey);
  if (!promise) {
    promise = loadStripe(key, accountId ? { stripeAccount: accountId } : undefined).catch(() => {
      stripeByAccount.delete(cacheKey);
      return null;
    });
    stripeByAccount.set(cacheKey, promise);
  }
  return promise;
}

function readCssColor(el: HTMLElement | null, name: string, fallback: string): string {
  if (!el) return fallback;
  const value = getComputedStyle(el).getPropertyValue(name).trim();
  return /^#[0-9a-f]{3,8}$/i.test(value) || /^rgba?\(/i.test(value) ? value : fallback;
}

function isDarkBackground(el: HTMLElement | null): boolean {
  if (!el) return false;
  const match = getComputedStyle(el).backgroundColor.match(/\d+(\.\d+)?/g);
  if (!match || match.length < 3) return false;
  const [r, g, b] = match.slice(0, 3).map(Number);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 110;
}

/** Stripe Appearance API, matched to the portal (Inter, the brand accent, soft borders). */
function buildAppearance(container: HTMLElement | null): Appearance {
  const accent = readCssColor(container, "--color-accent", "#3b82f6");
  const dark = isDarkBackground(container);
  return {
    theme: dark ? "night" : "stripe",
    variables: {
      colorPrimary: accent,
      colorBackground: dark ? "#1b2029" : "#ffffff",
      colorText: dark ? "#f1f5f9" : "#0f172a",
      colorTextSecondary: dark ? "#94a3b8" : "#64748b",
      colorTextPlaceholder: dark ? "#64748b" : "#94a3b8",
      colorDanger: "#dc2626",
      fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
      fontSizeBase: "15px",
      borderRadius: "10px",
      spacingUnit: "4px",
      focusBoxShadow: `0 0 0 3px color-mix(in srgb, ${accent} 22%, transparent)`,
    },
    rules: {
      ".Input": { border: `1px solid ${dark ? "#334155" : "#e2e8f0"}`, boxShadow: "none", padding: "12px 12px" },
      ".Input:focus": { borderColor: accent },
      ".Tab": { border: `1px solid ${dark ? "#334155" : "#e2e8f0"}`, boxShadow: "none" },
      ".Tab--selected": { borderColor: accent, boxShadow: `0 0 0 1px ${accent}` },
      ".Label": { fontWeight: "500" },
    },
  };
}

const STRIPE_FONTS = [{ cssSrc: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" }];

const CHECKOUT_KEYFRAMES = `
@keyframes sp-checkout-fade { from { opacity: 0 } to { opacity: 1 } }
@keyframes sp-checkout-rise { from { opacity: 0; transform: translateY(16px) } to { opacity: 1; transform: none } }
@keyframes sp-checkout-pop { from { opacity: 0; transform: scale(.6) } to { opacity: 1; transform: none } }
@media (prefers-reduced-motion: reduce) { [class*="sp-checkout-"] { animation: none !important } }
`;

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export function EmbeddedCheckoutModal(props: EmbeddedCheckoutModalProps) {
  if (!props.open) return null;
  return <EmbeddedCheckoutDialog {...props} />;
}

function EmbeddedCheckoutDialog({
  onClose,
  startCheckout,
  statusUrl,
  title,
  initialMethod = "card",
  resumeSessionId,
  onSettled,
  downloadsWereLocked,
  onDownloadMedia,
  fallbackReceiptHref,
  doneLabel = "Done",
  paidMessage,
}: EmbeddedCheckoutModalProps) {
  const brand = usePortalBrand();
  const titleId = useId();
  const emailId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const elementHostRef = useRef<HTMLDivElement>(null);
  const elementRef = useRef<StripePaymentElement | null>(null);
  const actionsRef = useRef<StripeCheckoutLoadActionsSuccess | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const attemptRef = useRef(0);
  const runRef = useRef(0);
  const settledRef = useRef(false);

  const [phase, setPhase] = useState<Phase>(resumeSessionId ? "verifying" : "starting");
  const [method, setMethod] = useState<Method>(initialMethod);
  const [start, setStart] = useState<EmbeddedCheckoutStart | null>(null);
  const [elementReady, setElementReady] = useState(false);
  const [canConfirm, setCanConfirm] = useState(false);
  const [needsEmail, setNeedsEmail] = useState(false);
  const [email, setEmail] = useState("");
  const [payError, setPayError] = useState<string | null>(null);
  const [fatal, setFatal] = useState<{ message: string; retry: boolean } | null>(null);
  const [outcome, setOutcome] = useState<CheckoutOutcome | null>(null);
  const [blockedMessage, setBlockedMessage] = useState<string | null>(null);

  // Only the Stripe confirmation itself can't be interrupted. While verifying, the client may
  // close: the payment continues server-side and reopening checkout can't charge again.
  const busy = phase === "confirming";
  const finished = phase === "paid" || phase === "processing" || phase === "uncertain";

  const destroyElement = useCallback(() => {
    try {
      elementRef.current?.destroy();
    } catch {
      // already gone
    }
    elementRef.current = null;
    actionsRef.current = null;
    setElementReady(false);
  }, []);

  const settle = useCallback(
    (result: CheckoutOutcome) => {
      if (settledRef.current) return;
      settledRef.current = true;
      onSettled?.(result);
    },
    [onSettled]
  );

  /**
   * Ask the server (never the browser) what happened. Polls briefly; the decisive poll is
   * "thorough" (also searches Stripe for this payment's charges). If nothing conclusive comes
   * back, the client lands on "still confirming" — never on a Pay button.
   */
  const verify = useCallback(
    async (sessionId: string | null, run: number, mode: VerifyMode, blockedText?: string) => {
      setPhase("verifying");
      setBlockedMessage(blockedText ?? null);
      const polls = mode === "afterConfirm" ? 12 : 6;
      let last: CheckoutOutcome | null = null;
      for (let i = 0; i < polls; i++) {
        if (runRef.current !== run) return;
        const thorough = i === polls - 1 || (mode !== "afterConfirm" && i === 0);
        try {
          const url = statusUrl(sessionId);
          const res = await fetch(thorough ? withThorough(url) : url, { credentials: "include", cache: "no-store" });
          if (res.ok) {
            last = (await res.json()) as CheckoutOutcome;
            if (runRef.current !== run) return;
            if (last.state === "paid" || last.state === "processing") {
              forgetInFlight();
              setOutcome(last);
              setPhase(last.state);
              settle(last);
              return;
            }
            // Conclusive "no money moved": the server checked the session and searched Stripe.
            const confirmedNothing = (last.state === "open" && thorough) || last.state === "expired" || last.state === "failed";
            if (confirmedNothing && mode !== "afterConfirm") {
              forgetInFlight();
              setOutcome(last);
              setPhase("notCompleted");
              return;
            }
          }
        } catch {
          // Network trouble is not an answer — keep asking.
        }
        await wait(i < 4 ? 1200 : 2000);
      }
      if (runRef.current !== run) return;
      setOutcome(last);
      setPhase("uncertain");
    },
    [statusUrl, settle]
  );

  const recheck = useCallback(() => {
    const run = ++runRef.current;
    void verify(sessionIdRef.current, run, "resume");
  }, [verify]);

  const begin = useCallback(
    async (nextMethod: Method) => {
      const run = ++runRef.current;
      destroyElement();
      setPhase("starting");
      setPayError(null);
      setFatal(null);
      setCanConfirm(false);

      let result: StartCheckoutResult;
      try {
        result = await startCheckout({ method: nextMethod, first: attemptRef.current === 0 });
      } catch {
        result = { ok: false, error: "We couldn't reach the payment server. Check your connection and try again.", status: 0 };
      }
      attemptRef.current += 1;
      if (runRef.current !== run) return;
      if (!result.ok) {
        if (result.status === 409) {
          // The server refused because a payment may already be in progress or done. Show what
          // Stripe and the record actually say instead of a dead end (or another Pay button).
          await verify(sessionIdRef.current, run, "blocked", result.error);
          return;
        }
        // 404/410: not payable any more — retrying won't help.
        setFatal({ message: result.error, retry: result.status !== 410 && result.status !== 404 });
        setPhase("fatal");
        return;
      }

      const data = result.data;
      setStart(data);
      setMethod(data.summary.method);
      sessionIdRef.current = data.sessionId;

      const stripe = await stripeFor(data.stripeAccountId);
      if (runRef.current !== run) return;
      if (!stripe) {
        setFatal({ message: "Secure payments couldn't load. Check your connection, or disable any content blocker, and try again.", retry: true });
        setPhase("fatal");
        return;
      }

      const checkout: StripeCheckoutElementsSdk = stripe.initCheckoutElementsSdk({
        clientSecret: data.clientSecret,
        elementsOptions: { appearance: buildAppearance(dialogRef.current), fonts: STRIPE_FONTS, loader: "never" },
      });
      checkout.on("change", (session) => setCanConfirm(Boolean(session.canConfirm)));

      const loaded = await checkout.loadActions();
      if (runRef.current !== run) return;
      if (loaded.type !== "success") {
        setFatal({ message: "This checkout has expired. Start again to pay.", retry: true });
        setPhase("fatal");
        return;
      }
      actionsRef.current = loaded.actions;
      const session = loaded.actions.getSession();
      setNeedsEmail(!session.email);
      setCanConfirm(Boolean(session.canConfirm));

      const element = checkout.createPaymentElement({
        layout: { type: "tabs" },
        wallets: { applePay: "auto", googlePay: "auto" },
      });
      elementRef.current = element;
      element.on("ready", () => {
        if (runRef.current === run) setElementReady(true);
      });
      if (elementHostRef.current) element.mount(elementHostRef.current);
      setPhase("ready");
    },
    [destroyElement, startCheckout, verify]
  );

  // Start (or resume) once when the dialog mounts.
  useEffect(() => {
    if (resumeSessionId) {
      const run = ++runRef.current;
      sessionIdRef.current = resumeSessionId;
      void verify(resumeSessionId, run, "resume");
    } else {
      void begin(initialMethod);
    }
    const runs = runRef;
    return () => {
      runs.current += 1;
      destroyElement();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Warn before a refresh or tab close while Stripe is confirming.
  useEffect(() => {
    if (phase !== "confirming") return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [phase]);

  const requestClose = useCallback(() => {
    if (busy) return;
    onClose();
  }, [busy, onClose]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") requestClose();
    }
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [requestClose]);

  async function pay() {
    const actions = actionsRef.current;
    if (!actions || phase !== "ready") return;
    const trimmedEmail = email.trim();
    if (needsEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setPayError("Enter the email address where you'd like your receipt.");
      return;
    }
    setPayError(null);
    setPhase("confirming");
    const run = runRef.current;
    // If the page reloads mid-payment, reopen in "confirming" instead of offering Pay again.
    rememberInFlight(start?.summary.paymentId, sessionIdRef.current);
    let result;
    try {
      result = await actions.confirm({ redirect: "if_required", ...(needsEmail ? { email: trimmedEmail } : {}) });
    } catch {
      // No answer from Stripe is not a failure: the charge may have gone through.
      if (runRef.current !== run) return;
      await verify(sessionIdRef.current, run, "resume");
      return;
    }
    if (runRef.current !== run) return;
    if (result.type === "error") {
      if (result.error.code === "paymentFailed") {
        // Stripe declined the attempt (card declined, insufficient funds, failed 3DS…). Nothing
        // was charged; the same session can be retried with another card.
        forgetInFlight();
        setPayError(result.error.message || "Your payment was declined. Try another payment method.");
        setPhase("ready");
        return;
      }
      // Any other error: make sure nothing went through before offering Pay again.
      await verify(sessionIdRef.current, run, "resume");
      return;
    }
    await verify(sessionIdRef.current, run, "afterConfirm");
  }

  const summary = start?.summary;
  const total = summary?.totalCents ?? outcome?.amountCents ?? 0;
  // ShootPortal's permanent receipt page first; Stripe's hosted receipt_url expires.
  const receiptHref = fallbackReceiptHref || outcome?.receiptUrl || null;

  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center sm:items-center sm:p-4">
      <style>{CHECKOUT_KEYFRAMES}</style>
      <button
        type="button"
        aria-label="Close checkout"
        className="absolute inset-0 bg-slate-950/50 backdrop-blur-[2px] [animation:sp-checkout-fade_160ms_ease-out]"
        onClick={requestClose}
        tabIndex={-1}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          "relative z-10 flex w-full flex-col overflow-hidden bg-white shadow-2xl surface-dark:bg-card [animation:sp-checkout-rise_220ms_ease-out]",
          "h-[100dvh] sm:h-auto sm:max-h-[min(92dvh,880px)] sm:max-w-[460px] sm:rounded-2xl sm:border sm:border-border"
        )}
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        {/* Business header */}
        <header className="flex shrink-0 items-center gap-3 border-b border-border px-5 py-4">
          <BusinessMark name={brand.name} logoUrl={brand.logoUrl} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-semibold text-heading">{brand.name}</p>
            <p className="flex items-center gap-1 text-xs text-muted">
              <Lock className="h-3 w-3" aria-hidden /> Secure checkout
            </p>
          </div>
          <button
            type="button"
            onClick={requestClose}
            disabled={busy}
            aria-label="Close"
            className="-mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-subtle hover:text-heading disabled:opacity-40"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-6 pt-5"
          style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
        >
          {finished ? (
            <ResultView
              phase={phase}
              outcome={outcome}
              totalCents={total}
              businessName={brand.name}
              downloadsUnlockedNow={Boolean(downloadsWereLocked && outcome?.downloadsUnlocked)}
              paidMessage={paidMessage}
              onDownloadMedia={onDownloadMedia}
              receiptHref={phase === "paid" ? receiptHref : null}
              doneLabel={doneLabel}
              onDone={onClose}
              onRecheck={recheck}
              titleId={titleId}
            />
          ) : phase === "fatal" || phase === "notCompleted" ? (
            <ProblemView
              titleId={titleId}
              title={phase === "notCompleted" ? "Payment not completed" : "We couldn't open checkout"}
              message={
                phase === "notCompleted"
                  ? blockedMessage && outcome?.state === "open"
                    ? "Stripe shows no payment for this request yet. " + blockedMessage
                    : "Your payment wasn't completed, and you have not been charged. You can try again with the same or a different payment method."
                  : fatal?.message ?? "Something went wrong."
              }
              retry={phase === "notCompleted" || Boolean(fatal?.retry)}
              onRetry={() => void begin(method)}
              onClose={onClose}
            />
          ) : (
            <div className="space-y-5">
              <div>
                <h2 id={titleId} className="text-lg font-semibold leading-snug text-heading">
                  {title}
                </h2>
                {summary?.dueDate ? <p className="mt-0.5 text-sm text-muted">Due {formatDate(summary.dueDate)}</p> : null}
              </div>

              {phase === "verifying" && !summary ? (
                <VerifyingNotice />
              ) : (
                <>
                  <OrderSummary summary={summary} />

                  {summary?.bankAvailable ? (
                    <MethodSwitch
                      method={method}
                      disabled={phase !== "ready"}
                      onChange={(next) => {
                        if (next === method) return;
                        setMethod(next);
                        void begin(next);
                      }}
                    />
                  ) : null}

                  {needsEmail && phase !== "starting" ? (
                    <div>
                      <label htmlFor={emailId} className="mb-1.5 block text-sm font-medium text-heading">
                        Email for your receipt
                      </label>
                      <input
                        id={emailId}
                        type="email"
                        inputMode="email"
                        autoComplete="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        disabled={busy}
                        className="h-12 w-full rounded-[10px] border border-border bg-background px-3 text-[15px] text-heading outline-none transition focus:border-accent focus:ring-[3px] focus:ring-accent/20"
                        placeholder="you@example.com"
                      />
                    </div>
                  ) : null}

                  <div className="relative min-h-[190px]">
                    {(phase === "starting" || !elementReady) && <PaymentElementSkeleton />}
                    <div
                      ref={elementHostRef}
                      className={cn("transition-opacity duration-300", elementReady ? "opacity-100" : "pointer-events-none opacity-0")}
                    />
                  </div>

                  {payError ? (
                    <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-800 surface-dark:border-red-900/60 surface-dark:bg-red-950/40 surface-dark:text-red-200">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                      <span>{payError}</span>
                    </div>
                  ) : null}

                  {phase === "verifying" ? (
                    <VerifyingNotice />
                  ) : (
                    <Button
                      type="button"
                      variant="accent"
                      className="h-12 w-full rounded-xl text-[15px] font-semibold"
                      disabled={phase !== "ready" || !elementReady || (!canConfirm && !needsEmail)}
                      onClick={() => void pay()}
                    >
                      {phase === "confirming" ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Processing…
                        </>
                      ) : (
                        <>
                          <Lock className="h-4 w-4" aria-hidden /> Pay {formatCurrency(total)}
                        </>
                      )}
                    </Button>
                  )}

                  <p className="flex items-center justify-center gap-1.5 text-center text-xs text-muted">
                    <Lock className="h-3 w-3 shrink-0" aria-hidden />
                    Secure payment powered by Stripe. Card details are never stored by {brand.name}.
                  </p>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function BusinessMark({ name, logoUrl }: { name: string; logoUrl: string }) {
  const [broken, setBroken] = useState(false);
  if (logoUrl && !broken) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={logoUrl} alt="" className="h-10 w-10 shrink-0 rounded-lg border border-border bg-white object-contain p-1" onError={() => setBroken(true)} />
    );
  }
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-base font-semibold text-accent" aria-hidden>
      {(name.trim()[0] || "•").toUpperCase()}
    </div>
  );
}

function OrderSummary({ summary }: { summary: EmbeddedCheckoutStart["summary"] | undefined }) {
  if (!summary) {
    return (
      <div className="space-y-3 rounded-xl border border-border bg-subtle/40 p-4" aria-hidden>
        <div className="h-4 w-2/3 animate-pulse rounded bg-border" />
        <div className="h-4 w-1/3 animate-pulse rounded bg-border" />
      </div>
    );
  }
  return (
    <dl className="rounded-xl border border-border bg-subtle/40 p-4 text-sm">
      <div className="flex items-start justify-between gap-4">
        <dt className="min-w-0 text-heading">{summary.description}</dt>
        <dd className="shrink-0 tabular-nums text-heading">{formatCurrency(summary.amountCents)}</dd>
      </div>
      {summary.feeCents > 0 ? (
        <div className="mt-2 flex items-start justify-between gap-4">
          <dt className="text-muted">{summary.feeLabel ?? "Card processing fee"}</dt>
          <dd className="shrink-0 tabular-nums text-muted">{formatCurrency(summary.feeCents)}</dd>
        </div>
      ) : null}
      <div className="mt-3 flex items-baseline justify-between gap-4 border-t border-border pt-3">
        <dt className="font-semibold text-heading">Total due</dt>
        <dd className="text-lg font-semibold tabular-nums text-heading">{formatCurrency(summary.totalCents)}</dd>
      </div>
    </dl>
  );
}

function MethodSwitch({ method, disabled, onChange }: { method: Method; disabled: boolean; onChange: (m: Method) => void }) {
  const options: { value: Method; label: string; icon: typeof CreditCard }[] = [
    { value: "card", label: "Card or wallet", icon: CreditCard },
    { value: "bank", label: "Bank account", icon: Landmark },
  ];
  return (
    <div role="radiogroup" aria-label="Payment method" className="grid grid-cols-2 gap-1 rounded-xl bg-subtle p-1">
      {options.map((o) => {
        const on = method === o.value;
        const Icon = o.icon;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={disabled}
            onClick={() => onChange(o.value)}
            className={cn(
              "flex min-h-11 items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed",
              on ? "bg-white text-heading shadow-sm surface-dark:bg-card" : "text-muted hover:text-heading"
            )}
          >
            <Icon className={cn("h-4 w-4", on ? "text-accent" : "")} aria-hidden />
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function PaymentElementSkeleton() {
  return (
    <div className="absolute inset-0 space-y-3" aria-hidden>
      <div className="grid grid-cols-3 gap-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-14 animate-pulse rounded-[10px] bg-subtle" />
        ))}
      </div>
      <div className="h-3 w-24 animate-pulse rounded bg-subtle" />
      <div className="h-12 animate-pulse rounded-[10px] bg-subtle" />
      <div className="grid grid-cols-2 gap-2">
        <div className="h-12 animate-pulse rounded-[10px] bg-subtle" />
        <div className="h-12 animate-pulse rounded-[10px] bg-subtle" />
      </div>
    </div>
  );
}

function VerifyingNotice() {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-subtle/40 px-4 py-3.5 text-sm text-heading" role="status" aria-live="polite">
      <Loader2 className="h-4 w-4 shrink-0 animate-spin text-accent" aria-hidden />
      Confirming your payment with Stripe… please keep this window open.
    </div>
  );
}

function ResultView({
  phase,
  outcome,
  totalCents,
  businessName,
  downloadsUnlockedNow,
  paidMessage,
  onDownloadMedia,
  receiptHref,
  doneLabel,
  onDone,
  onRecheck,
  titleId,
}: {
  onRecheck: () => void;
  paidMessage?: string;
  phase: Phase;
  outcome: CheckoutOutcome | null;
  totalCents: number;
  businessName: string;
  downloadsUnlockedNow: boolean;
  onDownloadMedia?: () => void;
  receiptHref: string | null;
  doneLabel: string;
  onDone: () => void;
  titleId: string;
}) {
  const amount = outcome ? outcome.amountCents + (outcome.feeCents || 0) : totalCents;
  const paidOn = outcome?.paidAt ? formatDate(outcome.paidAt) : formatDate(new Date().toISOString());
  const paid = phase === "paid";
  const processing = phase === "processing";
  const uncertain = phase === "uncertain";
  // "confirming" = Stripe completed the checkout; the record is catching up.
  const stripeConfirmed = outcome?.state === "confirming";

  return (
    <div className="flex flex-col items-center py-4 text-center" role="status" aria-live="polite">
      <div
        className={cn(
          "flex h-16 w-16 items-center justify-center rounded-full [animation:sp-checkout-pop_320ms_cubic-bezier(.2,.9,.3,1.3)]",
          paid ? "bg-emerald-50 text-emerald-600 surface-dark:bg-emerald-950/40" : "bg-sky-50 text-sky-600 surface-dark:bg-sky-950/40"
        )}
      >
        {paid ? <CheckCircle2 className="h-9 w-9" aria-hidden /> : <Clock className="h-8 w-8" aria-hidden />}
      </div>
      <h2 id={titleId} className="mt-4 text-xl font-semibold text-heading">
        {paid ? "Payment successful" : processing ? "Bank payment started" : stripeConfirmed ? "Payment received" : "Still confirming your payment"}
      </h2>
      <p className="mt-1 text-3xl font-semibold tabular-nums tracking-tight text-heading">{formatCurrency(amount)}</p>
      <p className="mt-1 text-sm text-muted">
        {paid
          ? `Paid ${paidOn}${outcome?.methodLabel ? ` · ${outcome.methodLabel}` : ""}`
          : processing
            ? "Bank payments usually clear in a few business days. It will show as paid here once it does."
            : stripeConfirmed
              ? `Stripe has your payment. ${businessName}'s records are updating — it will appear here in a moment. Please don't pay again.`
              : `We haven't been able to confirm the result yet. If your bank shows a charge, it will appear here shortly. Please don't pay again until this is confirmed.`}
      </p>

      {paid && (downloadsUnlockedNow || paidMessage) ? (
        <div className="mt-5 w-full rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 surface-dark:border-emerald-900/60 surface-dark:bg-emerald-950/30 surface-dark:text-emerald-100">
          {paidMessage ?? "Your photos and videos are now available for download."}
        </div>
      ) : null}

      <div className="mt-6 flex w-full flex-col gap-2">
        {uncertain ? (
          <Button variant="accent" className="h-12 w-full rounded-xl text-[15px]" onClick={onRecheck}>
            Check again
          </Button>
        ) : null}
        {paid && downloadsUnlockedNow && onDownloadMedia ? (
          <Button variant="accent" className="h-12 w-full rounded-xl text-[15px]" onClick={onDownloadMedia}>
            <Download className="h-4 w-4" aria-hidden /> Download media
          </Button>
        ) : null}
        {receiptHref ? (
          <a href={receiptHref} target="_blank" rel="noopener noreferrer" className="block">
            <Button variant="outline" className="h-12 w-full rounded-xl text-[15px]">
              <Receipt className="h-4 w-4" aria-hidden /> View receipt
            </Button>
          </a>
        ) : null}
        <Button
          variant={(paid && downloadsUnlockedNow && onDownloadMedia) || uncertain ? "ghost" : "accent"}
          className="h-12 w-full rounded-xl text-[15px]"
          onClick={onDone}
        >
          {doneLabel} <ArrowRight className="h-4 w-4" aria-hidden />
        </Button>
      </div>
    </div>
  );
}

function ProblemView({
  titleId,
  title,
  message,
  retry,
  onRetry,
  onClose,
}: {
  titleId: string;
  title: string;
  message: string;
  retry: boolean;
  onRetry: () => void;
  onClose: () => void;
}) {
  return (
    <div className="flex flex-col items-center py-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 text-amber-600 surface-dark:bg-amber-950/40">
        <AlertCircle className="h-7 w-7" aria-hidden />
      </div>
      <h2 id={titleId} className="mt-4 text-lg font-semibold text-heading">
        {title}
      </h2>
      <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-muted">{message}</p>
      <div className="mt-6 flex w-full flex-col gap-2">
        {retry ? (
          <Button variant="accent" className="h-12 w-full rounded-xl" onClick={onRetry}>
            Try again
          </Button>
        ) : null}
        <Button variant="outline" className="h-12 w-full rounded-xl" onClick={onClose}>
          Close
        </Button>
      </div>
    </div>
  );
}

/**
 * Read and clear `?payment=returned&payment_id=…&session_id=…` after a redirect-based payment
 * method sends the client back. The modal then verifies that session with the server.
 */
export function useCheckoutReturn(
  /** Only resume payments this page shows (the caller's own payment ids). */
  accepts: (paymentId: string) => boolean = () => true
): { paymentId: string | null; sessionId: string } | null {
  const [value, setValue] = useState<{ paymentId: string | null; sessionId: string } | null>(null);
  useEffect(() => {
    const url = new URL(window.location.href);
    const sessionId = url.searchParams.get("session_id");
    if (url.searchParams.get("payment") === "returned" || sessionId) {
      if (!sessionId || !/^cs_[A-Za-z0-9_]+$/.test(sessionId)) return;
      const paymentId = url.searchParams.get("payment_id");
      url.searchParams.delete("payment");
      url.searchParams.delete("payment_id");
      url.searchParams.delete("session_id");
      window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
      if (paymentId && !accepts(paymentId)) return;
      setValue({ paymentId, sessionId });
      return;
    }
    // The page was reloaded (or the app relaunched) while a payment was being confirmed.
    const inFlight = readInFlight();
    if (inFlight && accepts(inFlight.paymentId)) setValue(inFlight);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return value;
}

/** POST helper shared by the portal and pay-page callers. */
export async function postStartCheckout(url: string, body: Record<string, unknown>): Promise<StartCheckoutResult> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as Partial<EmbeddedCheckoutStart> & { error?: string };
  if (res.ok && data.clientSecret && data.sessionId && data.summary) {
    return { ok: true, data: data as EmbeddedCheckoutStart };
  }
  return { ok: false, error: data.error || "Could not start checkout. Please try again.", status: res.status };
}
