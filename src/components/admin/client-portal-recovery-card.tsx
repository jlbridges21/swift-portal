"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ClientPortalAccountStatus } from "@/lib/client-portal-recovery";

type Props = {
  clientId: string;
  clientEmail: string;
  initialStatus: ClientPortalAccountStatus;
};

function portalStatusBadge(accountStatus: ClientPortalAccountStatus["accountStatus"]) {
  if (accountStatus === "has_account") return <Badge variant="success">Portal account active</Badge>;
  if (accountStatus === "invited_unconfirmed") {
    return <Badge variant="warning">Invited — not confirmed</Badge>;
  }
  return <Badge variant="default">No portal account</Badge>;
}

export function ClientPortalRecoveryCard({ clientId, clientEmail, initialStatus: portalStatus }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [tempPasswordOnce, setTempPasswordOnce] = useState<string | null>(null);

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
    if (
      !window.confirm(
        `Generate a temporary password for ${clientEmail}? It will be shown once. The client must change it on first sign-in — you will not keep access to their account.`
      )
    ) {
      return;
    }
    const typed = window.prompt(
      'Type SET TEMP PASSWORD to confirm (you cannot choose the password).'
    );
    if (typed !== "SET TEMP PASSWORD") return;

    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/clients/${clientId}/portal-recovery`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set_temp_password", confirm: "SET TEMP PASSWORD" }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        temporaryPassword?: string;
      };
      if (!res.ok) throw new Error(data.error || "Could not set temporary password");
      if (data.temporaryPassword) {
        setTempPasswordOnce(data.temporaryPassword);
        setNotice("Temporary password generated. Copy it now — it will not be shown again.");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not set temporary password");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Portal access</CardTitle>
        <p className="text-sm text-muted">
          Restore this client&apos;s portal login without learning their password. Reset email is
          the safe default; temporary passwords force a change on first sign-in.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          {portalStatusBadge(portalStatus.accountStatus)}
          {portalStatus.mustChangePassword ? (
            <Badge variant="warning">Must change password on login</Badge>
          ) : null}
        </div>
        <p className="text-sm text-muted">{portalStatus.message}</p>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {notice ? <p className="text-sm text-green-700">{notice}</p> : null}

        {tempPasswordOnce ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm font-medium text-amber-900">Temporary password (shown once)</p>
            <p className="mt-2 break-all font-mono text-sm text-amber-950">{tempPasswordOnce}</p>
            <p className="mt-2 text-xs text-amber-800">
              Share this securely. The client must choose a new password before using the portal.
              It is not stored or logged anywhere after you dismiss this message.
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
            onClick={() => void setTempPassword()}
          >
            Set temporary password…
          </Button>
        </div>
        <p className="text-xs text-muted">
          Password reset uses your business portal origin and the prefetch-safe{" "}
          <code className="text-[11px]">/auth/confirm</code> flow. If they have no account yet,
          they receive the same invite path used elsewhere in ShootPortal.
        </p>
      </CardContent>
    </Card>
  );
}
