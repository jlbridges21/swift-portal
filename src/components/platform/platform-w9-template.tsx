"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type TemplateRow = {
  id: string;
  revision_label: string;
  active: boolean;
  created_at: string;
};

export function PlatformW9Template({ templates }: { templates: TemplateRow[] }) {
  const router = useRouter();
  const [revision, setRevision] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const active = templates.find((row) => row.active) ?? null;

  async function upload(event: React.FormEvent) {
    event.preventDefault();
    if (!file) {
      setError("Choose the IRS W-9 PDF.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const body = new FormData();
      body.set("file", file);
      body.set("revision", revision);
      const res = await fetch("/api/platform/w9-template", { method: "POST", body, credentials: "include" });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(data?.error || "Upload failed.");
      setRevision("");
      setFile(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  async function rollback(id: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/platform/w9-template", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ id }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(data?.error || "Rollback failed.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Rollback failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Active form</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          {active ? (
            <p>
              {active.revision_label} · uploaded {new Date(active.created_at).toLocaleString()}
            </p>
          ) : (
            <p>No W-9 form is uploaded yet.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Upload a revision</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={upload}>
            <div className="space-y-2">
              <Label htmlFor="w9-revision">Revision label</Label>
              <Input
                id="w9-revision"
                value={revision}
                onChange={(e) => setRevision(e.target.value)}
                placeholder="Rev. March 2024"
                maxLength={40}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="w9-file">IRS PDF</Label>
              <Input
                id="w9-file"
                type="file"
                accept="application/pdf"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>
            {error ? <p className="text-sm text-red-700">{error}</p> : null}
            <Button type="submit" variant="accent" disabled={busy}>
              {busy ? "Working…" : "Upload"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Previous revisions</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3 text-sm">
            {templates.map((row) => (
              <li key={row.id} className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  {row.revision_label} · {new Date(row.created_at).toLocaleString()}
                  {row.active ? " · active" : ""}
                </span>
                {row.active ? null : (
                  <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => rollback(row.id)}>
                    Restore
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
