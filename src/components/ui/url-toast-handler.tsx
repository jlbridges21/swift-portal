"use client";

import { useEffect } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { toast } from "sonner";
import { usePortalBrand } from "@/components/brand/brand-provider";

// Survives the effect re-run that router.replace causes, and the strict-mode
// double invoke, without blocking a later visit to the same return URL.
const shownUrlToasts = new Set<string>();

export function UrlToastHandler() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const brand = usePortalBrand();

  useEffect(() => {
    const welcome = searchParams.get("welcome");
    const payment = searchParams.get("payment");
    if (welcome !== "1" && !payment) return;

    const next = new URLSearchParams(searchParams.toString());
    next.delete("welcome");
    next.delete("payment");
    const qs = next.toString();
    const hash = payment === "success" || payment === "already_completed" || payment === "cancelled" ? "#payments" : "";
    const nextUrl = `${pathname}${qs ? `?${qs}` : ""}${hash}`;

    // Child effects run before the root <Toaster> subscribes. On a full load
    // (Stripe return) a synchronous toast() is published to nobody.
    const toastKey = `${pathname}|${welcome ?? ""}|${payment ?? ""}`;
    if (!shownUrlToasts.has(toastKey)) {
      shownUrlToasts.add(toastKey);
      window.setTimeout(() => {
        shownUrlToasts.delete(toastKey);
        if (welcome === "1") {
          toast.success(`Welcome to ${brand.portalName}! Your project has been created.`);
        }
        if (payment === "success") toast.success("Payment received — thank you!");
        if (payment === "already_completed") toast.info("This payment has already been completed.");
        if (payment === "cancelled") toast.message("Payment cancelled — you can try again when ready.");
      }, 0);
    }

    if (payment === "success") {
      const projectMatch = pathname.match(/\/dashboard\/projects\/([^/]+)/);
      const projectId = projectMatch?.[1];
      if (projectId) {
        void fetch(`/api/projects/${projectId}/payments/reconcile`, { method: "POST" })
          .then(() => router.refresh())
          .catch(() => router.refresh());
      }
    }

    router.replace(nextUrl);
  }, [searchParams, router, pathname, brand.portalName]);

  return null;
}
