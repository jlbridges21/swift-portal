"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronRight, GripVertical, Loader2, Plus, Tag } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { BusinessServiceRow } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  ServiceEditor,
  defaultStartingLabel,
  type ServiceDraft,
} from "@/components/admin/settings-tabs/services-editor";
import { useServicesTabBridge } from "@/components/admin/settings-tabs/services-tab-context";

/** Editor shows as a right column when the catalog is at least this wide; a sheet below it. */
const SIDE_PANEL_MIN_WIDTH = 760;

function formatPrice(cents: number | null): string {
  const value = (cents ?? 0) / 100;
  return value % 1 === 0 ? `$${value.toLocaleString("en-US")}` : `$${value.toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
}

function serviceSubtitle(service: BusinessServiceRow): string {
  if (service.hide_pricing) return "Custom proposal";
  const n = service.includes.filter((item) => item.trim()).length;
  if (n === 0) return "No items listed";
  return `${n} ${n === 1 ? "item" : "items"} included`;
}

function StatusPill({ active }: { active: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
        active
          ? "bg-emerald-50 text-emerald-700 surface-dark:bg-emerald-500/15 surface-dark:text-emerald-300"
          : "bg-subtle text-muted"
      )}
    >
      {active ? "Active" : "Inactive"}
    </span>
  );
}

function ServiceRow({
  service,
  selected,
  onOpen,
}: {
  service: BusinessServiceRow;
  selected: boolean;
  onOpen: () => void;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: service.id,
  });
  const price = service.hide_pricing ? "Price hidden" : formatPrice(service.preliminary_estimate_cents);

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "relative flex items-stretch bg-card",
        selected && "bg-accent-subtle/60",
        isDragging && "z-10 shadow-lg ring-1 ring-border"
      )}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        className="flex w-11 shrink-0 cursor-grab touch-none items-center justify-center text-muted/60 hover:text-muted active:cursor-grabbing"
        aria-label={`Reorder ${service.name}. Press space, then arrow keys to move.`}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={onOpen}
        aria-current={selected ? "true" : undefined}
        className="grid min-h-16 min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 py-3 pr-3 text-left sm:grid-cols-[minmax(0,1fr)_8.5rem_6rem_1.25rem]"
      >
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-heading">{service.name}</span>
          <span className="block truncate text-[13px] text-muted">
            {serviceSubtitle(service)}
            <span className="sm:hidden"> · {price}</span>
          </span>
        </span>
        <span className="hidden truncate text-sm text-foreground sm:block">{price}</span>
        <span className="flex items-center gap-2 sm:block">
          <StatusPill active={service.is_active} />
          <ChevronRight className="h-4 w-4 text-muted sm:hidden" aria-hidden />
        </span>
        <ChevronRight className="hidden h-4 w-4 text-muted sm:block" aria-hidden />
      </button>
    </li>
  );
}

/** Which service the editor shows: an existing id, a new one, or closed. */
type EditorTarget = { kind: "existing"; id: string } | { kind: "new" } | null;

export function ServicesSettingsCard() {
  const bridge = useServicesTabBridge();
  const [services, setServices] = useState<BusinessServiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [target, setTarget] = useState<EditorTarget>(null);
  const [editorDirty, setEditorDirty] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [wide, setWide] = useState(false);
  const [offscreen, setOffscreen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [wrapEl, setWrapEl] = useState<HTMLDivElement | null>(null);
  const setWrapRef = useCallback((el: HTMLDivElement | null) => {
    wrapRef.current = el;
    setWrapEl(el);
  }, []);
  const lastAddRequest = useRef(bridge?.addRequest ?? 0);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/services", { credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load services");
      setServices(data.services ?? []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load services");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  // Side panel on wide layouts, bottom sheet on narrow ones (phones, onboarding column).
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    // A hidden tab measures 0 wide: keep the last layout and don't show the sheet over other tabs.
    const update = () => {
      const w = el.getBoundingClientRect().width;
      setOffscreen(w === 0);
      if (w > 0) setWide(w >= SIDE_PANEL_MIN_WIDTH);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const confirmDiscard = useCallback(() => {
    if (!editorDirty) return true;
    return window.confirm("Discard your unsaved changes to this service?");
  }, [editorDirty]);

  const openTarget = useCallback(
    (next: EditorTarget) => {
      if (!confirmDiscard()) return;
      setEditorDirty(false);
      setTarget(next);
    },
    [confirmDiscard]
  );

  // "Add service" in the Settings tab header.
  useEffect(() => {
    if (!bridge) return;
    if (bridge.addRequest === lastAddRequest.current) return;
    lastAddRequest.current = bridge.addRequest;
    openTarget({ kind: "new" });
    wrapRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [bridge, openTarget]);

  async function savePatch(id: string, patch: Partial<BusinessServiceRow>) {
    const res = await fetch(`/api/admin/services/${id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Save failed");
    setServices((prev) => prev.map((row) => (row.id === id ? (data.service as BusinessServiceRow) : row)));
  }

  async function persistOrder(next: BusinessServiceRow[], previous: BusinessServiceRow[]) {
    setServices(next);
    try {
      const res = await fetch("/api/admin/services/reorder", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: next.map((row) => row.id) }),
      });
      if (!res.ok) throw new Error();
    } catch {
      toast.error("Could not save order");
      setServices(previous);
    }
  }

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = services.findIndex((row) => row.id === active.id);
    const newIndex = services.findIndex((row) => row.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    void persistOrder(arrayMove(services, oldIndex, newIndex), services);
  }

  function move(id: string, direction: -1 | 1) {
    const index = services.findIndex((row) => row.id === id);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= services.length) return;
    void persistOrder(arrayMove(services, index, nextIndex), services);
  }

  async function saveDraft(draft: ServiceDraft): Promise<boolean> {
    const name = draft.name.trim();
    if (!name) return false;
    try {
      if (target?.kind === "existing") {
        await savePatch(target.id, {
          name,
          description: draft.description,
          preliminary_estimate_cents: draft.hidePricing ? 0 : draft.cents,
          starting_label: draft.startingLabel,
          includes: draft.includes,
          notes: draft.notes,
          hide_pricing: draft.hidePricing,
        });
        toast.success("Service saved");
      } else {
        const res = await fetch("/api/admin/services", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            description: draft.description,
            preliminary_estimate_cents: draft.hidePricing ? 0 : draft.cents,
            starting_label:
              draft.startingLabel.trim() || (draft.hidePricing ? "Custom Quote" : defaultStartingLabel(draft.cents)),
            includes: draft.includes,
            notes: draft.notes,
            hide_pricing: draft.hidePricing,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Could not create");
        const created = data.service as BusinessServiceRow;
        setServices((prev) => [...prev, created]);
        setEditorDirty(false);
        setTarget({ kind: "existing", id: created.id });
        toast.success("Service created");
      }
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save service");
      return false;
    }
  }

  async function toggleActive(service: BusinessServiceRow) {
    try {
      await savePatch(service.id, { is_active: !service.is_active });
      toast.success(service.is_active ? "Service deactivated" : "Service activated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update service");
    }
  }

  async function confirmDelete() {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/services/${deleteId}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json();
      if (res.status === 409) {
        toast.error(data.error || "In use — deactivate instead");
        return;
      }
      if (!res.ok) {
        toast.error(data.error || "Delete failed");
        return;
      }
      setServices((prev) => prev.filter((row) => row.id !== deleteId));
      if (target?.kind === "existing" && target.id === deleteId) {
        setEditorDirty(false);
        setTarget(null);
      }
      toast.success("Service deleted");
    } finally {
      setDeleting(false);
      setDeleteId(null);
    }
  }

  const selected = target?.kind === "existing" ? services.find((row) => row.id === target.id) ?? null : null;
  const editorOpen = target?.kind === "new" || Boolean(selected);
  const selectedIndex = selected ? services.findIndex((row) => row.id === selected.id) : -1;
  const deleteRow = deleteId ? services.find((row) => row.id === deleteId) : null;

  function closeEditor() {
    if (!confirmDiscard()) return;
    setEditorDirty(false);
    setTarget(null);
  }

  const editor = editorOpen ? (
    <ServiceEditor
      key={selected?.id ?? "new"}
      service={selected}
      position={selectedIndex}
      count={services.length}
      showTitle={wide}
      onCancel={closeEditor}
      onSave={saveDraft}
      onToggleActive={() => selected && void toggleActive(selected)}
      onRequestDelete={() => selected && setDeleteId(selected.id)}
      onMove={(direction) => selected && move(selected.id, direction)}
      onDirtyChange={setEditorDirty}
    />
  ) : null;

  return (
    <div ref={setWrapRef} className="space-y-3">
      {!bridge ? (
        <div className="flex justify-end">
          <Button type="button" variant="accent" className="min-h-11" onClick={() => openTarget({ kind: "new" })}>
            <Plus className="h-4 w-4" /> Add service
          </Button>
        </div>
      ) : null}

      <div className={cn(wide && editorOpen && "grid grid-cols-[minmax(0,1fr)_minmax(320px,380px)] items-start gap-4")}>
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="hidden items-center border-b border-border pl-11 pr-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted sm:grid sm:grid-cols-[minmax(0,1fr)_8.5rem_6rem_1.25rem] sm:gap-x-3">
            <span>Service</span>
            <span>Starting price</span>
            <span>Status</span>
            <span aria-hidden />
          </div>
          {loading ? (
            <p className="flex items-center gap-2 px-5 py-6 text-sm text-muted">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading services…
            </p>
          ) : services.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-5 py-10 text-center">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-accent-subtle text-accent">
                <Tag className="h-5 w-5" aria-hidden />
              </span>
              <p className="text-sm font-semibold text-heading">No services yet</p>
              <p className="text-[13px] text-muted">Add what you offer so clients can pick it on the request form.</p>
              <Button type="button" variant="outline" className="mt-1 min-h-11" onClick={() => openTarget({ kind: "new" })}>
                <Plus className="h-4 w-4" /> Add service
              </Button>
            </div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <SortableContext items={services.map((row) => row.id)} strategy={verticalListSortingStrategy}>
                <ul className="divide-y divide-border" aria-label="Services">
                  {services.map((service) => (
                    <ServiceRow
                      key={service.id}
                      service={service}
                      selected={selected?.id === service.id}
                      onOpen={() => {
                        if (selected?.id !== service.id) openTarget({ kind: "existing", id: service.id });
                      }}
                    />
                  ))}
                </ul>
              </SortableContext>
            </DndContext>
          )}
        </div>

        {wide && editor ? (
          <aside
            aria-label={selected ? `Edit ${selected.name}` : "New service"}
            className="sticky top-4 rounded-2xl border border-border bg-card p-5"
          >
            {editor}
          </aside>
        ) : null}
      </div>

      {!wide ? (
        <BottomSheet
          open={editorOpen && !offscreen}
          onClose={closeEditor}
          title={selected ? selected.name : "New service"}
          surfaceFrom={wrapEl}
        >
          {editor}
        </BottomSheet>
      ) : null}

      <ConfirmDialog
        open={Boolean(deleteId)}
        onClose={() => setDeleteId(null)}
        onConfirm={() => void confirmDelete()}
        title="Delete service?"
        confirmLabel="Delete service"
        destructive
        busy={deleting}
      >
        <p>
          <span className="font-semibold text-heading">{deleteRow?.name ?? "This service"}</span> will be removed from your
          catalog. This can&apos;t be undone.
        </p>
        <p className="text-muted">If any project uses it, you&apos;ll be asked to deactivate it instead.</p>
      </ConfirmDialog>
    </div>
  );
}
