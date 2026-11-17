"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  CalendarPlus,
  CalendarX2,
  CheckCircle2,
  CircleCheck,
  ExternalLink,
  Info,
  Loader2,
  MapPin,
  ReceiptText,
  RefreshCw,
  Send,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { PersonAvatar } from "@/components/admin/booking/booking-ui";
import { splitAddress } from "@/components/booking/request-summary-card";
import type { ClientBookingView } from "@/lib/booking/client-view";
import { formatCurrency } from "@/lib/utils";

function googleCalendarLink(view: ClientBookingView): string | null {
  const a = view.appointment;
  if (!a) return null;
  const fmt = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `${view.businessName} shoot: ${splitAddress(view.address).line1 || view.projectName}`,
    dates: `${fmt(a.start)}/${fmt(a.end)}`,
    details: `Services: ${view.services.join(", ")}`,
    location: view.address ?? "",
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function ShootDetails({
  view,
  auth,
  scheduleHref,
  mapSrc,
  requested,
}: {
  view: ClientBookingView;
  auth: { b?: string; projectId?: string };
  scheduleHref: string;
  mapSrc: string | null;
  requested?: boolean;
}) {
  const router = useRouter();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mapFailed, setMapFailed] = useState(false);
  const appt = view.appointment;
  const confirmed = appt?.status === "confirmed";
  const cancelled = appt?.status === "cancelled";
  const tz = view.timeZone;
  const dateLabel = appt
    ? new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: tz }).format(new Date(appt.start))
    : "";
  const timeLabel = appt
    ? `${new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: tz }).format(new Date(appt.start))} – ${new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: tz, timeZoneName: "short" }).format(new Date(appt.end))}`
    : "";
  const addr = splitAddress(view.address);
  const estimate = view.estimate;
  const calLink = googleCalendarLink(view);

  async function cancel() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ...auth, action: "cancel", reason }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Couldn't cancel.");
      setCancelOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't cancel.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      {confirmed ? (
        <section className="flex items-start gap-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 surface-dark:border-emerald-500/30 surface-dark:bg-emerald-500/10">
          <CheckCircle2 className="h-9 w-9 shrink-0 text-emerald-600" aria-hidden />
          <div>
            <h2 className="text-xl font-bold text-heading sm:text-2xl">Your shoot is scheduled!</h2>
            <p className="mt-1 text-sm text-foreground">
              You&apos;ll also receive a confirmation email with all the details. We&apos;re excited to shoot your property!
            </p>
          </div>
        </section>
      ) : cancelled ? (
        <section className="flex items-start gap-4 rounded-2xl border border-border bg-card p-5">
          <XCircle className="h-9 w-9 shrink-0 text-muted" aria-hidden />
          <div>
            <h2 className="text-xl font-bold text-heading">This shoot was cancelled</h2>
            <p className="mt-1 text-sm text-muted">
              {view.bookable ? "Pick a new time whenever you're ready." : `${view.businessName} will follow up about a new time.`}
            </p>
            {view.bookable ? (
              <Link href={scheduleHref} className="mt-3 inline-block">
                <Button variant="accent">
                  <CalendarDays className="h-4 w-4" /> Book a new time
                </Button>
              </Link>
            ) : null}
          </div>
        </section>
      ) : (
        <section className="flex items-start gap-4 rounded-2xl border border-accent/20 bg-accent-subtle p-5">
          <Send className="h-8 w-8 shrink-0 text-accent" aria-hidden />
          <div>
            <h2 className="text-xl font-bold text-heading">{requested ? "Request sent — we'll find a time" : "Not scheduled yet"}</h2>
            <p className="mt-1 text-sm text-muted">
              {view.notBookableReason ?? `${view.businessName} will follow up shortly to confirm a time that works for you.`}
            </p>
            {view.bookable ? (
              <Link href={scheduleHref} className="mt-3 inline-block">
                <Button variant="accent">
                  <CalendarDays className="h-4 w-4" /> Choose a time now
                </Button>
              </Link>
            ) : null}
          </div>
        </section>
      )}

      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-5">
          <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="flex flex-col gap-5 sm:flex-row">
              {view.coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={view.coverUrl} alt="" className="h-40 w-full rounded-xl object-cover sm:h-36 sm:w-56" />
              ) : null}
              <div className="min-w-0">
                <p className="text-sm text-muted">Real estate media shoot</p>
                <p className="mt-0.5 text-2xl font-bold tracking-tight text-heading">{addr.line1 || view.projectName}</p>
                {addr.line2 ? <p className="text-muted">{addr.line2}</p> : null}
                <ul className="mt-3 flex flex-wrap gap-1.5">
                  {view.services.map((s) => (
                    <li key={s} className="rounded-lg bg-subtle px-3 py-1 text-sm text-foreground">
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            {appt && confirmed ? (
              <>
                <div className="mt-5 grid gap-4 border-t border-border pt-5 sm:grid-cols-2 sm:divide-x sm:divide-border">
                  <div className="flex items-start gap-3">
                    <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-accent-subtle text-accent">
                      <CalendarDays className="h-5 w-5" aria-hidden />
                    </span>
                    <div>
                      <p className="text-xs text-muted">Scheduled date &amp; time</p>
                      <p className="text-lg font-bold text-heading">{dateLabel}</p>
                      <p className="text-sm text-foreground">{timeLabel}</p>
                    </div>
                  </div>
                  {appt.photographer ? (
                    <div className="flex items-start gap-3 sm:pl-4">
                      <PersonAvatar name={appt.photographer.name} url={appt.photographer.avatarUrl} size={56} />
                      <div>
                        <p className="text-xs text-muted">Your photographer</p>
                        <p className="text-lg font-bold text-heading">{appt.photographer.name}</p>
                        <p className="text-sm text-muted">{appt.photographer.title}</p>
                      </div>
                    </div>
                  ) : null}
                </div>
                <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-border pt-5">
                  {view.canReschedule.allowed ? (
                    <Link href={scheduleHref}>
                      <Button variant="outline" className="min-h-11 border-accent text-accent">
                        <RefreshCw className="h-4 w-4" /> Reschedule
                      </Button>
                    </Link>
                  ) : null}
                  {view.canCancel.allowed ? (
                    <Button variant="outline" className="min-h-11" onClick={() => setCancelOpen(true)}>
                      <CalendarX2 className="h-4 w-4" /> Cancel
                    </Button>
                  ) : null}
                  {appt.onGoogleCalendar ? (
                    <span className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border px-3 text-sm text-foreground">
                      <CircleCheck className="h-4 w-4 text-emerald-600" /> On {view.businessName}&apos;s calendar
                    </span>
                  ) : null}
                  {calLink ? (
                    <a href={calLink} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border px-3 text-sm font-medium text-foreground hover:bg-subtle">
                      <CalendarPlus className="h-4 w-4 text-accent" /> Add to Google Calendar
                    </a>
                  ) : null}
                </div>
                {!view.canReschedule.allowed || !view.canCancel.allowed ? (
                  <p className="mt-2 flex items-start gap-1.5 text-xs text-muted">
                    <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                    {view.canReschedule.reason ?? view.canCancel.reason ?? "Need a change? Send us a message from your project."}
                  </p>
                ) : null}
              </>
            ) : null}
          </section>

          <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="grid gap-4 sm:grid-cols-[1fr_1.5fr] sm:items-center">
              <div className="flex items-start gap-3">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-accent-subtle text-accent">
                  <MapPin className="h-5 w-5" aria-hidden />
                </span>
                <div>
                  <p className="text-lg font-semibold text-heading">Location</p>
                  <p className="text-sm font-medium text-heading">{addr.line1}</p>
                  <p className="text-sm text-muted">{addr.line2}</p>
                  {view.address ? (
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(view.address)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-subtle"
                    >
                      Get directions <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  ) : null}
                </div>
              </div>
              {mapSrc && !mapFailed ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={mapSrc} alt={`Map of ${view.address}`} onError={() => setMapFailed(true)} className="h-44 w-full rounded-xl border border-border object-cover" />
              ) : (
                <div className="flex h-44 items-center justify-center rounded-xl border border-dashed border-border bg-subtle text-sm text-muted">
                  <MapPin className="mr-2 h-4 w-4" /> {addr.line1}
                </div>
              )}
            </div>
          </section>
        </div>

        <div className="space-y-5">
          <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <p className="flex items-center gap-2 text-lg font-semibold text-heading">
              <ReceiptText className="h-5 w-5 text-muted" aria-hidden />
              {estimate?.kind === "official" ? "Estimate" : "Preliminary estimate"}
            </p>
            {estimate ? (
              <>
                <p className="mt-2 text-3xl font-bold tracking-tight text-heading">{formatCurrency(estimate.totalCents)}</p>
                <dl className="mt-4 space-y-2 text-sm">
                  {estimate.lines.map((l, i) => (
                    <div key={`${l.description}-${i}`} className="flex justify-between gap-3">
                      <dt className="text-muted">{l.description}</dt>
                      <dd className="font-medium text-heading">{formatCurrency(l.amountCents)}</dd>
                    </div>
                  ))}
                  <div className="flex justify-between gap-3 border-t border-border pt-2 text-base">
                    <dt className="font-semibold text-heading">Estimated total</dt>
                    <dd className="font-bold text-heading">{formatCurrency(estimate.totalCents)}</dd>
                  </div>
                </dl>
              </>
            ) : (
              <p className="mt-2 text-sm text-muted">Custom quote — {view.businessName} will send pricing.</p>
            )}
          </section>
          <section className="rounded-2xl border border-accent/20 bg-accent-subtle p-5">
            <p className="flex items-center gap-2 text-lg font-semibold text-heading">
              <Info className="h-5 w-5 text-accent" aria-hidden /> What&apos;s next?
            </p>
            <p className="mt-2 text-sm text-foreground">
              We&apos;ll review everything and follow up if we need anything else — access details, special instructions, or changes to the
              property. Your official estimate and payment are handled in your project, separately from this booking.
            </p>
          </section>
        </div>
      </div>

      <Modal
        open={cancelOpen}
        onClose={() => !busy && setCancelOpen(false)}
        title="Cancel this shoot?"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setCancelOpen(false)} disabled={busy}>
              Keep my shoot
            </Button>
            <Button variant="destructive" onClick={cancel} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Cancel shoot
            </Button>
          </div>
        }
      >
        <p className="text-sm text-muted">
          Your appointment on {dateLabel} at {timeLabel} will be released. {view.businessName} will be notified.
        </p>
        <label htmlFor="cancel-reason" className="mt-4 block text-sm font-medium text-heading">
          Reason (optional)
        </label>
        <textarea
          id="cancel-reason"
          rows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="mt-1.5 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
        />
        {error ? <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      </Modal>
    </div>
  );
}
