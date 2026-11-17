import type { Metadata } from "next";
import { TenantUnavailable } from "@/components/public/tenant-unavailable";
import { BookingPageShell, InvalidBookingLink } from "@/components/booking/booking-page-shell";
import { ShootDetails } from "@/components/booking/shoot-details";
import { loadPublicBookingPage } from "@/lib/booking/public-page";
import { bookingPagePath } from "@/lib/booking/token";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your shoot", robots: { index: false, follow: false }, referrer: "no-referrer" };

export default async function ShootDetailsPage({ searchParams }: { searchParams: Promise<{ b?: string; requested?: string }> }) {
  const { b, requested } = await searchParams;
  const page = await loadPublicBookingPage(b);
  if (page.state === "unavailable") return <TenantUnavailable />;
  if (page.state === "invalid") return <InvalidBookingLink />;
  const { view, token } = page;
  const confirmed = view.appointment?.status === "confirmed";
  return (
    <BookingPageShell
      title={confirmed ? "Scheduled shoot details" : "Your shoot"}
      subtitle={confirmed ? "Your shoot is confirmed. Here are the details for your upcoming appointment." : undefined}
      backHref="/login"
      backLabel="Sign in to your portal"
    >
      <ShootDetails
        view={view}
        auth={{ b: token }}
        scheduleHref={bookingPagePath(token)}
        mapSrc={view.address ? `/api/booking/map?b=${encodeURIComponent(token)}` : null}
        requested={requested === "1"}
      />
    </BookingPageShell>
  );
}
