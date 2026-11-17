import { redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import { BookingPageShell } from "@/components/booking/booking-page-shell";
import { RequestSummaryCard } from "@/components/booking/request-summary-card";
import { ScheduleChooser } from "@/components/booking/schedule-chooser";
import { loadPortalBookingPage } from "@/lib/booking/portal-page";

export const dynamic = "force-dynamic";

export default async function PortalSchedulePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { view } = await loadPortalBookingPage(id);
  const shoot = `/dashboard/projects/${id}/shoot`;
  const rescheduling = view.appointment?.status === "confirmed";
  if (!view.bookable || (rescheduling && !view.canReschedule.allowed)) redirect(shoot);
  return (
    <>
      <Header variant="dashboard" userRole="client" />
      <BookingPageShell
        publicChrome={false}
        title={rescheduling ? "Reschedule your shoot" : "Choose a time"}
        subtitle={
          rescheduling
            ? "Pick a new time. Your current appointment stays booked until you confirm."
            : "Schedule your shoot below, or skip this step and we'll follow up to confirm a time."
        }
        backHref={shoot}
        backLabel="Back"
      >
        <RequestSummaryCard view={view} />
        <ScheduleChooser view={view} auth={{ projectId: id }} successPath={shoot} requestedPath={`${shoot}?requested=1`} />
      </BookingPageShell>
    </>
  );
}
