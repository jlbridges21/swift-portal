"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Check,
  Eye,
  EyeOff,
  Loader2,
  MoreHorizontal,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { CurrencyInput } from "@/components/ui/currency-input";
import { ActionMenu, type ActionMenuAnchor, type ActionMenuItem } from "@/components/ui/action-menu";
import type { BusinessServiceRow } from "@/lib/types";
import { cn } from "@/lib/utils";

export interface ServiceDraft {
  name: string;
  description: string;
  cents: number;
  startingLabel: string;
  includes: string[];
  notes: string;
  hidePricing: boolean;
}

export function draftFromService(service: BusinessServiceRow | null): ServiceDraft {
  return {
    name: service?.name ?? "",
    description: service?.description ?? "",
    cents: service?.preliminary_estimate_cents ?? 0,
    startingLabel: service?.starting_label ?? "",
    includes: service ? [...service.includes] : [],
    notes: service?.notes ?? "",
    hidePricing: service?.hide_pricing ?? false,
  };
}

/** The label used when "Shown as" is left blank on a new service (same rule as before). */
export function defaultStartingLabel(cents: number): string {
  return cents ? `Starting at $${(cents / 100).toFixed(0)}` : "Custom Quote";
}

interface IncludeItem {
  key: number;
  text: string;
}

/** Stable React keys for checklist rows (module-level so it isn't a ref read during render). */
let includeKeySeq = 0;
function nextKey(): number {
  includeKeySeq += 1;
  return includeKeySeq;
}
function toItems(list: string[]): IncludeItem[] {
  return list.map((text) => ({ key: nextKey(), text }));
}

