"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Check, ExternalLink, Globe, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DnsTable, readApiJson, REGISTRAR_GUIDES } from "@/components/admin/custom-domain-settings-card";
import { composePortalDomainInput } from "@/lib/custom-domain-input";
import type { CustomDomainPublicState } from "@/lib/custom-domain";

const API = "/api/admin/website-domain";

function statusOf(state: CustomDomainPublicState): { title: string; detail: string; tone: string } {
  if (!state.domain) {
    return { title: "Not connected", detail: `Your website is live at ${state.fallbackSubdomain}.`, tone: "text-muted" };
  }
  switch (state.status) {
    case "connected":
      return { title: "Connected", detail: `Your Business Website is live at ${state.domain}. HTTPS is active.`, tone: "text-emerald-700" };
    case "manual":
      return { title: "Waiting on support", detail: state.error || "DNS instructions are ready. Contact support to finish registration.", tone: "text-amber-800" };
    case "verifying":
      return {
        title: "Almost there",
        detail: state.error || "DNS is updating and HTTPS is being issued. This can take minutes to a few hours.",
        tone: "text-amber-800",
      };
    case "error":
      return { title: "Needs attention", detail: state.error || "Compare your DNS records with the ones below.", tone: "text-red-700" };
    default:
      return {
        title: "Waiting for DNS",
        detail: state.error || "Update the record below at your domain provider, then click Check connection.",
        tone: "text-amber-800",
      };
  }
}

