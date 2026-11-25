"use client";

import { Fragment, useEffect, useState } from "react";
import {
  AlignLeft,
  Check,
  CircleHelp,
  Copy,
  ExternalLink,
  Loader2,
  Lock,
  MapPin,
  Paperclip,
  Pencil,
  Phone,
  Repeat,
  Users,
  Video,
  X,
} from "lucide-react";
import { toast } from "sonner";
import type { ExternalCalendarEvent } from "@/lib/google-calendar-pull";
import type { ExternalEventDetails, ExternalEventPerson } from "@/lib/external-event-details";
import { ExternalEventEditor, type ExternalEventChange } from "@/components/admin/calendar/external-event-editor";

type Provider = "Google" | "Outlook";

type LoadState =
  | { status: "loading" }
  | { status: "ready"; details: ExternalEventDetails }
  | { status: "error"; message: string };

const URL_RE = /(https?:\/\/[^\s<>"')\]]+[^\s<>"')\].,;:!?])/g;

/** Plain text with clickable links. Never renders provider HTML. */
function LinkifiedText({ text }: { text: string }) {
  const parts = text.split(URL_RE);
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="break-all text-indigo-700 underline underline-offset-2 hover:text-indigo-900"
          >
            {part}
          </a>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        )
      )}
    </>
  );
}

function Row({ icon: Icon, children }: { icon: typeof MapPin; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden />
      <div className="min-w-0 flex-1 text-sm text-heading">{children}</div>
    </div>
  );
}

const RESPONSE_LABEL: Record<string, string> = {
  accepted: "Yes",
  declined: "No",
  tentative: "Maybe",
  needsAction: "Awaiting",
  organizer: "Organizer",
};

function ResponseMark({ response }: { response: string | null }) {
  if (response === "accepted" || response === "organizer")
    return <Check className="h-3.5 w-3.5 text-emerald-600" aria-label={RESPONSE_LABEL[response]} />;
  if (response === "declined") return <X className="h-3.5 w-3.5 text-red-600" aria-label="Declined" />;
  return <CircleHelp className="h-3.5 w-3.5 text-muted" aria-label={RESPONSE_LABEL[response ?? ""] ?? "No response"} />;
}

function guestSummary(people: ExternalEventPerson[]): string {
  const count = (r: string) => people.filter((p) => p.response === r).length;
  const yes = count("accepted") + count("organizer");
  const bits = [`${yes} yes`];
  if (count("declined")) bits.push(`${count("declined")} no`);
  if (count("tentative")) bits.push(`${count("tentative")} maybe`);
  const waiting = people.length - yes - count("declined") - count("tentative");
  if (waiting) bits.push(`${waiting} awaiting`);
  return bits.join(", ");
}

function Guests({ people, organizer }: { people: ExternalEventPerson[]; organizer: ExternalEventDetails["organizer"] }) {
  const [all, setAll] = useState(false);
  const sorted = [...people].sort((a, b) => Number(b.organizer) - Number(a.organizer));
  const shown = all ? sorted : sorted.slice(0, 6);
  const hasOrganizerRow = people.some((p) => p.organizer);
  return (
    <Row icon={Users}>
      <p className="font-medium text-heading">
        {people.length} guest{people.length === 1 ? "" : "s"}
        <span className="ml-1.5 font-normal text-muted">{guestSummary(people)}</span>
      </p>
      {organizer && !hasOrganizerRow ? (
        <p className="mt-1 text-muted">Organized by {organizer.name || organizer.email}</p>
      ) : null}
      <ul className="mt-2 space-y-1.5">
        {shown.map((p, i) => (
          <li key={`${p.email ?? p.name ?? i}`} className="flex items-center gap-2">
            <ResponseMark response={p.response} />
            <span className="min-w-0 truncate" title={p.email ?? undefined}>
              {p.name || p.email}
              {p.self ? <span className="text-muted"> (you)</span> : null}
            </span>
            {p.organizer ? <span className="shrink-0 text-xs text-muted">Organizer</span> : null}
            {p.optional ? <span className="shrink-0 text-xs text-muted">Optional</span> : null}
          </li>
        ))}
      </ul>
      {sorted.length > 6 ? (
        <button
          type="button"
          onClick={() => setAll((v) => !v)}
          className="mt-1.5 text-sm font-medium text-indigo-700 hover:text-indigo-900"
        >
          {all ? "Show fewer" : `Show all ${sorted.length}`}
        </button>
      ) : null}
    </Row>
  );
}

