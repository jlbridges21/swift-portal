"use client";

import { useCallback, useEffect, useState } from "react";
import type { TeamMember } from "@/lib/booking/team";
import type { AssignmentWeights, WeeklyHours } from "@/lib/booking/settings";

export type OverviewTeamMember = TeamMember & {
  effective: {
    workingHours: WeeklyHours;
    maxShootsPerDay: number;
    baseAddress: string | null;
    serviceRadiusMiles: number | null;
    weights: AssignmentWeights;
  };
};

export type OverviewService = {
  id: string;
  name: string;
  isActive: boolean;
  priceCents: number | null;
  hidePricing: boolean;
  durationMinutes: number;
  bufferMinutes: number;
  instantBookingAllowed: boolean;
  outsideRadiusRequiresQuote: boolean;
};

export type BookingOverview = {
  viewerUserId: string;
  memberCalendars: { userId: string; email: string | null; status: "active" | "needs_reconnect" }[];
  schemaReady: boolean;
  profilesReady: boolean;
  routesConfigured: boolean;
  businessAddress: string | null;
  google: {
    configured: boolean;
    connected: boolean;
    status: string;
    email: string | null;
    defaultCalendarId: string | null;
    calendars: { id: string; summary: string; primary: boolean }[];
  };
  team: OverviewTeamMember[];
  services: OverviewService[];
};

/** Settings → scheduling pages share one fetch per mount. */
export function useBookingOverview() {
  const [data, setData] = useState<BookingOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/booking", { credentials: "include", cache: "no-store" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Couldn't load scheduling settings.");
      setData(body as BookingOverview);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load scheduling settings.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, error, loading, reload, setData };
}

export function calendarLabel(overview: BookingOverview | null, id: string): string {
  const cal = overview?.google.calendars.find((c) => c.id === id);
  if (cal) return cal.summary || id;
  if (id === "primary") return "Primary calendar";
  return id;
}
