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

/**
 * After invite / recovery, /auth/callback lands here with a session.
 * Password must be set before continuing — middleware enforces the gate.
 */
export default function UpdatePasswordClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const reason = searchParams.get("reason");
  const isInvite = reason === "invite";
  const isRecovery = reason === "recovery";
  const isForced = reason === "forced" || searchParams.get("forced") === "1";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      setHasSession(Boolean(data.session));
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const title = isInvite
    ? "Set your password to finish setting up your account"
    : isForced
      ? "Choose a new password"
      : isRecovery
        ? "Choose a new password"
        : "Set a new password";

  const description = isInvite
    ? "Your invitation is accepted. Create a password so you can sign in again later."
    : isForced
      ? "A temporary password was used. You must set your own password before continuing."
      : "Choose a password for your ShootPortal account on this portal.";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      setError(
        "Your session expired. Request a new invite or password-reset link from the sign-in page."
      );
      setLoading(false);
      return;
    }

    const { error: updateErr } = await supabase.auth.updateUser({
      password,
      data: { must_change_password: false },
    });
    if (updateErr) {
      setError(updateErr.message);
      setLoading(false);
      return;
    }

    await fetch("/api/auth/password-setup-complete", { method: "POST", credentials: "include" });

    setDone(true);
    setLoading(false);
    const destRes = await fetch("/api/auth/post-login", {
      method: "POST",
      credentials: "include",
    });
    const destBody = (await destRes.json().catch(() => ({}))) as { redirect?: string };
    const dest = destBody.redirect || "/admin";
    router.replace(dest.startsWith("http") ? "/admin" : dest);
    router.refresh();
  }

  if (!ready) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="flex-1 flex items-center justify-center px-4 py-16">
          <p className="text-sm text-muted">Loading…</p>
        </main>
      </div>
    );
  }

  if (!hasSession) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="flex-1 flex items-center justify-center px-4 py-16">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <CardTitle>Link expired or missing</CardTitle>
              <CardDescription>
                Open a fresh invite or password-reset link from your email, or request a new one on
                the sign-in page.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <Link href="/login" className="text-accent hover:underline text-sm">
                Back to sign in
              </Link>
            </CardContent>
          </Card>
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
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </CardHeader>
          <CardContent>
            {done ? (
              <p className="text-sm text-muted text-center">Password saved. Redirecting…</p>
            ) : (
              <form onSubmit={onSubmit} className="space-y-4">
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
                <div className="space-y-2">
                  <Label htmlFor="confirm">Confirm password</Label>
                  <Input
                    id="confirm"
                    type="password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                    minLength={8}
                    autoComplete="new-password"
                  />
                </div>
                {error && <p className="text-sm text-red-600">{error}</p>}
                <Button type="submit" variant="accent" className="w-full min-h-11" disabled={loading}>
                  {loading ? "Saving…" : isInvite ? "Save password & continue" : "Update password"}
                </Button>
                <p className="text-xs text-muted text-center">
                  You must set a password before opening the admin portal.
                </p>
              </form>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
