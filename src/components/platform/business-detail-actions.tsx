"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Admin = { id: string; email: string; full_name: string | null };

export function BusinessDetailActions({
  business,
  admins,
  settingsJson,
  isProtected,
}: {
  business: {
    id: string;
    name: string;
    slug: string;
    custom_domain: string | null;
    plan: string;
    status: string;
    deleted_at: string | null;
  };
  admins: Admin[];
  settingsJson: string;
  isProtected: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const protectedBiz = isProtected;

  async function post(path: string, body?: unknown) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(path, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : "{}",
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; redirect?: string };
      if (!res.ok) throw new Error(data.error || "Request failed");
      if (data.redirect) {
        router.push(data.redirect);
        router.refresh();
        return data;
      }
      router.refresh();
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function saveIdentity(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/platform/businesses/${business.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.get("name"),
          slug: form.get("slug"),
          customDomain: form.get("customDomain"),
          plan: form.get("plan"),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Save failed");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {error && <p className="text-sm text-red-600">{error}</p>}

      <Card>
        <CardHeader>
          <CardTitle>Identity</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={saveIdentity}>
            <div>
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" defaultValue={business.name} className="mt-1" />
            </div>
            <div>
              <Label htmlFor="slug">Slug</Label>
              <Input id="slug" name="slug" defaultValue={business.slug} className="mt-1" />
            </div>
            <div>
              <Label htmlFor="customDomain">Custom domain</Label>
              <Input
                id="customDomain"
                name="customDomain"
                defaultValue={business.custom_domain ?? ""}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="plan">Plan</Label>
              <Input id="plan" name="plan" defaultValue={business.plan} className="mt-1" />
            </div>
            <Button type="submit" disabled={busy}>
              Save
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Access</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button
            type="button"
            disabled={busy || Boolean(business.deleted_at)}
            onClick={() => void post("/api/platform/impersonate", { action: "start", businessId: business.id })}
          >
            View as this business
          </Button>
          {business.status !== "suspended" ? (
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => {
                if (window.confirm(`Suspend ${business.name}? Admins and clients will be signed out.`)) {
                  void post(`/api/platform/businesses/${business.id}/suspend`);
                }
              }}
            >
              Suspend
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => void post(`/api/platform/businesses/${business.id}/reactivate`)}
            >
              Reactivate
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            disabled={busy || protectedBiz || Boolean(business.deleted_at)}
            onClick={() => {
              if (window.confirm("Soft-delete this business? Client data is kept. Login is blocked.")) {
                void post(`/api/platform/businesses/${business.id}/delete`);
              }
            }}
          >
            Soft-delete
          </Button>
          <Button
            type="button"
            variant="outline"
            className="border-red-300 text-red-700"
            disabled={busy || protectedBiz}
            onClick={() => {
              const typed = window.prompt(
                `Hard-delete ${business.name}? This removes CRM data. Type DELETE to confirm.`
              );
              if (typed === "DELETE") {
                void post(`/api/platform/businesses/${business.id}/hard-delete`, { confirm: "DELETE" });
              }
            }}
          >
            Hard-delete
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Admins</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ul className="space-y-2 text-sm">
            {admins.length === 0 && <li className="text-muted">No admin profiles yet.</li>}
            {admins.map((admin) => (
              <li key={admin.id} className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  {admin.full_name || "Admin"} — {admin.email}
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() =>
                    void post(`/api/platform/businesses/${business.id}/invite`, {
                      email: admin.email,
                      fullName: admin.full_name,
                      resend: true,
                    })
                  }
                >
                  Resend invite
                </Button>
              </li>
            ))}
          </ul>
          <form
            className="flex flex-wrap items-end gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              void post(`/api/platform/businesses/${business.id}/invite`, {
                email: form.get("email"),
                fullName: form.get("fullName"),
              });
              event.currentTarget.reset();
            }}
          >
            <div>
              <Label htmlFor="inviteEmail">Invite admin</Label>
              <Input id="inviteEmail" name="email" type="email" required className="mt-1" />
            </div>
            <div>
              <Label htmlFor="inviteName">Name</Label>
              <Input id="inviteName" name="fullName" className="mt-1" />
            </div>
            <Button type="submit" disabled={busy}>
              Invite
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Settings (read-only)</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="max-h-[480px] overflow-auto rounded-lg bg-subtle p-4 text-xs">{settingsJson}</pre>
        </CardContent>
      </Card>
    </div>
  );
}
