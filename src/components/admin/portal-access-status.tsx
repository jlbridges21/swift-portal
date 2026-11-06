"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { Check, Copy, Loader2, Mail, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PortalAccessState } from "@/lib/portal-activation";

export type PortalAccessSnapshot = {
  state: PortalAccessState;
  lastInviteSentAt: string | null;
  email: string | null;
  foreign: boolean;
};

type Props = {
  clientId: string;
  /** Invite links land on this project when the client is on it. */
  projectId?: string | null;
  variant?: "compact" | "full";
  initial?: PortalAccessSnapshot | null;
  /** Called after state changes (e.g. to refresh recovery actions). */
  onChange?: (snapshot: PortalAccessSnapshot) => void;
  className?: string;
};

const LABELS: Record<PortalAccessState, string> = {
  active: "Portal Access Active",
  not_activated: "Portal Not Activated",
  invite_sent: "Portal Invite Sent",
};

export function PortalAccessBadge({ state }: { state: PortalAccessState }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
        state === "active" && "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
        state === "not_activated" && "bg-amber-50 text-amber-800 ring-1 ring-amber-200",
        state === "invite_sent" && "bg-sky-50 text-sky-800 ring-1 ring-sky-200"
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          state === "active" && "bg-emerald-500",
          state === "not_activated" && "bg-amber-500",
          state === "invite_sent" && "bg-sky-500"
        )}
        aria-hidden
      />
      {LABELS[state]}
    </span>
  );
}

function sentAgo(iso: string | null): string | null {
  if (!iso) return null;
  try {
    return `Last sent ${formatDistanceToNow(new Date(iso), { addSuffix: true })}`;
  } catch {
    return null;
  }
}

/**
 * Portal access for one client: Active (green) · Not Activated (amber, Send
 * Portal Invite + Copy Invite Link) · Invite Sent (last sent, Resend + Copy).
 * Re-checks on window focus so it flips to Active once the client activates.
 */
export function PortalAccessStatus({
  clientId,
  projectId,
  variant = "compact",
  initial = null,
  onChange,
  className,
}: Props) {
  const [snapshot, setSnapshot] = useState<PortalAccessSnapshot | null>(initial);
  const [busy, setBusy] = useState<"send" | "copy" | null>(null);
  const [copied, setCopied] = useState(false);
  const [manualLink, setManualLink] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/clients/${encodeURIComponent(clientId)}/portal-invite`, {
        credentials: "include",
        cache: "no-store",
      });
      if (res.status === 401 || res.status === 403 || res.status === 404) {
        setUnavailable(true);
        return;
      }
      if (!res.ok) return;
      const next = (await res.json()) as PortalAccessSnapshot;
      setSnapshot(next);
      onChangeRef.current?.(next);
    } catch {
      /* keep last known state */
    }
  }, [clientId]);

  useEffect(() => {
    void load();
    function onFocus() {
      if (document.visibilityState === "visible") void load();
    }
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [load]);

  async function requestInvite(action: "send" | "link"): Promise<{ url: string; access?: PortalAccessSnapshot | null }> {
    const res = await fetch(`/api/clients/${encodeURIComponent(clientId)}/portal-invite`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, project_id: projectId ?? null }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      url?: string;
      error?: string;
      access?: PortalAccessSnapshot | null;
    };
    if (!res.ok || !data.url) throw new Error(data.error || "Couldn't create an invite link.");
    if (data.access) {
      setSnapshot(data.access);
      onChangeRef.current?.(data.access);
    }
    return { url: data.url, access: data.access };
  }

  async function send() {
    setBusy("send");
    try {
      await requestInvite("send");
      toast.success(`Portal invite sent${snapshot?.email ? ` to ${snapshot.email}` : ""}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't send the invite.");
      void load();
    } finally {
      setBusy(null);
    }
  }

  async function copy() {
    setBusy("copy");
    setManualLink(null);
    const linkPromise = requestInvite("link").then((r) => r.url);
    try {
      // Safari keeps the user gesture only if the clipboard write starts synchronously.
      if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/plain": linkPromise.then((url) => new Blob([url], { type: "text/plain" })),
          }),
        ]);
      } else {
        await navigator.clipboard.writeText(await linkPromise);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("Invite link copied — it expires in 7 days");
    } catch (err) {
      try {
        setManualLink(await linkPromise);
        toast.message("Copy the invite link below");
      } catch {
        toast.error(err instanceof Error ? err.message : "Couldn't copy the invite link.");
      }
    } finally {
      setBusy(null);
    }
  }

  if (unavailable && !snapshot) return null;

  if (!snapshot) {
    return (
      <div className={cn("flex items-center gap-2 text-xs text-muted", className)}>
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> Checking portal access…
      </div>
    );
  }

  const { state } = snapshot;
  const canInvite = state !== "active" && !snapshot.foreign && Boolean(snapshot.email);
  const lastSent = state === "invite_sent" ? sentAgo(snapshot.lastInviteSentAt) : null;

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <PortalAccessBadge state={state} />
        {lastSent ? <span className="text-xs text-muted">{lastSent}</span> : null}
      </div>
      {variant === "full" ? (
        <p className="text-sm text-muted">
          {state === "active"
            ? "This client signs in with their own password and sees every project they're on."
            : snapshot.foreign
              ? "This email is linked to another business, so it can't be invited here."
              : !snapshot.email
                ? "Add an email address to invite this client."
                : "Optional — you can quote, schedule, message and invoice this client without a login. An invite lets them create their own password and see their projects."}
        </p>
      ) : null}
      {canInvite ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Button
            type="button"
            size="sm"
            variant={state === "not_activated" ? "accent" : "outline"}
            className="min-h-11 text-xs sm:min-h-9"
            disabled={busy !== null}
            onClick={() => void send()}
          >
            {busy === "send" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : state === "invite_sent" ? (
              <RefreshCw className="h-4 w-4" />
            ) : (
              <Mail className="h-4 w-4" />
            )}
            {state === "invite_sent" ? "Resend Invite" : "Send Portal Invite"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="min-h-11 text-xs sm:min-h-9"
            disabled={busy !== null}
            onClick={() => void copy()}
          >
            {busy === "copy" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : copied ? (
              <Check className="h-4 w-4" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
            {copied ? "Copied" : "Copy Invite Link"}
          </Button>
        </div>
      ) : null}
      {manualLink ? (
        <input
          readOnly
          value={manualLink}
          onFocus={(e) => e.currentTarget.select()}
          className="w-full rounded-md border border-border bg-white px-2 py-1.5 font-mono text-[11px] text-heading surface-dark:bg-card"
          aria-label="Invite link"
        />
      ) : null}
    </div>
  );
}
