"use client";

import { useEffect } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { toast } from "sonner";

export function UrlToastHandler() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const welcome = searchParams.get("welcome");
    const payment = searchParams.get("payment");

    if (welcome === "1") {
      toast.success("Welcome to Swift Portal! Your project has been created.");
      router.replace(pathname);
    }

    if (payment === "success") {
      toast.success("Payment received — thank you!");
      router.replace("/dashboard");
    }
  }, [searchParams, router, pathname]);

  return null;
}
