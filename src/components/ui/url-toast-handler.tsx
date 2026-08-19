"use client";

import { useEffect } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { toast } from "sonner";
import { usePortalBrand } from "@/components/brand/brand-provider";

export function UrlToastHandler() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const brand = usePortalBrand();

  useEffect(() => {
    const welcome = searchParams.get("welcome");
    const payment = searchParams.get("payment");

    if (welcome === "1") {
      toast.success(`Welcome to ${brand.portalName}! Your project has been created.`);
      router.replace(pathname);
    }

    if (payment === "success") {
      toast.success("Payment received — thank you!");
      router.replace(`${pathname}#payments`);
    }

    if (payment === "already_completed") {
      toast.info("This payment has already been completed.");
      router.replace(`${pathname}#payments`);
    }

    if (payment === "cancelled") {
      toast.message("Payment cancelled — you can try again when ready.");
      router.replace(`${pathname}#payments`);
    }
  }, [searchParams, router, pathname, brand.portalName]);

  return null;
}
