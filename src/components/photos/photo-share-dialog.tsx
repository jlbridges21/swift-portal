"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, Check, Copy, Folder, Link2, Loader2, Mail, RotateCw, UserMinus, Users } from "lucide-react";
import { toast } from "sonner";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  MEDIA_SHARE_EXPIRY_OPTIONS,
  type MediaInviteResult,
  type MediaShareExpiryPreset,
  type MediaShareState,
  type MediaShareSubjectKind,
  type PhotoShareSummary,
} from "@/lib/media-share-types";

/** Shown on the folder share dialog and the shared-folder banner: membership is live. */
export const FOLDER_SHARE_WARNING =
  "Everyone you share this folder with can see every photo in it — including photos you upload or move here later. Photos moved out of the folder, deleted, or hidden from the client stop being shared. The rest of the project is never shared.";

type Permissions = { email: boolean; link: boolean };

type Confirming =
  | { kind: "disable_link" }
  | { kind: "rotate_link" }
  | { kind: "remove"; shareId: string; email: string }
  | null;

const ACCESS_OPTIONS = [
  { value: "view", label: "View only" },
  { value: "download", label: "Can download original" },
];

function expiryText(expiresAt: string | null): string {
  if (!expiresAt) return "No expiry";
  return `Expires ${new Date(expiresAt).toLocaleDateString()}`;
}

function viewsText(count: number): string {
  if (count === 0) return "Not opened yet";
  return count === 1 ? "Opened once" : `Opened ${count} times`;
}

export function summarizeShareState(state: MediaShareState): PhotoShareSummary {
  return { link: Boolean(state.link), people: state.people.length };
}

export type PhotoShareTarget = {
  id: string;
  name: string;
  thumbUrl?: string | null;
  /** Defaults to a single photo. */
  kind?: MediaShareSubjectKind;
};

type SummaryChange = (id: string, summary: PhotoShareSummary, kind: MediaShareSubjectKind) => void;

/** Owns which photo or folder the share dialog is open for. */
export function usePhotoShareDialog(onSummaryChange?: SummaryChange) {
  const [target, setTarget] = useState<PhotoShareTarget | null>(null);
  const dialog = target ? (
    <PhotoShareDialog
      open
      onClose={() => setTarget(null)}
      kind={target.kind ?? "photo"}
      targetId={target.id}
      targetName={target.name}
      thumbUrl={target.thumbUrl}
      onSummaryChange={onSummaryChange}
    />
  ) : null;
  return { openShare: setTarget, dialog };
}

function withSummary(prev: Record<string, PhotoShareSummary>, id: string, next: PhotoShareSummary) {
  const copy = { ...prev };
  if (next.link || next.people > 0) copy[id] = next;
  else delete copy[id];
  return copy;
}

/**
 * Live share badges for a project's photos and folders. Refetches when photos
 * change folder or disappear, or folders are deleted, because the server
 * revokes shares on move/delete.
 */
