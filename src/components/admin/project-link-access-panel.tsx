"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Link2, Copy, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import type { ProjectLinkAccessMode } from "@/lib/project-link-access";

export function ProjectLinkAccessPanel({
  projectId,
  initialMode,
  initialPublicUrl,
  initialViewCount,
}: {
  projectId: string;
  initialMode: ProjectLinkAccessMode;
  initialPublicUrl: string | null;
  initialViewCount: number;
}) {
  const [mode, setMode] = useState(initialMode);
  const [publicUrl, setPublicUrl] = useState(initialPublicUrl);
  const [viewCount, setViewCount] = useState(initialViewCount);
  const [saving, setSaving] = useState(false);
  const [rotating, setRotating] = useState(false);

  async function setLinkMode(next: ProjectLinkAccessMode) {
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/link-access`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ mode: next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not update link access");
      setMode(data.mode);
      setPublicUrl(data.publicUrl ?? null);
      setViewCount(data.viewCount ?? viewCount);
      toast.success(
        next === "anyone_with_link"
          ? "Anyone with the link can view and download."
          : "Link restricted — anonymous access blocked immediately."
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    } finally {
      setSaving(false);
    }
  }

  async function copyLink() {
    if (!publicUrl) return;
    await navigator.clipboard.writeText(publicUrl);
    toast.success("Link copied");
  }

  async function rotateLink() {
    if (
      !window.confirm(
        "Generate a new link? Every previously shared URL will stop working immediately. Email shares and assigned clients are unaffected."
      )
    ) {
      return;
    }
    setRotating(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/link-access/rotate`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not rotate link");
      setPublicUrl(data.publicUrl ?? null);
      toast.success("New link generated — old anonymous URLs are invalid");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Rotation failed");
    } finally {
      setRotating(false);
    }
  }

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Link2 className="h-4 w-4" /> General access
        </CardTitle>
        <p className="text-sm text-muted">
          Like Google Drive: Restricted limits access to your team, assigned client, and email
          shares. Anyone with link allows anonymous view and download (comments still require
          sign-in).
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant={mode === "restricted" ? "accent" : "outline"}
            size="sm"
            disabled={saving || mode === "restricted"}
            onClick={() => setLinkMode("restricted")}
          >
            Restricted
          </Button>
          <Button
            type="button"
            variant={mode === "anyone_with_link" ? "accent" : "outline"}
            size="sm"
            disabled={saving || mode === "anyone_with_link"}
            onClick={() => setLinkMode("anyone_with_link")}
          >
            Anyone with link
          </Button>
          {saving && <Loader2 className="h-4 w-4 animate-spin text-muted" />}
        </div>

        {mode === "anyone_with_link" && publicUrl && (
          <div className="space-y-2">
            <div className="flex gap-2">
              <input
                readOnly
                value={publicUrl}
                className="flex-1 min-w-0 rounded-md border border-border bg-muted/30 px-3 py-2 text-xs font-mono"
              />
              <Button type="button" variant="outline" size="sm" onClick={() => void copyLink()}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted">
              Anonymous link views (not identifiable): {viewCount.toLocaleString()}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={rotating || saving}
              onClick={() => void rotateLink()}
            >
              {rotating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Generate new link"}
            </Button>
            <p className="text-xs text-muted">
              Rotating invalidates every previously copied anonymous URL. Use this after a link
              leak — switching to Restricted blocks access without changing the URL.
            </p>
          </div>
        )}

        <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50/80 p-3 text-xs text-amber-900">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <p>
            Once this link is public and forwarded, the only way to stop anonymous access is
            switching back to <strong>Restricted</strong> — that also removes access for everyone
            using the link (email shares and clients are unaffected). There is no per-link
            revocation. Signed media URLs already issued expire in 30 minutes.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
