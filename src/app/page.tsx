import type { Metadata } from "next";
import { LandingPage } from "@/components/landing/landing-page";
import { LANDING } from "@/lib/landing-assets";

export const metadata: Metadata = {
  title: "Swift Portal | Swift Aerial Media",
  description:
    "Request aerial shoots, review quotes, track projects, approve deliverables, and pay securely — all in one premium client portal.",
  icons: {
    icon: LANDING.favicon,
    apple: LANDING.favicon,
  },
};

export default function HomePage() {
  return <LandingPage />;
}
