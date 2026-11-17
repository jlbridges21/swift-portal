"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarCheck2, Route } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppointmentModal } from "@/components/admin/booking/appointment-modal";
import type { ShootProposal } from "@/lib/types";

/**
 * Project → Scheduling: one entry point to the booking engine (schedule, reschedule,
 * reassign, route) for the business. The legacy propose/confirm card stays below it for
 * businesses that prefer to propose times to the client.
 */
export function ProjectBookingCard({ projectId, proposals }: { projectId: string; proposals: ShootProposal[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const confirmed = proposals.find((p) => p.status === "confirmed");
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-accent/25 bg-accent-subtle/50 px-4 py-3">
      <div className="flex items-center gap-3">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-card text-accent shadow-sm">
          {confirmed ? <Route className="h-[18px] w-[18px]" /> : <CalendarCheck2 className="h-[18px] w-[18px]" />}
        </span>
        <div>
          <p className="text-sm font-semibold text-heading">{confirmed ? "Shoot booked" : "Book this shoot"}</p>
          <p className="text-xs text-muted">
            {confirmed
              ? "See the route, reassign, or reschedule with availability and drive-time checks."
              : "Pick an open time using your hours, buffers, drive time and team availability."}
          </p>
        </div>
      </div>
      <Button variant="accent" size="sm" className="min-h-10" onClick={() => setOpen(true)}>
        {confirmed ? "Shoot details & route" : "Schedule shoot"}
      </Button>
      <AppointmentModal projectId={open ? projectId : null} open={open} onClose={() => setOpen(false)} onChanged={() => router.refresh()} />
    </div>
  );
}
