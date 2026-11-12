"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Copy, Download, Eye, Loader2, MoreHorizontal, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { ActionMenu, type ActionMenuAnchor, type ActionMenuItem } from "@/components/ui/action-menu";
import { PdfPages } from "@/components/projects/pdf-pages";
import { downloadEstimatePdf, renderEstimatePdf } from "@/components/projects/estimate-pdf-client";
import { fetchStoredProposalPdf } from "@/components/projects/estimate-pdf-preview";
import { estimateReference, type EstimatePdfInput } from "@/lib/estimate-pdf";
import {
  getProjectActiveQuote,
  getQuoteIntroText,
  isArchivedQuote,
  isPreliminaryQuote,
  parseQuoteIncludes,
} from "@/lib/quote-display";
import type { ProjectQuote } from "@/lib/types";
import { cn, formatCurrency, formatDate } from "@/lib/utils";

type StatusTone = "slate" | "blue" | "emerald" | "amber" | "rose" | "sky" | "zinc";

const TONE_CLASS: Record<StatusTone, string> = {
  slate: "bg-slate-100 text-slate-700 ring-slate-200",
  blue: "bg-blue-50 text-blue-700 ring-blue-200",
  emerald: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  amber: "bg-amber-50 text-amber-800 ring-amber-200",
  rose: "bg-rose-50 text-rose-700 ring-rose-200",
  sky: "bg-sky-50 text-sky-700 ring-sky-200",
  zinc: "bg-zinc-100 text-zinc-500 ring-zinc-200",
};

/**
 * Statuses the proposal system stores, plus the two it can derive exactly:
 * Superseded (archived by a newer official) and Expired (sent, past expires_at).
 * There is no "viewed" or "declined" record, so those are never shown.
 */
export function proposalHistoryStatus(quote: ProjectQuote, now = Date.now()): { label: string; tone: StatusTone } {
  if (isArchivedQuote(quote)) return { label: "Superseded", tone: "zinc" };
  if (isPreliminaryQuote(quote)) return { label: "Preliminary", tone: "sky" };
  switch (quote.status) {
    case "approved":
      return { label: "Accepted", tone: "emerald" };
    case "changes_requested":
      return { label: "Changes requested", tone: "amber" };
    case "sent":
      if (quote.expires_at && new Date(quote.expires_at).getTime() < now) return { label: "Expired", tone: "rose" };
      return { label: "Sent", tone: "blue" };
    default:
      return { label: "Draft", tone: "slate" };
  }
}

function proposalSummary(quote: ProjectQuote): string {
  const intro = getQuoteIntroText(quote.description);
  if (intro) return intro.replace(/\s+/g, " ");
  const includes = parseQuoteIncludes(quote.description);
  if (includes.length) return includes.join(" · ");
  const items = (quote.line_items ?? []).map((item) => item.description).filter(Boolean);
  return items.length ? items.join(" · ") : "No description";
}

function proposalDateLabel(quote: ProjectQuote): string {
  if (quote.sent_at) return `Sent ${formatDate(quote.sent_at)}`;
  return `Created ${formatDate(quote.created_at)}`;
}

