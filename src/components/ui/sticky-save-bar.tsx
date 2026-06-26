"use client";

import { Button } from "@/components/ui/button";
import { Loader2, Save } from "lucide-react";
import { cn } from "@/lib/utils";

interface StickySaveBarProps {
  onSave: () => void;
  saving?: boolean;
  label?: string;
  className?: string;
}

/** Mobile: static bar at end of form. Desktop: fixed to bottom safe area. */
export function StickySaveBar({ onSave, saving, label = "Save Project", className }: StickySaveBarProps) {
  return (
    <div
      className={cn(
        "border-t border-border bg-white px-4 py-4 safe-area-bottom safe-area-x",
        "md:fixed md:bottom-0 md:left-0 md:right-0 md:z-40 md:bg-white/95 md:py-3 md:shadow-[0_-4px_20px_rgba(15,23,42,0.08)] md:backdrop-blur-md",
        className
      )}
    >
      <div className="mx-auto flex max-w-4xl items-center justify-end gap-4 md:justify-between">
        <p className="hidden text-sm text-muted md:block">Unsaved changes are saved when you click Save.</p>
        <Button variant="accent" onClick={onSave} disabled={saving} className="w-full min-h-11 md:ml-auto md:w-auto md:min-w-[140px]">
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              {label}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
