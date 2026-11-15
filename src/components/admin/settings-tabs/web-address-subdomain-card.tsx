"use client";

import { useCallback, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Globe, House, Loader2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { composePortalDomainInput } from "@/lib/custom-domain-input";
import type { CustomDomainPublicState } from "@/lib/custom-domain";
import {
  AddressCard,
  DnsRecordsTable,
  DomainActions,
  DomainAlerts,
  domainPill,
  HowItWorks,
  NoteLine,
  SetupSteps,
  useDomainApi,
  useOpenOnHash,
} from "@/components/admin/settings-tabs/web-address-parts";
import { cn } from "@/lib/utils";

/**
 * Client Portal (portal.yourstudio.com) or Property Websites (listings.yourstudio.com) address card.
 * Same API, validation and claim/check/remove flow as CustomDomainSettingsCard (which the platform
 * admin still uses); this is the compact Settings layout.
 */
export function WebAddressSubdomainCard({
  kind,
  anchorId,
  entitled,
  initialState,
  apiBase,
  setupRequired = false,
  suggestedRootDomain = null,
  forceOpen = false,
  header,
}: {
  kind: "portal" | "listing";
  anchorId: string;
  entitled: boolean;
  initialState: CustomDomainPublicState;
  apiBase: string;
  setupRequired?: boolean;
  /** Prefill for the root domain (e.g. from the connected portal domain). Never auto-claimed. */
  suggestedRootDomain?: string | null;
  /** Open on first render (e.g. arrived from the listing editor with ?return=). */
  forceOpen?: boolean;
  /** Extra content at the top of the open card (e.g. a Back link). */
  header?: ReactNode;
}) {
  const isListing = kind === "listing";
  const defaultSub = isListing ? "listings" : "portal";
  const { state, busy, post, refresh } = useDomainApi(apiBase, initialState);
  const { pill, needsAttention, notSetUp } = domainPill(state, { entitled, setupRequired });
  const [open, setOpen] = useState(needsAttention || forceOpen);
  const openCard = useCallback(() => setOpen(true), []);
  useOpenOnHash(anchorId, openCard);

  const [mode, setMode] = useState<"subdomain" | "apex">("subdomain");
  const [sub, setSub] = useState(defaultSub);
  const [root, setRoot] = useState(suggestedRootDomain ?? "");
  const [apex, setApex] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [fieldNotice, setFieldNotice] = useState<string | null>(null);

  const composed = useMemo(
    () =>
      mode === "apex"
        ? composePortalDomainInput({ mode: "apex", apexDomain: apex })
        : composePortalDomainInput({ mode: "subdomain", subdomain: sub, rootDomain: root }),
    [mode, sub, root, apex]
  );
  const preview = composed.ok ? composed.domain : null;

  function toggle() {
    // Re-read the latest status when a card with a domain is opened.
    if (!open && state.domain) void refresh();
    setOpen(!open);
  }

  async function run(action: "claim" | "check" | "remove", domain?: string) {
    setFieldError(null);
    try {
      const next = await post({ action, domain });
      if (action === "claim") toast.success("Domain saved. Add the DNS record shown below.");
      if (action === "check") {
        if (next?.dnsTargetChanged) toast.error(next.dnsTargetChanged.message);
        else toast.message(next?.status === "connected" ? "Connected" : "Status updated");
      }
      if (action === "remove") {
        toast.success(
          isListing
            ? "Removed. Property websites use your ShootPortal address again (their links keep working there)."
            : "Removed. Clients use your ShootPortal address again."
        );
        setMode("subdomain");
        setSub(defaultSub);
        setRoot("");
        setApex("");
        setFieldNotice(null);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Request failed";
      if (action === "claim") setFieldError(msg);
      toast.error(msg);
    }
  }

  function onConnect() {
    setFieldError(null);
    setFieldNotice(null);
    if (!composed.ok) {
      if (composed.redirectToApex) setMode("apex");
      setFieldError(composed.error);
      return;
    }
    if (composed.split) {
      setSub(composed.split.subdomain);
      setRoot(composed.split.rootDomain);
      setMode("subdomain");
    }
    if (composed.notice) setFieldNotice(composed.notice);
    void run("claim", composed.domain);
  }

  const routing = state.dnsRecords.filter((r) => r.purpose === "routing");
  const ownership = state.dnsRecords.filter((r) => r.purpose === "ownership");
  const fallback = isListing ? `${state.fallbackSubdomain}/l/…` : state.fallbackSubdomain;

  let body: ReactNode;
  if (setupRequired) {
    body = (
      <NoteLine>
        This needs a one-time database update (migration v118). Property websites still work at your ShootPortal address.
      </NoteLine>
    );
  } else if (!entitled) {
    body = (
      <NoteLine>
        Included on plans with custom domains (for example Studio). Until then {isListing ? "property websites stay" : "your portal stays"} at{" "}
        <span className="font-medium text-heading">{fallback}</span>.
      </NoteLine>
    );
  } else if (!state.domain) {
    body = (
      <div className="space-y-4">
        <p className="text-[13px] text-muted">
          {isListing
            ? "Add a new address on a domain you own. Every listing you publish uses it automatically."
            : "Add a new address on a domain you own. Your main website stays as it is."}
        </p>
        {mode === "subdomain" ? (
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
            <div className="space-y-1.5">
              <Label htmlFor={`${anchorId}-sub`}>Subdomain</Label>
              <Input
                id={`${anchorId}-sub`}
                value={sub}
                onChange={(e) => {
                  setSub(e.target.value);
                  setFieldError(null);
                }}
                placeholder={defaultSub}
                disabled={busy}
                autoComplete="off"
                spellCheck={false}
              />
              {isListing ? (
                <div className="flex flex-wrap gap-1.5">
                  {["listings", "homes", "properties", "tours"].map((label) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => setSub(label)}
                      className={cn(
                        "min-h-8 rounded-full border px-2.5 text-xs",
                        sub === label ? "border-accent bg-accent-subtle text-heading" : "border-border text-muted hover:text-heading"
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted">Usually “portal”. Don&apos;t use “www”.</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`${anchorId}-root`}>Your domain</Label>
              <Input
                id={`${anchorId}-root`}
                value={root}
                onChange={(e) => {
                  setRoot(e.target.value);
                  setFieldError(null);
                }}
                placeholder="yourstudio.com"
                disabled={busy}
                autoComplete="off"
                spellCheck={false}
              />
              <p className="text-xs text-muted">The domain you renew, not your full website link.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <NoteLine tone="amber">
              Visitors to this exact domain will open your portal, not a separate website. A subdomain like portal.example.com is usually better.
            </NoteLine>
            <Label htmlFor={`${anchorId}-apex`}>Root domain</Label>
            <Input
              id={`${anchorId}-apex`}
              value={apex}
              onChange={(e) => {
                setApex(e.target.value);
                setFieldError(null);
              }}
              placeholder="yourstudio.com"
              disabled={busy}
              autoComplete="off"
              spellCheck={false}
            />
          </div>
        )}

        <p className="text-[13px] text-muted">
          {isListing ? "Listings will look like " : "Your portal will be at "}
          <span className="break-all font-semibold text-heading">
            {isListing ? `${preview ?? "listings.yourstudio.com"}/123-main-st` : preview ?? "portal.yourstudio.com"}
          </span>
        </p>

        {fieldNotice ? <NoteLine tone="green">{fieldNotice}</NoteLine> : null}
        {fieldError ? (
          <div role="alert">
            <NoteLine tone="red">{fieldError}</NoteLine>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            disabled={busy || (mode === "subdomain" ? !sub.trim() && !root.trim() : !apex.trim())}
            onClick={onConnect}
            className="min-h-11 sm:min-h-10"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Globe className="h-4 w-4" />} Connect
          </Button>
          {isListing ? null : (
            <button
              type="button"
              className="min-h-9 text-xs font-medium text-accent hover:underline"
              onClick={() => {
                setMode((m) => (m === "apex" ? "subdomain" : "apex"));
                setFieldError(null);
                setFieldNotice(null);
              }}
            >
              {mode === "apex" ? "Use a subdomain instead (recommended)" : "Using a root domain (example.com)?"}
            </button>
          )}
        </div>

        <HowItWorks>
          <p>
            A subdomain is the short name in front of your domain, like the <code className="text-xs">{defaultSub}</code> in{" "}
            <code className="text-xs">{defaultSub}.yourstudio.com</code>.
          </p>
          <p>You add one new DNS record where you renew your domain. Your website&apos;s existing records stay unchanged.</p>
          <p>
            Your ShootPortal address <span className="font-medium text-heading">{fallback}</span> keeps working the whole time.
          </p>
        </HowItWorks>
      </div>
    );
  } else {
    const connected = state.status === "connected";
    const rows = [...routing.map((record) => ({ record })), ...ownership.map((record) => ({ record, tag: "Verification" }))];
    body = (
      <>
        <SetupSteps state={state} />
        <DomainAlerts state={state} routingCount={routing.length} busy={busy} onRetry={() => void run("check")} />
        {connected ? (
          <>
            <NoteLine tone="green">
              {isListing
                ? `Live with HTTPS. Every published property website is at ${state.domain}/your-listing.`
                : `Live with HTTPS. Portal links in emails and payments now use ${state.domain}.`}
            </NoteLine>
            <HowItWorks label="DNS records">
              <DnsRecordsTable rows={rows} />
            </HowItWorks>
          </>
        ) : (
          <>
            <DnsRecordsTable rows={rows} />
            <NoteLine>
              Add only {rows.length > 1 ? "these records" : "this record"}. Email (MX, TXT) stays as it is. Using
              Cloudflare? Set {rows.length > 1 ? "them" : "it"} to DNS only.
            </NoteLine>
          </>
        )}
        <DomainActions
          busy={busy}
          onCheck={() => void run("check")}
          onRemove={() => {
            if (
              window.confirm(
                isListing
                  ? `Remove ${state.domain}? Property websites keep working at your ShootPortal address; links using ${state.domain} stop working.`
                  : `Remove ${state.domain}? Clients will use ${state.fallbackSubdomain} again.`
              )
            ) {
              void run("remove");
            }
          }}
        />
      </>
    );
  }

  return (
    <AddressCard
      id={anchorId}
      icon={isListing ? House : Users}
      title={isListing ? "Property Websites" : "Client Portal"}
      purpose={isListing ? "Every listing gets its own page" : "Where clients sign in, pay and download"}
      domain={state.domain}
      liveUrl={state.status === "connected" ? state.portalUrl : null}
      pill={pill}
      showSetUp={notSetUp}
      open={open}
      onToggle={toggle}
    >
      {header}
      {body}
    </AddressCard>
  );
}
