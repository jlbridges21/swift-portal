"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp } from "lucide-react";

interface ExpandableMediaListProps<T> {
  items: T[];
  initialCount: number;
  renderItem: (item: T, index: number) => React.ReactNode;
  labelSingular: string;
  labelPlural: string;
  viewAllLabel?: (total: number) => string;
  listClassName?: string;
}

export function ExpandableMediaList<T>({
  items,
  initialCount,
  renderItem,
  labelSingular,
  labelPlural,
  viewAllLabel,
  listClassName,
}: ExpandableMediaListProps<T>) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? items : items.slice(0, initialCount);
  const remaining = items.length - initialCount;

  if (!items.length) return null;

  return (
    <div className="space-y-4">
      <div className={listClassName ?? "space-y-4"}>{visible.map((item, i) => renderItem(item, i))}</div>
      {remaining > 0 && (
        <Button
          type="button"
          variant="outline"
          className="w-full min-h-11"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? (
            <>
              <ChevronUp className="h-4 w-4" />
              Show fewer {items.length > 1 ? labelPlural : labelSingular}
            </>
          ) : (
            <>
              <ChevronDown className="h-4 w-4" />
              {viewAllLabel?.(items.length) ??
                `View all ${items.length} ${items.length > 1 ? labelPlural : labelSingular}`}
            </>
          )}
        </Button>
      )}
    </div>
  );
}
