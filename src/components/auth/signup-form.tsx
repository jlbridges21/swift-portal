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
import { annualTotalCents, formatUsd } from "@/lib/trial-conversion";
import { cn } from "@/lib/utils";

const DEFAULT_INTENT: SignupIntent = { path: "trial", interval: null, source: null };

export function SignupForm({
  platformRootDomain,
  trialDays,
  oauthAllowed,
  initialIntent = DEFAULT_INTENT,
  pricing,
  adminDemo = null,
}: {
  platformRootDomain: string;
  /** Studio plan trial_days for new signups (from plans table). */
  trialDays: number;
  oauthAllowed?: boolean;
  /** From /signup?plan=monthly|annual&source=… — Subscribe Now vs free trial. */
  initialIntent?: SignupIntent;
  pricing?: { monthlyCents: number | null; annualPerMonthCents: number | null };
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
  const annualTotal = pricing ? annualTotalCents(pricing) : null;
  const planSummary =
    intent.interval === "monthly"
      ? pricing?.monthlyCents != null
        ? `${formatUsd(pricing.monthlyCents)}/month, billed monthly`
        : "Billed monthly"
      : annualTotal != null
        ? `${formatUsd(annualTotal)}/year (${formatUsd(pricing?.annualPerMonthCents)}/month), billed once a year`
        : "Billed annually";

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
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>
              {subscribing ? "Create your account" : "Start your free trial"}
            </CardTitle>
            <CardDescription>
              {subscribing
                ? "Subscribe to ShootPortal. You'll enter payment details securely on the next step."
                : `${trialDays} days free. No credit card required.`}
            </CardDescription>
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
            {intent.path === "subscribe" && (
              <div className="mb-5">
                <div className="rounded-xl border border-border bg-background p-3">
                  <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Billing">
                    {(["monthly", "annual"] as const).map((option) => (
                      <button
                        key={option}
                        type="button"
                        role="radio"
                        aria-checked={intent.interval === option}
                        onClick={() => chooseInterval(option)}
                        className={cn(
                          "min-h-11 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                          intent.interval === option
                            ? "border-accent bg-accent/10 text-heading"
                            : "border-border bg-card text-muted hover:text-heading"
                        )}
                      >
                        {option === "monthly" ? "Monthly" : "Annual"}
                        {option === "annual" && pricing?.annualPerMonthCents != null ? (
                          <span className="block text-xs font-normal">Best value</span>
                        ) : (
                          <span className="block text-xs font-normal">Flexible</span>
                        )}
                      </button>
                    ))}
                  </div>
                  <p className="mt-2 text-center text-xs text-muted">{planSummary}</p>
                </div>
                {trialDays > 0 && (
                  <p className="mt-3 text-center text-sm text-muted">
                    Not quite ready?{" "}
                    <button
                      type="button"
                      className="font-medium text-accent hover:underline"
                      onClick={() => setIntent((prev) => ({ ...prev, path: "trial", interval: null }))}
                    >
                      Start a {trialDays}-day free trial instead
                    </button>
                  </p>
                )}
              </div>
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
                      : "Create account"}
              </Button>
            </form>
            {trialDays > 0 && intent.path === "trial" && (
              <p className="mt-4 text-center text-sm text-muted">
                Ready to buy?{" "}
                <button
                  type="button"
                  className="font-medium text-accent hover:underline"
                  onClick={() => chooseInterval("annual")}
                >
                  Subscribe now
                </button>
              </p>
            )}
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
