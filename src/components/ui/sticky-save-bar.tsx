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

export function StickySaveBar({ onSave, saving, label = "Save Project", className }: StickySaveBarProps) {
  return (
    <div
      className={cn(
        "fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-white/95 px-4 py-3 shadow-[0_-4px_20px_rgba(15,23,42,0.08)] backdrop-blur-md",
        className
      )}
    >
      <div className="mx-auto flex max-w-4xl items-center justify-between gap-4">
        <p className="hidden text-sm text-muted sm:block">Unsaved changes are saved when you click Save.</p>
        <Button variant="accent" onClick={onSave} disabled={saving} className="ml-auto min-w-[140px]">
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
