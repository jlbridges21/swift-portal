"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

type HomeTarget = { href: string; label: string };

/**
 * Role-aware home link for error / empty states.
 * Must never throw — falls back to "/" if role cannot be resolved.
 */
export function SafeHomeLink({
  variant = "accent",
  className,
}: {
  variant?: "accent" | "outline";
  className?: string;
}) {
  const [target, setTarget] = useState<HomeTarget>({ href: "/", label: "Go home" });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const supabase = createClient();
        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError || !authData.user) {
          if (!cancelled) setTarget({ href: "/login", label: "Sign in" });
          return;
        }
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", authData.user.id)
          .maybeSingle();
        if (cancelled) return;
        if (profileError || !profile?.role) {
          setTarget({ href: "/", label: "Go home" });
          return;
        }
        if (profile.role === "super_admin") {
          setTarget({ href: "/platform", label: "Back to platform" });
        } else if (profile.role === "admin") {
          setTarget({ href: "/admin", label: "Back to admin" });
        } else {
          setTarget({ href: "/dashboard", label: "Back to dashboard" });
        }
      } catch {
        if (!cancelled) setTarget({ href: "/", label: "Go home" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Link href={target.href} className={className}>
      <Button variant={variant}>{target.label}</Button>
    </Link>
  );
}
