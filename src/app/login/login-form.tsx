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

type LinkErrorKind = "otp_expired" | "access_denied" | "generic" | null;

function messageForLinkError(kind: LinkErrorKind, description: string | null): string {
  if (kind === "otp_expired") {
    return (
      "That invite or reset link expired or was already used. " +
      (description ? `(${description.replace(/\+/g, " ")}) ` : "") +
      "Request a new link below."
    );
  }
  if (kind === "access_denied") {
    return (
      "Access was denied for that email link — it may have expired, already been used, or been blocked. " +
      "Request a new link below."
    );
  }
  if (kind === "generic") {
    return "That email link didn’t work. Request a new one below.";
  }
  return "";
}

function parseHashAuthError(): { kind: LinkErrorKind; description: string | null } {
  if (typeof window === "undefined") return { kind: null, description: null };
  const hash = window.location.hash.replace(/^#/, "");
  if (!hash) return { kind: null, description: null };
  const params = new URLSearchParams(hash);
  const error = params.get("error");
  const code = params.get("error_code");
  const description = params.get("error_description");
  if (!error && !code) return { kind: null, description: null };

  if (code === "otp_expired" || /otp_expired|expired|invalid/i.test(description || "")) {
    return { kind: "otp_expired", description };
  }
  if (error === "access_denied" || code === "access_denied") {
    return { kind: "access_denied", description };
  }
  return { kind: "generic", description };
}

export function LoginForm({ showRequestLink }: { showRequestLink: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/dashboard";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"login" | "forgot" | "link_help">("login");
  const [resetSent, setResetSent] = useState(false);
  const [linkSent, setLinkSent] = useState(false);
  const [linkErrorKind, setLinkErrorKind] = useState<LinkErrorKind>(null);

  const queryError = searchParams.get("error");
  const queryUnavailable =
    queryError === "unavailable"
      ? "This portal is unavailable. Your business is suspended or no longer active."
      : "";

  const [error, setError] = useState(queryUnavailable);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const fromHash = parseHashAuthError();
    if (fromHash.kind) {
      setLinkErrorKind(fromHash.kind);
      setError(messageForLinkError(fromHash.kind, fromHash.description));
      setMode("link_help");
      // Strip hash so refresh doesn’t re-trigger; keep path/query.
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
      return;
    }
    if (queryError === "otp_expired") {
      setLinkErrorKind("otp_expired");
      setError(messageForLinkError("otp_expired", null));
      setMode("link_help");
    } else if (queryError === "auth_callback") {
      setLinkErrorKind("generic");
      setError(messageForLinkError("generic", null));
      setMode("link_help");
    } else if (queryError === "access_denied") {
      setLinkErrorKind("access_denied");
      setError(messageForLinkError("access_denied", null));
      setMode("link_help");
    }
  }, [queryError]);

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
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent("/auth/update-password")}&sp_flow=recovery`;
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

  async function handleResendLink(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setNotice("");
    const res = await fetch("/api/auth/resend-link", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim() }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "Could not send a new link.");
      return;
    }
    setLinkSent(true);
    setNotice(data.message || "If an account exists, a new link was sent.");
  }

  const title =
    mode === "forgot"
      ? "Reset password"
      : mode === "link_help"
        ? "That link didn’t work"
        : "Sign in";

  const description =
    mode === "forgot"
      ? "We’ll email a link that opens on this portal so you stay on the right business."
      : mode === "link_help"
        ? "Email security scanners often open invite links automatically and consume them. Requesting a new link usually fixes this — the product isn’t broken."
        : "Access your ShootPortal admin or client portal";

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1 flex items-center justify-center px-4 py-16">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </CardHeader>
          <CardContent>
            {mode === "login" ? (
              <form onSubmit={handleLogin} className="space-y-4">
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
            ) : mode === "forgot" ? (
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
            ) : (
              <form onSubmit={handleResendLink} className="space-y-4">
                {error && <p className="text-sm text-red-600">{error}</p>}
                {linkErrorKind === "otp_expired" && (
                  <p className="text-sm text-muted">
                    Expired or already-used links are common when an email scanner opens the URL
                    before you do.
                  </p>
                )}
                {linkErrorKind === "access_denied" && (
                  <p className="text-sm text-muted">
                    Access was denied for that link. A fresh invite or reset email usually resolves
                    it.
                  </p>
                )}
                <div className="space-y-2">
                  <Label htmlFor="link-email">Your email</Label>
                  <Input
                    id="link-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="you@example.com"
                  />
                </div>
                {notice && <p className="text-sm text-muted">{notice}</p>}
                <Button
                  type="submit"
                  variant="accent"
                  className="w-full min-h-11"
                  disabled={loading || linkSent}
                >
                  {loading ? "Sending…" : linkSent ? "Link sent" : "Send me a new link"}
                </Button>
                <p className="text-center text-sm">
                  <button
                    type="button"
                    className="text-accent hover:underline"
                    onClick={() => {
                      setMode("login");
                      setError("");
                      setNotice("");
                      setLinkSent(false);
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