export function ServiceEditor({
  service,
  position,
  count,
  showTitle = true,
  onCancel,
  onSave,
  onToggleActive,
  onRequestDelete,
  onMove,
  onDirtyChange,
}: {
  /** null = a new service. */
  service: BusinessServiceRow | null;
  position: number;
  count: number;
  showTitle?: boolean;
  onCancel: () => void;
  onSave: (draft: ServiceDraft) => Promise<boolean>;
  onToggleActive: () => void;
  onRequestDelete: () => void;
  onMove: (direction: -1 | 1) => void;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const [draft, setDraft] = useState<ServiceDraft>(() => draftFromService(service));
  const [items, setItems] = useState<IncludeItem[]>(() => toItems(service?.includes ?? []));
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [menu, setMenu] = useState<ActionMenuAnchor | null>(null);
  const [focusKey, setFocusKey] = useState<number | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const itemRefs = useRef(new Map<number, HTMLInputElement>());

  // Reset when another service is opened, or after the saved row comes back from the API.
  useEffect(() => {
    setDraft(draftFromService(service));
    setItems(toItems(service?.includes ?? []));
    setDirty(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [service?.id]);

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  useEffect(() => {
    if (!service) nameRef.current?.focus();
  }, [service]);

  useEffect(() => {
    if (focusKey == null) return;
    itemRefs.current.get(focusKey)?.focus();
    setFocusKey(null);
  }, [focusKey, items]);

  function patch(next: Partial<ServiceDraft>) {
    setDraft((prev) => ({ ...prev, ...next }));
    setDirty(true);
  }

  function setItemText(key: number, text: string) {
    setItems((prev) => prev.map((item) => (item.key === key ? { ...item, text } : item)));
    setDirty(true);
  }

  function addItem(afterKey?: number) {
    const key = nextKey();
    setItems((prev) => {
      const at = afterKey == null ? prev.length : prev.findIndex((item) => item.key === afterKey) + 1;
      const next = [...prev];
      next.splice(at, 0, { key, text: "" });
      return next;
    });
    setFocusKey(key);
    setDirty(true);
  }

  function removeItem(key: number) {
    setItems((prev) => prev.filter((item) => item.key !== key));
    setDirty(true);
  }

  async function save() {
    if (!draft.name.trim()) {
      nameRef.current?.focus();
      return;
    }
    setSaving(true);
    try {
      const ok = await onSave({
        ...draft,
        includes: items.map((item) => item.text.trim()).filter(Boolean),
      });
      if (ok) setDirty(false);
    } finally {
      setSaving(false);
    }
  }

  const menuItems: ActionMenuItem[] = service
    ? [
        { id: "up", label: "Move up", icon: ArrowUp, disabled: position <= 0, onSelect: () => onMove(-1) },
        { id: "down", label: "Move down", icon: ArrowDown, disabled: position >= count - 1, onSelect: () => onMove(1) },
        { type: "separator", id: "sep-1" },
        service.is_active
          ? { id: "deactivate", label: "Deactivate", icon: EyeOff, description: "Hide from new requests", onSelect: onToggleActive }
          : { id: "activate", label: "Activate", icon: Eye, description: "Show on the request form", onSelect: onToggleActive },
        { type: "separator", id: "sep-2" },
        { id: "delete", label: "Delete", icon: Trash2, destructive: true, onSelect: onRequestDelete },
      ]
    : [];

  const idBase = service ? `service-${service.id}` : "service-new";

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        {showTitle ? (
          <h3 className="min-w-0 truncate pt-1.5 text-base font-semibold text-heading">
            {service ? draft.name.trim() || service.name : "New service"}
          </h3>
        ) : (
          <span />
        )}
        {service ? (
          <>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-10 w-10 shrink-0"
              aria-label="More actions"
              aria-haspopup="menu"
              onClick={(e) => setMenu({ kind: "element", element: e.currentTarget })}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
            <ActionMenu anchor={menu} onClose={() => setMenu(null)} items={menuItems} title={service.name} />
          </>
        ) : null}
      </div>

      {service && !service.is_active ? (
        <p className="rounded-lg bg-subtle px-3 py-2 text-xs text-muted">
          Inactive: hidden from new requests. Existing projects keep it.
        </p>
      ) : null}

      <div className="space-y-1.5">
        <Label htmlFor={`${idBase}-name`}>Name</Label>
        <Input
          id={`${idBase}-name`}
          ref={nameRef}
          value={draft.name}
          onChange={(e) => patch({ name: e.target.value })}
          placeholder="Aerial Photography"
        />
      </div>

      <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
        {!draft.hidePricing ? (
          <div className="space-y-1.5">
            <p className="text-sm font-medium text-heading" aria-hidden>
              Starting price
            </p>
            <CurrencyInput
              valueCents={draft.cents}
              onChangeCents={(cents) => patch({ cents })}
              aria-label="Starting price"
            />
          </div>
        ) : null}
        <div className={cn("space-y-1.5", draft.hidePricing && "min-[420px]:col-span-2")}>
          <Label htmlFor={`${idBase}-label`}>Shown as</Label>
          <Input
            id={`${idBase}-label`}
            value={draft.startingLabel}
            onChange={(e) => patch({ startingLabel: e.target.value })}
            placeholder={draft.hidePricing ? "Custom Quote" : defaultStartingLabel(draft.cents)}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`${idBase}-description`}>Description</Label>
        <Textarea
          id={`${idBase}-description`}
          rows={2}
          value={draft.description}
          onChange={(e) => patch({ description: e.target.value })}
        />
      </div>

      <div className="space-y-1.5">
        <p className="text-sm font-medium text-heading" id={`${idBase}-includes-label`}>
          What&apos;s included
        </p>
        <ul className="space-y-1.5" aria-labelledby={`${idBase}-includes-label`}>
          {items.map((item, index) => (
            <li
              key={item.key}
              className="flex items-center gap-2 rounded-lg border border-border bg-background pl-3 focus-within:ring-2 focus-within:ring-accent"
            >
              <Check className="h-4 w-4 shrink-0 text-emerald-600 surface-dark:text-emerald-400" aria-hidden />
              <input
                ref={(el) => {
                  if (el) itemRefs.current.set(item.key, el);
                  else itemRefs.current.delete(item.key);
                }}
                value={item.text}
                aria-label={`Included item ${index + 1}`}
                onChange={(e) => setItemText(item.key, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addItem(item.key);
                  } else if (e.key === "Backspace" && !item.text) {
                    e.preventDefault();
                    const prev = items[index - 1];
                    removeItem(item.key);
                    if (prev) setFocusKey(prev.key);
                  }
                }}
                className="min-h-10 min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted"
                placeholder="Describe one thing included"
              />
              <button
                type="button"
                onClick={() => removeItem(item.key)}
                aria-label={`Remove ${item.text || "item"}`}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => addItem()}
          className="flex min-h-10 w-full items-center gap-2 rounded-lg border border-dashed border-border px-3 text-sm font-semibold text-accent hover:bg-accent-subtle"
        >
          <Plus className="h-4 w-4" aria-hidden />
          Add item
        </button>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`${idBase}-notes`}>Notes</Label>
        <Textarea
          id={`${idBase}-notes`}
          rows={2}
          value={draft.notes}
          onChange={(e) => patch({ notes: e.target.value })}
        />
      </div>

      <label htmlFor={`${idBase}-hide`} className="flex min-h-11 cursor-pointer items-center justify-between gap-3">
        <span>
          <span className="block text-sm font-semibold text-heading">Hide price (custom proposal)</span>
          <span className="block text-[13px] text-muted">Clients ask for a quote instead of seeing a price.</span>
        </span>
        <Switch
          id={`${idBase}-hide`}
          checked={draft.hidePricing}
          onCheckedChange={(hidePricing) => patch({ hidePricing })}
          aria-label="Hide price (custom proposal)"
        />
      </label>

      <div className="flex gap-2 pt-1">
        <Button
          type="button"
          variant="accent"
          className="min-h-11 flex-1"
          disabled={saving || !draft.name.trim()}
          onClick={() => void save()}
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {service ? "Save service" : "Add service"}
        </Button>
        <Button type="button" variant="outline" className="min-h-11" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
