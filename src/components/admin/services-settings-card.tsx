"use client";

import { useEffect, useState } from "react";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { CurrencyInput } from "@/components/ui/currency-input";
import { toast } from "sonner";
import { GripVertical, Loader2, Plus, Trash2 } from "lucide-react";
import type { BusinessServiceRow } from "@/lib/types";
import { cn } from "@/lib/utils";

function SortableService({
  service,
  onSave,
  onToggle,
  onDelete,
}: {
  service: BusinessServiceRow;
  onSave: (id: string, patch: Partial<BusinessServiceRow>) => Promise<void>;
  onToggle: (id: string, is_active: boolean) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: service.id,
  });
  const [name, setName] = useState(service.name);
  const [description, setDescription] = useState(service.description ?? "");
  const [cents, setCents] = useState(service.preliminary_estimate_cents ?? 0);
  const [startingLabel, setStartingLabel] = useState(service.starting_label ?? "");
  const [includesText, setIncludesText] = useState(service.includes.join("\n"));
  const [notes, setNotes] = useState(service.notes ?? "");
  const [hidePricing, setHidePricing] = useState(service.hide_pricing);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(service.name);
    setDescription(service.description ?? "");
    setCents(service.preliminary_estimate_cents ?? 0);
    setStartingLabel(service.starting_label ?? "");
    setIncludesText(service.includes.join("\n"));
    setNotes(service.notes ?? "");
    setHidePricing(service.hide_pricing);
  }, [service]);

  async function save() {
    setSaving(true);
    try {
      const includes = includesText.split("\n").map((line) => line.trim()).filter(Boolean);
      await onSave(service.id, {
        name,
        description,
        preliminary_estimate_cents: hidePricing ? 0 : cents,
        starting_label: startingLabel,
        includes,
        notes,
        hide_pricing: hidePricing,
      });
      toast.success("Service saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save service");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "rounded-xl border border-border bg-white p-4",
        isDragging && "opacity-70",
        !service.is_active && "opacity-60"
      )}
    >
      <div className="mb-3 flex items-center gap-2">
        <button type="button" className="cursor-grab text-muted" {...attributes} {...listeners}>
          <GripVertical className="h-4 w-4" />
        </button>
        <p className="flex-1 text-sm font-semibold text-primary">{service.name}</p>
        <Button type="button" variant="outline" size="sm" onClick={() => void onToggle(service.id, !service.is_active)}>
          {service.is_active ? "Deactivate" : "Activate"}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => void onDelete(service.id)}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1 sm:col-span-2">
          <Label>Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label>Description</Label>
          <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Preliminary estimate</Label>
          <CurrencyInput valueCents={cents} onChangeCents={setCents} />
        </div>
        <div className="space-y-1">
          <Label>Starting label</Label>
          <Input value={startingLabel} onChange={(e) => setStartingLabel(e.target.value)} placeholder="Starting at $249" />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label>Includes (one per line)</Label>
          <Textarea rows={4} value={includesText} onChange={(e) => setIncludesText(e.target.value)} />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label>Notes</Label>
          <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input type="checkbox" checked={hidePricing} onChange={(e) => setHidePricing(e.target.checked)} />
          Hide pricing (custom proposal)
        </label>
      </div>
      <div className="mt-3">
        <Button type="button" size="sm" onClick={() => void save()} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Save service
        </Button>
      </div>
    </div>
  );
}

export function ServicesSettingsCard() {
  const [services, setServices] = useState<BusinessServiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCents, setNewCents] = useState(0);
  const [newDescription, setNewDescription] = useState("");

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

  async function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = services.findIndex((row) => row.id === active.id);
    const newIndex = services.findIndex((row) => row.id === over.id);
    const next = arrayMove(services, oldIndex, newIndex);
    setServices(next);
    const res = await fetch("/api/admin/services/reorder", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: next.map((row) => row.id) }),
    });
    if (!res.ok) {
      toast.error("Could not save order");
      await load();
    }
  }

  return (
    <div className="space-y-4">
      <form
        className="grid gap-3 rounded-xl border border-dashed border-border p-4 sm:grid-cols-2"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!newName.trim()) return;
          setCreating(true);
          try {
            const res = await fetch("/api/admin/services", {
              method: "POST",
              credentials: "include",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                name: newName.trim(),
                description: newDescription,
                preliminary_estimate_cents: newCents,
                starting_label: newCents ? `Starting at $${(newCents / 100).toFixed(0)}` : "Custom Quote",
              }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Could not create");
            setServices((prev) => [...prev, data.service as BusinessServiceRow]);
            setNewName("");
            setNewDescription("");
            setNewCents(0);
            toast.success("Service created");
          } catch (error) {
            toast.error(error instanceof Error ? error.message : "Could not create service");
          } finally {
            setCreating(false);
          }
        }}
      >
        <div className="space-y-1 sm:col-span-2">
          <Label>New service name</Label>
          <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Aerial Videography Pro" />
        </div>
        <div className="space-y-1">
          <Label>Preliminary estimate</Label>
          <CurrencyInput valueCents={newCents} onChangeCents={setNewCents} />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label>Description</Label>
          <Input value={newDescription} onChange={(e) => setNewDescription(e.target.value)} />
        </div>
        <Button type="submit" disabled={creating || !newName.trim()}>
          {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Add service
        </Button>
      </form>

      {loading ? (
        <p className="text-sm text-muted">Loading services…</p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => void onDragEnd(e)}>
          <SortableContext items={services.map((row) => row.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-3">
              {services.map((service) => (
                <SortableService
                  key={service.id}
                  service={service}
                  onSave={savePatch}
                  onToggle={async (id, is_active) => {
                    await savePatch(id, { is_active });
                  }}
                  onDelete={async (id) => {
                    const res = await fetch(`/api/admin/services/${id}`, {
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
                    setServices((prev) => prev.filter((row) => row.id !== id));
                    toast.success("Service deleted");
                  }}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}
