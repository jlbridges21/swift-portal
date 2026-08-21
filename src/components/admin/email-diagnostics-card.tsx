"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Send } from "lucide-react";

interface EmailDiagnostics {
  sendingConfigured: boolean;
  webhookConfigured: boolean;
  senderMode: string;
  domainVerificationStatus: string;
  customDomain: string;
  resolvedFrom: string;
  resolvedReplyTo: string | null;
}

interface LastSend {
  sent: boolean;
  skipped?: boolean;
  skipReason?: string | null;
  error?: string | null;
  messageId?: string | null;
  to?: string | null;
  subject?: string | null;
  at: string;
}

function senderModeLabel(mode: string): string {
  if (mode === "custom_domain") return "Your domain";
  return "ShootPortal shared sending";
}

function domainStatusLabel(status: string): string {
  if (status === "verified") return "Verified";
  if (status === "pending") return "Waiting on DNS";
  if (status === "failed") return "Needs attention";
  return status || "Not started";
}

export function EmailDiagnosticsCard() {
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<EmailDiagnostics | null>(null);
  const [lastSend, setLastSend] = useState<LastSend | null>(null);
  const [testTo, setTestTo] = useState("");
  const [sending, setSending] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/email", { credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load email status");
      setConfig(data.config as EmailDiagnostics);
      setLastSend((data.lastSend as LastSend | null) ?? null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load email status");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function sendTest() {
    setSending(true);
    try {
      const res = await fetch("/api/admin/email", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "test", email: testTo || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Test email failed");
      toast.success("Test email sent");
      setLastSend((data.lastSend as LastSend) ?? null);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Test email failed");
    } finally {
      setSending(false);
    }
  }

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Email delivery check</CardTitle>
        <p className="text-sm font-normal text-muted">
          Confirm how client emails leave your portal, then send yourself a quick test.
        </p>
      </CardHeader>
      <CardContent className="space-y-4 pt-2">
        {loading || !config ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : (
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted">Sending ready</dt>
              <dd className="mt-0.5">{config.sendingConfigured ? "Yes" : "Not yet"}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted">Delivery tracking</dt>
              <dd className="mt-0.5">{config.webhookConfigured ? "On" : "Off"}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted">Sending as</dt>
              <dd className="mt-0.5">{senderModeLabel(config.senderMode)}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted">Custom domain</dt>
              <dd className="mt-0.5">{domainStatusLabel(config.domainVerificationStatus)}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs font-medium uppercase tracking-wide text-muted">From address</dt>
              <dd className="mt-0.5 break-all text-sm">{config.resolvedFrom}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs font-medium uppercase tracking-wide text-muted">Replies go to</dt>
              <dd className="mt-0.5 break-all text-sm">{config.resolvedReplyTo || "—"}</dd>
            </div>
            {config.customDomain ? (
              <div className="sm:col-span-2">
                <dt className="text-xs font-medium uppercase tracking-wide text-muted">Your sending domain</dt>
                <dd className="mt-0.5">{config.customDomain}</dd>
              </div>
            ) : null}
          </dl>
        )}

        {lastSend ? (
          <p className="text-xs text-muted">
            Last test: {lastSend.sent ? "sent" : "failed"}
            {lastSend.subject ? ` — ${lastSend.subject}` : ""} at {lastSend.at}
            {lastSend.error ? ` (${lastSend.error})` : ""}
          </p>
        ) : (
          <p className="text-xs text-muted">No test email recorded yet for this portal.</p>
        )}

        <div className="flex flex-col gap-2 border-t border-border pt-4 sm:flex-row sm:items-end">
          <div className="space-y-2 flex-1">
            <Label htmlFor="testEmail">Send a test email</Label>
            <Input
              id="testEmail"
              type="email"
              placeholder="you@example.com"
              value={testTo}
              onChange={(e) => setTestTo(e.target.value)}
            />
          </div>
          <Button type="button" variant="outline" onClick={() => void sendTest()} disabled={sending}>
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Send test
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
