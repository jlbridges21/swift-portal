"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AuthLinkHelpCard } from "@/components/auth/auth-link-help-card";
import {
  clearAuthFragmentFromUrl,
  parseAuthFragment,
  type AuthLinkErrorKind,
} from "@/lib/auth-fragment";
import { AuthDivider, GoogleSignInButton } from "@/components/auth/google-sign-in-button";

export function LoginForm({
  showRequestLink,
  oauthAllowed,
}: {
  showRequestLink: boolean;
  oauthAllowed?: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/dashboard";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"login" | "forgot" | "link_help" | "oauth_error">("login");
  const [resetSent, setResetSent] = useState(false);
  const [linkErrorKind, setLinkErrorKind] = useState<AuthLinkErrorKind>("generic");
  const [linkDescription, setLinkDescription] = useState<string | null>(null);

  const queryError = searchParams.get("error");
  const queryCode = searchParams.get("code");
  const queryMessage = searchParams.get("message");
  const queryUnavailable =
    queryError === "unavailable"
      ? "This portal is unavailable. Your business is suspended or no longer active."
      : queryError === "oauth_link_conflict" || queryCode === "oauth_link_conflict"
        ? "An account already exists for this email. Sign in with your password and verify your email before connecting Google."
        : queryError === "tenant_no_match" || queryCode === "tenant_no_match"
          ? "No portal account was found for this email on this business. Ask your studio to invite you, or sign in on shootportal.app if you are starting a new studio."
          : queryError === "no_portal"
            ? queryMessage ||
              "This host has no portal for your account. Open your studio’s portal URL to continue."
            : queryError === "handoff_failed"
              ? queryMessage ||
                "Could not finish signing you into this portal. Try signing in again here."
              : "";

  const [error, setError] = useState(queryUnavailable);
  const [notice, setNotice] = useState("");
  const [oauthDetail, setOauthDetail] = useState<string | null>(null);

  useEffect(() => {
    const fromHash = parseAuthFragment(window.location.hash, window.location.search);
    if (fromHash.kind === "error") {
      setLinkErrorKind(fromHash.errorKind);
      setLinkDescription(fromHash.description);
      setMode("link_help");
      clearAuthFragmentFromUrl();
      return;
    }
    // Success tokens on /login — establish session via shared landing behavior would
    // be unusual; still clear and send through post-login if present.
    if (fromHash.kind === "tokens") {
      clearAuthFragmentFromUrl();
      void (async () => {
        const supabase = createClient();
        await supabase.auth.setSession({
          access_token: fromHash.accessToken,
          refresh_token: fromHash.refreshToken,
        });
        if (fromHash.type === "recovery" || fromHash.type === "invite") {
          await fetch("/api/auth/password-setup-begin", { method: "POST", credentials: "include" });
          window.location.replace(
            `/auth/update-password?reason=${fromHash.type === "invite" ? "invite" : "recovery"}`
          );
          return;
        }
        const destRes = await fetch("/api/auth/post-login", {
          method: "POST",
          credentials: "include",
        });
        const destBody = (await destRes.json().catch(() => ({}))) as { redirect?: string };
        window.location.replace(destBody.redirect || "/admin");
      })();
      return;
    }
    if (fromHash.kind === "code") {
      const next = new URL("/auth/callback", window.location.origin);
      next.searchParams.set("code", fromHash.code);
      window.location.replace(next.toString());
      return;
    }
    if (queryError === "oauth_exchange") {
      setOauthDetail(queryMessage);
      setMode("oauth_error");
      return;
    }
    if (queryError === "otp_expired") {
      setLinkErrorKind("otp_expired");
      setLinkDescription(null);
      setMode("link_help");
    } else if (queryError === "auth_callback") {
      setLinkErrorKind("generic");
      setLinkDescription(null);
      setMode("link_help");
    } else if (queryError === "access_denied") {
      setLinkErrorKind("access_denied");
      setLinkDescription(null);
      setMode("link_help");
    }
  }, [queryError, queryMessage]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setNotice("");

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    const destRes = await fetch("/api/auth/post-login", {
      method: "POST",
      credentials: "include",
    });
    const destBody = (await destRes.json().catch(() => ({}))) as {
      redirect?: string;
      error?: string;
    };

    if (!destRes.ok) {
      setError(
        destBody.error ||
          "This portal is unavailable. Your business is suspended or no longer active."
      );
      setLoading(false);
      return;
    }

    const dest = destBody.redirect || redirect;
    if (dest.startsWith("http://") || dest.startsWith("https://")) {
      window.location.assign(dest);
      return;
    }
    router.push(dest);
    router.refresh();
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setNotice("");
    const supabase = createClient();
    const redirectTo = `${window.location.origin}/auth/confirm`;
    const { error: resetErr } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo,
    });
    setLoading(false);
    if (resetErr) {
      setError(resetErr.message);
      return;
    }
    setResetSent(true);
    setNotice("If an account exists for that email, a reset link was sent. It returns to this portal.");
  }

  if (mode === "oauth_error") {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="flex-1 flex items-center justify-center px-4 py-16">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <CardTitle>Google sign-in didn’t finish</CardTitle>
              <CardDescription>
                The sign-in session expired or couldn’t be verified on this host. This is not an
                invite or password-reset link — try Google again from this page.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {oauthDetail && (
                <p className="text-sm text-muted" role="status">
                  {oauthDetail}
                </p>
              )}
              <GoogleSignInButton
                label="Try Google again"
                disabled={loading}
                allowed={oauthAllowed}
              />
              <p className="text-center text-sm">
                <button
                  type="button"
                  className="text-accent hover:underline"
                  onClick={() => {
                    setMode("login");
                    setError("");
                    setOauthDetail(null);
                  }}
                >
                  Sign in with email instead
                </button>
              </p>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  if (mode === "link_help") {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="flex-1 flex items-center justify-center px-4 py-16">
          <AuthLinkHelpCard
            errorKind={linkErrorKind}
            description={linkDescription}
            onDismiss={() => {
              setMode("login");
              setError("");
              setNotice("");
            }}
            dismissLabel="Back to sign in"
          />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1 flex items-center justify-center px-4 py-16">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>{mode === "forgot" ? "Reset password" : "Sign in"}</CardTitle>
            <CardDescription>
              {mode === "forgot"
                ? "We’ll email a link that opens on this portal so you stay on the right business."
                : "Access your ShootPortal admin or client portal"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {mode === "login" ? (
              <form onSubmit={handleLogin} className="space-y-4">
                {oauthAllowed !== false && (
                  <>
                    <GoogleSignInButton
                      label="Continue with Google"
                      disabled={loading}
                      allowed={oauthAllowed}
                    />
                    <AuthDivider />
                  </>
                )}
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="you@example.com"
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
                  />
                </div>

                {error && <p className="text-sm text-red-600">{error}</p>}

                <Button type="submit" variant="accent" className="w-full min-h-11" disabled={loading}>
                  {loading ? "Signing in..." : "Sign In"}
                </Button>

                <p className="text-center text-sm">
                  <button
                    type="button"
                    className="text-accent hover:underline"
                    onClick={() => {
                      setMode("forgot");
                      setError("");
                      setNotice("");
                      setResetSent(false);
                    }}
                  >
                    Forgot password?
                  </button>
                </p>
              </form>
            ) : (
              <form onSubmit={handleForgot} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="reset-email">Email</Label>
                  <Input
                    id="reset-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="you@example.com"
                  />
                </div>
                {error && <p className="text-sm text-red-600">{error}</p>}
                {notice && <p className="text-sm text-muted">{notice}</p>}
                <Button
                  type="submit"
                  variant="accent"
                  className="w-full min-h-11"
                  disabled={loading || resetSent}
                >
                  {loading ? "Sending…" : resetSent ? "Email sent" : "Send reset link"}
                </Button>
                <p className="text-center text-sm">
                  <button
                    type="button"
                    className="text-accent hover:underline"
                    onClick={() => {
                      setMode("login");
                      setError("");
                      setNotice("");
                    }}
                  >
                    Back to sign in
                  </button>
                </p>
              </form>
            )}

            {showRequestLink && (
              <p className="mt-6 text-center text-sm text-muted">
                Need aerial media?{" "}
                <Link href="/request" className="text-accent hover:underline">
                  Request a shoot
                </Link>
              </p>
            )}
            {!showRequestLink && (
              <p className="mt-6 text-center text-sm text-muted">
                New studio?{" "}
                <Link href="/signup" className="text-accent hover:underline">
                  Start a free trial
                </Link>
              </p>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
