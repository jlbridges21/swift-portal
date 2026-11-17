import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { TenantUnavailable } from "@/components/public/tenant-unavailable";
import { BookingPageShell, InvalidBookingLink } from "@/components/booking/booking-page-shell";
import { RequestSummaryCard } from "@/components/booking/request-summary-card";
import { ScheduleChooser } from "@/components/booking/schedule-chooser";
import { loadPublicBookingPage } from "@/lib/booking/public-page";
import { shootPagePath } from "@/lib/booking/token";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Choose a time", robots: { index: false, follow: false }, referrer: "no-referrer" };

export default async function ChooseTimePage({ searchParams }: { searchParams: Promise<{ b?: string }> }) {
  const { b } = await searchParams;
  const page = await loadPublicBookingPage(b);
  if (page.state === "unavailable") return <TenantUnavailable />;
  if (page.state === "invalid") return <InvalidBookingLink />;
  const { view, token } = page;
  const shoot = shootPagePath(token);
  const rescheduling = view.appointment?.status === "confirmed";
  if (!view.bookable || (rescheduling && !view.canReschedule.allowed)) redirect(shoot);

  return (
    <BookingPageShell
      title={rescheduling ? "Reschedule your shoot" : "Choose a time"}
      subtitle={
        rescheduling
          ? "Pick a new time. Your current appointment stays booked until you confirm."
          : view.mode === "optional"
            ? "Schedule your shoot below, or skip this step and we'll follow up to confirm a time."
            : "Choose a time that works for you to schedule your shoot."
      }
      backHref={shoot}
      backLabel={rescheduling ? "Back to shoot details" : "Back to request"}
    >
      <RequestSummaryCard view={view} />
      <ScheduleChooser view={view} auth={{ b: token }} successPath={shoot} requestedPath={`${shoot}&requested=1`} />
    </BookingPageShell>
  );
}
