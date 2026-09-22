"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { Check, Copy, ExternalLink, Loader2 } from "lucide-react";
import {
  composePortalDomainInput,
} from "@/lib/custom-domain-input";
import type { CustomDomainPublicState, DnsRecordInstruction } from "@/lib/custom-domain";

const REGISTRAR_GUIDES = [
  {
    name: "GoDaddy",
    href: "https://www.godaddy.com/help/add-a-cname-record-19236",
  },
  {
    name: "Namecheap",
    href: "https://www.namecheap.com/support/knowledgebase/article.aspx/9646/2237/how-to-create-a-cname-record-for-your-domain/",
  },
  {
    name: "Cloudflare",
    href: "https://developers.cloudflare.com/dns/manage-dns-records/how-to/create-dns-records/",
  },
  {
    name: "Squarespace",
    href: "https://support.squarespace.com/hc/en-us/articles/360002101888",
  },
  {
    name: "Google Domains / Squarespace Domains",
    href: "https://support.google.com/domains/answer/3290350",
  },
] as const;

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted">{label}</p>
      <div className="flex gap-2">
        <code className="min-w-0 flex-1 break-all rounded-md border border-border bg-slate-50 px-3 py-2 text-sm">
          {value}
        </code>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0"
          aria-label={`Copy ${label}`}
          onClick={async () => {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}

function statusLabel(state: CustomDomainPublicState): { title: string; detail: string; tone: string } {
  if (!state.domain) {
    return {
      title: "Not connected",
      detail: `Clients use ${state.fallbackSubdomain} until you connect your own domain.`,
      tone: "text-muted",
    };
  }
  switch (state.status) {
    case "connected":
      return {
        title: "Connected",
        detail: `Your portal is live at ${state.domain}.`,
        tone: "text-emerald-700",
      };
    case "manual":
      return {
        title: "Waiting on support",
        detail: state.error || "DNS instructions are ready. Contact support to finish registration.",
        tone: "text-amber-800",
      };
    case "verifying":
      return {
        title: "Almost there",
        detail:
          state.error ||
          "DNS is updating. This can take minutes to a few hours — keep checking; it is not a failure yet.",
        tone: "text-amber-800",
      };
    case "error":
      return {
        title: "Needs attention",
        detail: state.error || "Something looks wrong with DNS. Compare your records to the table below.",
        tone: "text-red-700",
      };
    case "pending":
    default:
      return {
        title: "Waiting for DNS",
        detail:
          state.error ||
          "Add the NEW record below at your registrar. Propagation often takes a few minutes and can take up to 48 hours.",
        tone: "text-amber-800",
      };
  }
}

function DnsTable({ records }: { records: DnsRecordInstruction[] }) {
  if (records.length === 0) return null;
  return (
    <div className="space-y-3">
      {records.map((r, i) => (
        <div key={`${r.type}-${r.host}-${i}`} className="rounded-lg border border-border p-3 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            {r.purpose === "ownership" ? "Ownership verification" : "Point your domain here"}
          </p>
          {r.isGenericFallback ? (
            <p className="text-xs text-amber-800">
              Generic Vercel fallback — prefer Retry DNS lookup for the project-specific target.
            </p>
          ) : null}
          <CopyField label="Type" value={r.type} />
          <CopyField label="Name / Host" value={r.host} />
          <CopyField label="Value / Points to" value={r.value} />
        </div>
      ))}
    </div>
  );
}

async function readApiJson(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    const trimmed = text.trim().replace(/\s+/g, " ");
    const preview = trimmed.length > 240 ? `${trimmed.slice(0, 237)}…` : trimmed;
    throw new Error(
      preview
        ? `Server returned a non-JSON error (HTTP ${res.status}): ${preview}`
        : `Server returned an empty or invalid response (HTTP ${res.status}).`
    );
  }
}

function splitExistingDomain(domain: string | null): { subdomain: string; root: string } {
  if (!domain) return { subdomain: "portal", root: "" };
  const parts = domain.split(".");
  if (parts.length <= 2) return { subdomain: "portal", root: domain };
  return { subdomain: parts.slice(0, -2).join("."), root: parts.slice(-2).join(".") };
}

