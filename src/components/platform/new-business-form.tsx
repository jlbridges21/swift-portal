"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatPlanPrice, type PlanRow } from "@/lib/plan-catalog";

export function NewBusinessForm({ plans }: { plans: PlanRow[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    portalUrl: string;
    adminEmail: string;
    stagesNote: string;
    businessId?: string;
    inviteSent?: boolean;
    inviteError?: string | null;
    attachedExisting?: boolean;
  } | null>(null);

  const defaultPlan = plans.find((p) => p.key === "studio")?.key ?? plans[0]?.key ?? "studio";

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    try {
      const res = await fetch("/api/platform/businesses", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.get("name"),
          slug: form.get("slug"),
          customDomain: form.get("customDomain") || null,
          plan: form.get("plan") || defaultPlan,
          adminEmail: form.get("adminEmail"),
          adminName: form.get("adminName") || undefined,
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        portalUrl?: string;
        adminEmail?: string;
        stagesNote?: string;
        businessId?: string;
        inviteSent?: boolean;
        inviteError?: string | null;
        attachedExisting?: boolean;
      };
      if (!res.ok) throw new Error(data.error || "Failed to create business");
      setResult({
        portalUrl: data.portalUrl || "",
        adminEmail: data.adminEmail || "",
        stagesNote: data.stagesNote || "",
        businessId: data.businessId,
        inviteSent: data.inviteSent,
        inviteError: data.inviteError,
        attachedExisting: data.attachedExisting,
      });
      if (data.businessId) {
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create business");
    } finally {
      setBusy(false);
    }
  }

  if (result) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Business created</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {result.attachedExisting && (
            <p className="rounded-lg border border-sky-300 bg-sky-50 px-3 py-2 text-sky-950">
              That email already had an account with no business. It was attached as this
              business&apos;s admin
              {result.inviteSent
                ? " — they can sign in (check email if still unconfirmed)."
                : " — but the invite/confirmation email failed; use Resend invite."}
            </p>
          )}
          {!result.attachedExisting && result.inviteSent === false && (
            <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-amber-950">
              Business created, but the invite email failed to send — resend it from the business
              page.
              {result.inviteError ? ` (${result.inviteError})` : ""}
            </p>
          )}
          {!result.attachedExisting && result.inviteError && result.inviteSent === false && result.inviteError.includes("already belongs") && (
            <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-amber-950">
              {result.inviteError}
            </p>
          )}
          <p>
            Send this portal URL to the pilot:{" "}
            <a className="font-medium text-accent underline" href={result.portalUrl}>
              {result.portalUrl}
            </a>
          </p>
          <p>Admin invite: {result.adminEmail}</p>
          <p className="text-muted">{result.stagesNote}</p>
          <div className="flex flex-wrap gap-2">
            {result.businessId && (
              <Button type="button" onClick={() => router.push(`/platform/businesses/${result.businessId}`)}>
                Open business
              </Button>
            )}
            <Button type="button" variant="outline" onClick={() => router.push("/platform")}>
              Back to dashboard
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create a business</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={onSubmit}>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div>
            <Label htmlFor="name">Business name</Label>
            <Input id="name" name="name" required className="mt-1" />
          </div>
          <div>
            <Label htmlFor="slug">Slug</Label>
            <Input id="slug" name="slug" required placeholder="acme-media" className="mt-1" />
            <p className="mt-1 text-xs text-muted">Becomes {`{slug}.shootportal.app`}. Reserved labels are rejected.</p>
          </div>
          <div>
            <Label htmlFor="customDomain">Custom domain (optional)</Label>
            <Input id="customDomain" name="customDomain" placeholder="portal.example.com" className="mt-1" />
            <p className="mt-1 text-xs text-muted">Requires a plan that includes custom domain (Studio+).</p>
          </div>
          <div>
            <Label htmlFor="plan">Plan</Label>
            <select
              id="plan"
              name="plan"
              required
              defaultValue={defaultPlan}
              className="mt-1 flex h-11 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm"
            >
              {plans.map((plan) => (
                <option key={plan.id} value={plan.key}>
                  {plan.name} — {formatPlanPrice(plan.price_monthly_cents)}/mo
                  {plan.key === "studio" ? " (recommended)" : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="adminEmail">First admin email</Label>
            <Input id="adminEmail" name="adminEmail" type="email" required className="mt-1" />
          </div>
          <div>
            <Label htmlFor="adminName">Admin display name (optional)</Label>
            <Input id="adminName" name="adminName" className="mt-1" />
          </div>
          <Button type="submit" disabled={busy || plans.length === 0}>
            {busy ? "Creating…" : "Create business"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
