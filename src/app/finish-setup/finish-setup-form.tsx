"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { suggestSlugFromName } from "@/lib/signup-validation";

export function FinishSetupForm({
  platformRootDomain,
  defaultOwnerName,
  email,
}: {
  platformRootDomain: string;
  defaultOwnerName: string;
  email: string;
}) {
  const [name, setName] = useState("");
  const [ownerName, setOwnerName] = useState(defaultOwnerName);
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
      const res = await fetch("/api/auth/finish-setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name, slug, ownerName }),
      });
      const data = (await res.json()) as {
        error?: string;
        message?: string;
        code?: string;
        requestId?: string;
        suggestion?: string;
        redirect?: string;
        portalUrl?: string;
      };
      if (!res.ok) {
        if (data.suggestion) {
          setSlug(data.suggestion);
          setSlugTouched(true);
        }
        if (data.code === "is_partner" && data.redirect) {
          window.location.assign(data.redirect);
          return;
        }
        throw new Error(data.message || data.error || "Could not finish setup");
      }
      const dest = data.redirect || data.portalUrl || "/onboarding";
      window.location.assign(dest);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not finish setup");
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1 flex items-center justify-center px-4 py-16">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>Finish setting up your studio</CardTitle>
            <CardDescription>
              You signed in with Google as {email}. Choose a name and subdomain for your
              ShootPortal, then continue to onboarding.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Studio name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  minLength={2}
                  maxLength={120}
                  placeholder="Acme Media"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ownerName">Your name</Label>
                <Input
                  id="ownerName"
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  required
                  placeholder="Jordan Lee"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="slug">Subdomain</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="slug"
                    value={slug}
                    onChange={(e) => {
                      setSlugTouched(true);
                      setSlug(e.target.value.toLowerCase());
                    }}
                    required
                    className="font-mono text-sm"
                  />
                  <span className="shrink-0 text-sm text-muted">.{platformRootDomain}</span>
                </div>
                {slugStatus && !slugStatus.ok && (
                  <p className="text-sm text-red-600">{slugStatus.error}</p>
                )}
                {slugStatus?.ok && (
                  <p className="text-sm text-muted">
                    {slugStatus.preview || `${slug}.${platformRootDomain}`}
                  </p>
                )}
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <Button type="submit" variant="accent" className="w-full min-h-11" disabled={busy}>
                {busy ? "Creating studio..." : "Create studio and continue"}
              </Button>

              <p className="text-center text-sm text-muted">
                Prefer email and password?{" "}
                <Link href="/signup" className="text-accent hover:underline">
                  Start a free trial
                </Link>
              </p>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
