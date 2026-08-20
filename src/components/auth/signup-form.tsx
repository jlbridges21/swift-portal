"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { suggestSlugFromName } from "@/lib/signup-validation";

export function SignupForm({ platformRootDomain }: { platformRootDomain: string }) {
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
  const [done, setDone] = useState<{ message: string; portalUrl: string } | null>(null);

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
        body: JSON.stringify({ name, slug, email, password, ownerName }),
      });
      const data = (await res.json()) as {
        error?: string;
        suggestion?: string;
        message?: string;
        portalUrl?: string;
      };
      if (!res.ok) {
        if (data.suggestion) {
          setSlug(data.suggestion);
          setSlugTouched(true);
        }
        throw new Error(data.error || "Signup failed");
      }
      setDone({
        message: data.message || "Check your email to confirm your account.",
        portalUrl: data.portalUrl || "",
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
              <CardTitle>Confirm your email</CardTitle>
              <CardDescription>{done.message}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              {done.portalUrl && (
                <p className="text-muted">
                  After confirming, your portal will be{" "}
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
            <CardTitle>Start your free trial</CardTitle>
            <CardDescription>30 days on Studio — no credit card required.</CardDescription>
          </CardHeader>
          <CardContent>
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
              <Button type="submit" variant="accent" className="w-full min-h-11" disabled={busy}>
                {busy ? "Creating…" : "Create account"}
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