/**
 * Settings → Use Your Own Web Address → Business Website Address (www.yourstudio.com).
 * Same Vercel registration, verification and status model as the client portal address; the
 * difference is the intent — this REPLACES whatever website the domain shows today.
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
  const [state, setState] = useState(initialState);
  const [mode, setMode] = useState<"www" | "apex">("www");
  const [root, setRoot] = useState("");
  const [redirect, setRedirect] = useState(true);
  const [understood, setUnderstood] = useState(false);
  const [busy, setBusy] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);

  useEffect(() => setState(initialState), [initialState]);

  const composed = useMemo(
    () =>
      mode === "apex"
        ? composePortalDomainInput({ mode: "apex", apexDomain: root })
        : composePortalDomainInput({ mode: "subdomain", subdomain: "www", rootDomain: root, allowWww: true }),
    [mode, root]
  );
  const preview = composed.ok ? composed.domain : null;
  const alternatePreview = composed.ok ? (mode === "apex" ? `www.${composed.domain}` : composed.rootDomain) : null;

  async function run(action: "claim" | "check" | "remove") {
    setBusy(true);
    setFieldError(null);
    try {
      const res = await fetch(API, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, domain: action === "claim" && composed.ok ? composed.domain : undefined, redirectAlternate: redirect }),
      });
      const data = await readApiJson(res);
      if (!res.ok) throw new Error(typeof data.error === "string" && data.error ? data.error : `Request failed (HTTP ${res.status})`);
      const next = data.state as CustomDomainPublicState | undefined;
      if (next) setState(next);
      if (action === "claim") toast.success("Domain saved — update the DNS record shown below");
      if (action === "check") toast.message(next?.status === "connected" ? "Connected — your website is live on your domain" : "Status updated");
      if (action === "remove") {
        toast.success("Removed — your website stays live at your ShootPortal address");
        setRoot("");
        setUnderstood(false);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Request failed";
      if (action === "claim") setFieldError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  const status = statusOf(state);
  const routing = state.dnsRecords.filter((r) => r.purpose === "routing");
  const ownership = state.dnsRecords.filter((r) => r.purpose === "ownership");
  const alt = state.alternate;

  return (
    <div id="settings-website-domain" tabIndex={-1} className="scroll-mt-24 space-y-4 rounded-xl outline-none">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-heading">Business Website Address</h3>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Use your own domain for the professional business website created by ShootPortal — for example{" "}
            <span className="font-medium text-heading">www.yourstudio.com</span>. This can replace a Squarespace, WordPress or Wix site.
          </p>
        </div>
        <a href="#settings-website" className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline">
          <ArrowLeft className="h-4 w-4" /> Back to Business Website
        </a>
      </div>

      {setupRequired ? (
        <Card className="shadow-sm">
          <CardContent className="pt-6 text-sm text-muted">
            This needs a one-time database update (migration v119). Your website keeps working at your ShootPortal address in the meantime.
          </CardContent>
        </Card>
      ) : !entitled ? (
        <Card className="shadow-sm">
          <CardContent className="space-y-2 pt-6 text-sm text-muted">
            <p>
              Connecting your own domain is included on plans with the custom domain feature (for example Studio). Until then your website is
              live at <span className="font-medium text-heading">{state.fallbackSubdomain}</span>.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="shadow-sm">
          <CardContent className="space-y-5 pt-6">
            <div>
              <p className={`text-sm font-medium ${status.tone}`}>{status.title}</p>
              <p className="mt-1 text-sm text-muted">{status.detail}</p>
              <p className="mt-2 text-xs text-muted">
                <span className="font-medium text-heading">{state.fallbackSubdomain}</span> always keeps working, even while a domain is pending, changed or removed.
              </p>
            </div>

            {state.status === "connected" && state.portalUrl ? (
              <a href={state.portalUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm font-medium text-accent underline underline-offset-2">
                Open {state.domain} <ExternalLink className="h-3.5 w-3.5" />
              </a>
            ) : null}

            {!state.vercelApiConfigured ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                Automatic registration with our host is not configured in this environment. Contact support for the exact DNS record — do not guess a value.
              </div>
            ) : null}

            {!state.domain ? (
              <div className="space-y-4">
                <div className="rounded-lg border border-border bg-subtle/60 p-4 text-sm text-muted space-y-2">
                  <p className="font-medium text-heading">Before you switch</p>
                  <ul className="list-disc space-y-1 pl-5">
                    <li>Preview and finish your Business Website first — it is already live at {state.fallbackSubdomain}.</li>
                    <li>Connecting your domain replaces the website visitors currently see at that address.</li>
                    <li>Only the website records change. Email (MX), Google Workspace / Microsoft 365, SPF, DKIM and other TXT records stay exactly as they are.</li>
                  </ul>
                  {!websiteLive ? (
                    <p className="text-amber-800">
                      Your public homepage still shows the classic landing page. Publish the new Business Website before pointing your domain here.
                    </p>
                  ) : null}
                </div>

                <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Main address">
                  {(["www", "apex"] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      role="radio"
                      aria-checked={mode === m}
                      onClick={() => setMode(m)}
                      className={`rounded-lg border px-3 py-2 text-left text-sm ${mode === m ? "border-accent bg-accent/5 text-heading" : "border-border text-muted"}`}
                    >
                      <span className="block font-medium">{m === "www" ? "www.yourstudio.com" : "yourstudio.com"}</span>
                      <span className="text-xs">{m === "www" ? "Recommended" : "Without www"}</span>
                    </button>
                  ))}
                </div>

                <div className="space-y-2">
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
                  {root && !composed.ok ? <p className="text-xs text-red-700">{composed.error}</p> : null}
                </div>

                {preview ? (
                  <div className="rounded-lg border border-accent/30 bg-accent/5 px-4 py-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted">Your website will be at</p>
                    <p className="mt-1 break-all text-base font-semibold text-heading">{preview}</p>
                  </div>
                ) : null}

                {alternatePreview ? (
                  <label className="flex items-start gap-3 text-sm">
                    <input type="checkbox" className="mt-1 h-4 w-4" checked={redirect} onChange={(e) => setRedirect(e.target.checked)} />
                    <span>
                      Also send <span className="font-medium text-heading">{alternatePreview}</span> to {preview}
                      <span className="block text-xs text-muted">Recommended — visitors who type either version reach your website.</span>
                    </span>
                  </label>
                ) : null}

                <label className="flex items-start gap-3 text-sm">
                  <input type="checkbox" className="mt-1 h-4 w-4" checked={understood} onChange={(e) => setUnderstood(e.target.checked)} />
                  <span>I understand that once DNS is updated, this address shows my ShootPortal Business Website instead of my current website.</span>
                </label>

                {fieldError ? (
                  <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {fieldError}
                  </p>
                ) : null}

                <Button type="button" disabled={busy || !composed.ok || !understood} onClick={() => void run("claim")}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Globe className="h-4 w-4" />} Connect domain
                </Button>
              </div>
            ) : (
              <div className="space-y-5">
                <p className="text-sm text-heading">
                  Domain: <span className="font-semibold">{state.domain}</span>
                </p>

                {state.dnsTargetChanged ? (
                  <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-3 text-sm text-amber-950">
                    <p className="font-medium">Required DNS value changed</p>
                    <p className="mt-1">{state.dnsTargetChanged.message}</p>
                  </div>
                ) : null}

                {state.dnsConfigMessage && routing.length === 0 ? (
                  <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-950">
                    <p>{state.dnsConfigMessage}</p>
                    <Button type="button" size="sm" disabled={busy} onClick={() => void run("check")}>
                      Retry DNS lookup
                    </Button>
                  </div>
                ) : null}

                {state.status !== "connected" ? (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-heading">Update your website record</p>
                    <ol className="list-decimal space-y-1 pl-5 text-sm text-muted">
                      <li>Sign in where you manage your domain&apos;s DNS (GoDaddy, Namecheap, Cloudflare, Squarespace Domains…).</li>
                      <li>
                        Find the record for <strong className="font-medium text-heading">{state.isApex ? "@ (the bare domain)" : "www"}</strong>. If one already points
                        at your current website builder, <strong className="font-medium text-heading">edit it</strong> (or delete just that record) and use the value
                        below. If there is none, add it.
                      </li>
                      <li>
                        Leave every other record alone — MX (email), TXT (SPF, DKIM, DMARC, Google / Microsoft verification) and other subdomains are not affected.
                      </li>
                      <li>Save, wait a few minutes (sometimes up to a few hours), then click Check connection.</li>
                    </ol>
                    <DnsTable records={routing} />
                    {ownership.length ? (
                      <>
                        <p className="pt-2 text-sm font-medium text-heading">Ownership verification (add this TXT record too)</p>
                        <DnsTable records={ownership} />
                      </>
                    ) : null}
                  </div>
                ) : (
                  <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-950">
                    <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
                    <div>
                      <p className="font-medium">Connected and secure</p>
                      <p className="mt-1">
                        {state.domain} now shows your Business Website. Client sign-in, payments and project links keep using your client portal address.
                      </p>
                    </div>
                  </div>
                )}

                {alt ? (
                  <div className="space-y-2 rounded-lg border border-border p-3">
                    <p className="flex items-center gap-2 text-sm font-medium text-heading">
                      {alt.status === "connected" ? <Check className="h-4 w-4 text-emerald-600" /> : null}
                      {alt.domain} → {alt.redirectsTo}
                    </p>
                    {alt.status === "connected" ? (
                      <p className="text-xs text-muted">Redirect active.</p>
                    ) : (
                      <>
                        <p className="text-xs text-muted">
                          Optional, recommended: update the record for {alt.domain.startsWith("www.") ? "www" : "@"} too, so both addresses reach your website.
                          {alt.error ? ` ${alt.error}` : ""}
                        </p>
                        <DnsTable records={alt.dnsRecords} />
                      </>
                    )}
                  </div>
                ) : null}

                <div className="rounded-lg border border-border bg-slate-50 px-3 py-2 text-xs text-muted surface-dark:bg-subtle">
                  <p className="font-medium text-heading">Cloudflare users</p>
                  <p className="mt-1">Set these records to DNS only (grey cloud). Proxying often blocks verification and HTTPS.</p>
                </div>
                <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
                  {REGISTRAR_GUIDES.map((g) => (
                    <li key={g.name}>
                      <a href={g.href} target="_blank" rel="noopener noreferrer" className="text-accent underline underline-offset-2">
                        {g.name}
                      </a>
                    </li>
                  ))}
                </ul>

                <div className="flex flex-wrap gap-2">
                  <Button type="button" disabled={busy} onClick={() => void run("check")}>
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Check connection
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busy}
                    onClick={() => {
                      if (window.confirm(`Remove ${state.domain}? Your website stays live at ${state.fallbackSubdomain}; ${state.domain} stops showing it.`)) void run("remove");
                    }}
                  >
                    Remove domain
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
