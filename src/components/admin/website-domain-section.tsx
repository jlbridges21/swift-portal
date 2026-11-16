"use client";

import { useCallback, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { ArrowLeft, Globe, LayoutTemplate, Loader2 } from "lucide-react";
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
  radioClass,
  SetupSteps,
  useDomainApi,
  useOpenOnHash,
  type DnsRow,
} from "@/components/admin/settings-tabs/web-address-parts";

const API = "/api/admin/website-domain";
const ANCHOR = "settings-website-domain";

/**
 * Settings → Use your own web address → Business Website (www.yourstudio.com).
 * Same Vercel registration, verification and status model as the client portal address; the
 * difference is the intent: this REPLACES whatever website the domain shows today.
 */
export function WebsiteDomainSection({
  entitled,
  initialState,
  setupRequired,
  websiteLive,
}: {
  entitled: boolean;
  initialState: CustomDomainPublicState;
  setupRequired: boolean;
  /** The new Business Website is the public homepage (not the classic landing page). */
  websiteLive: boolean;
}) {
  const { state, busy, post, refresh } = useDomainApi(API, initialState);
  const { pill, needsAttention, notSetUp } = domainPill(state, { entitled, setupRequired });
  const [open, setOpen] = useState(needsAttention);
  const openCard = useCallback(() => setOpen(true), []);
  useOpenOnHash(ANCHOR, openCard);

  const [mode, setMode] = useState<"www" | "apex">("www");
  const [root, setRoot] = useState("");
  const [redirect, setRedirect] = useState(true);
  const [understood, setUnderstood] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);

  const composed = useMemo(
    () =>
      mode === "apex"
        ? composePortalDomainInput({ mode: "apex", apexDomain: root })
        : composePortalDomainInput({ mode: "subdomain", subdomain: "www", rootDomain: root, allowWww: true }),
    [mode, root]
  );
  const preview = composed.ok ? composed.domain : null;
  const alternatePreview = composed.ok ? (mode === "apex" ? `www.${composed.domain}` : composed.rootDomain) : null;

  function toggle() {
    if (!open && state.domain) void refresh();
    setOpen(!open);
  }

  async function run(action: "claim" | "check" | "remove") {
    setFieldError(null);
    try {
      const next = await post({
        action,
        domain: action === "claim" && composed.ok ? composed.domain : undefined,
        redirectAlternate: redirect,
      });
      if (action === "claim") toast.success("Domain saved. Update the DNS record shown below.");
      if (action === "check") {
        if (next?.dnsTargetChanged) toast.error(next.dnsTargetChanged.message);
        else toast.message(next?.status === "connected" ? "Connected. Your website is live on your domain." : "Status updated");
      }
      if (action === "remove") {
        toast.success("Removed. Your website stays live at your ShootPortal address.");
        setRoot("");
        setUnderstood(false);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Request failed";
      if (action === "claim") setFieldError(msg);
      toast.error(msg);
    }
  }

  const routing = state.dnsRecords.filter((r) => r.purpose === "routing");
  const ownership = state.dnsRecords.filter((r) => r.purpose === "ownership");
  const alt = state.alternate;

  const backLink = (
    <a href="#settings-website" className="inline-flex min-h-9 items-center gap-1.5 text-[13px] font-medium text-accent hover:underline">
      <ArrowLeft className="h-4 w-4" /> Back to Business Website
    </a>
  );

  let body: ReactNode;
  if (setupRequired) {
    body = (
      <NoteLine>
        This needs a one-time database update (migration v119). Your website keeps working at your ShootPortal address in the meantime.
      </NoteLine>
    );
  } else if (!entitled) {
    body = (
      <NoteLine>
        Included on plans with custom domains (for example Studio). Until then your website is live at{" "}
        <span className="font-medium text-heading">{state.fallbackSubdomain}</span>.
      </NoteLine>
    );
  } else if (!state.domain) {
    body = (
      <div className="space-y-4">
        <p className="text-[13px] text-muted">Point your domain here to replace the website it shows today (Squarespace, WordPress, Wix…).</p>
        {!websiteLive ? (
          <NoteLine tone="amber">Your homepage still shows the classic landing page. Publish the new Business Website first.</NoteLine>
        ) : null}
        {!state.vercelApiConfigured ? (
          <NoteLine tone="amber">Automatic setup isn&apos;t available here. Contact support for the exact DNS record; don&apos;t guess a value.</NoteLine>
        ) : null}

        <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Main address">
          {(["www", "apex"] as const).map((m) => (
            <button key={m} type="button" role="radio" aria-checked={mode === m} onClick={() => setMode(m)} className={radioClass(mode === m)}>
              <span className="block font-medium">{m === "www" ? "www.yourstudio.com" : "yourstudio.com"}</span>
              <span className="text-xs">{m === "www" ? "Recommended" : "Without www"}</span>
            </button>
          ))}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="website-domain-root">Your domain</Label>
          <div className="flex items-center gap-2">
            {mode === "www" ? <span className="text-sm text-muted">www.</span> : null}
            <Input
              id="website-domain-root"
              value={root}
              onChange={(e) => {
                setRoot(e.target.value);
                setFieldError(null);
              }}
              placeholder="yourstudio.com"
              autoComplete="off"
              spellCheck={false}
              disabled={busy}
            />
          </div>
          {root && !composed.ok ? <p className="text-xs text-red-700 surface-dark:text-red-300">{composed.error}</p> : null}
          {preview ? (
            <p className="text-[13px] text-muted">
              Your website will be at <span className="break-all font-semibold text-heading">{preview}</span>
            </p>
          ) : null}
        </div>

        {alternatePreview ? (
          <label className="flex min-h-11 items-start gap-3 text-sm text-foreground">
            <input type="checkbox" className="mt-1 h-4 w-4" checked={redirect} onChange={(e) => setRedirect(e.target.checked)} />
            <span>
              Also send <span className="font-medium text-heading">{alternatePreview}</span> to {preview} <span className="text-muted">(recommended)</span>
            </span>
          </label>
        ) : null}

        <label className="flex min-h-11 items-start gap-3 text-sm text-foreground">
          <input type="checkbox" className="mt-1 h-4 w-4" checked={understood} onChange={(e) => setUnderstood(e.target.checked)} />
          <span>I understand that once DNS is updated, this address shows my ShootPortal Business Website instead of my current website.</span>
        </label>

        {fieldError ? (
          <div role="alert">
            <NoteLine tone="red">{fieldError}</NoteLine>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" disabled={busy || !composed.ok || !understood} onClick={() => void run("claim")} className="min-h-11 sm:min-h-10">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Globe className="h-4 w-4" />} Connect
          </Button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <HowItWorks>
            <p>Preview and finish your Business Website first. It is already live at {state.fallbackSubdomain}.</p>
            <p>Connecting your domain replaces the website visitors see at that address today.</p>
            <p>Only the website records change. Email (MX), Google Workspace / Microsoft 365, SPF, DKIM and other TXT records stay as they are.</p>
          </HowItWorks>
          {backLink}
        </div>
      </div>
    );
  } else {
    const connected = state.status === "connected";
    const rows: DnsRow[] = [
      ...routing.map((record) => ({ record })),
      ...ownership.map((record) => ({ record, tag: "Verification" })),
      ...(alt && alt.status !== "connected" ? alt.dnsRecords.map((record) => ({ record, tag: "Optional" })) : []),
    ];
    body = (
      <>
        <SetupSteps state={state} />
        <DomainAlerts state={state} routingCount={routing.length} busy={busy} onRetry={() => void run("check")} />
        {connected ? (
          <>
            <NoteLine tone="green">
              Live with HTTPS. {state.domain} now shows your Business Website. Client sign-in and payments keep using your client portal address.
            </NoteLine>
            {alt && alt.status !== "connected" && alt.dnsRecords.length ? (
              <>
                <NoteLine>Optional: update the {alt.domain.startsWith("www.") ? "www" : "@"} record too, so {alt.domain} also reaches your website.</NoteLine>
                <DnsRecordsTable rows={alt.dnsRecords.map((record) => ({ record, tag: "Optional" }))} />
              </>
            ) : null}
            <HowItWorks label="DNS records">
              <DnsRecordsTable rows={[...routing.map((record) => ({ record })), ...ownership.map((record) => ({ record, tag: "Verification" }))]} />
            </HowItWorks>
          </>
        ) : (
          <>
            <DnsRecordsTable rows={rows} />
            <NoteLine>Change only these records. Email (MX, TXT) stays as it is. Using Cloudflare? Set them to DNS only.</NoteLine>
          </>
        )}
        {alt ? (
          alt.status === "connected" ? (
            <NoteLine tone="green">
              {alt.domain} redirects to {alt.redirectsTo}.
            </NoteLine>
          ) : alt.error ? (
            <NoteLine tone="amber">{alt.error}</NoteLine>
          ) : null
        ) : null}
        <DomainActions
          busy={busy}
          onCheck={() => void run("check")}
          onRemove={() => {
            if (window.confirm(`Remove ${state.domain}? Your website stays live at ${state.fallbackSubdomain}; ${state.domain} stops showing it.`)) {
              void run("remove");
            }
          }}
        />
        <HowItWorks>
          <p>
            At your registrar, find the record for <span className="font-medium text-heading">{state.isApex ? "@ (the bare domain)" : "www"}</span>. If it
            points at your current website builder, edit it (or delete just that record) and use the value above. If there is none, add it.
          </p>
          <p>Leave every other record alone: MX (email), TXT (SPF, DKIM, DMARC, verification) and other subdomains are not affected.</p>
          <p>Save, wait a few minutes (sometimes a few hours), then press Check connection.</p>
        </HowItWorks>
        {backLink}
      </>
    );
  }

  return (
    <AddressCard
      id={ANCHOR}
      icon={LayoutTemplate}
      title="Business Website"
      purpose="The website ShootPortal builds for you"
      domain={state.domain}
      liveUrl={state.status === "connected" ? state.portalUrl : null}
      pill={pill}
      showSetUp={notSetUp}
      open={open}
      onToggle={toggle}
    >
      {body}
    </AddressCard>
  );
}
