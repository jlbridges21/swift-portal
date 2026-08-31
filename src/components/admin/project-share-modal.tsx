"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Modal } from "@/components/ui/modal";
import {
  AlertTriangle,
  Copy,
  Globe,
  Info,
  Loader2,
  Lock,
  Share2,
  Trash2,
  User,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import type { ProjectLinkAccessMode } from "@/lib/project-link-access";
import type { ProjectShareRow } from "@/lib/project-shares";
import {
  isValidShareEmail,
  normalizeShareEmail,
  parseShareEmailInput,
} from "@/lib/share-email-parse";

type AssignedClient = {
  name: string;
  email: string;
  user_id?: string | null;
};

type AddShareResult = {
  email: string;
  created?: boolean;
  notified?: boolean;
  linkedExistingUser?: boolean;
  error?: string;
  skippedReason?: "assigned_client" | "already_has_access" | "invalid";
};

export function ProjectShareModal({
  open,
  onClose,
  projectId,
  assignedClient,
  clientProjectUrl,
  initialShares,
  initialLinkMode,
  initialPublicUrl,
  initialViewCount,
}: {
  open: boolean;
  onClose: () => void;
  projectId: string;
  assignedClient: AssignedClient;
  clientProjectUrl: string;
  initialShares: ProjectShareRow[];
  initialLinkMode: ProjectLinkAccessMode;
  initialPublicUrl: string | null;
  initialViewCount: number;
}) {
  const [emailInput, setEmailInput] = useState("");
  const [notify, setNotify] = useState(true);
  const [personalMessage, setPersonalMessage] = useState("");
  const [adding, setAdding] = useState(false);
  const [shares, setShares] = useState(initialShares);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [linkMode, setLinkMode] = useState(initialLinkMode);
  const [publicUrl, setPublicUrl] = useState(initialPublicUrl);
  const [viewCount, setViewCount] = useState(initialViewCount);
  const [linkSaving, setLinkSaving] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showReEnableReminder, setShowReEnableReminder] = useState(false);

  const assignedEmail = normalizeShareEmail(assignedClient.email);

  const parsedCandidates = useMemo(() => parseShareEmailInput(emailInput), [emailInput]);
  const invalidEmails = useMemo(
    () => parsedCandidates.filter((email) => !isValidShareEmail(email)),
    [parsedCandidates]
  );
  const validEmails = useMemo(
    () => parsedCandidates.filter((email) => isValidShareEmail(email)),
    [parsedCandidates]
  );

  const copyTargetUrl =
    linkMode === "anyone_with_link" && publicUrl ? publicUrl : clientProjectUrl;

  const refreshState = useCallback(async () => {
    setRefreshing(true);
    try {
      const [sharesRes, linkRes] = await Promise.all([
        fetch(`/api/projects/${projectId}/shares`, { credentials: "include" }),
        fetch(`/api/projects/${projectId}/link-access`, { credentials: "include" }),
      ]);
      if (sharesRes.ok) {
        const data = await sharesRes.json();
        setShares(data.shares ?? []);
      }
      if (linkRes.ok) {
        const data = await linkRes.json();
        setLinkMode(data.mode);
        setPublicUrl(data.publicUrl ?? null);
        setViewCount(data.viewCount ?? 0);
      }
    } finally {
      setRefreshing(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (!open) return;
    void refreshState();
    setShowReEnableReminder(false);
  }, [open, refreshState]);

  useEffect(() => {
    setShares(initialShares);
    setLinkMode(initialLinkMode);
    setPublicUrl(initialPublicUrl);
    setViewCount(initialViewCount);
  }, [initialShares, initialLinkMode, initialPublicUrl, initialViewCount]);

  async function handleAddPeople() {
    if (validEmails.length === 0) {
      toast.error(invalidEmails.length ? "Fix invalid addresses before sending." : "Enter at least one email.");
      return;
    }

    setAdding(true);
    const results: AddShareResult[] = [];

    for (const email of invalidEmails) {
      results.push({ email, skippedReason: "invalid", error: "Invalid email address" });
    }

    const toInvite = validEmails.filter((email) => {
      if (email === assignedEmail) {
        results.push({ email, skippedReason: "assigned_client" });
        return false;
      }
      if (shares.some((s) => normalizeShareEmail(s.email) === email)) {
        results.push({ email, skippedReason: "already_has_access" });
        return false;
      }
      return true;
    });

    if (toInvite.length > 0) {
      try {
        const res = await fetch(`/api/projects/${projectId}/shares`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ emails: toInvite, notify }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Could not add shares");

        for (let i = 0; i < toInvite.length; i++) {
          const email = toInvite[i];
          const row = data.results?.[i];
          if (!row) {
            results.push({ email, error: "No response for this address" });
            continue;
          }
          if (!row.created) {
            results.push({ email, skippedReason: "already_has_access", ...row });
          } else {
            results.push({ email, ...row });
          }
        }
        await refreshState();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not add shares");
        setAdding(false);
        return;
      }
    }

    const added = results.filter((r) => r.created && !r.error);
    const already = results.filter((r) => r.skippedReason === "already_has_access");
    const assigned = results.filter((r) => r.skippedReason === "assigned_client");
    const invalid = results.filter((r) => r.skippedReason === "invalid");

    if (added.length) {
      toast.success(
        notify
          ? `Invite${added.length > 1 ? "s" : ""} sent to ${added.length} ${added.length === 1 ? "person" : "people"}.`
          : `Access granted for ${added.length} ${added.length === 1 ? "person" : "people"} (no email sent).`
      );
    }
    if (already.length) {
      toast.info(
        already.length === 1
          ? `${already[0].email} already has access.`
          : `${already.length} people already had access.`
      );
    }
    if (assigned.length) {
      toast.info(
        assigned.length === 1
          ? `${assigned[0].email} is the assigned client — they already have full access.`
          : "Assigned client email skipped — they already have full access."
      );
    }
    if (invalid.length) {
      toast.error(`${invalid.length} invalid ${invalid.length === 1 ? "address" : "addresses"} skipped.`);
    }

    if (added.length || already.length || assigned.length) {
      setEmailInput("");
      setPersonalMessage("");
    }
    setAdding(false);
  }

  async function handleRevoke(shareId: string, email: string) {
    setRevokingId(shareId);
    try {
      const res = await fetch(`/api/projects/${projectId}/shares/${shareId}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not remove access");
      setShares((prev) => prev.filter((s) => s.id !== shareId));
      toast.success(`Removed ${email} — access revoked immediately.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not remove access");
    } finally {
      setRevokingId(null);
    }
  }

  async function setLinkAccessMode(next: ProjectLinkAccessMode) {
    if (next === linkMode) return;
    const wasRestricted = linkMode === "restricted";
    setLinkSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/link-access`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ mode: next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not update link access");
      setLinkMode(data.mode);
      setPublicUrl(data.publicUrl ?? null);
      setViewCount(data.viewCount ?? viewCount);
      if (next === "anyone_with_link" && wasRestricted) {
        setShowReEnableReminder(true);
      } else if (next === "restricted") {
        setShowReEnableReminder(false);
      }
      toast.success(
        next === "anyone_with_link"
          ? "Anyone with the link can view and download."
          : "Restricted — only people with access can open this project."
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    } finally {
      setLinkSaving(false);
    }
  }

  async function copyShareLink() {
    if (!copyTargetUrl) {
      toast.error("No link available to copy.");
      return;
    }
    await navigator.clipboard.writeText(copyTargetUrl);
    toast.success(
      linkMode === "anyone_with_link"
        ? "Public view link copied"
        : "Project link copied (sign-in required)"
    );
  }

  async function rotateLink() {
    if (
      !window.confirm(
        "Generate a new link? Every previously shared anonymous URL will stop working immediately. Email shares and assigned clients are unaffected."
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
      setViewCount(data.viewCount ?? viewCount);
      toast.success("New public link generated — old anonymous URLs no longer work.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Rotation failed");
    } finally {
      setRotating(false);
    }
  }

  function shareAccessLabel(share: ProjectShareRow) {
    if (share.last_accessed_at) {
      return `Signed in · Last opened ${new Date(share.last_accessed_at).toLocaleDateString()}`;
    }
    if (share.notified_at) {
      return `Invited ${new Date(share.invited_at).toLocaleDateString()} · Hasn't opened yet`;
    }
    return `Added ${new Date(share.invited_at).toLocaleDateString()} · No email sent`;
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Share project"
      className="max-w-lg sm:max-w-xl"
      footer={
        <div className="flex justify-end">
          <Button type="button" variant="accent" className="min-h-11 w-full sm:w-auto" onClick={onClose}>
            Done
          </Button>
        </div>
      }
    >
      <div className="space-y-6 pb-2">
        {/* Add people */}
        <section className="space-y-3">
          <Label htmlFor="share-emails" className="text-sm font-semibold text-primary">
            Add people
          </Label>
          <Textarea
            id="share-emails"
            value={emailInput}
            onChange={(e) => setEmailInput(e.target.value)}
            placeholder="name@example.com, teammate@company.com"
            rows={2}
            className="min-h-[72px] text-base sm:text-sm"
          />
          {invalidEmails.length > 0 && (
            <p className="text-xs text-destructive">
              Invalid: {invalidEmails.join(", ")}
            </p>
          )}
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={notify}
              onChange={(e) => setNotify(e.target.checked)}
              className="mt-1 rounded border-border"
            />
            <span>
              <span className="font-medium">Notify people</span>
              <span className="block text-xs text-muted mt-0.5">
                Sends a passwordless sign-in link from your business portal.
              </span>
            </span>
          </label>
          {notify && (
            <div className="space-y-1.5">
              <Label htmlFor="share-message" className="text-xs text-muted">
                Message (optional)
              </Label>
              <Textarea
                id="share-message"
                value={personalMessage}
                onChange={(e) => setPersonalMessage(e.target.value)}
                placeholder="Add a short note for your records…"
                rows={2}
                className="text-sm"
              />
              <p className="text-xs text-muted">
                Invite emails use your standard template; this note is not sent yet.
              </p>
            </div>
          )}
          <Button
            type="button"
            variant="accent"
            className="min-h-11 w-full sm:w-auto"
            disabled={adding || validEmails.length === 0}
            onClick={() => void handleAddPeople()}
          >
            {adding ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Sending…
              </>
            ) : (
              <>
                <Share2 className="h-4 w-4" /> Share
              </>
            )}
          </Button>
        </section>

        <hr className="border-border" />

        {/* People with access */}
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-primary">People with access</h3>
            {refreshing && <Loader2 className="h-4 w-4 animate-spin text-muted" />}
          </div>
          <ul className="divide-y divide-border rounded-lg border border-border overflow-hidden">
            <li className="flex items-start gap-3 px-3 py-3 bg-muted/20">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
                <User className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{assignedClient.name}</p>
                <p className="text-xs text-muted truncate">{assignedClient.email}</p>
                <p className="text-xs text-muted mt-0.5">
                  Assigned client · Full access including quotes and payments
                  {assignedClient.user_id ? " · Portal account active" : " · Portal not enabled"}
                </p>
              </div>
            </li>
            {shares.map((share) => (
              <li key={share.id} className="flex items-start gap-3 px-3 py-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <Users className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{share.email}</p>
                  <p className="text-xs text-muted">{shareAccessLabel(share)}</p>
                  <p className="text-xs text-muted mt-0.5">Shared viewer · Media only</p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-destructive shrink-0 min-h-11 min-w-11"
                  disabled={revokingId === share.id}
                  onClick={() => void handleRevoke(share.id, share.email)}
                  aria-label={`Remove ${share.email}`}
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
          <p className="text-xs text-muted flex items-start gap-1.5">
            <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            Team members with admin access can manage this project. They are not listed here individually.
          </p>
          <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted space-y-1">
            <p className="font-medium text-primary">What shared viewers can do</p>
            <p>Can: view and download media, leave video comments (after sign-in).</p>
            <p>Cannot: see quotes, estimates, proposals, payments, checkout, or messages.</p>
          </div>
        </section>

        <hr className="border-border" />

        {/* General access */}
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-primary flex items-center gap-2">
            <Globe className="h-4 w-4" /> General access
          </h3>
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => void setLinkAccessMode("restricted")}
              disabled={linkSaving || linkMode === "restricted"}
              className={`w-full rounded-lg border px-3 py-3 text-left transition-colors min-h-11 ${
                linkMode === "restricted"
                  ? "border-accent bg-accent/5 ring-1 ring-accent/30"
                  : "border-border hover:bg-muted/40"
              }`}
            >
              <div className="flex items-center gap-2 text-sm font-medium">
                <Lock className="h-4 w-4 shrink-0" />
                Restricted
              </div>
              <p className="text-xs text-muted mt-1 ml-6">
                Only people with access can open this project
              </p>
            </button>
            <button
              type="button"
              onClick={() => void setLinkAccessMode("anyone_with_link")}
              disabled={linkSaving || linkMode === "anyone_with_link"}
              className={`w-full rounded-lg border px-3 py-3 text-left transition-colors min-h-11 ${
                linkMode === "anyone_with_link"
                  ? "border-accent bg-accent/5 ring-1 ring-accent/30"
                  : "border-border hover:bg-muted/40"
              }`}
            >
              <div className="flex items-center gap-2 text-sm font-medium">
                <Globe className="h-4 w-4 shrink-0" />
                Anyone with the link
              </div>
              <p className="text-xs text-muted mt-1 ml-6">
                Anyone on the internet with the link can view and download
              </p>
            </button>
            {linkSaving && (
              <p className="text-xs text-muted flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" /> Updating access…
              </p>
            )}
          </div>

          {showReEnableReminder && linkMode === "anyone_with_link" && (
            <div className="rounded-lg border border-amber-200 bg-amber-50/80 p-3 text-xs text-amber-900 space-y-1">
              <p className="font-medium">Same public link as before</p>
              <p>
                Re-enabling reuses your existing anonymous URL. If an old link leaked while this
                project was restricted, use <strong>Generate new link</strong> below to invalidate
                it.
              </p>
            </div>
          )}

          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              readOnly
              value={copyTargetUrl}
              className="flex-1 min-w-0 rounded-md border border-border bg-muted/30 px-3 py-2.5 text-xs font-mono min-h-11"
            />
            <Button
              type="button"
              variant="outline"
              className="min-h-11 shrink-0"
              onClick={() => void copyShareLink()}
            >
              <Copy className="h-4 w-4" /> Copy link
            </Button>
          </div>

          {linkMode === "anyone_with_link" && publicUrl && (
            <div className="space-y-2">
              <p className="text-xs text-muted">
                Anonymous link views (not identifiable): {viewCount.toLocaleString()}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-h-11"
                disabled={rotating || linkSaving}
                onClick={() => void rotateLink()}
              >
                {rotating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Generate new link"}
              </Button>
            </div>
          )}

          {linkMode === "anyone_with_link" && (
            <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50/80 p-3 text-xs text-amber-900">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <p>
                Once this link is public and forwarded, switching back to{" "}
                <strong>Restricted</strong> blocks anonymous access immediately. Email shares and
                clients are unaffected. There is no per-visitor revocation — use{" "}
                <strong>Generate new link</strong> after a leak.
              </p>
            </div>
          )}
        </section>
      </div>
    </Modal>
  );
}
