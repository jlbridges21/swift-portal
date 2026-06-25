import type { Metadata } from "next";
import { LandingPage } from "@/components/landing/landing-page";
import { SITE } from "@/lib/site-metadata";

export const metadata: Metadata = {
  title: SITE.title,
  description:
    "Request aerial shoots, review quotes, track projects, approve deliverables, and pay securely — all in one premium client portal.",
  openGraph: {
    title: SITE.title,
    description:
      "Request aerial shoots, review quotes, track projects, approve deliverables, and pay securely — all in one premium client portal.",
  },
};

export default function HomePage() {
  return <LandingPage />;
}
