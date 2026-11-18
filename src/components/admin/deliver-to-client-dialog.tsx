"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  CreditCard,
  Download,
  ExternalLink,
  ImageIcon,
  KeyRound,
  Loader2,
  Lock,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency } from "@/lib/utils";
import type { DeliverySummary } from "@/lib/project-delivery";

type Props = {
  open: boolean;
  onClose: () => void;
  projectId: string;
  /** Business preview of the client's project page. */
  previewUrl: string;
  /** Called after a successful send (status may have moved to Delivered). */
  onSent?: (summary: DeliverySummary) => void;
};

function firstNameOf(name: string | undefined | null): string {
  const first = (name ?? "").trim().split(/\s+/)[0] ?? "";
  return first && !first.includes("@") ? first : "your client";
}

function mediaLine(m: DeliverySummary["media"]): string {
  const parts: string[] = [];
  const add = (n: number, one: string, many: string) => n && parts.push(`${n} ${n === 1 ? one : many}`);
  add(m.photos, "photo", "photos");
  add(m.videos, "video", "videos");
  add(m.tours, "virtual tour", "virtual tours");
  add(m.models, "3D model", "3D models");
  add(m.documents, "file", "files");
  return parts.join(" · ");
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function Row({ icon: Icon, tone = "default", children }: { icon: typeof ImageIcon; tone?: "default" | "warn" | "ok"; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span
        className={
          tone === "warn"
            ? "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700 surface-dark:bg-amber-500/15 surface-dark:text-amber-300"
            : tone === "ok"
              ? "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 surface-dark:bg-emerald-500/15 surface-dark:text-emerald-300"
              : "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-subtle text-accent"
        }
      >
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1 text-sm leading-6 text-heading">{children}</div>
    </li>
  );
}

const ISSUE_COPY: Record<NonNullable<DeliverySummary["clientIssue"]>, { title: string; body: string }> = {
  no_client: {
    title: "This project has no client yet",
    body: "Add the client in this project's Client section (name and email), then come back and send.",
  },
  no_email: {
    title: "Your client has no email address",
    body: "Add an email address to the client's details, then come back and send.",
  },
  business_login: {
    title: "That email is a business login",
    body: "The client's email belongs to you or a team member, so it can't get a one-click client link. Use the client's own email address.",
  },
  foreign_login: {
    title: "That email can't be used here",
    body: "The client's email is linked to another business's account. Use a different email for this client.",
  },
};

/**
 * "Send to client": one email to the project's own client with a one-click link
 * (no account, no password) to view, pay and download. Copy link for texting.
 */
export function DeliverToClientDialog({ open, onClose, projectId, previewUrl, onSent }: Props) {
  const [summary, setSummary] = useState<DeliverySummary | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [markDelivered, setMarkDelivered] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [copying, setCopying] = useState(false);
  const [sent, setSent] = useState<{ to: string; at: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/deliver`, { credentials: "include", cache: "no-store" });
      const data = (await res.json().catch(() => ({}))) as { summary?: DeliverySummary; error?: string };
      if (!res.ok || !data.summary) throw new Error(data.error || "Couldn't load delivery details.");
      setSummary(data.summary);
      setMarkDelivered(data.summary.suggestMarkDelivered);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Couldn't load delivery details.");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (!open) return;
    setSent(null);
    setError(null);
    setNote("");
    setNoteOpen(false);
    setMarkDelivered(false);
    void load();
  }, [open, load]);

  async function send() {
    if (sending || !summary) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/deliver`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "send",
          markDelivered: summary.canMarkDelivered && markDelivered,
          note: noteOpen ? note : "",
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        sentTo?: string;
        sentAt?: string;
        summary?: DeliverySummary;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error || "The email couldn't be sent.");
      if (data.summary) setSummary(data.summary);
      setSent({ to: data.sentTo ?? summary.client?.email ?? "", at: data.sentAt ?? new Date().toISOString() });
      if (data.summary) onSent?.(data.summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The email couldn't be sent.");
    } finally {
      setSending(false);
    }
  }

  async function copyLink() {
    if (copying) return;
    setCopying(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/deliver`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "link" }),
      });
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !data.url) throw new Error(data.error || "Couldn't create the link.");
      await navigator.clipboard.writeText(data.url);
      toast.success(`Link copied. It signs ${firstNameOf(summary?.client?.name)} in, so send it only to them.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't copy the link.");
    } finally {
      setCopying(false);
    }
  }

  const first = firstNameOf(summary?.client?.name);
  const ready = summary && !summary.clientIssue;
  const willUnlock = Boolean(summary?.canMarkDelivered && markDelivered);

  const footer = sent ? (
    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <Button type="button" variant="outline" className="min-h-11" onClick={() => void copyLink()} disabled={copying}>
        {copying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />} Copy link
      </Button>
      <Button type="button" variant="accent" className="min-h-11" onClick={onClose}>
        Done
      </Button>
    </div>
  ) : (
    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      {ready ? (
        <Button type="button" variant="outline" className="min-h-11" onClick={() => void copyLink()} disabled={copying || sending}>
          {copying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />} Copy link instead
        </Button>
      ) : (
        <Button type="button" variant="outline" className="min-h-11" onClick={onClose}>
          Close
        </Button>
      )}
      <Button
        type="button"
        variant="accent"
        className="min-h-11"
        onClick={() => void send()}
        disabled={!ready || sending || loading}
      >
        {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        {sending ? "Sending…" : ready ? `Email ${first === "your client" ? "client" : first}` : "Send"}
      </Button>
    </div>
  );

  return (
    <Modal open={open} onClose={onClose} title="Send to client" className="max-w-lg" footer={footer}>
      {loading && !summary ? (
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : loadError ? (
        <div className="space-y-3 py-4 text-center">
          <p className="text-sm text-red-600" role="alert">
            {loadError}
          </p>
          <Button type="button" variant="outline" onClick={() => void load()}>
            Try again
          </Button>
        </div>
      ) : summary && sent ? (
        <div className="space-y-4 py-2 text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" aria-hidden />
          <div>
            <p className="text-lg font-semibold text-heading">Sent to {first === "your client" ? "your client" : first}</p>
            <p className="mt-1 text-sm text-muted break-all">{sent.to}</p>
          </div>
          <p className="mx-auto max-w-sm text-sm text-muted">
            The button in the email signs them in and opens the project, with no account or password.
            {summary.dueCents > 0 && !summary.downloadsUnlocked
              ? ` They'll pay ${formatCurrency(summary.dueCents)} there${summary.payUnlocksDownloads ? " and download right after." : "."}`
              : summary.downloadsUnlocked
                ? " They can download everything right away."
                : ""}
          </p>
          <p className="text-xs text-muted">Texting them instead? Copy the link below.</p>
        </div>
      ) : summary ? (
        <div className="space-y-5">
          {summary.clientIssue ? (
            <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 surface-dark:border-amber-500/30 surface-dark:bg-amber-500/10">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
              <div className="text-sm">
                <p className="font-semibold text-heading">{ISSUE_COPY[summary.clientIssue].title}</p>
                <p className="mt-1 text-muted">{ISSUE_COPY[summary.clientIssue].body}</p>
                {summary.client?.email ? <p className="mt-1 text-muted break-all">Email on file: {summary.client.email}</p> : null}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-foreground">
                {(summary.client?.name ?? "?").trim().charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0">
                <p className="truncate font-medium text-heading">{summary.client?.name}</p>
                <p className="truncate text-sm text-muted">{summary.client?.email}</p>
              </div>
            </div>
          )}

          {!summary.clientIssue ? (
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">What {first} gets</p>
              <ul className="space-y-3">
                {summary.media.total > 0 ? (
                  <Row icon={ImageIcon}>
                    <span className="font-medium">{mediaLine(summary.media)}</span>
                    <span className="block text-muted">for {summary.projectLabel}</span>
                  </Row>
                ) : (
                  <Row icon={ImageIcon} tone="warn">
                    <span className="font-medium">No media uploaded yet</span>
                    <span className="block text-muted">You can still send it. They&apos;ll see the project page and its progress.</span>
                  </Row>
                )}

                {summary.dueCents > 0 ? (
                  <Row icon={CreditCard}>
                    {summary.downloadsUnlocked ? (
                      <>
                        <span className="font-medium">Downloads are open</span>
                        <span className="block text-muted">
                          The {formatCurrency(summary.dueCents)} balance is shown on the same page to pay.
                        </span>
                      </>
                    ) : summary.payUnlocksDownloads ? (
                      <>
                        <span className="font-medium">Pays {formatCurrency(summary.dueCents)}, then downloads unlock</span>
                        <span className="block text-muted">They pay right on the project page, with no login step.</span>
                      </>
                    ) : (
                      <>
                        <span className="font-medium">Sees {formatCurrency(summary.dueCents)} due</span>
                        <span className="block text-muted">Downloads unlock when you mark the project Delivered.</span>
                      </>
                    )}
                  </Row>
                ) : summary.downloadsUnlocked ? (
                  <Row icon={Download} tone="ok">
                    <span className="font-medium">Can download everything right away</span>
                    <span className="block text-muted">One &quot;Download all&quot; button, full resolution.</span>
                  </Row>
                ) : summary.canMarkDelivered ? (
                  <Row icon={willUnlock ? Download : Lock} tone={willUnlock ? "ok" : "warn"}>
                    <span className="font-medium">
                      {willUnlock ? "Can download everything right away" : "Can view, but not download yet"}
                    </span>
                    <label className="mt-1.5 flex cursor-pointer items-start gap-2 text-muted">
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4 shrink-0 accent-[var(--color-accent)]"
                        checked={markDelivered}
                        onChange={(e) => setMarkDelivered(e.target.checked)}
                      />
                      <span>
                        Mark the project <strong className="text-heading">Delivered</strong> so downloads unlock (now{" "}
                        {summary.statusLabel})
                      </span>
                    </label>
                  </Row>
                ) : (
                  <Row icon={Lock} tone="warn">
                    <span className="font-medium">Can view, but not download yet</span>
                    <span className="block text-muted">Downloads unlock when the project is Delivered.</span>
                  </Row>
                )}

                <Row icon={KeyRound}>
                  <span className="font-medium">One click to open, no account or password</span>
                  <span className="block text-muted">The email button signs them in on any device.</span>
                </Row>
              </ul>
            </div>
          ) : null}

          {!summary.clientIssue ? (
            noteOpen ? (
              <div className="space-y-1.5">
                <label htmlFor="deliver-note" className="text-sm font-medium text-heading">
                  Personal note <span className="font-normal text-muted">(optional)</span>
                </label>
                <Textarea
                  id="deliver-note"
                  rows={3}
                  maxLength={1000}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={first === "your client" ? "Thanks! Great working with you." : `Thanks ${first}! Great working with you.`}
                />
              </div>
            ) : (
              <button type="button" className="text-sm font-medium text-accent hover:underline" onClick={() => setNoteOpen(true)}>
                + Add a personal note
              </button>
            )
          ) : null}

          {error ? (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-xs text-muted">
            <span>
              {summary.lastSent
                ? `Last sent ${formatWhen(summary.lastSent.at)}${summary.lastOpenedAt && summary.lastOpenedAt >= summary.lastSent.at ? ` · Opened ${formatWhen(summary.lastOpenedAt)}` : " · Not opened yet"}`
                : summary.lastOpenedAt
                  ? `Client last opened a link ${formatWhen(summary.lastOpenedAt)}`
                  : "Not sent yet"}
            </span>
            <a href={previewUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-accent hover:underline">
              Preview what they see <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
