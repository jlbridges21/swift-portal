"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, Circle } from "lucide-react";
import type { ChecklistItem } from "@/lib/setup-completeness";

interface SetupChecklistCardProps {
  items: ChecklistItem[];
  incomplete: boolean;
  /** When true, deep-link into /admin/settings (admin home). */
  linkToSettings?: boolean;
}

function settingsHref(hash: string, linkToSettings: boolean) {
  return linkToSettings ? `/admin/settings#${hash}` : `#${hash}`;
}

/**
 * Server-computed checklist — no async gap, no flash of false incompletes.
 * Parent must omit this component when completedAt is set or !incomplete.
 */
export function SetupChecklistCard({
  items,
  incomplete,
  linkToSettings = false,
}: SetupChecklistCardProps) {
  if (!incomplete || items.length === 0) return null;

  return (
    <Card className="mb-4 border-sky-200 bg-sky-50/70 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Finish setting up your portal</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.map((item) => (
          <a
            key={item.id}
            href={settingsHref(item.hash, linkToSettings)}
            className="flex items-center gap-2 text-sm text-primary hover:underline"
          >
            {item.done ? (
              <CheckCircle2 className="h-4 w-4 text-teal-600" />
            ) : (
              <Circle className="h-4 w-4 text-muted" />
            )}
            <span>{item.label}</span>
            <span className="text-xs text-muted">{item.done ? "Done" : "Needs attention"}</span>
          </a>
        ))}
      </CardContent>
    </Card>
  );
}
