"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Eye, EyeOff, Pencil, Plus, Quote, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { WEBSITE_LIMITS, type WebsiteTestimonial, type WebsiteTestimonials } from "@/lib/website/settings";

type Draft = { id: string | null; quote: string; name: string; title: string };

function newId(): string {
  return `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Settings → Business Website → Client Testimonials. Reviews are typed or pasted by the business;
 * nothing is generated or pulled from client records. Edits are draft until Save Settings.
 */
export function TestimonialsPanel({
  value,
  onChange,
  onPreview,
}: {
  value: WebsiteTestimonials;
  onChange: (next: WebsiteTestimonials) => void;
  /** Show the homepage in the live preview. */
  onPreview: () => void;
}) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const items = value.items;
  const visibleCount = items.filter((t) => t.visible).length;

  const setItems = (next: WebsiteTestimonial[], enable = value.enabled) => {
    onChange({ enabled: enable, items: next });
    onPreview();
  };

  const save = () => {
    if (!draft || !draft.quote.trim()) return;
    const row: WebsiteTestimonial = {
      id: draft.id ?? newId(),
      quote: draft.quote.trim().slice(0, WEBSITE_LIMITS.testimonialQuote),
      name: draft.name.trim(),
      title: draft.title.trim(),
      visible: draft.id ? items.find((t) => t.id === draft.id)?.visible ?? true : true,
    };
    const next = draft.id ? items.map((t) => (t.id === draft.id ? row : t)) : [...items, row];
    // Adding the first review turns the section on (still a draft until Save Settings).
    setItems(next, value.enabled || (!draft.id && items.length === 0));
    setDraft(null);
  };

  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j]!, next[i]!];
    setItems(next);
  };

  const form = draft ? (
    <div className="space-y-3 rounded-lg border border-accent/40 bg-accent/5 p-3">
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="testimonial-quote">Review</Label>
          <span className="text-xs text-muted">
            {draft.quote.length}/{WEBSITE_LIMITS.testimonialQuote}
          </span>
        </div>
        <Textarea
          id="testimonial-quote"
          rows={4}
          autoFocus
          maxLength={WEBSITE_LIMITS.testimonialQuote}
          value={draft.quote}
          onChange={(e) => setDraft({ ...draft, quote: e.target.value })}
          placeholder="Paste what your client said…"
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="testimonial-name">Client name (optional)</Label>
          <Input id="testimonial-name" maxLength={WEBSITE_LIMITS.testimonialName} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Jamie R." />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="testimonial-title">Title or company (optional)</Label>
          <Input id="testimonial-title" maxLength={WEBSITE_LIMITS.testimonialTitle} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="Realtor, Coastal Realty" />
        </div>
      </div>
      <p className="text-xs text-muted">Only publish reviews — and names — your client has agreed to share publicly.</p>
      <div className="flex gap-2">
        <Button type="button" size="sm" variant="accent" disabled={!draft.quote.trim()} onClick={save}>
          {draft.id ? "Update review" : "Add review"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setDraft(null)}>
          Cancel
        </Button>
      </div>
    </div>
  ) : null;

  return (
    <div className="space-y-4">
      <label className="flex items-center justify-between gap-3 text-sm">
        <span>
          Show testimonials on the homepage
          <span className="block text-xs text-muted">Appears below your services. Hidden automatically while there are no reviews.</span>
        </span>
        <Switch
          checked={value.enabled}
          onCheckedChange={(enabled) => {
            onChange({ ...value, enabled });
            onPreview();
          }}
        />
      </label>

      {items.length ? (
        <ul className="space-y-2">
          {items.map((t, i) =>
            draft?.id === t.id ? (
              <li key={t.id}>{form}</li>
            ) : (
              <li key={t.id} className={cn("rounded-lg border border-border bg-white p-3 surface-dark:bg-card", !t.visible && "opacity-60")}>
                <p className="line-clamp-3 whitespace-pre-line text-sm text-heading">“{t.quote}”</p>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <p className="min-w-0 truncate text-xs text-muted">
                    {[t.name, t.title].filter(Boolean).join(", ") || "No name shown"}
                    {!t.visible ? " · Hidden" : ""}
                  </p>
                  <div className="flex items-center">
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)}>
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8" aria-label="Move down" disabled={i === items.length - 1} onClick={() => move(i, 1)}>
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      aria-label={t.visible ? "Hide from website" : "Show on website"}
                      title={t.visible ? "Shown on your website — click to hide" : "Hidden — click to show"}
                      onClick={() => setItems(items.map((x) => (x.id === t.id ? { ...x, visible: !x.visible } : x)))}
                    >
                      {t.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                    </Button>
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8" aria-label="Edit review" onClick={() => setDraft({ id: t.id, quote: t.quote, name: t.name, title: t.title })}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      aria-label="Delete review"
                      onClick={() => {
                        if (window.confirm("Delete this review?")) setItems(items.filter((x) => x.id !== t.id));
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </li>
            )
          )}
        </ul>
      ) : !draft ? (
        <div className="rounded-lg border border-dashed border-border p-5 text-center">
          <Quote className="mx-auto h-5 w-5 text-muted" />
          <p className="mt-2 text-sm font-medium text-heading">No reviews yet</p>
          <p className="mt-1 text-xs text-muted">Paste a kind word from a client — a text, an email or an online review.</p>
        </div>
      ) : null}

      {draft && !draft.id ? form : null}

      {!draft ? (
        <Button
          type="button"
          variant="outline"
          className="w-full"
          disabled={items.length >= WEBSITE_LIMITS.testimonialsMax}
          onClick={() => setDraft({ id: null, quote: "", name: "", title: "" })}
        >
          <Plus className="h-4 w-4" /> Add Testimonial
        </Button>
      ) : null}

      {items.length > 0 ? (
        <p className="text-xs text-muted">
          {visibleCount} of {items.length} shown{value.enabled ? "" : " once the section is turned on"}. One review is featured on its own; two or three
          sit side by side; more become a swipeable row.
        </p>
      ) : null}
    </div>
  );
}
