"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CurrencyInput } from "@/components/ui/currency-input";
import type { ProjectQuote, QuoteLineItem } from "@/lib/types";
import { PRELIMINARY_ESTIMATE_DISCLAIMER } from "@/lib/service-templates";
import { formatCurrency } from "@/lib/utils";
import {
  FileText, Plus, Trash2, Send, Check, MessageSquare, CheckCircle2,
  Copy, Pencil, AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";

interface QuoteSectionProps {
  projectId: string;
  quotes: ProjectQuote[];
  isAdmin: boolean;
  onStatusChange?: (status: string) => void;
}

function isPreliminaryQuote(quote: ProjectQuote): boolean {
  return quote.quote_kind === "preliminary" || quote.title.startsWith("Preliminary Estimate");
}

function getPreliminaryQuote(quotes: ProjectQuote[]): ProjectQuote | null {
  return quotes.find((q) => isPreliminaryQuote(q)) ?? null;
}

function getMainOfficialQuote(quotes: ProjectQuote[], isAdmin: boolean): ProjectQuote | null {
  const official = quotes.filter((q) => !isPreliminaryQuote(q));
  const visible = isAdmin ? official : official.filter((q) => q.status !== "draft");
  const approved = visible.find((q) => q.status === "approved");
  if (approved) return approved;

  const latestSent = [...visible]
    .filter((q) => q.status === "sent")
    .sort(
      (a, b) =>
        new Date(b.sent_at ?? b.created_at).getTime() -
        new Date(a.sent_at ?? a.created_at).getTime()
    )[0];
  if (latestSent) return latestSent;

  const changesRequested = visible.find((q) => q.status === "changes_requested");
  if (changesRequested) return changesRequested;

  return visible.find((q) => q.status === "draft") ?? null;
}

const emptyForm = {
  title: "",
  description: "",
  notes: "",
  expires_at: "",
  line_items: [{ description: "", amount_cents: 0 }] as QuoteLineItem[],
};

export function QuoteSection({ projectId, quotes: initialQuotes, isAdmin, onStatusChange }: QuoteSectionProps) {
  const router = useRouter();
  const [quotes, setQuotes] = useState(initialQuotes);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [approving, setApproving] = useState(false);
  const [converting, setConverting] = useState(false);
  const [changeFeedback, setChangeFeedback] = useState("");
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    setQuotes(initialQuotes);
  }, [initialQuotes]);

  const preliminaryQuote = getPreliminaryQuote(quotes);
  const mainOfficialQuote = getMainOfficialQuote(quotes, isAdmin);
  const changesRequestedQuote = quotes.find(
    (q) => !isPreliminaryQuote(q) && q.status === "changes_requested"
  );
  const draftQuotes = quotes.filter((q) => !isPreliminaryQuote(q) && q.status === "draft");
  const editingPreliminary = editingId && preliminaryQuote?.id === editingId;

  function updateLineItem(index: number, field: keyof QuoteLineItem, value: string | number) {
    setForm((f) => {
      const items = [...f.line_items];
      items[index] = { ...items[index], [field]: value };
      return { ...f, line_items: items };
    });
  }

  const totalCents = form.line_items.reduce((s, i) => s + (Number(i.amount_cents) || 0), 0);

  function openCreateForm() {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
  }

  function openEditForm(quote: ProjectQuote) {
    setEditingId(quote.id);
    setForm({
      title: quote.title,
      description: quote.description || "",
      notes: quote.notes || "",
      expires_at: quote.expires_at ? quote.expires_at.split("T")[0] : "",
      line_items: (quote.line_items as QuoteLineItem[]).map((i) => ({ ...i })),
    });
    setShowForm(true);
  }

  async function duplicateQuote(source: ProjectQuote) {
    setLoading(true);
    const res = await fetch("/api/quotes", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ id: source.id, action: "duplicate" }),
    });
    setLoading(false);
    if (res.ok) {
      const draft = await res.json();
      setQuotes((prev) => [draft, ...prev]);
      openEditForm(draft);
      toast.success("Draft revision created — edit and send when ready");
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error || "Failed to duplicate proposal");
    }
  }

  async function submitQuote(send: boolean) {
    setLoading(true);

    const payload = {
      title: form.title,
      description: form.description,
      notes: form.notes,
      expires_at: form.expires_at || null,
      line_items: form.line_items.map((i) => ({
        description: i.description,
        amount_cents: Number(i.amount_cents) || 0,
      })),
    };

    if (editingId) {
      const updateRes = await fetch("/api/quotes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ id: editingId, action: "update", ...payload }),
      });
      if (!updateRes.ok) {
        setLoading(false);
        toast.error("Failed to update draft");
        return;
      }
      if (send) {
        const sendRes = await fetch("/api/quotes", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ id: editingId, action: "send" }),
        });
        setLoading(false);
        if (sendRes.ok) {
          const updated = await sendRes.json();
          setQuotes((prev) => prev.map((q) => (q.id === editingId ? updated : q)));
          onStatusChange?.("quote_sent");
          toast.success("Revised proposal sent to client");
          setShowForm(false);
          setEditingId(null);
          setForm(emptyForm);
          router.refresh();
        } else {
          toast.error("Failed to send proposal");
        }
        return;
      }
      const updated = await updateRes.json();
      setQuotes((prev) => prev.map((q) => (q.id === editingId ? updated : q)));
      setLoading(false);
      toast.success("Draft saved");
      setShowForm(false);
      router.refresh();
      return;
    }

    const res = await fetch("/api/quotes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ project_id: projectId, ...payload, send }),
    });
    setLoading(false);
    if (res.ok) {
      const quote = await res.json();
      setQuotes((prev) => [quote, ...prev]);
      if (send) onStatusChange?.("quote_sent");
      toast.success(send ? "Quote sent to client" : "Quote saved");
      setShowForm(false);
      setForm(emptyForm);
      router.refresh();
    } else {
      toast.error("Failed to save quote");
    }
  }

  async function convertToOfficial() {
    if (!preliminaryQuote) return;
    setConverting(true);
    const res = await fetch("/api/quotes", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        id: preliminaryQuote.id,
        action: "convert_to_official",
        title: form.title || undefined,
        description: form.description || undefined,
        notes: form.notes || undefined,
        expires_at: form.expires_at || null,
        line_items: form.line_items.map((i) => ({
          description: i.description,
          amount_cents: Number(i.amount_cents) || 0,
        })),
      }),
    });
    setConverting(false);
    if (res.ok) {
      const official = await res.json();
      setQuotes((prev) => [official, ...prev]);
      onStatusChange?.("quote_sent");
      toast.success("Official proposal sent to client");
      setShowForm(false);
      setEditingId(null);
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error || "Failed to convert estimate");
    }
  }

  async function savePreliminaryEdits() {
    if (!preliminaryQuote) return;
    setLoading(true);
    const res = await fetch("/api/quotes", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        id: preliminaryQuote.id,
        action: "update",
        title: form.title,
        description: form.description,
        notes: form.notes,
        expires_at: form.expires_at || null,
        line_items: form.line_items.map((i) => ({
          description: i.description,
          amount_cents: Number(i.amount_cents) || 0,
        })),
      }),
    });
    setLoading(false);
    if (res.ok) {
      const updated = await res.json();
      setQuotes((prev) => prev.map((q) => (q.id === updated.id ? updated : q)));
      toast.success("Preliminary estimate saved");
      setShowForm(false);
      setEditingId(null);
      router.refresh();
    } else {
      toast.error("Failed to save estimate");
    }
  }

  function renderDisclaimer() {
    return (
      <div className="rounded-xl border border-sky-200 bg-sky-50/80 p-4 space-y-2">
        <p className="text-sm font-semibold text-primary">About this Preliminary Estimate</p>
        <p className="text-sm text-muted leading-relaxed">{PRELIMINARY_ESTIMATE_DISCLAIMER}</p>
        <p className="text-xs text-muted">
          This is not the final proposal. Final pricing will be confirmed after Swift Aerial Media
          reviews the property, schedules the shoot, and confirms the project scope.
        </p>
      </div>
    );
  }

  async function quoteAction(id: string, action: string, feedback?: string) {
    if (action === "approve") setApproving(true);
    const res = await fetch("/api/quotes", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ id, action, feedback }),
    });
    if (res.ok) {
      const updated = await res.json();
      setQuotes((prev) => prev.map((q) => (q.id === id ? updated : q)));
      if (action === "approve") {
        onStatusChange?.("proposal_approved");
        toast.success("Proposal approved!");
      } else {
        toast.success("Feedback sent");
      }
      router.refresh();
    }
    setApproving(false);
  }

  function renderQuoteForm() {
    return (
      <div className="space-y-4 rounded-xl border border-border p-5 bg-slate-50/50">
        <p className="text-sm font-medium text-primary">
          {editingId ? "Edit draft proposal" : "New proposal"}
        </p>
        <div className="space-y-2">
          <Label>Proposal Title</Label>
          <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Aerial Media Package" />
        </div>
        <div className="space-y-2">
          <Label>Description</Label>
          <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
        </div>
        <div className="space-y-2">
          <Label>Line Items</Label>
          {form.line_items.map((item, i) => (
            <div key={`form-line-${i}`} className="flex gap-2">
              <Input
                placeholder="Service description"
                value={item.description}
                onChange={(e) => updateLineItem(i, "description", e.target.value)}
                className="flex-1"
              />
              <CurrencyInput
                valueCents={item.amount_cents}
                onChangeCents={(cents) => updateLineItem(i, "amount_cents", cents)}
                className="w-32"
              />
              {form.line_items.length > 1 && (
                <Button variant="ghost" size="sm" onClick={() => setForm((f) => ({ ...f, line_items: f.line_items.filter((_, j) => j !== i) }))}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
          <Button variant="ghost" size="sm" onClick={() => setForm((f) => ({ ...f, line_items: [...f.line_items, { description: "", amount_cents: 0 }] }))}>
            <Plus className="h-4 w-4" /> Add Line Item
          </Button>
        </div>
        <p className="text-sm font-medium">Total: {formatCurrency(totalCents)}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Expiration Date</Label>
            <Input type="date" value={form.expires_at} onChange={(e) => setForm({ ...form, expires_at: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Notes</Label>
            <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="accent" disabled={loading || !form.title} onClick={() => submitQuote(true)}>
            <Send className="h-4 w-4" /> Send to Client
          </Button>
          {editingId && (
            <Button variant="outline" disabled={loading || !form.title} onClick={() => submitQuote(false)}>
              Save Draft
            </Button>
          )}
          <Button variant="outline" onClick={() => { setShowForm(false); setEditingId(null); setForm(emptyForm); }}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  function renderQuote(quote: ProjectQuote, options?: { showDisclaimer?: boolean }) {
    const isApproved = quote.status === "approved";
    const preliminary = isPreliminaryQuote(quote);

    return (
      <div className="rounded-xl border border-border bg-white p-6 space-y-4">
        {options?.showDisclaimer && renderDisclaimer()}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-primary">
              {preliminary ? quote.title.replace(/^Preliminary Estimate — /, "") : quote.title}
            </h3>
            {quote.description && (
              <p className="text-sm text-muted mt-1 whitespace-pre-line">{quote.description}</p>
            )}
          </div>
          <Badge variant={isApproved ? "success" : quote.status === "changes_requested" ? "warning" : "default"}>
            {preliminary ? "Preliminary" : isApproved ? "Approved" : quote.status.replace("_", " ")}
          </Badge>
        </div>
        <div className="divide-y divide-border rounded-lg border border-border">
          {(quote.line_items as QuoteLineItem[]).map((item, i) => (
            <div key={`line-${quote.id}-${i}`} className="flex justify-between px-4 py-3 text-sm">
              <span>{item.description}</span>
              <span className="font-medium">{formatCurrency(item.amount_cents)}</span>
            </div>
          ))}
          <div className="flex justify-between px-4 py-3 font-semibold bg-slate-50">
            <span>Total</span>
            <span className="text-primary">{formatCurrency(quote.total_cents)}</span>
          </div>
        </div>
        {quote.notes && <p className="text-sm text-muted"><strong>Notes:</strong> {quote.notes}</p>}
        {quote.expires_at && (
          <p className="text-xs text-muted">Valid until {new Date(quote.expires_at).toLocaleDateString()}</p>
        )}

        {isAdmin && (
          <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
            {preliminary && (
              <>
                <Button variant="outline" size="sm" onClick={() => openEditForm(quote)}>
                  <Pencil className="h-4 w-4" /> Edit Estimate
                </Button>
              </>
            )}
            {!preliminary && quote.status === "draft" && (
              <>
                <Button variant="outline" size="sm" onClick={() => openEditForm(quote)}>
                  <Pencil className="h-4 w-4" /> Edit Draft
                </Button>
                <Button variant="accent" size="sm" disabled={loading} onClick={async () => {
                  const res = await fetch("/api/quotes", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify({ id: quote.id, action: "send" }),
                  });
                  if (res.ok) {
                    toast.success("Proposal sent");
                    router.refresh();
                  }
                }}>
                  <Send className="h-4 w-4" /> Send
                </Button>
              </>
            )}
            {!preliminary && quote.status !== "draft" && quote.status !== "approved" && (
              <Button variant="outline" size="sm" disabled={loading} onClick={() => duplicateQuote(quote)}>
                <Copy className="h-4 w-4" /> Duplicate & Revise
              </Button>
            )}
          </div>
        )}

        {!isAdmin && !preliminary && quote.status === "sent" && (
          <div className="flex flex-wrap gap-2 pt-2">
            <Button variant="accent" disabled={approving} onClick={() => quoteAction(quote.id, "approve")}>
              <Check className="h-4 w-4" /> Approve Proposal
            </Button>
            <Button variant="outline" onClick={() => {
              const fb = changeFeedback || prompt("What changes would you like?");
              if (fb) quoteAction(quote.id, "request_changes", fb);
            }}>
              <MessageSquare className="h-4 w-4" /> Request Changes
            </Button>
          </div>
        )}
        {isApproved && !isAdmin && (
          <div className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-800">
            <CheckCircle2 className="h-5 w-5 shrink-0" />
            <span>Proposal approved{quote.approved_at ? ` on ${new Date(quote.approved_at).toLocaleDateString()}` : ""}</span>
          </div>
        )}
      </div>
    );
  }

  const sectionTitle = isAdmin
    ? "Estimates & Proposals"
    : mainOfficialQuote
      ? "Official Proposal"
      : "Preliminary Estimate";

  return (
    <Card className="shadow-sm" id="quote">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-base">
          <FileText className="h-5 w-5 text-accent" /> {sectionTitle}
        </CardTitle>
        {isAdmin && !showForm && (
          <Button variant="outline" size="sm" onClick={openCreateForm}>
            {mainOfficialQuote ? "New Official Proposal" : "Create Official Proposal"}
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {isAdmin && changesRequestedQuote && !showForm && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-amber-900">Client requested changes</p>
                {changesRequestedQuote.changes_feedback && (
                  <p className="text-sm text-amber-800 mt-1">&ldquo;{changesRequestedQuote.changes_feedback}&rdquo;</p>
                )}
              </div>
            </div>
            <Button variant="accent" size="sm" disabled={loading} onClick={() => duplicateQuote(changesRequestedQuote)}>
              <Copy className="h-4 w-4" /> Create Revised Proposal
            </Button>
          </div>
        )}

        {preliminaryQuote && !showForm && (
          <div className="space-y-3">
            {!isAdmin && renderDisclaimer()}
            {renderQuote(preliminaryQuote, { showDisclaimer: false })}
          </div>
        )}

        {mainOfficialQuote && !showForm && (
          <div className="space-y-3">
            {preliminaryQuote && (
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Official Proposal</p>
            )}
            {renderQuote(mainOfficialQuote)}
          </div>
        )}

        {!preliminaryQuote && !mainOfficialQuote && !showForm && (
          <p className="text-sm text-muted text-center py-6">
            {isAdmin
              ? "A preliminary estimate is generated automatically when a client requests a project."
              : "Your preliminary estimate will appear here shortly after your request is submitted."}
          </p>
        )}

        {showForm && (
          <>
            {editingPreliminary ? (
              <div className="space-y-4 rounded-xl border border-border p-5 bg-slate-50/50">
                <p className="text-sm font-medium text-primary">Edit preliminary estimate</p>
                <div className="space-y-2">
                  <Label>Title</Label>
                  <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Package Description</Label>
                  <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={6} />
                </div>
                <div className="space-y-2">
                  <Label>Line Items</Label>
                  {form.line_items.map((item, i) => (
                    <div key={`prelim-line-${i}`} className="flex gap-2">
                      <Input
                        placeholder="Service description"
                        value={item.description}
                        onChange={(e) => updateLineItem(i, "description", e.target.value)}
                        className="flex-1"
                      />
                      <CurrencyInput
                        valueCents={item.amount_cents}
                        onChangeCents={(cents) => updateLineItem(i, "amount_cents", cents)}
                        className="w-32"
                      />
                      {form.line_items.length > 1 && (
                        <Button variant="ghost" size="sm" onClick={() => setForm((f) => ({ ...f, line_items: f.line_items.filter((_, j) => j !== i) }))}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button variant="ghost" size="sm" onClick={() => setForm((f) => ({ ...f, line_items: [...f.line_items, { description: "", amount_cents: 0 }] }))}>
                    <Plus className="h-4 w-4" /> Add Line Item
                  </Button>
                </div>
                <p className="text-sm font-medium">Total: {formatCurrency(totalCents)}</p>
                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" disabled={loading || !form.title} onClick={savePreliminaryEdits}>
                    Save Estimate
                  </Button>
                  <Button variant="accent" disabled={converting || loading || !form.title} onClick={convertToOfficial}>
                    <Send className="h-4 w-4" /> Convert to Official Proposal
                  </Button>
                  <Button variant="outline" onClick={() => { setShowForm(false); setEditingId(null); setForm(emptyForm); }}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              renderQuoteForm()
            )}
          </>
        )}

        {isAdmin && draftQuotes.length > 0 && !showForm && (
          <div className="rounded-lg border border-dashed border-border p-4">
            <p className="text-xs font-semibold uppercase text-muted mb-2">Draft proposals</p>
            <div className="space-y-2">
              {draftQuotes.map((d) => (
                <div key={`draft-${d.id}`} className="flex items-center justify-between text-sm">
                  <span>{d.title}</span>
                  <Button variant="ghost" size="sm" onClick={() => openEditForm(d)}>Edit</Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {isAdmin && quotes.length > 0 && (
          <div className="border-t border-border pt-6">
            <h3 className="text-sm font-semibold text-primary mb-3">Proposal History</h3>
            <div className="space-y-2">
              {quotes.map((q) => (
                <div key={`history-${q.id}`} className="rounded-lg border border-border px-4 py-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">{q.title}</span>
                    <Badge variant={q.status === "approved" ? "success" : q.status === "changes_requested" ? "warning" : "default"}>
                      {isPreliminaryQuote(q) ? "preliminary" : q.status.replace("_", " ")}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted mt-1">
                    Created {new Date(q.created_at).toLocaleString()}
                    {q.sent_at && ` · Sent ${new Date(q.sent_at).toLocaleString()}`}
                    {q.approved_at && ` · Approved ${new Date(q.approved_at).toLocaleString()}`}
                  </p>
                  {q.changes_feedback && (
                    <p className="text-xs text-amber-800 mt-2 bg-amber-50 rounded p-2">
                      <strong>Client feedback:</strong> {q.changes_feedback}
                    </p>
                  )}
                  {q.notes && <p className="text-xs text-muted mt-1"><strong>Notes:</strong> {q.notes}</p>}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
