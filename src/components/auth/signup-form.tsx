"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { suggestSlugFromName } from "@/lib/signup-validation";
import { AuthDivider, GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { createClient } from "@/lib/supabase/client";
import { resolvePostLoginRedirect } from "@/lib/auth-post-login-client";
import {
  serializeSignupIntent,
  SIGNUP_INTENT_COOKIE,
  SIGNUP_INTENT_MAX_AGE_SECONDS,
  signupIntentCookieDomain,
  type SignupIntent,
  type SignupInterval,
} from "@/lib/signup-intent";
import { formatUsd } from "@/lib/trial-conversion";
import { introOfferSavingsLabel, quotePlan, type OfferDisplay } from "@/lib/intro-offer";
import { cn } from "@/lib/utils";

const DEFAULT_INTENT: SignupIntent = { path: "trial", interval: null, source: null };

export function SignupForm({
  platformRootDomain,
  trialDays,
  oauthAllowed,
  initialIntent = DEFAULT_INTENT,
  pricing,
  offer = null,
  adminDemo = null,
}: {
  platformRootDomain: string;
  /** Studio plan trial_days for new signups (from plans table). */
  trialDays: number;
  oauthAllowed?: boolean;
  /** From /signup?plan=monthly|annual&source=… — Subscribe Now vs free trial. */
  initialIntent?: SignupIntent;
  pricing?: { monthlyCents: number | null; annualPerMonthCents: number | null };
  /** Prices to show for Subscribe & Save (intro offer) or a partner referral — never both. */
  offer?: (OfferDisplay & { partnerName?: string | null }) | null;
  /**
   * Set only when the server verified a super admin on /signup?source=admin-demo. Shows the
   * "Create without partner referral" option. The server re-verifies on submit.
   */
  adminDemo?: { adminEmail: string | null } | null;
}) {
  const [intent, setIntent] = useState<SignupIntent>(() =>
    initialIntent.path === "subscribe" && !initialIntent.interval
      ? { ...initialIntent, interval: "annual" }
      : initialIntent
  );
  const subscribing = intent.path === "subscribe" || trialDays <= 0;
  const offerKind = offer?.kind ?? "intro";
  const quotes = offer?.quotes ?? (pricing ? quotePlan(pricing, true) : {});
  const save = introOfferSavingsLabel();
  const selectedQuote = quotes[intent.interval === "monthly" ? "monthly" : "annual"] ?? null;
  const referralHasDiscount = Object.values(quotes).some((q) => (q?.savingsCents ?? 0) > 0);

  // Keep the choice through Google sign-up (OAuth → /finish-setup) and existing-user login.
  useEffect(() => {
    try {
      const domain = signupIntentCookieDomain(window.location.hostname, platformRootDomain);
      const secure = window.location.protocol === "https:" ? "; Secure" : "";
      document.cookie = `${SIGNUP_INTENT_COOKIE}=${encodeURIComponent(serializeSignupIntent(intent))}; Path=/; Max-Age=${SIGNUP_INTENT_MAX_AGE_SECONDS}; SameSite=Lax${domain ? `; Domain=${domain}` : ""}${secure}`;
    } catch {
      /* cookies blocked — the POST body still carries the choice */
    }
  }, [intent, platformRootDomain]);

  const [skipReferral, setSkipReferral] = useState(true);
  function toggleSkipReferral(next: boolean) {
    setSkipReferral(next);
    // The source carries the choice through Google sign-up (finish-setup re-verifies the admin).
    setIntent((prev) => ({ ...prev, source: next ? "admin-demo" : "demo" }));
  }

  function chooseInterval(next: SignupInterval) {
    setIntent((prev) => ({ ...prev, path: "subscribe", interval: next }));
  }
  const [name, setName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [slugStatus, setSlugStatus] = useState<{
    ok: boolean;
    error?: string;
    suggestion?: string;
    preview?: string | null;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ message: string; portalUrl: string; confirmEmail: boolean } | null>(null);
  const [signingIn, setSigningIn] = useState(false);

  useEffect(() => {
    if (!slugTouched) {
      setSlug(suggestSlugFromName(name));
    }
  }, [name, slugTouched]);

  useEffect(() => {
    if (!slug.trim()) {
      setSlugStatus(null);
      return;
    }
    const t = window.setTimeout(() => {
      void (async () => {
        try {
          const res = await fetch(
            `/api/signup/availability?slug=${encodeURIComponent(slug)}&name=${encodeURIComponent(name)}`
          );
          const data = (await res.json()) as {
            ok: boolean;
            error?: string;
            suggestion?: string;
            preview?: string | null;
          };
          setSlugStatus(data);
        } catch {
          setSlugStatus(null);
        }
      })();
    }, 300);
    return () => window.clearTimeout(t);
  }, [slug, name]);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          slug,
          email,
          password,
          ownerName,
          signupPath: intent.path,
          interval: intent.interval,
          source: intent.source,
          skipPartnerReferral: adminDemo != null && skipReferral,
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        code?: string;
        requestId?: string;
        suggestion?: string;
        message?: string;
        portalUrl?: string;
        requiresEmailConfirmation?: boolean;
      };
      if (!res.ok) {
        if (data.suggestion) {
          setSlug(data.suggestion);
          setSlugTouched(true);
        }
        const base = data.error || "Signup failed";
        const support =
          data.code && data.code !== "rate_limited"
            ? ` (code: ${data.code}${data.requestId ? ` · ${data.requestId}` : ""})`
            : data.requestId
              ? ` (ref: ${data.requestId})`
              : "";
        throw new Error(`${base}${support}`);
      }
      if (data.requiresEmailConfirmation === false) {
        // No email step: sign in now and go straight on (Subscribe Now → secure checkout,
        // free trial → portal setup). The login page is only a fallback.
        setSigningIn(true);
        const { error: signInError } = await createClient().auth.signInWithPassword({ email, password });
        const destination = signInError ? null : await resolvePostLoginRedirect("/admin");
        if (destination?.ok) {
          window.location.assign(destination.redirect);
          return;
        }
        setSigningIn(false);
        setDone({
          message: "Your account is ready. Log in with the email and password you just chose to continue.",
          portalUrl: data.portalUrl || "",
          confirmEmail: false,
        });
        return;
      }
      setDone({
        message: data.message || "Check your email to confirm your account.",
        portalUrl: data.portalUrl || "",
        confirmEmail: true,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Signup failed");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="flex flex-1 items-center justify-center px-4 py-16">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>{done.confirmEmail ? "Confirm your email" : "Your account is ready"}</CardTitle>
              <CardDescription>{done.message}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              {done.portalUrl && (
                <p className="text-muted">
                  {done.confirmEmail ? "After confirming, your portal will be" : "Your portal is"}{" "}
                  <a className="text-accent underline" href={done.portalUrl}>
                    {done.portalUrl}
                  </a>
                </p>
              )}
              <Link href="/login">
                <Button className="w-full min-h-11" variant="accent">
                  Go to login
                </Button>
              </Link>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  const preview =
    slugStatus?.preview ||
    (slug.trim() ? `${slug.trim().toLowerCase()}.${platformRootDomain}` : null);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex flex-1 items-center justify-center px-4 py-16">
        <Card className="w-full max-w-lg">
          <CardHeader className="text-center">
            <CardTitle>Get started with ShootPortal</CardTitle>
            <CardDescription>Choose how you&apos;d like to begin. Same full product either way.</CardDescription>
          </CardHeader>
          <CardContent>
            {adminDemo && (
              <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                <p className="font-semibold">Admin demo signup</p>
                <label className="mt-2 flex items-start gap-2">
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4"
                    checked={skipReferral}
                    onChange={(e) => toggleSkipReferral(e.target.checked)}
                  />
                  <span>
                    Create without partner referral
                    <span className="block text-xs">
                      Ignores any partner referral saved in this browser, so this account gets no partner
                      discount and earns no partner commission.
                    </span>
                  </span>
                </label>
              </div>
            )}

            <div
              className={cn("mb-5 grid gap-3", trialDays > 0 && "sm:grid-cols-2")}
              role="radiogroup"
              aria-label="How would you like to start?"
            >
              {trialDays > 0 && (
                <button
                  type="button"
                  role="radio"
                  aria-checked={!subscribing}
                  onClick={() => setIntent((prev) => ({ ...prev, path: "trial", interval: null }))}
                  data-sp-cta="signup:path_trial"
                  className={cn(
                    "flex min-h-11 flex-col rounded-xl border-2 p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                    !subscribing ? "border-accent bg-accent/5" : "border-border bg-card hover:border-accent/50"
                  )}
                >
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted">
                    {trialDays} days free
                  </span>
                  <span className="mt-1 text-base font-bold text-heading">Start Free Trial</span>
                  <span className="mt-1 text-sm text-muted">
                    Try ShootPortal free for {trialDays} days. No credit card required.
                  </span>
                </button>
              )}
              <button
                type="button"
                role="radio"
                aria-checked={subscribing}
                onClick={() => chooseInterval(intent.interval ?? "annual")}
                data-sp-cta="signup:path_subscribe"
                className={cn(
                  "relative flex min-h-11 flex-col rounded-xl border-2 p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                  subscribing ? "border-accent bg-accent/5" : "border-border bg-card hover:border-accent/50"
                )}
              >
                {offerKind === "intro" && (
                  <span className="absolute -top-2.5 right-3 rounded-full bg-emerald-600 px-2 py-0.5 text-xs font-semibold text-white">
                    Save {save}
                  </span>
                )}
                <span className="text-xs font-semibold uppercase tracking-wide text-muted">Skip the trial</span>
                <span className="mt-1 text-base font-bold text-heading">
                  {offerKind === "intro" ? "Subscribe & Save" : "Subscribe Now"}
                </span>
                <span className="mt-1 text-sm text-muted">
                  {offerKind === "intro"
                    ? `Ready to get started? Subscribe today and save ${save}.`
                    : offerKind === "referral" && referralHasDiscount
                      ? `Subscribe today with your ${offer?.partnerName ? `${offer.partnerName} ` : ""}partner discount.`
                      : "Ready to get started? Subscribe today."}
                </span>
              </button>
            </div>

            {subscribing ? (
              <div className="mb-5">
                <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Billing">
                  {(["monthly", "annual"] as const).map((option) => {
                    const q = quotes[option];
                    const discounted = q && q.savingsCents > 0;
                    return (
                      <button
                        key={option}
                        type="button"
                        role="radio"
                        aria-checked={intent.interval === option}
                        onClick={() => chooseInterval(option)}
                        className={cn(
                          "flex min-h-11 flex-col items-start rounded-lg border px-3 py-2.5 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                          intent.interval === option
                            ? "border-accent bg-accent/10 text-heading"
                            : "border-border bg-card text-muted hover:text-heading"
                        )}
                      >
                        <span className="flex w-full items-center justify-between gap-1 font-semibold text-heading">
                          {option === "monthly" ? "Monthly" : "Annual"}
                          {option === "annual" && <span className="text-xs font-medium text-emerald-700">Best value</span>}
                        </span>
                        {q ? (
                          <>
                            <span className="mt-1 text-lg font-bold text-heading">
                              {discounted && (
                                <span className="mr-1.5 text-sm font-normal text-muted line-through">
                                  {formatUsd(q.regularCents)}
                                </span>
                              )}
                              {formatUsd(q.firstChargeCents)}
                              <span className="text-xs font-normal text-muted">
                                {option === "monthly" ? "/mo" : discounted ? " first year" : "/yr"}
                              </span>
                            </span>
                            <span className="text-xs text-muted">
                              {discounted
                                ? option === "monthly"
                                  ? `for ${q.introInvoices} months, then ${formatUsd(q.regularCents)}/mo`
                                  : `then ${formatUsd(q.regularCents)}/year`
                                : option === "monthly"
                                  ? "Billed monthly"
                                  : "Billed once a year"}
                            </span>
                          </>
                        ) : (
                          <span className="text-xs">{option === "monthly" ? "Billed monthly" : "Billed annually"}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
                {selectedQuote && (
                  <p className="mt-3 rounded-lg bg-background px-3 py-2 text-center text-xs text-muted">
                    You&apos;ll pay <strong className="text-heading">{formatUsd(selectedQuote.firstChargeCents)} today</strong>{" "}
                    on the next step.{" "}
                    {selectedQuote.interval === "annual" ? selectedQuote.renewal : `${selectedQuote.summary}`}.
                    {selectedQuote.savingsCents > 0 ? ` You save ${formatUsd(selectedQuote.savingsCents)}.` : ""} Cancel
                    anytime.
                  </p>
                )}
              </div>
            ) : (
              offerKind === "intro" && (
                <p className="mb-5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-center text-sm text-emerald-900">
                  Starting with the trial? You can still claim <strong>{save} off</strong> by subscribing any time
                  before your trial ends.
                </p>
              )
            )}
            <div className="mb-2 space-y-4">
              {oauthAllowed !== false && (
                <>
                  <GoogleSignInButton
                    label="Continue with Google"
                    disabled={busy}
                    allowed={oauthAllowed}
                  />
                  <AuthDivider label="or use email" />
                </>
              )}
            </div>
            <form className="space-y-4" onSubmit={onSubmit}>
              <div className="space-y-2">
                <Label htmlFor="name">Business name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  minLength={2}
                  placeholder="Acme Media"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ownerName">Your name</Label>
                <Input
                  id="ownerName"
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  placeholder="Alex Rivera"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="slug">Portal address</Label>
                <Input
                  id="slug"
                  value={slug}
                  onChange={(e) => {
                    setSlugTouched(true);
                    setSlug(e.target.value);
                  }}
                  required
                  placeholder="acme-media"
                />
                {preview && (
                  <p className="text-xs text-muted">
                    Preview: <span className="font-medium text-heading">{preview}</span>
                  </p>
                )}
                {slugStatus && !slugStatus.ok && (
                  <p className="text-xs text-amber-700">
                    {slugStatus.error}
                    {slugStatus.suggestion ? (
                      <>
                        {" "}
                        Try{" "}
                        <button
                          type="button"
                          className="underline"
                          onClick={() => {
                            setSlugTouched(true);
                            setSlug(slugStatus.suggestion!);
                          }}
                        >
                          {slugStatus.suggestion}
                        </button>
                      </>
                    ) : null}
                  </p>
                )}
                {slugStatus?.ok && <p className="text-xs text-teal-700">Available</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Work email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <Button type="submit" variant="accent" className="w-full min-h-11" disabled={busy || signingIn}>
                {signingIn
                  ? subscribing
                    ? "Taking you to secure checkout…"
                    : "Opening your portal…"
                  : busy
                    ? "Creating…"
                    : subscribing
                      ? "Create account & continue to payment"
                      : "Start my free trial"}
              </Button>
            </form>
            <p className="mt-6 text-center text-sm text-muted">
              Already have an account?{" "}
              <Link href="/login" className="text-accent hover:underline">
                Log in
              </Link>
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
