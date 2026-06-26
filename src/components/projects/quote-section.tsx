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
import { ProposalCard } from "@/components/projects/proposal-card";
import type { ProjectQuote, QuoteLineItem } from "@/lib/types";
import {
  getClientActiveQuote,
  getMainOfficialQuote,
  getPreliminaryQuote,
  hasOfficialProposal,
  isPreliminaryQuote,
} from "@/lib/quote-display";
import { formatCurrency } from "@/lib/utils";
import {
  FileText, Plus, Trash2, Send, Check, MessageSquare,
  Copy, Pencil, AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";

interface QuoteSectionProps {
  projectId: string;
  quotes: ProjectQuote[];
  isAdmin: boolean;
  allowClientProposalChanges?: boolean;
  onStatusChange?: (status: string) => void;
}

const emptyForm = {
  title: "",
  description: "",
  notes: "",
  expires_at: "",
  line_items: [{ description: "", amount_cents: 0 }] as QuoteLineItem[],
};

export function QuoteSection({
  projectId,
  quotes: initialQuotes,
  isAdmin,
  allowClientProposalChanges = true,
  onStatusChange,
}: QuoteSectionProps) {
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
  const clientActive = !isAdmin ? getClientActiveQuote(quotes) : null;
  const adminActiveQuote = isAdmin
    ? mainOfficialQuote
      ? { quote: mainOfficialQuote, kind: "official" as const }
      : preliminaryQuote
        ? { quote: preliminaryQuote, kind: "preliminary" as const }
        : null
    : null;

  const activeDisplay = isAdmin ? adminActiveQuote : clientActive;

  const changesRequestedQuote = quotes.find(
    (q) => !isPreliminaryQuote(q) && q.status === "changes_requested"
  );
  const draftQuotes = quotes.filter((q) => !isPreliminaryQuote(q) && q.status === "draft");
  const officialExists = hasOfficialProposal(quotes);
  const historyQuotes = quotes.filter((q) => {
    if (activeDisplay?.quote.id === q.id) return false;
    if (draftQuotes.some((d) => d.id === q.id)) return false;
    if (officialExists && isPreliminaryQuote(q)) return false;
    return true;
  });
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

  function renderAdminActions(quote: ProjectQuote) {
    const preliminary = isPreliminaryQuote(quote);

    if (preliminary) {
      return (
        <>
          <Button variant="outline" size="sm" onClick={() => openEditForm(quote)}>
            <Pencil className="h-4 w-4" /> Edit Estimate
          </Button>
        </>
      );
    }

    if (quote.status === "draft") {
      return (
        <>
          <Button variant="outline" size="sm" onClick={() => openEditForm(quote)}>
            <Pencil className="h-4 w-4" /> Edit Draft
          </Button>
          <Button
            variant="accent"
            size="sm"
            disabled={loading}
            onClick={async () => {
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
            }}
          >
            <Send className="h-4 w-4" /> Send
          </Button>
        </>
      );
    }

    if (quote.status !== "approved") {
      return (
        <Button variant="outline" size="sm" disabled={loading} onClick={() => duplicateQuote(quote)}>
          <Copy className="h-4 w-4" /> Duplicate & Revise
        </Button>
      );
    }

    return null;
  }

  function renderClientActions(quote: ProjectQuote) {
    if (quote.status === "sent") {
      return (
        <>
          <Button variant="accent" disabled={approving} onClick={() => quoteAction(quote.id, "approve")}>
            <Check className="h-4 w-4" /> Approve Proposal
          </Button>
          {allowClientProposalChanges && (
            <Button
              variant="outline"
              onClick={() => {
                const fb = changeFeedback || prompt("What changes would you like?");
                if (fb) quoteAction(quote.id, "request_changes", fb);
              }}
            >
              <MessageSquare className="h-4 w-4" /> Request Changes
            </Button>
          )}
        </>
      );
    }
    return null;
  }

  function renderQuoteForm() {
    return (
      <div className="space-y-4 rounded-2xl bg-slate-50/60 p-6 ring-1 ring-black/[0.04]">
        <p className="text-sm font-medium text-primary">
          {editingId ? "Edit draft proposal" : "New proposal"}
        </p>
        <div className="space-y-2">
          <Label>Proposal Title</Label>
          <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Aerial Media Package" />
        </div>
        <div className="space-y-2">
          <Label>Description & Includes</Label>
          <Textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={8}
            placeholder={"Optional intro paragraph\n\nIncludes\n• Deliverable one\n• Deliverable two"}
          />
        </div>
        <div className="space-y-2">
          <Label>Line Items</Label>
          {form.line_items.map((item, i) => (
            <div key={`form-line-${i}`} className="flex gap-2">
              <Input
                placeholder="Package name"
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

  const sectionTitle = isAdmin
    ? "Estimates & Proposals"
    : activeDisplay?.kind === "official"
      ? "Official Proposal"
      : "Preliminary Estimate";

  return (
    <section id="quote" className="scroll-mt-20">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h2 className="flex items-center gap-2 text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
          <FileText className="h-5 w-5 text-accent" />
          {sectionTitle}
        </h2>
        {isAdmin && !showForm && (
          <Button variant="outline" size="sm" onClick={openCreateForm}>
            {mainOfficialQuote ? "New Official Proposal" : "Create Official Proposal"}
          </Button>
        )}
      </div>

      <div className="space-y-6">
        {isAdmin && changesRequestedQuote && !showForm && (
          <Card className="border-amber-200/80 bg-amber-50/50 shadow-none">
            <CardContent className="space-y-3 p-5">
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
            </CardContent>
          </Card>
        )}

        {activeDisplay && !showForm && (
          <ProposalCard
            quote={activeDisplay.quote}
            kind={activeDisplay.kind}
            isAdmin={isAdmin}
            actions={
              isAdmin
                ? renderAdminActions(activeDisplay.quote)
                : activeDisplay.kind === "official"
                  ? renderClientActions(activeDisplay.quote)
                  : null
            }
          />
        )}

        {!activeDisplay && !showForm && (
          <Card className="border-0 bg-slate-50/50 shadow-none ring-1 ring-black/[0.04]">
            <CardContent className="py-12 text-center">
              <p className="text-sm text-muted">
                {isAdmin
                  ? "A preliminary estimate is generated automatically when a client requests a project."
                  : "Your preliminary estimate will appear here shortly after your request is submitted."}
              </p>
            </CardContent>
          </Card>
        )}

        {showForm && (
          <>
            {editingPreliminary ? (
              <div className="space-y-4 rounded-2xl bg-slate-50/60 p-6 ring-1 ring-black/[0.04]">
                <p className="text-sm font-medium text-primary">Edit preliminary estimate</p>
                <div className="space-y-2">
                  <Label>Title</Label>
                  <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Description & Includes</Label>
                  <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={8} />
                </div>
                <div className="space-y-2">
                  <Label>Package Price</Label>
                  {form.line_items.map((item, i) => (
                    <div key={`prelim-line-${i}`} className="flex gap-2">
                      <Input
                        placeholder="Package name"
                        value={item.description}
                        onChange={(e) => updateLineItem(i, "description", e.target.value)}
                        className="flex-1"
                      />
                      <CurrencyInput
                        valueCents={item.amount_cents}
                        onChangeCents={(cents) => updateLineItem(i, "amount_cents", cents)}
                        className="w-32"
                      />
                    </div>
                  ))}
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
          <Card className="border-dashed shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-muted">Draft proposals</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {draftQuotes.map((d) => (
                <div key={`draft-${d.id}`} className="flex items-center justify-between text-sm">
                  <span>{d.title}</span>
                  <Button variant="ghost" size="sm" onClick={() => openEditForm(d)}>Edit</Button>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {isAdmin && historyQuotes.length > 0 && (
          <Card className="border-0 bg-transparent shadow-none">
            <CardHeader className="px-0">
              <CardTitle className="text-sm font-semibold text-slate-700">Proposal History</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 px-0">
              {historyQuotes.map((q) => (
                <div key={`history-${q.id}`} className="rounded-xl bg-slate-50/80 px-4 py-3 text-sm ring-1 ring-black/[0.04]">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">{q.title}</span>
                    <div className="flex items-center gap-2">
                      {q.total_cents > 0 && (
                        <span className="text-xs font-medium text-muted">{formatCurrency(q.total_cents)}</span>
                      )}
                      <Badge variant={q.status === "approved" ? "success" : q.status === "changes_requested" ? "warning" : "default"}>
                        {isPreliminaryQuote(q) ? "preliminary" : q.status.replace("_", " ")}
                      </Badge>
                    </div>
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
            </CardContent>
          </Card>
        )}
      </div>
    </section>
  );
}
