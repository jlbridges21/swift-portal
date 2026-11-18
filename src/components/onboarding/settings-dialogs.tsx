"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { StaffPermissionsSettings } from "@/components/admin/staff-permissions-settings";
import { WebAddressSubdomainCard } from "@/components/admin/settings-tabs/web-address-subdomain-card";
import type { CustomDomainPublicState } from "@/lib/custom-domain";

/**
 * Settings pages redirect to /onboarding until setup is finished, so the wizard opens these
 * pieces of Settings in place instead of linking to them.
 */

export function InviteTeammateDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="Your team" className="sm:max-w-2xl">
      <div className="p-5">{open ? <StaffPermissionsSettings startWithInvite /> : null}</div>
    </Modal>
  );
}

type DomainLoad =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; entitled: boolean; state: CustomDomainPublicState };

export function PortalDomainDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [load, setLoad] = useState<DomainLoad>({ status: "loading" });

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoad({ status: "loading" });
    fetch("/api/admin/custom-domain", { credentials: "include" })
      .then(async (res) => {
        const data = (await res.json().catch(() => ({}))) as {
          entitled?: boolean;
          state?: CustomDomainPublicState;
          error?: string;
        };
        if (cancelled) return;
        if (!res.ok || !data.state) {
          setLoad({ status: "error", message: data.error || "Couldn't load your web address." });
          return;
        }
        setLoad({ status: "ready", entitled: Boolean(data.entitled), state: data.state });
      })
      .catch(() => {
        if (!cancelled) setLoad({ status: "error", message: "Couldn't load your web address." });
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  return (
    <Modal open={open} onClose={onClose} title="Your own web address" className="sm:max-w-2xl">
      <div className="space-y-3 p-5">
        <p className="text-sm text-muted">
          Optional. Clients open your portal at an address you own, like portal.yourstudio.com. You can also do this later in
          Settings → Use your own web address.
        </p>
        {load.status === "loading" ? (
          <div className="flex items-center gap-2 py-6 text-sm text-muted">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading…
          </div>
        ) : load.status === "error" ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">{load.message}</p>
        ) : (
          <WebAddressSubdomainCard
            kind="portal"
            anchorId="onboarding-custom-domain"
            entitled={load.entitled}
            initialState={load.state}
            apiBase="/api/admin/custom-domain"
            forceOpen
          />
        )}
      </div>
    </Modal>
  );
}
