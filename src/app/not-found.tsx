import Link from "next/link";
import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { MapPin, ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "Page Not Found | Swift Portal",
};

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center">
      <p className="text-sm font-medium uppercase tracking-widest text-accent">Swift Aerial Media</p>
      <h1 className="mt-4 text-6xl font-bold tracking-tight text-primary">404</h1>
      <p className="mt-3 max-w-sm text-lg text-muted">
        This page doesn&apos;t exist, or you may not have permission to view it.
      </p>
      <div className="mt-10 flex flex-wrap justify-center gap-3">
        <Link href="/dashboard">
          <Button variant="accent">
            <MapPin className="h-4 w-4" /> Go to Dashboard
          </Button>
        </Link>
        <Link href="/">
          <Button variant="outline">
            <ArrowLeft className="h-4 w-4" /> Back to Home
          </Button>
        </Link>
      </div>
    </div>
  );
}
