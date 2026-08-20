"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export function LoginForm({ showRequestLink }: { showRequestLink: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/dashboard";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const unavailable =
    searchParams.get("error") === "unavailable"
      ? "This portal is unavailable. Your business is suspended or no longer active."
      : "";
  const [error, setError] = useState(unavailable);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

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

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1 flex items-center justify-center px-4 py-16">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>Sign in</CardTitle>
            <CardDescription>
              Access your ShootPortal admin or client portal
            </CardDescription>
          </CardHeader>
          <CardContent>
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
            </form>

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
