import { Header } from "@/components/layout/header";
import { BookingPageShell } from "@/components/booking/booking-page-shell";
import { ShootDetails } from "@/components/booking/shoot-details";
import { NextStepChoices } from "@/components/booking/next-step-choices";
import { RequestSummaryCard } from "@/components/booking/request-summary-card";
import { loadPortalBookingPage } from "@/lib/booking/portal-page";

export const dynamic = "force-dynamic";

export default async function PortalShootPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ requested?: string; welcome?: string }>;
}) {
  const { id } = await params;
  const { requested, welcome } = await searchParams;
  const { view } = await loadPortalBookingPage(id);
  const confirmed = view.appointment?.status === "confirmed";
  const scheduleHref = `/dashboard/projects/${id}/schedule`;
  // Just submitted from the portal with Instant Booking on: same "what's next" step as the public flow.
  const offerNextStep = welcome === "1" && !view.appointment && view.bookable;

  return (
    <>
      <Header variant="dashboard" userRole="client" />
      <BookingPageShell
        publicChrome={false}
        title={offerNextStep ? "Your request was received!" : confirmed ? "Scheduled shoot details" : "Your shoot"}
        subtitle={confirmed ? "Your shoot is confirmed. Here are the details for your upcoming appointment." : undefined}
        backHref={`/dashboard/projects/${id}`}
        backLabel="Back to project"
      >
        {offerNextStep ? (
          <>
            <RequestSummaryCard view={view} />
            <section className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-7">
              <h2 className="mb-4 text-xl font-bold text-heading">What&apos;s next? Schedule your shoot</h2>
              <NextStepChoices
                scheduleHref={scheduleHref}
                auth={{ projectId: id }}
                allowSkip={view.mode === "optional"}
                requestedHref={`/dashboard/projects/${id}/shoot?requested=1`}
              />
            </section>
          </>
        ) : (
          <ShootDetails
            view={view}
            auth={{ projectId: id }}
            scheduleHref={scheduleHref}
            mapSrc={view.address ? `/api/booking/map?projectId=${id}` : null}
            requested={requested === "1"}
          />
        )}
      </BookingPageShell>
    </>
  );
}
