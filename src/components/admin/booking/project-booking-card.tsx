"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarCheck2, Clock, Link2, Loader2, Route, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { AppointmentModal } from "@/components/admin/booking/appointment-modal";
import { OfferTimesPanel } from "@/components/admin/booking/offer-times-panel";
import { bookingPost } from "@/components/admin/booking/schedule-panel";
import type { ShootProposal } from "@/lib/types";

type DetailsLite = {
  timeZone: string;
  teamMembers: { userId: string; name: string }[];
  bookingLink: string | null;
  project: { clientName: string; durationMinutes: number };
};

function formatWhen(iso: string) {
  return new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(
    new Date(iso)
  );
}

/**
 * Project → Scheduling: the one place the business books a shoot.
 * - Schedule shoot: pick a time through the booking engine (or reschedule / reassign / route).
 * - Offer times: send the client up to three engine-checked times to pick from.
 * - Copy booking link: the client's personal page to book any open time (Instant Booking on).
 * Pending proposals (offered times, client suggestions) are answered in the card below it.
 */
export function ProjectBookingCard({ projectId, proposals }: { projectId: string; proposals: ShootProposal[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [offerOpen, setOfferOpen] = useState(false);
  const [details, setDetails] = useState<DetailsLite | null>(null);
  const [loadingDetails, setLoadingDetails] = useState<"offer" | "link" | null>(null);

  const confirmed = proposals.find((p) => p.status === "confirmed");
  const offered = proposals
    .filter((p) => p.status === "pending" && p.proposed_by === "admin")
    .sort((a, b) => Date.parse(a.proposed_at) - Date.parse(b.proposed_at));
  const suggested = proposals.filter((p) => p.status === "pending" && p.proposed_by === "client");

  async function ensureDetails(kind: "offer" | "link"): Promise<DetailsLite | null> {
    if (details) return details;
    setLoadingDetails(kind);
    const res = await bookingPost({ action: "details", projectId });
    setLoadingDetails(null);
    if (!res.ok) {
      toast.error(res.body.error || "Couldn't load scheduling details.");
      return null;
    }
    setDetails(res.body as DetailsLite);
    return res.body as DetailsLite;
  }

  async function openOffer() {
    if (await ensureDetails("offer")) setOfferOpen(true);
  }

  async function copyLink() {
    const d = await ensureDetails("link");
    if (!d) return;
    if (!d.bookingLink) {
      toast.error("A booking link needs a client on this project and Instant Booking turned on (Settings → Instant Booking).");
      return;
    }
    try {
      await navigator.clipboard.writeText(d.bookingLink);
      toast.success("Booking link copied. Text or email it to the client.");
    } catch {
      window.prompt("Copy the client's booking link:", d.bookingLink);
    }
  }

  const title = confirmed
    ? "Shoot booked"
    : offered.length
      ? offered.length > 1
        ? `${offered.length} times offered to the client`
        : "Time offered to the client"
      : suggested.length
        ? "The client suggested a time"
        : "Book this shoot";
  const subtitle = confirmed
    ? `${formatWhen(confirmed.proposed_at)} · see the route, reassign, or reschedule with availability and drive-time checks.`
    : offered.length
      ? `Waiting for them to pick: ${offered.map((o) => formatWhen(o.proposed_at)).join(" · ")}`
      : suggested.length
        ? "Book it below (checked against your availability), or offer other times."
        : "Schedule it yourself, offer the client a few times, or send them your booking link.";

  return (
    <div className="rounded-2xl border border-accent/25 bg-accent-subtle/50 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-card text-accent shadow-sm">
            {confirmed ? (
              <Route className="h-[18px] w-[18px]" />
            ) : offered.length ? (
              <Clock className="h-[18px] w-[18px]" />
            ) : (
              <CalendarCheck2 className="h-[18px] w-[18px]" />
            )}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-heading">{title}</p>
            <p className="text-xs text-muted">{subtitle}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!confirmed ? (
            <>
              <Button variant="outline" size="sm" className="min-h-10" onClick={copyLink} disabled={loadingDetails !== null}>
                {loadingDetails === "link" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />} Copy booking link
              </Button>
              <Button variant="outline" size="sm" className="min-h-10" onClick={openOffer} disabled={loadingDetails !== null}>
                {loadingDetails === "offer" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {offered.length ? " Change offered times" : " Offer times"}
              </Button>
            </>
          ) : null}
          <Button variant="accent" size="sm" className="min-h-10" onClick={() => setOpen(true)}>
            {confirmed ? "Shoot details & route" : "Schedule shoot"}
          </Button>
        </div>
      </div>

      <AppointmentModal projectId={open ? projectId : null} open={open} onClose={() => setOpen(false)} onChanged={() => router.refresh()} />
      <Modal open={offerOpen} onClose={() => setOfferOpen(false)} title="Offer shoot times" className="sm:max-w-xl">
        {details ? (
          <OfferTimesPanel
            projectId={projectId}
            timeZone={details.timeZone}
            team={details.teamMembers}
            durationMinutes={details.project.durationMinutes}
            clientName={details.project.clientName}
            onSent={() => {
              setOfferOpen(false);
              toast.success("Times sent. You'll be notified when the client picks one.");
              router.refresh();
            }}
          />
        ) : null}
      </Modal>
    </div>
  );
}
