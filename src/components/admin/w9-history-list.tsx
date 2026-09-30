"use client";

import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { W9SendEvent } from "@/lib/w9-send";

export function w9LinkStatus(row: W9SendEvent): string {
  if (row.revoked_at) return "Revoked";
  if (row.downloaded_at) return "Downloaded";
  if (new Date(row.expires_at).getTime() <= Date.now()) return "Expired";
  return "Link active";
}

export function W9HistoryList({
  rows,
  error,
  revoking,
  onRevoke,
  empty,
  showClient = true,
}: {
  rows: W9SendEvent[];
  error: string | null;
  revoking: string | null;
  onRevoke: (id: string) => void;
  empty: string;
  showClient?: boolean;
}) {
  return (
    <div className="space-y-3">
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {rows.length === 0 ? <p className="text-sm text-muted">{empty}</p> : null}
      <ul className="space-y-3">
        {rows.map((row) => {
          const status = w9LinkStatus(row);
          const canRevoke = status === "Link active";
          return (
            <li
              key={row.id}
              className="flex min-w-0 flex-wrap items-center justify-between gap-2 border-b border-border pb-3 text-sm"
              data-w9-history-row=""
            >
              <div className="min-w-0">
                <p className="font-medium text-primary">
                  {showClient ? `${row.client_name || "Client"} · ` : ""}
                  {row.recipient_email}
                </p>
                <p className="text-muted">
                  Sent {new Date(row.created_at).toLocaleString()} · Expires{" "}
                  {new Date(row.expires_at).toLocaleString()} · {status}
                </p>
              </div>
              {canRevoke ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={revoking === row.id}
                  onClick={() => onRevoke(row.id)}
                >
                  {revoking === row.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Revoke link"}
                </Button>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
