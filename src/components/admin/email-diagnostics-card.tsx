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
      if (!res.ok) throw new Error(data.error || "Failed to load email diagnostics");
      setConfig(data.config as EmailDiagnostics);
      setLastSend((data.lastSend as LastSend | null) ?? null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load email diagnostics");
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
    <Card className="shadow-sm border-0">
      <CardHeader className="px-0 pt-0">
        <CardTitle className="text-base">This business&apos;s email diagnostics</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 px-0">
        {loading || !config ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : (
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted">Sending</dt>
              <dd>{config.sendingConfigured ? "Configured" : "Not configured"}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted">Webhook</dt>
              <dd>{config.webhookConfigured ? "Configured" : "Not configured"}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted">Sender mode</dt>
              <dd>{config.senderMode}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted">Domain status</dt>
              <dd>{config.domainVerificationStatus}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs uppercase tracking-wide text-muted">From</dt>
              <dd className="font-mono text-xs break-all">{config.resolvedFrom}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs uppercase tracking-wide text-muted">Reply-To</dt>
              <dd className="font-mono text-xs break-all">{config.resolvedReplyTo || "—"}</dd>
            </div>
            {config.customDomain ? (
              <div className="sm:col-span-2">
                <dt className="text-xs uppercase tracking-wide text-muted">Custom domain</dt>
                <dd>{config.customDomain}</dd>
              </div>
            ) : null}
          </dl>
        )}

        {lastSend ? (
          <p className="text-xs text-muted">
            Last send for this business: {lastSend.sent ? "sent" : "failed"}
            {lastSend.subject ? ` — ${lastSend.subject}` : ""} at {lastSend.at}
            {lastSend.error ? ` (${lastSend.error})` : ""}
          </p>
        ) : (
          <p className="text-xs text-muted">No send recorded for this business in this server process.</p>
        )}

        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
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
