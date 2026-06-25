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
import { formatCurrency } from "@/lib/utils";
import { FileText, Plus, Trash2, Send, Check, MessageSquare, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

interface QuoteSectionProps {
  projectId: string;
  quotes: ProjectQuote[];
  isAdmin: boolean;
  onStatusChange?: (status: string) => void;
}

export function QuoteSection({ projectId, quotes: initialQuotes, isAdmin, onStatusChange }: QuoteSectionProps) {
  const router = useRouter();
  const [quotes, setQuotes] = useState(initialQuotes);

  useEffect(() => {
    setQuotes(initialQuotes);
  }, [initialQuotes]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [approving, setApproving] = useState(false);
  const [changeFeedback, setChangeFeedback] = useState("");
  const [form, setForm] = useState({
    title: "",
    description: "",
    notes: "",
    expires_at: "",
    line_items: [{ description: "", amount_cents: 0 }] as QuoteLineItem[],
  });

  const activeQuote = quotes.find((q) => ["sent", "changes_requested"].includes(q.status));
  const approvedQuote = quotes.find((q) => q.status === "approved");
  const mainQuote = approvedQuote ?? activeQuote ?? quotes[0] ?? null;

  function updateLineItem(index: number, field: keyof QuoteLineItem, value: string | number) {
    setForm((f) => {
      const items = [...f.line_items];
      items[index] = { ...items[index], [field]: value };
      return { ...f, line_items: items };
    });
  }

  const totalCents = form.line_items.reduce((s, i) => s + (Number(i.amount_cents) || 0), 0);

  async function submitQuote(send: boolean) {
    setLoading(true);
    const res = await fetch("/api/quotes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        project_id: projectId,
        title: form.title,
        description: form.description,
        notes: form.notes,
        expires_at: form.expires_at || null,
        line_items: form.line_items.map((i) => ({
          description: i.description,
          amount_cents: Number(i.amount_cents) || 0,
        })),
        send,
      }),
    });
    setLoading(false);
    if (res.ok) {
      const quote = await res.json();
      setQuotes((prev) => [quote, ...prev]);
      if (send) onStatusChange?.("quote_sent");
      toast.success(send ? "Quote sent to client" : "Quote saved");
      setShowForm(false);
      setForm({
        title: "",
        description: "",
        notes: "",
        expires_at: "",
        line_items: [{ description: "", amount_cents: 0 }],
      });
      router.refresh();
    } else {
      toast.error("Failed to save quote");
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

  function renderQuote(quote: ProjectQuote, sectionKey: string) {
    const isApproved = quote.status === "approved";

    return (
      <div key={`quote-${sectionKey}-${quote.id}`} className="rounded-xl border border-border bg-white p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-primary">{quote.title}</h3>
            {quote.description && <p className="text-sm text-muted mt-1">{quote.description}</p>}
          </div>
          <Badge variant={isApproved ? "success" : quote.status === "changes_requested" ? "warning" : "default"}>
            {isApproved ? "Approved" : quote.status.replace("_", " ")}
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
        {!isAdmin && quote.status === "sent" && (
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

  return (
    <Card className="shadow-sm" id="quote">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-base">
          <FileText className="h-5 w-5 text-accent" /> Quote & Proposal
        </CardTitle>
        {isAdmin && !showForm && !mainQuote && (
          <Button variant="outline" size="sm" onClick={() => setShowForm(true)}>Create Quote</Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {mainQuote && renderQuote(mainQuote, "main")}
        {!mainQuote && !showForm && (
          <p className="text-sm text-muted text-center py-6">
            {isAdmin ? "Create a quote to send to the client." : "Your quote will appear here once Swift Aerial Media sends it."}
          </p>
        )}

        {showForm && isAdmin && (
          <div className="space-y-4 rounded-xl border border-border p-5">
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
            <div className="flex gap-2">
              <Button variant="accent" disabled={loading || !form.title} onClick={() => submitQuote(true)}>
                <Send className="h-4 w-4" /> Send to Client
              </Button>
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
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
                      {q.status.replace("_", " ")}
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
