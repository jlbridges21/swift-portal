"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { VideoPosterSurface } from "@/components/ui/video-poster-surface";
import { mediaDisplayName } from "@/lib/media-display-name";
import type { MediaAsset } from "@/lib/types";
import { cn } from "@/lib/utils";

type DragData = { video: MediaAsset; thumbUrl?: string | null };

/**
 * Drag-and-drop ordering for the admin Videos grid (same dnd-kit setup as AdminPhotoGrid:
 * mouse after 4px, touch long-press 250ms). Up/down arrows on each card stay the keyboard path.
 */
export function SortableVideoList({
  id,
  ids,
  onReorder,
  children,
}: {
  id: string;
  ids: string[];
  onReorder: (orderedIds: string[]) => void;
  children: ReactNode;
}) {
  const [active, setActive] = useState<DragData | null>(null);
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } })
  );

  function handleDragStart(event: DragStartEvent) {
    setActive((event.active.data.current as DragData | undefined) ?? null);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActive(null);
    const { active: dragged, over } = event;
    if (!over || dragged.id === over.id) return;
    const oldIndex = ids.indexOf(String(dragged.id));
    const newIndex = ids.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    onReorder(arrayMove(ids, oldIndex, newIndex));
  }

  return (
    <DndContext
      id={id}
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActive(null)}
      autoScroll={{ threshold: { x: 0.15, y: 0.15 }, acceleration: 12 }}
    >
      <SortableContext items={ids} strategy={rectSortingStrategy}>
        {children}
      </SortableContext>
      <DragOverlay dropAnimation={null}>
        {active ? (
          <div className="w-56 select-none overflow-hidden rounded-xl border-2 border-accent bg-card shadow-lg">
            <div className="relative aspect-video bg-slate-900">
              <VideoPosterSurface
                asset={active.video}
                thumbUrl={active.thumbUrl}
                compact
                className="absolute inset-0"
              />
            </div>
            <p className="truncate px-2.5 py-1.5 text-xs font-semibold text-heading">
              {mediaDisplayName(active.video)}
            </p>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

export function SortableVideoItem({
  video,
  thumbUrl,
  disabled = false,
  children,
}: {
  video: MediaAsset;
  thumbUrl?: string | null;
  disabled?: boolean;
  children: ReactNode;
}) {
  const { listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: video.id,
    disabled,
    data: { video, thumbUrl } satisfies DragData,
  });
  // A mouse drag that ends over the card would otherwise click Play / Edit / Delete.
  const justDragged = useRef(false);
  useEffect(() => {
    if (isDragging) {
      justDragged.current = true;
      return;
    }
    if (!justDragged.current) return;
    const t = window.setTimeout(() => {
      justDragged.current = false;
    }, 0);
    return () => window.clearTimeout(t);
  }, [isDragging]);

  return (
    <div
      ref={setNodeRef}
      data-video-id={video.id}
      onMouseDown={listeners?.onMouseDown as React.MouseEventHandler | undefined}
      onTouchStart={listeners?.onTouchStart as React.TouchEventHandler | undefined}
      onClickCapture={(e) => {
        if (!justDragged.current) return;
        justDragged.current = false;
        e.preventDefault();
        e.stopPropagation();
      }}
      onContextMenu={(e) => {
        if (isDragging) e.preventDefault();
      }}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        touchAction: "pan-y",
        WebkitTouchCallout: "none",
      }}
      className={cn(
        "min-w-0 select-none",
        !disabled && "cursor-grab active:cursor-grabbing",
        isDragging && "opacity-40"
      )}
    >
      {children}
    </div>
  );
}
