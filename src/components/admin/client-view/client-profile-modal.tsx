"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ExternalLink, RotateCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ClientCrmProfile } from "@/components/admin/clients-table";
import type { ClientProfileView } from "@/lib/client-profile-view";

type OpenClientProfile = (clientId: string) => void;

const ClientProfileModalContext = createContext<OpenClientProfile | null>(null);

/**
 * "View client profile" inside Client View. Returns null outside the provider,
 * so callers can fall back to navigating to /admin/clients/[id].
 */
export function useOpenClientProfile(): OpenClientProfile | null {
  return useContext(ClientProfileModalContext);
}

/**
 * Hosts the full client profile in a modal over the Projects page. The board
 * underneath stays mounted, so the selected client, tab, filters and scroll
 * position are all exactly where they were when the modal closes.
 */
export function ClientProfileModalProvider({ children }: { children: React.ReactNode }) {
  const [clientId, setClientId] = useState<string | null>(null);
  const open = useCallback<OpenClientProfile>((id) => setClientId(id), []);
  const close = useCallback(() => setClientId(null), []);

  return (
    <ClientProfileModalContext.Provider value={open}>
      {children}
      {clientId ? <ClientProfileModal key={clientId} clientId={clientId} onClose={close} /> : null}
    </ClientProfileModalContext.Provider>
  );
}

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; view: ClientProfileView };

function ClientProfileModal({ clientId, onClose }: { clientId: string; onClose: () => void }) {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/admin/clients/${encodeURIComponent(clientId)}/profile`, {
      credentials: "include",
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) {
          const message =
            res.status === 404
              ? "This client isn't available."
              : res.status === 403
                ? "You don't have access to client profiles."
                : "Couldn't load this client.";
          setState({ status: "error", message });
          return;
        }
        setState({ status: "ready", view: (await res.json()) as ClientProfileView });
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        console.error("[client-profile-modal]", err);
        setState({ status: "error", message: "Couldn't load this client." });
      });
    return () => controller.abort();
  }, [clientId, attempt]);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      // Edit / note / confirm dialogs open on top of this one handle their own Escape.
      if (panelRef.current?.querySelector('[role="dialog"]')) return;
      onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus?.();
    };
  }, [onClose]);

  const name =
    state.status === "ready" ? state.view.data.client.full_name || state.view.data.client.name : null;

  return (
    <div className="fixed inset-0 z-[100] flex items-stretch justify-center sm:items-center sm:p-4 lg:p-8 safe-area-x">
      <button type="button" className="absolute inset-0 bg-black/45" onClick={onClose} aria-label="Close client profile" tabIndex={-1} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="client-profile-modal-title"
        className="relative z-10 flex h-dvh w-full flex-col bg-background shadow-2xl sm:h-[min(92dvh,64rem)] sm:max-w-5xl sm:overflow-hidden sm:rounded-2xl sm:border sm:border-border"
      >
        <div className="flex shrink-0 items-center gap-2 border-b border-border bg-card px-4 py-2.5 safe-area-top sm:px-6">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Client profile</p>
            <h2 id="client-profile-modal-title" className="truncate text-sm font-semibold text-heading">
              {name ?? "Loading…"}
            </h2>
          </div>
          <Link
            href={`/admin/clients/${clientId}`}
            className="hidden h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-muted transition-colors hover:bg-accent-subtle hover:text-heading sm:inline-flex"
          >
            <ExternalLink className="h-4 w-4" />
            Open full page
          </Link>
          <Button
            ref={closeRef}
            variant="ghost"
            size="icon"
            className="min-h-11 min-w-11 shrink-0"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="modal-scroll-body modal-scroll-body-pad flex-1 px-4 pt-5 sm:px-6 sm:pt-6 lg:px-8">
          {state.status === "ready" ? (
            <ClientCrmProfile
              data={state.view.data}
              canViewMoney={state.view.canViewMoney}
              w9={state.view.w9}
              projectCovers={state.view.projectCovers}
              embedded={{ onHidden: onClose }}
            />
          ) : state.status === "error" ? (
            <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
              <p className="text-sm font-medium text-heading">{state.message}</p>
              <div className="flex flex-wrap justify-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setState({ status: "loading" });
                    setAttempt((n) => n + 1);
                  }}
                >
                  <RotateCw className="h-4 w-4" />
                  Try again
                </Button>
                <Link href={`/admin/clients/${clientId}`}>
                  <Button variant="ghost" size="sm">
                    <ExternalLink className="h-4 w-4" />
                    Open full page
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <ClientProfileSkeleton />
          )}
        </div>
      </div>
    </div>
  );
}

function ClientProfileSkeleton() {
  const block = "animate-pulse rounded-xl bg-slate-200/70 surface-dark:bg-border/70";
  return (
    <div className="space-y-8" aria-busy="true" aria-label="Loading client profile">
      <div className="flex gap-4">
        <div className="h-14 w-14 shrink-0 animate-pulse rounded-full bg-slate-200/70 surface-dark:bg-border/70" />
        <div className="flex-1 space-y-2">
          <div className={`${block} h-7 w-48`} />
          <div className={`${block} h-4 w-64`} />
          <div className={`${block} h-4 w-40`} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className={`${block} h-20`} />
        ))}
      </div>
      <div className={`${block} h-32`} />
      <div className={`${block} h-48`} />
    </div>
  );
}
