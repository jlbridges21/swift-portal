"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import type { ProjectShareRow } from "@/lib/project-shares";

export function ProjectSharesPanel({
  projectId,
  initialShares,
}: {
  projectId: string;
  initialShares: ProjectShareRow[];
}) {
  const [shares, setShares] = useState(initialShares);
  const [email, setEmail] = useState("");
  const [notify, setNotify] = useState(true);
  const [saving, setSaving] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  async function refresh() {
    const res = await fetch(`/api/projects/${projectId}/shares`, { credentials: "include" });
    if (!res.ok) return;
    const data = await res.json();
    setShares(data.shares ?? []);
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/shares`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: email.trim(), notify }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not add share");
      setEmail("");
      await refresh();
      const linked = data.results?.[0]?.linkedExistingUser;
      toast.success(
        notify
          ? linked
            ? "Share added — sign-in email sent to their existing account."
            : "Share added — passwordless sign-in link sent."
          : "Share added — no email sent."
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not add share");
    } finally {
      setSaving(false);
    }
  }

  async function handleRevoke(shareId: string) {
    setRevokingId(shareId);
    try {
      const res = await fetch(`/api/projects/${projectId}/shares/${shareId}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not revoke share");
      setShares((prev) => prev.filter((s) => s.id !== shareId));
      toast.success("Share removed — access revoked immediately.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not revoke share");
    } finally {
      setRevokingId(null);
    }
  }

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <UserPlus className="h-4 w-4" /> Share by email
        </CardTitle>
        <p className="text-sm text-muted">
          Invite specific people to view and download this project passwordlessly. They are not
          added as clients and cannot see invoices or other projects.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={handleAdd} className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="share-email">Email address</Label>
            <Input
              id="share-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="collaborator@example.com"
              required
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={notify}
              onChange={(e) => setNotify(e.target.checked)}
              className="rounded border-border"
            />
            Send email with a passwordless sign-in link
          </label>
          <Button type="submit" variant="accent" disabled={saving} className="min-h-11">
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Adding…
              </>
            ) : (
              "Add share"
            )}
          </Button>
        </form>

        {shares.length > 0 && (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {shares.map((share) => (
              <li
                key={share.id}
                className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{share.email}</p>
                  <p className="text-xs text-muted">
                    {share.notified_at ? "Notified" : "Added without email"}
                    {share.last_accessed_at
                      ? ` · Last viewed ${new Date(share.last_accessed_at).toLocaleDateString()}`
                      : ""}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-destructive shrink-0"
                  disabled={revokingId === share.id}
                  onClick={() => handleRevoke(share.id)}
                >
                  {revokingId === share.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
