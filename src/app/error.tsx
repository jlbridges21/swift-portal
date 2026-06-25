"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-50 mb-6">
        <AlertTriangle className="h-7 w-7 text-red-500" />
      </div>
      <h1 className="text-2xl font-bold text-primary">Something went wrong</h1>
      <p className="mt-2 max-w-md text-muted">
        {error.message === "Not found"
          ? "We couldn't find what you're looking for. It may have been removed or you may not have access."
          : "An unexpected error occurred. Please try again."}
      </p>
      <div className="mt-8 flex gap-3">
        <Button variant="accent" onClick={reset}>Try again</Button>
        <Link href="/dashboard">
          <Button variant="outline">Back to dashboard</Button>
        </Link>
      </div>
    </div>
  );
}