export function CustomDomainSettingsCard({
  entitled,
  initialState,
  apiBase = "/api/admin/custom-domain",
}: {
  entitled: boolean;
  initialState: CustomDomainPublicState;
  apiBase?: string;
}) {
  const [state, setState] = useState(initialState);
  const initialParts = splitExistingDomain(initialState.domain);
  const [subdomainInput, setSubdomainInput] = useState(initialParts.subdomain || "portal");
  const [rootDomainInput, setRootDomainInput] = useState(
    initialState.isApex ? initialState.domain ?? "" : initialParts.root
  );
  const [apexDomainInput, setApexDomainInput] = useState(
    initialState.isApex ? initialState.domain ?? "" : ""
  );
  const [mode, setMode] = useState<"subdomain" | "apex">(
    initialState.domain && initialState.isApex ? "apex" : "subdomain"
  );
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [fieldNotice, setFieldNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setState(initialState);
    if (initialState.domain) {
      if (initialState.isApex) {
        setMode("apex");
        setApexDomainInput(initialState.domain);
      } else {
        const parts = splitExistingDomain(initialState.domain);
        setMode("subdomain");
        setSubdomainInput(parts.subdomain);
        setRootDomainInput(parts.root);
      }
    }
  }, [initialState]);

  const liveCompose = useMemo(() => {
    if (mode === "apex") {
      return composePortalDomainInput({ mode: "apex", apexDomain: apexDomainInput });
    }
    return composePortalDomainInput({
      mode: "subdomain",
      subdomain: subdomainInput,
      rootDomain: rootDomainInput,
    });
  }, [mode, subdomainInput, rootDomainInput, apexDomainInput]);

  const livePreview =
    liveCompose.ok && !liveCompose.isApex
      ? liveCompose.domain
      : liveCompose.ok && liveCompose.isApex
        ? liveCompose.domain
        : null;

  const refresh = useCallback(async () => {
    const res = await fetch(apiBase, { credentials: "include" });
    const data = await readApiJson(res);
    if (res.ok && data.state) setState(data.state as CustomDomainPublicState);
  }, [apiBase]);

  async function run(action: "claim" | "check" | "remove", domain?: string) {
    setBusy(true);
    setFieldError(null);
    try {
      const res = await fetch(apiBase, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, domain }),
      });
      const data = await readApiJson(res);
      if (!res.ok) {
        throw new Error(
          typeof data.error === "string" && data.error
            ? data.error
            : `Request failed (HTTP ${res.status})`
        );
      }
      if (data.state) {
        const next = data.state as CustomDomainPublicState;
        setState(next);
        if (action === "check" && next.dnsTargetChanged) {
          toast.error(next.dnsTargetChanged.message);
        }
      }
      if (action === "claim") toast.success("Domain saved — add the DNS record shown below");
      if (action === "check" && !(data.state as CustomDomainPublicState | undefined)?.dnsTargetChanged) {
        toast.message("Status updated");
      }
      if (action === "remove") {
        toast.success("Custom domain removed — clients use your ShootPortal address again");
        setSubdomainInput("portal");
        setRootDomainInput("");
        setApexDomainInput("");
        setMode("subdomain");
        setFieldNotice(null);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  function onContinue() {
    setFieldError(null);
    setFieldNotice(null);
    const composed =
      mode === "apex"
        ? composePortalDomainInput({ mode: "apex", apexDomain: apexDomainInput })
        : composePortalDomainInput({
            mode: "subdomain",
            subdomain: subdomainInput,
            rootDomain: rootDomainInput,
          });

    if (!composed.ok) {
      if (composed.redirectToApex) {
        setMode("apex");
        setFieldError(composed.error);
        return;
      }
      setFieldError(composed.error);
      return;
    }

    if (composed.split) {
      setSubdomainInput(composed.split.subdomain);
      setRootDomainInput(composed.split.rootDomain);
      setMode("subdomain");
    }
    if (composed.notice) setFieldNotice(composed.notice);

    void run("claim", composed.domain);
  }

  const status = statusLabel(state);
  const routingRecords = state.dnsRecords.filter((r) => r.purpose === "routing");
  const ownershipRecords = state.dnsRecords.filter((r) => r.purpose === "ownership");

  if (!entitled) {
    return (
      <Card className="shadow-sm">
        <CardContent className="space-y-3 pt-6">
          <h3 className="font-semibold text-heading">Use your own web address</h3>
          <p className="text-sm text-muted">
            Clients can open your portal at something like{" "}
            <span className="font-medium text-heading">portal.yourstudio.com</span> — a subdomain on
            a domain you already own — instead of{" "}
            <span className="font-medium text-heading">{state.fallbackSubdomain}</span>.
          </p>
          <p className="text-sm text-muted">
            This is included on plans with the custom domain entitlement (for example Studio). Upgrade
            to unlock the step-by-step DNS setup here. Until then, your portal stays on the ShootPortal
            address above.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="shadow-sm">
        <CardContent className="space-y-4 pt-6">
          <div>
            <h3 className="font-semibold text-heading">Use your own web address</h3>
            <p className="mt-1 text-sm text-muted">
              A <strong className="font-medium text-heading">subdomain</strong> is a short name in
              front of your domain — the <code className="text-xs">portal</code> in{" "}
              <code className="text-xs">portal.yourstudio.com</code>. You will{" "}
              <strong className="font-medium text-heading">create a NEW DNS record</strong> at the
              company where you renew your domain. You are not editing your website&apos;s existing
              records, and your main website stays unchanged.
            </p>
            <p className={`mt-3 text-sm font-medium ${status.tone}`}>{status.title}</p>
            <p className="mt-1 text-sm text-muted">{status.detail}</p>
            <p className="mt-2 text-xs text-muted">
              Your ShootPortal address{" "}
              <span className="font-medium text-heading">{state.fallbackSubdomain}</span> always
              works for sign-in, even while a custom domain is pending or broken.
            </p>
          </div>

          {state.status === "connected" && state.portalUrl ? (
            <a
              href={state.portalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm font-medium text-accent underline underline-offset-2"
            >
              Open live portal <ExternalLink className="h-3.5 w-3.5" />
            </a>
          ) : null}

          {!state.vercelApiConfigured ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
              Automatic registration with our host is not configured in this environment. Contact
              support for the exact DNS record — do not guess a CNAME value.
            </div>
          ) : null}

          {!state.domain ? (
            <div className="space-y-4">
              {mode === "subdomain" ? (
                <>
                  <p className="text-sm text-muted">
                    Enter a short subdomain label and the domain you already own. We create a{" "}
                    <strong className="font-medium text-heading">new</strong> address for your
                    portal — your homepage (including www) is not moved.
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="custom-domain-sub">Subdomain</Label>
                      <Input
                        id="custom-domain-sub"
                        value={subdomainInput}
                        onChange={(e) => {
                          setSubdomainInput(e.target.value);
                          setFieldError(null);
                        }}
                        placeholder="portal"
                        disabled={busy}
                        autoComplete="off"
                        spellCheck={false}
                      />
                      <p className="text-xs text-muted">Usually “portal”. Do not use “www”.</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="custom-domain-root">Your domain</Label>
                      <Input
                        id="custom-domain-root"
                        value={rootDomainInput}
                        onChange={(e) => {
                          setRootDomainInput(e.target.value);
                          setFieldError(null);
                        }}
                        placeholder="yourstudio.com"
                        disabled={busy}
                        autoComplete="off"
                        spellCheck={false}
                      />
                      <p className="text-xs text-muted">
                        The domain you renew (not your full website URL).
                      </p>
                    </div>
                  </div>

                  <div className="rounded-lg border border-accent/30 bg-accent/5 px-4 py-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted">
                      Live preview
                    </p>
                    <p className="mt-1 text-base font-semibold text-heading break-all sm:text-lg">
                      {livePreview
                        ? `Your portal will be at ${livePreview}`
                        : "Your portal will be at portal.yourstudio.com"}
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-950 space-y-2">
                    <p className="font-medium">Apex domain warning</p>
                    <p>
                      Pointing your <strong>root</strong> domain (example.com, with no subdomain)
                      at ShootPortal means visitors to that exact address open your portal — not a
                      separate marketing site. Prefer a subdomain like{" "}
                      <code className="text-xs">portal.example.com</code> unless you intend this.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="custom-domain-apex">Root domain (apex)</Label>
                    <Input
                      id="custom-domain-apex"
                      value={apexDomainInput}
                      onChange={(e) => {
                        setApexDomainInput(e.target.value);
                        setFieldError(null);
                      }}
                      placeholder="yourstudio.com"
                      disabled={busy}
                      autoComplete="off"
                      spellCheck={false}
                    />
                  </div>
                  {livePreview ? (
                    <div className="rounded-lg border border-accent/30 bg-accent/5 px-4 py-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted">
                        Live preview
                      </p>
                      <p className="mt-1 text-base font-semibold text-heading break-all">
                        Your portal will be at {livePreview}
                      </p>
                    </div>
                  ) : null}
                </>
              )}

              {fieldNotice ? (
                <p className="text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2">
                  {fieldNotice}
                </p>
              ) : null}
              {fieldError ? (
                <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2" role="alert">
                  {fieldError}
                </p>
              ) : null}

              <button
                type="button"
                className="text-xs text-accent underline"
                onClick={() => {
                  setMode((m) => (m === "apex" ? "subdomain" : "apex"));
                  setFieldError(null);
                  setFieldNotice(null);
                }}
              >
                {mode === "apex"
                  ? "Back to subdomain setup (recommended)"
                  : "Using an apex domain (example.com)?"}
              </button>

              <Button
                type="button"
                disabled={
                  busy ||
                  (mode === "subdomain"
                    ? !subdomainInput.trim() && !rootDomainInput.trim()
                    : !apexDomainInput.trim())
                }
                onClick={onContinue}
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Continue
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-heading">
                Domain: <span className="font-semibold">{state.domain}</span>
              </p>

              {state.dnsTargetChanged ? (
                <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-3 text-sm text-amber-950">
                  <p className="font-medium">Required DNS value changed</p>
                  <p className="mt-1">{state.dnsTargetChanged.message}</p>
                </div>
              ) : null}

              {state.dnsConfigMessage && routingRecords.length === 0 ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-950 space-y-2">
                  <p>{state.dnsConfigMessage}</p>
                  <Button type="button" size="sm" disabled={busy} onClick={() => void run("check")}>
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Retry DNS lookup
                  </Button>
                </div>
              ) : null}

              <div className="space-y-2">
                <p className="text-sm font-medium text-heading">Add this DNS record</p>
                <ol className="list-decimal space-y-1 pl-5 text-sm text-muted">
                  <li>Sign in to the site where you renew your domain (your registrar).</li>
                  <li>Open DNS settings (sometimes labeled “DNS”, “Manage DNS”, or “Zone file”).</li>
                  <li>
                    <strong className="font-medium text-heading">Add a new record</strong> using the
                    Type, Name, and Value below — do not edit your website&apos;s existing www or
                    root records.
                  </li>
                  <li>
                    Save, wait a few minutes (sometimes up to a few hours), then click Check status.
                  </li>
                </ol>
                <DnsTable records={routingRecords} />
                {ownershipRecords.length > 0 ? (
                  <>
                    <p className="text-sm font-medium text-heading pt-2">
                      Ownership verification (if shown)
                    </p>
                    <DnsTable records={ownershipRecords} />
                  </>
                ) : null}
                {state.dnsConfigMessage && routingRecords.length > 0 ? (
                  <p className="text-xs text-amber-800">{state.dnsConfigMessage}</p>
                ) : null}
                <div className="rounded-lg border border-border bg-slate-50 px-3 py-2 text-xs text-muted">
                  <p className="font-medium text-heading">Cloudflare users</p>
                  <p className="mt-1">
                    Set the record to <strong>DNS only</strong> (grey cloud). Proxying (orange cloud)
                    often breaks verification and HTTPS.
                  </p>
                </div>
                <p className="text-xs text-muted">Registrar help:</p>
                <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
                  {REGISTRAR_GUIDES.map((g) => (
                    <li key={g.name}>
                      <a
                        href={g.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-accent underline underline-offset-2"
                      >
                        {g.name}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button type="button" disabled={busy} onClick={() => run("check")}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Check status
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => {
                    if (
                      window.confirm(
                        `Remove ${state.domain}? Clients will use ${state.fallbackSubdomain} again.`
                      )
                    ) {
                      void run("remove");
                    }
                  }}
                >
                  Remove domain
                </Button>
                <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => void refresh()}>
                  Refresh
                </Button>
              </div>

              {state.status === "connected" ? (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-950">
                  <p className="font-medium">Connected</p>
                  <p className="mt-1">
                    Portal links in email and payments now use this domain. Sign-in, invites, password
                    reset, and Google work as soon as DNS is live.
                  </p>
                </div>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