export function useProjectPhotoShareSummary(
  projectId: string,
  initial: Record<string, PhotoShareSummary>,
  photos: { id: string; folder_id?: string | null }[],
  enabled: boolean,
  initialFolders: Record<string, PhotoShareSummary> = {},
  folderIds: string[] = []
) {
  const [summary, setSummary] = useState(initial);
  const [folderSummary, setFolderSummary] = useState(initialFolders);
  const placementKey = `${photos.map((p) => `${p.id}:${p.folder_id ?? ""}`).join(",")}|${folderIds.join(",")}`;
  const lastKey = useRef(placementKey);

  useEffect(() => {
    if (!enabled || lastKey.current === placementKey) return;
    lastKey.current = placementKey;
    let cancelled = false;
    void fetch(`/api/projects/${projectId}/photo-shares`, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (cancelled) return;
        if (json?.summary) setSummary(json.summary);
        if (json?.folders) setFolderSummary(json.folders);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [enabled, placementKey, projectId]);

  const update = useCallback<SummaryChange>((id, next, kind) => {
    if (kind === "folder") setFolderSummary((prev) => withSummary(prev, id, next));
    else setSummary((prev) => withSummary(prev, id, next));
  }, []);

  return { summary, folderSummary, update };
}

export function PhotoShareDialog({
  open,
  onClose,
  kind = "photo",
  targetId,
  targetName,
  thumbUrl,
  onSummaryChange,
}: {
  open: boolean;
  onClose: () => void;
  kind?: MediaShareSubjectKind;
  targetId: string;
  targetName: string;
  thumbUrl?: string | null;
  onSummaryChange?: SummaryChange;
}) {
  const isFolder = kind === "folder";
  const endpoint = isFolder ? `/api/media-folders/${targetId}/shares` : `/api/media/${targetId}/shares`;
  const [state, setState] = useState<MediaShareState | null>(null);
  const [perms, setPerms] = useState<Permissions>({ email: false, link: false });
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<Confirming>(null);
  const [emails, setEmails] = useState("");
  const [inviteAccess, setInviteAccess] = useState("view");
  const [inviteExpiry, setInviteExpiry] = useState<MediaShareExpiryPreset>("indefinite");
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const res = await fetch(endpoint, { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Couldn't load sharing.");
      setState(json.state);
      setPerms(json.permissions);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Couldn't load sharing.");
    }
  }, [endpoint]);

  useEffect(() => {
    if (!open) return;
    setState(null);
    setConfirming(null);
    setEmails("");
    void load();
  }, [open, load]);

  async function act(
    key: string,
    payload: Record<string, unknown>,
    success?: string
  ): Promise<MediaInviteResult[] | undefined> {
    setBusy(key);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Something went wrong.");
      setState(json.state);
      onSummaryChange?.(targetId, summarizeShareState(json.state), kind);
      if (success) toast.success(success);
      return json.results as MediaInviteResult[] | undefined;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
      return undefined;
    } finally {
      setBusy(null);
      setConfirming(null);
    }
  }

  async function invite() {
    const results = await act("invite", {
      action: "invite",
      emails,
      allowDownload: inviteAccess === "download",
      expiryPreset: inviteExpiry,
    });
    if (!results) return;
    const invited = results.filter((r) => r.status === "invited");
    const already = results.filter((r) => r.status === "already_shared");
    const failed = results.filter((r) => r.status === "invalid" || r.status === "notify_failed");
    if (invited.length) toast.success(invited.length === 1 ? `Invite sent to ${invited[0].email}` : `${invited.length} invites sent`);
    if (already.length) toast.message(`Already shared with ${already.map((r) => r.email).join(", ")}`);
    for (const r of failed) {
      toast.error(r.status === "invalid" ? `${r.email} isn't a valid email` : `Shared with ${r.email}, but the email didn't send. Try Resend.`);
    }
    if (!failed.some((r) => r.status === "invalid")) setEmails("");
  }

  async function copyLink(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Couldn't copy. Select the link and copy it manually.");
    }
  }

  const link = state?.link ?? null;
  const people = state?.people ?? [];
  const statusLine = state
    ? [
        people.length ? `${people.length} ${people.length === 1 ? "person" : "people"}` : null,
        link ? "anyone with the link" : null,
      ]
        .filter(Boolean)
        .join(" · ") || "Not shared"
    : null;

  return (
    <Modal open={open} onClose={onClose} title={isFolder ? "Share folder" : "Share photo"} className="sm:max-w-xl">
      <div className="space-y-5 pb-1">
        <div className="flex items-center gap-3">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-subtle">
            {thumbUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={thumbUrl} alt="" className="h-full w-full object-cover" />
            ) : isFolder ? (
              <Folder className="h-6 w-6 text-muted" aria-hidden />
            ) : null}
          </div>
          <div className="min-w-0">
            <p className="truncate font-medium text-heading">{targetName}</p>
            <p className="text-sm text-muted" aria-live="polite">
              {statusLine ? `Shared with: ${statusLine}` : "Loading sharing…"}
            </p>
          </div>
        </div>

        {isFolder ? (
          <div
            role="note"
            className="flex gap-2.5 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 surface-dark:border-amber-500/40 surface-dark:bg-amber-500/10 surface-dark:text-amber-100"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <p>{FOLDER_SHARE_WARNING}</p>
          </div>
        ) : null}

        {loadError ? (
          <div className="rounded-lg border border-border bg-subtle p-4 text-sm">
            <p className="font-medium text-heading">Couldn&apos;t load sharing</p>
            <p className="mt-1 text-muted">{loadError}</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => void load()}>
              <RotateCw className="h-4 w-4" /> Try again
            </Button>
          </div>
        ) : !state ? (
          <div className="space-y-3" aria-hidden>
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : (
          <>
            {perms.email ? (
              <section className="space-y-3" aria-labelledby="share-people-heading">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted" aria-hidden />
                  <h3 id="share-people-heading" className="text-sm font-semibold text-heading">
                    Specific people
                  </h3>
                </div>
                <form
                  className="space-y-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (emails.trim()) void invite();
                  }}
                >
                  <Input
                    type="text"
                    inputMode="email"
                    autoComplete="off"
                    placeholder="Email addresses, separated by commas"
                    aria-label="Email addresses to invite"
                    value={emails}
                    onChange={(e) => setEmails(e.target.value)}
                  />
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <div className="sm:w-48">
                      <Select
                        aria-label="Access for new invites"
                        options={ACCESS_OPTIONS}
                        value={inviteAccess}
                        onChange={(e) => setInviteAccess(e.target.value)}
                      />
                    </div>
                    <div className="sm:w-36">
                      <Select
                        aria-label="Invite expiry"
                        options={MEDIA_SHARE_EXPIRY_OPTIONS}
                        value={inviteExpiry}
                        onChange={(e) => setInviteExpiry(e.target.value as MediaShareExpiryPreset)}
                      />
                    </div>
                    <Button
                      type="submit"
                      variant="accent"
                      className="min-h-10 sm:ml-auto"
                      disabled={!emails.trim() || busy !== null}
                    >
                      {busy === "invite" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                      Send invite
                    </Button>
                  </div>
                  <p className="text-xs text-muted">
                    Each person gets their own private link by email. No account needed.
                  </p>
                </form>

                {people.length ? (
                  <ul className="divide-y divide-border rounded-lg border border-border">
                    {people.map((p) => (
                      <li key={p.id} className="space-y-2 p-3">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-heading">{p.email}</p>
                            <p className="text-xs text-muted">
                              {p.notified_at ? viewsText(p.view_count) : "Email not sent"} · {expiryText(p.access_expires_at)}
                            </p>
                          </div>
                          <div className="w-44">
                            <Select
                              aria-label={`Access for ${p.email}`}
                              options={ACCESS_OPTIONS}
                              value={p.allow_download ? "download" : "view"}
                              disabled={busy !== null}
                              onChange={(e) =>
                                void act(
                                  `update-${p.id}`,
                                  { action: "update", shareId: p.id, allowDownload: e.target.value === "download" },
                                  "Access updated"
                                )
                              }
                            />
                          </div>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="min-h-10"
                              disabled={busy !== null}
                              onClick={() => void act(`resend-${p.id}`, { action: "resend", shareId: p.id }, `Invite resent to ${p.email}`)}
                            >
                              {busy === `resend-${p.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                              Resend
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="min-h-10 text-red-600 hover:text-red-700"
                              disabled={busy !== null}
                              onClick={() => setConfirming({ kind: "remove", shareId: p.id, email: p.email })}
                            >
                              <UserMinus className="h-4 w-4" /> Remove
                            </Button>
                          </div>
                        </div>
                        {confirming?.kind === "remove" && confirming.shareId === p.id ? (
                          <InlineConfirm
                            message={`Remove ${p.email}? Their link stops working immediately.`}
                            confirmLabel="Remove access"
                            busy={busy === `revoke-${p.id}`}
                            onCancel={() => setConfirming(null)}
                            onConfirm={() =>
                              void act(`revoke-${p.id}`, { action: "revoke", shareId: p.id }, `Removed ${p.email}`)
                            }
                          />
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </section>
            ) : null}

            {perms.link ? (
              <section className="space-y-3" aria-labelledby="share-link-heading">
                <div className="flex items-center gap-2">
                  <Link2 className="h-4 w-4 text-muted" aria-hidden />
                  <h3 id="share-link-heading" className="text-sm font-semibold text-heading">
                    Anyone with the link
                  </h3>
                  <span
                    className={cn(
                      "ml-auto rounded-full px-2 py-0.5 text-xs font-medium",
                      link ? "bg-accent-subtle text-accent" : "bg-subtle text-muted"
                    )}
                  >
                    {link ? "On" : "Off"}
                  </span>
                </div>

                {link ? (
                  <div className="space-y-3 rounded-lg border border-border p-3">
                    {link.url ? (
                      <div className="flex gap-2">
                        <Input readOnly value={link.url} aria-label="Share link" onFocus={(e) => e.currentTarget.select()} />
                        <Button variant="outline" className="min-h-11 shrink-0" onClick={() => void copyLink(link.url!)}>
                          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                          {copied ? "Copied" : "Copy"}
                        </Button>
                      </div>
                    ) : (
                      <p className="text-sm text-muted">This link can&apos;t be shown. Reset it to get a new one.</p>
                    )}
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <div className="sm:w-48">
                        <Select
                          aria-label="Link access"
                          options={ACCESS_OPTIONS}
                          value={link.allow_download ? "download" : "view"}
                          disabled={busy !== null}
                          onChange={(e) =>
                            void act(
                              "link-access",
                              { action: "update", shareId: link.id, allowDownload: e.target.value === "download" },
                              "Link access updated"
                            )
                          }
                        />
                      </div>
                      <div className="sm:w-36">
                        <Select
                          aria-label="Link expiry"
                          options={MEDIA_SHARE_EXPIRY_OPTIONS}
                          value={link.expiry_preset}
                          disabled={busy !== null}
                          onChange={(e) =>
                            void act(
                              "link-expiry",
                              { action: "update", shareId: link.id, expiryPreset: e.target.value },
                              "Link expiry updated"
                            )
                          }
                        />
                      </div>
                      <p className="text-xs text-muted sm:ml-auto">
                        {viewsText(link.view_count)} · {expiryText(link.access_expires_at)}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 border-t border-border pt-3">
                      <Button
                        variant="outline"
                        size="sm"
                        className="min-h-10"
                        disabled={busy !== null}
                        onClick={() => setConfirming({ kind: "rotate_link" })}
                      >
                        <RotateCw className="h-4 w-4" /> Reset link
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="min-h-10 text-red-600 hover:text-red-700"
                        disabled={busy !== null}
                        onClick={() => setConfirming({ kind: "disable_link" })}
                      >
                        Turn off link
                      </Button>
                    </div>
                    {confirming?.kind === "rotate_link" ? (
                      <InlineConfirm
                        message="Reset the link? Anyone using the current link loses access. You'll get a new link to share."
                        confirmLabel="Reset link"
                        busy={busy === "rotate"}
                        onCancel={() => setConfirming(null)}
                        onConfirm={() => void act("rotate", { action: "rotate_link" }, "New link created. The old link no longer works.")}
                      />
                    ) : null}
                    {confirming?.kind === "disable_link" ? (
                      <InlineConfirm
                        message="Turn off the link? Anyone who has it loses access immediately. People you invited by email keep access."
                        confirmLabel="Turn off link"
                        busy={busy === "disable"}
                        onCancel={() => setConfirming(null)}
                        onConfirm={() => void act("disable", { action: "revoke", shareId: link.id }, "Link turned off")}
                      />
                    ) : null}
                  </div>
                ) : (
                  <div className="flex flex-col gap-3 rounded-lg border border-dashed border-border p-3 sm:flex-row sm:items-center">
                    <p className="flex-1 text-sm text-muted">
                      Off. Only people you invite can open this {isFolder ? "folder" : "photo"}.
                    </p>
                    <Button
                      variant="outline"
                      className="min-h-10"
                      disabled={busy !== null}
                      onClick={() => void act("enable", { action: "enable_link" }, "Link created")}
                    >
                      {busy === "enable" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
                      Create link
                    </Button>
                  </div>
                )}
              </section>
            ) : null}

            <p className="flex gap-2 text-xs text-muted">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              <span>
                {isFolder
                  ? "Deleting the folder ends every share of it. Photos shared on their own keep those shares."
                  : "Shares open this one photo only — never the project, folder, or other photos. Moving the photo to another folder or project, or deleting it, ends every share."}
              </span>
            </p>
          </>
        )}
      </div>
    </Modal>
  );
}

function InlineConfirm({
  message,
  confirmLabel,
  busy,
  onCancel,
  onConfirm,
}: {
  message: string;
  confirmLabel: string;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div role="alertdialog" aria-label={confirmLabel} className="rounded-lg border border-red-200 bg-red-50 p-3 surface-dark:border-red-900/60 surface-dark:bg-red-950/40">
      <p className="text-sm text-red-800 surface-dark:text-red-200">{message}</p>
      <div className="mt-2 flex flex-wrap justify-end gap-2">
        <Button variant="outline" size="sm" className="min-h-10" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button variant="destructive" size="sm" className="min-h-10" onClick={onConfirm} disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {confirmLabel}
        </Button>
      </div>
    </div>
  );
}
