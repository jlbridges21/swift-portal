"use client";

import { useLayoutEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { AuthLinkHelpCard } from "@/components/auth/auth-link-help-card";
import {
  clearAuthFragmentFromUrl,
  parseAuthFragment,
  type AuthLinkErrorKind,
} from "@/lib/auth-fragment";

type UiState =
  | { mode: "hidden" }
  | { mode: "processing"; message: string }
  | { mode: "error"; errorKind: AuthLinkErrorKind; description: string | null };

/**
 * Mount on public landings (platform apex + tenant/custom-domain roots).
 * No fragment → renders nothing (no flash, no redirect, no console noise).
 */
export function AuthFragmentHandler() {
  const [ui, setUi] = useState<UiState>({ mode: "hidden" });

  useLayoutEffect(() => {
    const parsed = parseAuthFragment(window.location.hash, window.location.search);
    if (parsed.kind === "none") return;

    if (parsed.kind === "error") {
      clearAuthFragmentFromUrl();
      setUi({
        mode: "error",
        errorKind: parsed.errorKind,
        description: parsed.description,
      });
      return;
    }

    if (parsed.kind === "code") {
      // PKCE code on Site URL / landing — hand off to server callback.
      const next = new URL("/auth/callback", window.location.origin);
      next.searchParams.set("code", parsed.code);
      const existingNext = new URLSearchParams(window.location.search).get("next");
      if (existingNext) next.searchParams.set("next", existingNext);
      const spFlow = new URLSearchParams(window.location.search).get("sp_flow");
      if (spFlow) next.searchParams.set("sp_flow", spFlow);
      // Default dashboard recoveries to password setup when type unknown.
      if (!existingNext && !spFlow) {
        next.searchParams.set("next", "/auth/update-password");
        next.searchParams.set("sp_flow", "recovery");
      }
      window.location.replace(next.toString());
      return;
    }

    // Implicit-flow tokens in the hash (Dashboard emails use Site URL).
    setUi({ mode: "processing", message: "Signing you in…" });
    clearAuthFragmentFromUrl();

    void (async () => {
      try {
        const supabase = createClient();
        const { error } = await supabase.auth.setSession({
          access_token: parsed.accessToken,
          refresh_token: parsed.refreshToken,
        });
        if (error) {
          setUi({
            mode: "error",
            errorKind: "generic",
            description: error.message,
          });
          return;
        }

        const isRecovery = parsed.type === "recovery" || parsed.type === "invite";
        if (isRecovery) {
          await fetch("/api/auth/password-setup-begin", {
            method: "POST",
            credentials: "include",
          });
          const reason = parsed.type === "invite" ? "invite" : "recovery";
          window.location.replace(`/auth/update-password?reason=${reason}`);
          return;
        }

        const destRes = await fetch("/api/auth/post-login", {
          method: "POST",
          credentials: "include",
        });
        const destBody = (await destRes.json().catch(() => ({}))) as {
          redirect?: string;
          error?: string;
        };
        if (!destRes.ok) {
          setUi({
            mode: "error",
            errorKind: "generic",
            description: destBody.error || "Could not finish signing in.",
          });
          return;
        }
        const dest = destBody.redirect || "/login";
        if (dest.startsWith("http://") || dest.startsWith("https://")) {
          window.location.replace(dest);
        } else {
          window.location.replace(dest);
        }
      } catch {
        setUi({
          mode: "error",
          errorKind: "generic",
          description: null,
        });
      }
    })();
  }, []);

  if (ui.mode === "hidden") return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/95 px-4 backdrop-blur-sm">
      {ui.mode === "processing" ? (
        <p className="text-sm text-muted">{ui.message}</p>
      ) : (
        <AuthLinkHelpCard
          errorKind={ui.errorKind}
          description={ui.description}
          onDismiss={() => setUi({ mode: "hidden" })}
          dismissLabel="Continue to homepage"
        />
      )}
    </div>
  );
}
