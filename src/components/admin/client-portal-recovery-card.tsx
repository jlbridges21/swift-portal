"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PortalAccessStatus, type PortalAccessSnapshot } from "@/components/admin/portal-access-status";
import type { ClientPortalAccountStatus } from "@/lib/client-portal-recovery";

type Props = {
  clientId: string;
  clientEmail: string;
  initialStatus: ClientPortalAccountStatus;
};

export function ClientPortalRecoveryCard({ clientId, clientEmail, initialStatus: portalStatus }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [tempPasswordOnce, setTempPasswordOnce] = useState<{ password: string; email: string } | null>(
    null
  );
  const [confirmTempOpen, setConfirmTempOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [access, setAccess] = useState<PortalAccessSnapshot | null>(null);
  const isActive = access ? access.state === "active" : portalStatus.accountStatus === "has_account";

  async function sendReset() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/clients/${clientId}/portal-recovery`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send_reset" }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        path?: string;
      };
      if (!res.ok) throw new Error(data.error || "Could not send reset email");
      const pathLabel =
        data.path === "password_reset_email"
          ? "password reset email (confirmed account)"
          : "portal invite email (new or unconfirmed account)";
      setNotice(`Email sent to ${clientEmail} via ${pathLabel}.`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send reset email");
    } finally {
      setBusy(false);
    }
  }

  async function setTempPassword() {
    setBusy(true);
    setError(null);
    setNotice(null);
    setTempPasswordOnce(null);
    setCopied(false);
    try {
      const res = await fetch(`/api/clients/${clientId}/portal-recovery`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        // The dialog is the confirmation; the server still requires the phrase.
        body: JSON.stringify({ action: "set_temp_password", confirm: "SET TEMP PASSWORD" }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        temporaryPassword?: string;
        email?: string;
      };
      if (!res.ok) throw new Error(data.error || "Could not set temporary password");
      if (!data.temporaryPassword) throw new Error("No temporary password was returned. Try again.");
      setTempPasswordOnce({ password: data.temporaryPassword, email: data.email || clientEmail });
      setNotice("Temporary password set. Copy it now — it will not be shown again.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not set temporary password");
    } finally {
      setBusy(false);
      setConfirmTempOpen(false);
    }
  }

  async function copyTempPassword() {
    if (!tempPasswordOnce) return;
    try {
      await navigator.clipboard.writeText(tempPasswordOnce.password);
      setCopied(true);
    } catch {
      setError("Could not copy — select the password and copy it manually.");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Portal access</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <PortalAccessStatus clientId={clientId} variant="full" onChange={setAccess} />
        {isActive && portalStatus.mustChangePassword ? (
          <Badge variant="warning">Must change password on login</Badge>
        ) : null}

        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {notice ? <p className="text-sm text-green-700">{notice}</p> : null}

        {tempPasswordOnce ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm font-medium text-amber-900">Temporary password (shown once)</p>
            <p className="mt-1 text-xs text-amber-800">
              Sign-in email: <span className="font-medium">{tempPasswordOnce.email}</span>
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <code className="select-all break-all rounded-md border border-amber-200 bg-white px-3 py-2 font-mono text-base tracking-wide text-amber-950">
                {tempPasswordOnce.password}
              </code>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="min-h-10"
                onClick={() => void copyTempPassword()}
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
            <p className="mt-2 text-xs text-amber-800">
              Share this securely. It is case-sensitive. The client signs in at the portal login
              page and must choose a new password before using the portal. It is not stored or
              logged anywhere after you dismiss this message.
            </p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="mt-2"
              onClick={() => setTempPasswordOnce(null)}
            >
              Dismiss
            </Button>
          </div>
        ) : null}

        {isActive ? (
          <div className="space-y-3 border-t border-border pt-4">
            <p className="text-sm text-muted">
              Locked out? Restore access without learning their password. The reset email is the safe default;
              temporary passwords force a change on first sign-in.
            </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Button
            type="button"
            variant="accent"
            className="min-h-11"
            disabled={busy}
            onClick={() => void sendReset()}
          >
            Send password reset email
          </Button>
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            disabled={busy}
            onClick={() => setConfirmTempOpen(true)}
          >
            Set temporary password…
          </Button>
        </div>
          </div>
        ) : null}
        <ConfirmDialog
          open={confirmTempOpen}
          onClose={() => setConfirmTempOpen(false)}
          onConfirm={() => void setTempPassword()}
          title="Set a temporary password?"
          confirmLabel="Generate password"
          busy={busy}
        >
          <p>
            ShootPortal will generate a random password for{" "}
            <span className="font-medium">{clientEmail}</span> and show it to you once. You
            can&apos;t choose it.
          </p>
          <p className="text-muted">
            Their current password stops working. On first sign-in they must choose a new one, so
            you won&apos;t keep access to their account. The reset email is usually the better
            option.
          </p>
        </ConfirmDialog>
      </CardContent>
    </Card>
  );
}