function mapsUrl(location: string): string | null {
  // A URL as the location (e.g. a Zoom link) opens directly; otherwise search Google Maps.
  if (/^https?:\/\//i.test(location)) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`;
}

export function ExternalEventDetailsBody({
  event,
  provider,
  timeZone,
  onChanged,
}: {
  event: ExternalCalendarEvent;
  provider: Provider;
  timeZone: string;
  /** Saved or deleted in Google/Outlook: the calendar updates and re-reads the provider. */
  onChanged?: (change: ExternalEventChange) => void;
}) {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: "loading" });
    const params = new URLSearchParams({ calendarId: event.calendarId, eventId: event.id });
    fetch(`/api/integrations/calendar-event-details?${params.toString()}`, { signal: controller.signal })
      .then(async (res) => {
        const json = (await res.json().catch(() => ({}))) as { details?: ExternalEventDetails; error?: string };
        if (!res.ok || !json.details) throw new Error(json.error || `Couldn't load the details from ${provider}.`);
        setState({ status: "ready", details: json.details });
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setState({ status: "error", message: err instanceof Error ? err.message : "Couldn't load the details." });
      });
    return () => controller.abort();
  }, [event.calendarId, event.id, provider, attempt]);

  const details = state.status === "ready" ? state.details : null;
  const location = details?.location ?? null;
  const locationLink = location ? mapsUrl(location) : null;
  const canEdit = Boolean(details?.edit.canEdit && onChanged);

  if (editing && details) {
    return (
      <ExternalEventEditor
        event={event}
        details={details}
        provider={provider}
        timeZone={timeZone}
        onCancel={() => setEditing(false)}
        onDone={(change) => {
          setEditing(false);
          if (change.kind === "updated") setAttempt((n) => n + 1);
          onChanged?.(change);
        }}
      />
    );
  }

  return (
    <div className="space-y-4 pb-1">
      <div className="space-y-1">
        <div className="flex items-start justify-between gap-3">
          <p className="min-w-0 text-base font-semibold text-heading">{event.title}</p>
          {canEdit ? (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-md border border-border px-3 text-sm font-medium text-heading hover:bg-subtle"
            >
              <Pencil className="h-4 w-4" aria-hidden /> Edit
            </button>
          ) : null}
        </div>
        <p className="text-sm text-indigo-800">
          {event.allDay ? "All day" : event.timeLabel}
          {details?.recurring ? (
            <span className="ml-2 inline-flex items-center gap-1 text-muted">
              <Repeat className="h-3.5 w-3.5" aria-hidden /> Repeats
            </span>
          ) : null}
        </p>
        <p className="flex items-center gap-1.5 text-sm text-muted">
          {event.calendarColor ? (
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: event.calendarColor }} aria-hidden />
          ) : null}
          {provider} · {event.calendarSummary}
          {details?.showAs === "free" ? " · Free" : null}
          {details?.visibility === "private" ? (
            <span className="inline-flex items-center gap-1">
              · <Lock className="h-3 w-3" aria-hidden /> Private
            </span>
          ) : null}
        </p>
      </div>

      {state.status === "loading" ? (
        <p className="flex items-center gap-2 text-sm text-muted">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading details from {provider}…
        </p>
      ) : null}

      {state.status === "error" ? (
        <p className="text-sm text-muted">
          {state.message}{" "}
          <button
            type="button"
            onClick={() => setAttempt((n) => n + 1)}
            className="font-medium text-indigo-700 hover:text-indigo-900"
          >
            Retry
          </button>
        </p>
      ) : null}

      {details ? (
        <div className="space-y-4">
          {details.meeting ? (
            <Row icon={Video}>
              <div className="flex flex-wrap items-center gap-2">
                <a
                  href={details.meeting.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-10 items-center gap-2 rounded-md bg-indigo-600 px-3 text-sm font-medium text-white hover:bg-indigo-700"
                >
                  {details.meeting.label}
                </a>
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard
                      ?.writeText(details.meeting!.url)
                      .then(() => toast.success("Meeting link copied"))
                      .catch(() => toast.error("Couldn't copy the link"));
                  }}
                  className="inline-flex min-h-10 items-center gap-1.5 rounded-md border border-border px-3 text-sm text-heading hover:bg-subtle"
                  aria-label="Copy meeting link"
                >
                  <Copy className="h-4 w-4" aria-hidden /> Copy link
                </button>
              </div>
              <p className="mt-1 truncate text-xs text-muted" title={details.meeting.url}>
                {details.meeting.url.replace(/^https?:\/\//, "")}
              </p>
              {details.meeting.phone ? (
                <p className="mt-1 flex items-center gap-1.5 text-xs text-muted">
                  <Phone className="h-3 w-3" aria-hidden /> {details.meeting.phone}
                </p>
              ) : null}
            </Row>
          ) : null}

          {location ? (
            <Row icon={MapPin}>
              {locationLink ? (
                <a
                  href={locationLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-700 underline-offset-2 hover:underline"
                >
                  {location}
                </a>
              ) : (
                <LinkifiedText text={location} />
              )}
            </Row>
          ) : null}

          {details.attendees.length ? <Guests people={details.attendees} organizer={details.organizer} /> : null}

          {details.description ? (
            <Row icon={AlignLeft}>
              <div className="max-h-72 overflow-y-auto whitespace-pre-wrap break-words pr-1 leading-relaxed">
                <LinkifiedText text={details.description} />
              </div>
            </Row>
          ) : null}

          {details.attachments.length ? (
            <Row icon={Paperclip}>
              <ul className="space-y-1">
                {details.attachments.map((a) => (
                  <li key={a.url}>
                    <a
                      href={a.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-700 underline-offset-2 hover:underline"
                    >
                      {a.title}
                    </a>
                  </li>
                ))}
              </ul>
            </Row>
          ) : null}

          {!details.meeting && !location && !details.attendees.length && !details.description && !details.attachments.length ? (
            <p className="text-sm text-muted">No description, location or guests on this event.</p>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-border pt-4">
        {event.htmlLink ? (
          <a
            href={event.htmlLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center gap-2 rounded-md border border-indigo-300 bg-indigo-50 px-3 text-sm font-medium text-indigo-900"
          >
            Open in {provider} Calendar <ExternalLink className="h-4 w-4" />
          </a>
        ) : null}
        <p className="text-xs text-muted">
          {canEdit
            ? `Changes you make here save to ${provider} Calendar.`
            : details
              ? `You can't change this event (it's an invitation or on a read-only calendar).`
              : null}
        </p>
      </div>
    </div>
  );
}
