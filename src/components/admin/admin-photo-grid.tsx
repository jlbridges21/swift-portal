"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ChevronUp, ChevronDown, Trash2, GripVertical } from "lucide-react";
import type { MediaAsset } from "@/lib/types";

interface AdminPhotoGridProps {
  photos: MediaAsset[];
  isHero: (id: string) => boolean;
  onSetHero: (id: string) => void;
  onDelete: (id: string) => void;
  onReorder: (photos: MediaAsset[]) => void;
}

function PhotoThumb({ assetId }: { assetId: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    fetch(`/api/media/download/${assetId}?thumb=1`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setUrl(d.url));
  }, [assetId]);
  return (
    <div className="relative aspect-square w-full bg-slate-100">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="h-full w-full object-cover" />
      ) : (
        <div className="h-full w-full animate-pulse bg-slate-200" />
      )}
    </div>
  );
}

export function AdminPhotoGrid({
  photos,
  isHero,
  onSetHero,
  onDelete,
  onReorder,
}: AdminPhotoGridProps) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  async function persistOrder(reordered: MediaAsset[]) {
    const items = reordered.map((p, i) => ({
      id: p.id,
      display_order: i,
      type: "media" as const,
    }));
    onReorder(reordered.map((p, i) => ({ ...p, display_order: i })));
    await fetch("/api/media/reorder", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ items }),
    });
  }

  function movePhoto(id: string, direction: "up" | "down") {
    const idx = photos.findIndex((p) => p.id === id);
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= photos.length) return;
    const next = [...photos];
    [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
    persistOrder(next);
  }

  function handleDrop(targetId: string) {
    if (!dragId || dragId === targetId) return;
    const from = photos.findIndex((p) => p.id === dragId);
    const to = photos.findIndex((p) => p.id === targetId);
    if (from < 0 || to < 0) return;
    const next = [...photos];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    persistOrder(next);
    setDragId(null);
    setOverId(null);
  }

  if (!photos.length) {
    return <p className="text-sm text-muted py-4 text-center">No photos yet</p>;
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {photos.map((p, i) => (
        <div
          key={`photo-card-${p.project_id}-${p.id}-${i}`}
          draggable
          onDragStart={() => setDragId(p.id)}
          onDragEnd={() => { setDragId(null); setOverId(null); }}
          onDragOver={(e) => { e.preventDefault(); setOverId(p.id); }}
          onDrop={() => handleDrop(p.id)}
          className={`rounded-lg border border-border overflow-hidden bg-white transition-shadow ${
            overId === p.id && dragId !== p.id ? "ring-2 ring-accent" : ""
          } ${dragId === p.id ? "opacity-50" : ""}`}
        >
          <PhotoThumb assetId={p.id} />
          <div className="p-2 space-y-2">
            <div className="flex items-start gap-1">
              <GripVertical className="h-4 w-4 shrink-0 text-muted mt-0.5 cursor-grab" />
              <p className="text-xs text-foreground line-clamp-2 flex-1">{p.file_name}</p>
            </div>
            {isHero(p.id) && (
              <span className="inline-block rounded bg-accent/10 px-1.5 py-0.5 text-[10px] font-medium text-accent">Hero</span>
            )}
            <div className="flex flex-wrap gap-1">
              <Button variant="ghost" size="sm" className="h-7 text-xs px-2" onClick={() => onSetHero(p.id)}>
                Hero
              </Button>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" disabled={i === 0} onClick={() => movePhoto(p.id, "up")}>
                <ChevronUp className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" disabled={i === photos.length - 1} onClick={() => movePhoto(p.id, "down")}>
                <ChevronDown className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500" onClick={() => onDelete(p.id)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
