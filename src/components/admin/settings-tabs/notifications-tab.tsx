"use client";

import { useMemo, useState } from "react";
import { Bell, Check, Info, Mail, Smartphone } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  SectionHeading,
  useSettingsTab,
  type NotificationEventDef,
} from "@/components/admin/settings-tabs/shared";
import {
  AUDIENCE_LABEL,
  NOTIFICATION_CHANNELS,
  NOTIFICATION_STAGES,
  TOP_NOTIFICATION_EVENTS,
  channelAvailable,
  matchingPreset,
  presetValue,
  type NotificationChannel,
  type NotificationPreset,
} from "@/components/admin/settings-tabs/notifications-meta";

const CHANNEL_META: Record<NotificationChannel, { label: string; icon: typeof Bell; idPart: string }> = {
  inApp: { label: "In-app", icon: Bell, idPart: "inapp" },
  email: { label: "Email", icon: Mail, idPart: "email" },
  push: { label: "Push", icon: Smartphone, idPart: "push" },
};

const PRESET_OPTIONS: { value: NotificationPreset | "custom"; label: string }[] = [
  { value: "custom", label: "Custom" },
  { value: "everything", label: "Everything" },
  { value: "essentials", label: "Essentials" },
];

export function NotificationsTab() {
  const { settings, updateNotification, notificationEvents } = useSettingsTab();
  const [showAll, setShowAll] = useState(false);

  const groups = useMemo(() => {
    const byKey = new Map(notificationEvents.map((e) => [e.key, e] as const));
    const used = new Set<string>();
    const out = NOTIFICATION_STAGES.map((stage) => {
      const events = stage.keys
        .map((key) => byKey.get(key))
        .filter((e): e is NotificationEventDef => Boolean(e));
      events.forEach((e) => used.add(e.key));
      return { id: stage.id, title: stage.title, events };
    });
    // Any event not placed in a stage still shows, under "Messages & other".
    const rest = notificationEvents.filter((e) => !used.has(e.key));
    if (rest.length > 0) out[out.length - 1].events.push(...rest);
    return out;
  }, [notificationEvents]);

  const totalCount = notificationEvents.length;
  const topCount = notificationEvents.filter((e) => TOP_NOTIFICATION_EVENTS.includes(e.key)).length;
  const hasMore = topCount < totalCount;
  const visibleGroups = groups
    .map((g) => ({
      ...g,
      events: showAll || !hasMore ? g.events : g.events.filter((e) => TOP_NOTIFICATION_EVENTS.includes(e.key)),
    }))
    .filter((g) => g.events.length > 0);

  const activePreset = matchingPreset(settings.notifications, notificationEvents);

  function applyPreset(preset: NotificationPreset) {
    for (const event of notificationEvents) {
      for (const channel of NOTIFICATION_CHANNELS) {
        if (!channelAvailable(event, channel)) continue;
        const next = presetValue(preset, event, channel);
        if (Boolean(settings.notifications[event.key]?.[channel]) !== next) {
          updateNotification(event.key, channel, next);
        }
      }
    }
  }

  function cell(event: NotificationEventDef, channel: NotificationChannel, suffix: "d" | "m") {
    if (!channelAvailable(event, channel)) {
      return (
        <span className="flex h-11 w-11 items-center justify-center text-muted" aria-label="Not available">
          —
        </span>
      );
    }
    const meta = CHANNEL_META[channel];
    return (
      <ChannelCheckbox
        id={`${event.key}-${meta.idPart}-${suffix}`}
        label={`${event.label} ${meta.label.toLowerCase()}`}
        checked={Boolean(settings.notifications[event.key]?.[channel])}
        onChange={(v) => updateNotification(event.key, channel, v)}
      />
    );
  }

  return (
    <div id="settings-notifications" tabIndex={-1} className="scroll-mt-24">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <SectionHeading id="notifications">Notifications</SectionHeading>
          <p className="mt-1 text-sm text-muted">
            Choose how you hear about each event. Clients get in-app and email only.
          </p>
        </div>
        <div
          role="radiogroup"
          aria-label="Notification preset"
          className="inline-flex shrink-0 rounded-xl bg-subtle p-1"
        >
          {PRESET_OPTIONS.map((option) => {
            const active = activePreset === option.value;
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => {
                  if (option.value !== "custom") applyPreset(option.value);
                }}
                title={
                  option.value === "custom"
                    ? "Your own mix. Change any box below."
                    : option.value === "everything"
                      ? "Every available channel on"
                      : "Only the alerts that matter most"
                }
                className={cn(
                  "min-h-9 rounded-lg px-3 text-sm font-medium transition-colors",
                  active ? "bg-card text-heading shadow-sm" : "text-muted hover:text-heading",
                  option.value === "custom" && !active && "cursor-default"
                )}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-5 overflow-hidden rounded-2xl border border-border bg-card">
        {/* Column header */}
        <div className="flex items-center border-b border-border px-4 py-3 sm:px-5">
          <span className="flex-1 text-[11px] font-semibold uppercase tracking-wider text-muted">Event</span>
          {NOTIFICATION_CHANNELS.map((channel) => {
            const { icon: Icon, label } = CHANNEL_META[channel];
            return (
              <span
                key={channel}
                className="flex w-11 flex-col items-center gap-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted sm:w-20 sm:text-[11px]"
              >
                <Icon className="h-4 w-4" aria-hidden />
                {label}
              </span>
            );
          })}
        </div>

        {visibleGroups.map((group) => (
          <div key={group.id}>
            <p className="border-b border-border bg-subtle px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted sm:px-5">
              {group.title}
            </p>
            <ul className="divide-y divide-border border-b border-border">
              {group.events.map((event) => (
                <li key={event.key} className="flex items-center px-4 py-1 sm:px-5" title={event.description}>
                  <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-0.5 py-2">
                    <span className="text-sm font-medium text-heading">{event.label}</span>
                    <span className="rounded-md bg-subtle px-1.5 py-0.5 text-[11px] font-semibold text-muted">
                      {AUDIENCE_LABEL[event.audience]}
                    </span>
                  </div>
                  {NOTIFICATION_CHANNELS.map((channel) => (
                    <div key={channel} className="flex w-11 justify-center sm:w-20">
                      {cell(event, channel, "d")}
                    </div>
                  ))}
                </li>
              ))}
            </ul>
          </div>
        ))}

        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 px-4 py-3 text-[13px] text-muted sm:px-5">
          <Info className="h-4 w-4 shrink-0" aria-hidden />
          <span>Push goes to your team only. Activity still logs when alerts are off.</span>
          {hasMore ? (
            <>
              <span>
                {showAll ? `Showing all ${totalCount} events` : `Showing ${topCount} of ${totalCount} events`} ·
              </span>
              <button
                type="button"
                onClick={() => setShowAll((v) => !v)}
                className="min-h-9 font-semibold text-accent hover:underline"
                aria-expanded={showAll}
              >
                {showAll ? "Show fewer" : `Show all (${totalCount})`}
              </button>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** Checkbox-style toggle with a 44px tap target. */
function ChannelCheckbox({
  id,
  label,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      id={id}
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      title={label}
      onClick={() => onChange(!checked)}
      className="group flex h-11 w-11 items-center justify-center rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      <span
        className={cn(
          "flex h-5 w-5 items-center justify-center rounded-md border transition-colors",
          checked
            ? "border-accent bg-accent text-accent-foreground"
            : "border-border bg-card group-hover:border-accent"
        )}
      >
        {checked ? <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden /> : null}
      </span>
    </button>
  );
}
