"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Mail, RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface EmailDiagnostics {
  config: {
    resendApiKeyPresent: boolean;
    resendFromEmailPresent: boolean;
    resendWebhookSecretPresent?: boolean;
    fromEmail: string;
    environment: string;
    appUrl: string | null;
  };
  clientPrefs: {
    found: boolean;
    email: string | null;
    email_notifications_enabled: boolean;
    in_app_notifications_enabled: boolean;
    note?: string;
  };
  lastSend: {
    sent: boolean;
    skipped: boolean;
    skipReason: string | null;
    error: string | null;
    messageId: string | null;
    to: string | null;
    subject: string | null;
    at: string;
  } | null;
}

export function EmailDiagnosticsCard() {
  const [diagnostics, setDiagnostics] = useState<EmailDiagnostics | null>(null);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [lookupEmail, setLookupEmail] = useState("");

  const refreshDiagnostics = useCallback(async (clientEmail?: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (clientEmail?.trim()) params.set("client_email", clientEmail.trim());
      const qs = params.toString();
      const res = await fetch(`/api/admin/email${qs ? `?${qs}` : ""}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load email diagnostics");
      setDiagnostics(await res.json());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load email diagnostics");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshDiagnostics();
  }, [refreshDiagnostics]);

  async function handleTestEmail() {
    const email = testEmail.trim();
    if (!email) {
      toast.error("Enter a test email address");
      return;
    }

    setTesting(true);
    try {
      const res = await fetch("/api/admin/email", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "test", email }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || data.detail || "Failed to send test email");
      }

      toast.success(`Test email sent to ${email}`);
      await refreshDiagnostics(lookupEmail || undefined);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to send test email";
      toast.error(message);
      await refreshDiagnostics(lookupEmail || undefined);
    } finally {
      setTesting(false);
    }
  }

  const config = diagnostics?.config;
  const lastSend = diagnostics?.lastSend;
  const clientPrefs = diagnostics?.clientPrefs;

  return (
    <Card className="mb-10 border-blue-100 bg-gradient-to-br from-blue-50/40 to-white">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Mail className="h-5 w-5 text-accent" />
          Email Notifications (Resend)
        </CardTitle>
        <CardDescription>
          Diagnose client email delivery and send a test message. Secrets are never shown here.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {loading && !diagnostics ? (
          <div className="flex items-center gap-2 text-sm text-muted">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading email diagnostics…
          </div>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 text-sm">
              <div className="rounded-lg border border-border bg-white/80 px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-muted">RESEND_API_KEY</p>
                <p className="mt-1 font-medium text-primary">
                  {config?.resendApiKeyPresent ? "Present" : "Missing"}
                </p>
              </div>
              <div className="rounded-lg border border-border bg-white/80 px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-muted">RESEND_FROM_EMAIL</p>
                <p className="mt-1 font-medium text-primary">
                  {config?.resendFromEmailPresent ? "Present" : "Using default"}
                </p>
                <p className="text-xs text-muted mt-1 break-all">{config?.fromEmail}</p>
              </div>
              <div className="rounded-lg border border-border bg-white/80 px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-muted">Environment</p>
                <p className="mt-1 font-medium text-primary capitalize">{config?.environment}</p>
              </div>
              <div className="rounded-lg border border-border bg-white/80 px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-muted">App URL</p>
                <p className="mt-1 font-medium text-primary break-all">{config?.appUrl || "Not set"}</p>
              </div>
              <div className="rounded-lg border border-border bg-white/80 px-4 py-3 sm:col-span-2">
                <p className="text-xs uppercase tracking-wide text-muted">RESEND_WEBHOOK_SECRET</p>
                <p className="mt-1 font-medium text-primary">
                  {config?.resendWebhookSecretPresent ? "Present" : "Missing — analytics webhooks disabled"}
                </p>
                <p className="text-xs text-muted mt-1">Endpoint: /api/resend/webhook</p>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-white/80 px-4 py-3 space-y-3">
              <p className="text-sm font-medium text-primary">Client preference lookup</p>
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  placeholder="Client email to inspect"
                  value={lookupEmail}
                  onChange={(e) => setLookupEmail(e.target.value)}
                />
                <Button
                  variant="outline"
                  className="shrink-0"
                  onClick={() => refreshDiagnostics(lookupEmail)}
                  disabled={loading}
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  Check Client
                </Button>
              </div>
              {clientPrefs && lookupEmail.trim() ? (
                <div className="text-sm text-muted space-y-1">
                  <p>
                    Email notifications:{" "}
                    <span className="font-medium text-primary">
                      {clientPrefs.email_notifications_enabled ? "Enabled" : "Disabled"}
                    </span>
                  </p>
                  <p>
                    In-app notifications:{" "}
                    <span className="font-medium text-primary">
                      {clientPrefs.in_app_notifications_enabled ? "Enabled" : "Disabled"}
                    </span>
                  </p>
                  {clientPrefs.email ? (
                    <p>
                      Client email: <span className="font-medium text-primary">{clientPrefs.email}</span>
                    </p>
                  ) : null}
                  {clientPrefs.note ? <p className="text-amber-700">{clientPrefs.note}</p> : null}
                </div>
              ) : (
                <p className="text-xs text-muted">Enter a client email to verify notification preferences.</p>
              )}
            </div>

            <div className="rounded-lg border border-border bg-white/80 px-4 py-3 text-sm">
              <p className="font-medium text-primary mb-2">Last email send (this server instance)</p>
              {!lastSend ? (
                <p className="text-muted">No email attempts recorded yet in this runtime.</p>
              ) : (
                <div className="space-y-1 text-muted">
                  <p>
                    Status:{" "}
                    <span
                      className={
                        lastSend.sent
                          ? "font-medium text-emerald-700"
                          : lastSend.skipped
                            ? "font-medium text-amber-700"
                            : "font-medium text-red-700"
                      }
                    >
                      {lastSend.sent ? "Sent" : lastSend.skipped ? "Skipped" : "Failed"}
                    </span>
                  </p>
                  {lastSend.to ? <p>To: {lastSend.to}</p> : null}
                  {lastSend.subject ? <p>Subject: {lastSend.subject}</p> : null}
                  {lastSend.messageId ? <p>Resend ID: {lastSend.messageId}</p> : null}
                  {lastSend.skipReason ? <p>Skip reason: {lastSend.skipReason}</p> : null}
                  {lastSend.error ? <p className="text-red-700 break-words">Error: {lastSend.error}</p> : null}
                  <p className="text-xs">At: {new Date(lastSend.at).toLocaleString()}</p>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="test-email">Send test email</Label>
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  id="test-email"
                  type="email"
                  placeholder="you@example.com"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                />
                <Button variant="accent" className="shrink-0 min-h-11" onClick={handleTestEmail} disabled={testing}>
                  {testing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Sending…
                    </>
                  ) : (
                    "Send Test Email"
                  )}
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