function newestFirst(quotes: ProjectQuote[]): ProjectQuote[] {
  return [...quotes].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

type ViewState = {
  quote: ProjectQuote;
  bytes: Uint8Array | null;
  source: "stored" | "rebuilt" | null;
  failed: boolean;
};

export function ProposalHistoryDialog({
  open,
  onClose,
  quotes,
  pdfInputFor,
  logoUrl,
  busy,
  onDuplicate,
  onEditDraft,
}: {
  open: boolean;
  onClose: () => void;
  quotes: ProjectQuote[];
  pdfInputFor: (quote: ProjectQuote) => EstimatePdfInput;
  logoUrl: string;
  busy: boolean;
  onDuplicate: (quote: ProjectQuote) => void;
  onEditDraft: (quote: ProjectQuote) => void;
}) {
  const rows = useMemo(() => newestFirst(quotes), [quotes]);
  const currentId = useMemo(() => getProjectActiveQuote(quotes, "admin")?.quote.id ?? null, [quotes]);
  const [menu, setMenu] = useState<{ anchor: ActionMenuAnchor; quote: ProjectQuote } | null>(null);
  const [view, setView] = useState<ViewState | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setView(null);
      setMenu(null);
    }
  }, [open]);

  /** Stored copy for anything that was sent; drafts and legacy rows rebuild from their own saved fields. */
  async function pdfFor(quote: ProjectQuote): Promise<{ bytes: Uint8Array; source: "stored" | "rebuilt" }> {
    const stored = quote.sent_at ? await fetchStoredProposalPdf(quote.id) : null;
    if (stored) return { bytes: stored, source: "stored" };
    return { bytes: await renderEstimatePdf(pdfInputFor(quote), logoUrl), source: "rebuilt" };
  }

  async function openView(quote: ProjectQuote) {
    setView({ quote, bytes: null, source: null, failed: false });
    try {
      const { bytes, source } = await pdfFor(quote);
      setView((prev) => (prev?.quote.id === quote.id ? { quote, bytes, source, failed: false } : prev));
    } catch {
      setView((prev) => (prev?.quote.id === quote.id ? { ...prev, failed: true } : prev));
    }
  }

  async function download(quote: ProjectQuote) {
    if (downloadingId) return;
    setDownloadingId(quote.id);
    try {
      const { bytes } = await pdfFor(quote);
      downloadEstimatePdf(bytes, `${estimateReference(quote.id)}.pdf`);
    } catch {
      toast.error("Could not create the PDF. Try again.");
    } finally {
      setDownloadingId(null);
    }
  }

  function menuItems(quote: ProjectQuote): ActionMenuItem[] {
    const preliminary = isPreliminaryQuote(quote);
    const editableDraft = !preliminary && quote.status === "draft" && !isArchivedQuote(quote);
    return [
      { id: "view", label: "View", icon: Eye, onSelect: () => void openView(quote) },
      {
        id: "download",
        label: downloadingId === quote.id ? "Preparing PDF…" : "Download PDF",
        icon: Download,
        disabled: downloadingId !== null,
        onSelect: () => void download(quote),
      },
      ...(editableDraft
        ? [{ id: "edit", label: "Edit draft", icon: Pencil, onSelect: () => onEditDraft(quote) } as ActionMenuItem]
        : []),
      ...(!preliminary
        ? [
            {
              id: "duplicate",
              label: "Duplicate & Revise",
              icon: Copy,
              disabled: busy,
              hint: "New draft. This proposal stays as it is.",
              onSelect: () => onDuplicate(quote),
            } as ActionMenuItem,
          ]
        : []),
    ];
  }

  const count = quotes.length;
  const title = view
    ? view.quote.title || "Proposal"
    : `Proposal History — ${count} ${count === 1 ? "Proposal" : "Proposals"}`;

  return (
    <Modal
      open={open}
      // Escape with the row menu open closes only the menu (both listen on document).
      onClose={() => {
        if (!menu) onClose();
      }}
      title={title}
      className={view ? "sm:max-w-3xl" : "sm:max-w-2xl"}
    >
      {view ? (
        <div className="space-y-4 pb-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button variant="ghost" size="sm" onClick={() => setView(null)}>
              <ArrowLeft className="h-4 w-4" /> All proposals
            </Button>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge quote={view.quote} />
              <Button
                variant="outline"
                size="sm"
                disabled={downloadingId !== null}
                onClick={() => void download(view.quote)}
              >
                <Download className="h-4 w-4" /> {downloadingId ? "Preparing…" : "Download PDF"}
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted">
            {estimateReference(view.quote.id)} · {proposalDateLabel(view.quote)} · Read-only
            {view.source === "stored" ? " · The PDF stored when it was sent" : ""}
            {view.source === "rebuilt" ? " · Rebuilt from this proposal’s saved details" : ""}
          </p>
          <div className="rounded-xl bg-slate-100 p-3 ring-1 ring-black/[0.05] sm:p-5">
            {view.failed ? (
              <p className="py-10 text-center text-sm text-red-700">This proposal couldn’t be displayed. Try downloading it instead.</p>
            ) : view.bytes ? (
              <PdfPages bytes={view.bytes} label={`${view.quote.title} PDF`} className="mx-auto max-w-[680px]" />
            ) : (
              <p className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading proposal…
              </p>
            )}
          </div>
        </div>
      ) : rows.length === 0 ? (
        <p className="pb-5 text-sm text-muted">No proposals yet.</p>
      ) : (
        <ul className="-mx-2 divide-y divide-border pb-3" aria-label="Proposals, newest first">
          {rows.map((quote) => {
            const current = quote.id === currentId;
            return (
              <li key={quote.id} className="flex items-start gap-3 px-2 py-3">
                <button
                  type="button"
                  className="min-w-0 flex-1 rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  onClick={() => void openView(quote)}
                >
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="truncate font-medium text-heading">{quote.title || "Untitled proposal"}</span>
                    {current ? (
                      <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[11px] font-semibold text-accent">
                        Current
                      </span>
                    ) : null}
                  </span>
                  <span className="mt-0.5 line-clamp-1 block text-sm text-muted">{proposalSummary(quote)}</span>
                  <span className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                    <StatusBadge quote={quote} />
                    <span>{proposalDateLabel(quote)}</span>
                    <span className="sm:hidden font-medium text-heading">{formatCurrency(quote.total_cents)}</span>
                  </span>
                </button>
                <span className="hidden shrink-0 pt-0.5 text-sm font-semibold tabular-nums text-heading sm:block">
                  {formatCurrency(quote.total_cents)}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="min-h-9 min-w-9 shrink-0"
                  aria-label={`Actions for ${quote.title || "proposal"}`}
                  aria-haspopup="menu"
                  onClick={(event) => setMenu({ anchor: { kind: "element", element: event.currentTarget }, quote })}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </li>
            );
          })}
        </ul>
      )}
      <ActionMenu
        anchor={menu?.anchor ?? null}
        onClose={() => setMenu(null)}
        title={menu?.quote.title || "Proposal"}
        items={menu ? menuItems(menu.quote) : []}
      />
    </Modal>
  );
}

function StatusBadge({ quote }: { quote: ProjectQuote }) {
  const status = proposalHistoryStatus(quote);
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset",
        TONE_CLASS[status.tone]
      )}
    >
      {status.label}
    </span>
  );
}
