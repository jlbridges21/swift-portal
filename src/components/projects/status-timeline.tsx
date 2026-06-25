import { PROJECT_STATUSES, normalizeStatus } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

interface StatusTimelineProps {
  currentStatus: string;
  audience?: "admin" | "client";
}

export function StatusTimeline({ currentStatus, audience = "client" }: StatusTimelineProps) {
  const normalized = normalizeStatus(currentStatus);
  const currentOrder = PROJECT_STATUSES.find((s) => s.value === normalized)?.order ?? 0;
  const labelFor = (status: (typeof PROJECT_STATUSES)[number]) =>
    audience === "client" ? status.clientLabel : status.label;

  return (
    <div className="w-full">
      <div className="hidden sm:flex items-center justify-between">
        {PROJECT_STATUSES.map((status, index) => {
          const isComplete = status.order <= currentOrder;
          const isCurrent = status.value === normalized;

          return (
            <div key={status.value} className="flex flex-1 items-center">
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full border-2 transition-colors",
                    isComplete
                      ? "border-accent bg-accent text-white"
                      : "border-border bg-white text-muted"
                  )}
                >
                  {isComplete ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <span className="text-xs font-medium">{index + 1}</span>
                  )}
                </div>
                <span
                  className={cn(
                    "mt-2 text-center font-medium leading-tight",
                    audience === "client" ? "text-[10px] max-w-[92px] sm:text-xs sm:max-w-[100px]" : "text-xs max-w-[80px]",
                    isCurrent ? "text-accent" : isComplete ? "text-foreground" : "text-muted"
                  )}
                >
                  {labelFor(status)}
                </span>
              </div>
              {index < PROJECT_STATUSES.length - 1 && (
                <div
                  className={cn(
                    "mx-2 h-0.5 flex-1",
                    status.order < currentOrder ? "bg-accent" : "bg-border"
                  )}
                />
              )}
            </div>
          );
        })}
      </div>

      <div className="sm:hidden space-y-3">
        {PROJECT_STATUSES.map((status) => {
          const isComplete = status.order <= currentOrder;
          const isCurrent = status.value === normalized;

          return (
            <div key={status.value} className="flex items-center gap-3">
              <div
                className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2",
                  isComplete
                    ? "border-accent bg-accent text-white"
                    : "border-border bg-white"
                )}
              >
                {isComplete && <Check className="h-3 w-3" />}
              </div>
              <span
                className={cn(
                  "text-sm",
                  isCurrent ? "font-semibold text-accent" : isComplete ? "text-foreground" : "text-muted"
                )}
              >
                {labelFor(status)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
