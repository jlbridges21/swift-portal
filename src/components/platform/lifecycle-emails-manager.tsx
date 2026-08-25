"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export type LifecycleTemplateView = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  subject: string;
  body: string;
  is_active: boolean;
  send_offset_days: number;
  send_count: number;
  updated_at: string;
};

export type LifecycleSendView = {
  id: string;
  business_id: string;
  business_name: string;
  template_key: string;
  event_date: string;
  is_test: boolean;
  recipient: string;
  subject: string;
  created_at: string;
};

export type LifecycleBusinessOption = {
  id: string;
  name: string;
};

function timingLabel(offset: number): string {
  if (offset === 0) return "Day of event";
  if (offset < 0) return `${Math.abs(offset)} day${Math.abs(offset) === 1 ? "" : "s"} before`;
  return `${offset} day${offset === 1 ? "" : "s"} after`;
}

export function LifecycleEmailsManager({
  initialTemplates,
  initialRecent,
  businesses,
}: {
  initialTemplates: LifecycleTemplateView[];
  initialRecent: LifecycleSendView[];
  businesses: LifecycleBusinessOption[];
}) {
  const router = useRouter();
  const [templates, setTemplates] = useState(initialTemplates);
  const [recent, setRecent] = useState(initialRecent);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ subject: string; body: string } | null>(null);
  const [previewBusinessId, setPreviewBusinessId] = useState(businesses[0]?.id ?? "");
  const [testTo, setTestTo] = useState("");

  const editing = useMemo(
    () => templates.find((t) => t.id === editingId) ?? null,
    [templates, editingId]
  );

  async function refresh() {
    const res = await fetch("/api/platform/lifecycle-emails", { credentials: "include" });
    const data = (await res.json()) as {
      templates?: LifecycleTemplateView[];
      recent?: LifecycleSendView[];
      error?: string;
    };
    if (!res.ok) throw new Error(data.error || "Failed to reload");
    setTemplates(data.templates ?? []);
    setRecent(data.recent ?? []);
    router.refresh();
  }

  async function saveEdit(form: HTMLFormElement) {
    if (!editing) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    const fd = new FormData(form);
    try {
      const res = await fetch("/api/platform/lifecycle-emails", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editing.id,
          name: String(fd.get("name") ?? ""),
          description: String(fd.get("description") ?? ""),
          subject: String(fd.get("subject") ?? ""),
          body: String(fd.get("body") ?? ""),
          send_offset_days: Number(fd.get("send_offset_days") ?? 0),
          is_active: fd.get("is_active") === "on",
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Save failed");
      setNotice(`Saved ${editing.key}. Next cron run uses these values — no deploy needed.`);
      setEditingId(null);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function runPreview(overrides?: { subject: string; body: string }) {
    if (!editing || !previewBusinessId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/platform/lifecycle-emails/${editing.id}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "preview",
          businessId: previewBusinessId,
          subject: overrides?.subject,
          body: overrides?.body,
        }),
      });
      const data = (await res.json()) as {
        rendered?: { subject: string; body: string };
        error?: string;
      };
      if (!res.ok) throw new Error(data.error || "Preview failed");
      setPreview(data.rendered ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Preview failed");
    } finally {
      setBusy(false);
    }
  }

  async function runTestSend(form: HTMLFormElement) {
    if (!editing || !previewBusinessId) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    const fd = new FormData(form);
    try {
      const res = await fetch(`/api/platform/lifecycle-emails/${editing.id}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "test_send",
          businessId: previewBusinessId,
          to: testTo || String(fd.get("test_to") ?? ""),
          subject: String(fd.get("subject") ?? editing.subject),
          body: String(fd.get("body") ?? editing.body),
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        from?: string;
        subject?: string;
        note?: string;
      };
      if (!res.ok) throw new Error(data.error || "Test send failed");
      setNotice(
        `Test sent. From: ${data.from ?? "ShootPortal"}. Subject: ${data.subject}. ${data.note ?? ""}`
      );
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Test send failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-heading">Lifecycle emails</h1>
        <p className="mt-1 max-w-2xl text-muted">
          ShootPortal emails photography businesses about their own account (trial, payment,
          cancellation). Sends as ShootPortal — not the studio brand. Timing and copy are editable
          here; no deploy required.
        </p>
        <p className="mt-2 text-sm text-muted">
          Variables:{" "}
          <code className="text-xs">
            {"{{businessName}} {{daysRemaining}} {{trialEndDate}} {{planName}} {{planPrice}} {{billingUrl}} {{ownerName}}"}
            {" · Partner: {{partnerName}} {{commissionRatePct}} {{referralLink}} {{landingPageUrl}} {{partnerDashboardUrl}} {{inviteUrl}}"}
          </code>
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          {error}
        </div>
      )}
      {notice && (
        <div className="rounded-lg border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-slate-900">
          {notice}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Templates</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {templates.map((t) => (
            <div
              key={t.id}
              className="flex flex-wrap items-center justify-between gap-3 border-b border-border py-3 last:border-0"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium text-heading">{t.name}</p>
                  <Badge variant={t.is_active ? "success" : "warning"}>
                    {t.is_active ? "Active" : "Off"}
                  </Badge>
                  <Badge variant="default">{timingLabel(t.send_offset_days)}</Badge>
                </div>
                <p className="text-xs text-muted">
                  <code>{t.key}</code> · {t.send_count} real send{t.send_count === 1 ? "" : "s"}
                </p>
                <p className="truncate text-sm text-muted">{t.subject}</p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => setEditingId(t.id)}>
                Edit
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      {editing && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Edit · {editing.key}</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                void saveEdit(e.currentTarget);
              }}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="name">Name</Label>
                  <Input id="name" name="name" defaultValue={editing.name} required />
                </div>
                <div>
                  <Label htmlFor="send_offset_days">Offset days</Label>
                  <Input
                    id="send_offset_days"
                    name="send_offset_days"
                    type="number"
                    defaultValue={editing.send_offset_days}
                    required
                  />
                  <p className="mt-1 text-xs text-muted">Negative = before event, 0 = day of, positive = after.</p>
                </div>
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Input id="description" name="description" defaultValue={editing.description ?? ""} />
              </div>
              <div>
                <Label htmlFor="subject">Subject</Label>
                <Input id="subject" name="subject" defaultValue={editing.subject} required />
              </div>
              <div>
                <Label htmlFor="body">Body (plain text)</Label>
                <textarea
                  id="body"
                  name="body"
                  defaultValue={editing.body}
                  required
                  rows={10}
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="is_active" defaultChecked={editing.is_active} />
                Active (cron will send)
              </label>

              <div className="grid gap-4 rounded-lg border border-border bg-subtle/40 p-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="preview_business">Preview / test business</Label>
                  <select
                    id="preview_business"
                    className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                    value={previewBusinessId}
                    onChange={(e) => setPreviewBusinessId(e.target.value)}
                  >
                    {businesses.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label htmlFor="test_to">Test send to</Label>
                  <Input
                    id="test_to"
                    name="test_to"
                    type="email"
                    placeholder="you@example.com"
                    value={testTo}
                    onChange={(e) => setTestTo(e.target.value)}
                  />
                </div>
              </div>

              {preview && (
                <div className="rounded-lg border border-border bg-card p-4 text-sm">
                  <p className="font-semibold text-heading">Preview subject</p>
                  <p className="mt-1">{preview.subject}</p>
                  <p className="mt-4 font-semibold text-heading">Preview body</p>
                  <pre className="mt-1 whitespace-pre-wrap font-sans text-muted">{preview.body}</pre>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <Button type="submit" disabled={busy}>
                  Save
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy || !previewBusinessId}
                  onClick={(e) => {
                    const form = (e.currentTarget as HTMLButtonElement).form;
                    if (!form) return;
                    const fd = new FormData(form);
                    void runPreview({
                      subject: String(fd.get("subject") ?? ""),
                      body: String(fd.get("body") ?? ""),
                    });
                  }}
                >
                  Preview
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy || !previewBusinessId || !testTo}
                  onClick={(e) => {
                    const form = (e.currentTarget as HTMLButtonElement).form;
                    if (form) void runTestSend(form);
                  }}
                >
                  Send test
                </Button>
                <Button type="button" variant="ghost" onClick={() => setEditingId(null)}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent sends</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {recent.length === 0 && <p className="text-sm text-muted">No sends yet.</p>}
          {recent.map((r) => (
            <div key={r.id} className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border py-2 text-sm last:border-0">
              <div>
                <span className="font-medium text-heading">{r.business_name}</span>
                <span className="text-muted"> · </span>
                <code className="text-xs">{r.template_key}</code>
                {r.is_test && (
                  <Badge className="ml-2" variant="warning">
                    TEST
                  </Badge>
                )}
                <p className="text-muted">{r.subject}</p>
                <p className="text-xs text-muted">→ {r.recipient}</p>
              </div>
              <p className="text-xs text-muted">{new Date(r.created_at).toLocaleString()}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
