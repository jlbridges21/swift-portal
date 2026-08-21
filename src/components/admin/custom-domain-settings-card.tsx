"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { Check, Copy, ExternalLink, Loader2 } from "lucide-react";
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
        <code className="min-w-0 flex-1 truncate rounded-md border border-border bg-slate-50 px-3 py-2 text-sm">
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
          "Add the record below at your registrar. Propagation often takes a few minutes and can take up to 48 hours.",
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
          <CopyField label="Type" value={r.type} />
          <CopyField label="Name / Host" value={r.host} />
          <CopyField label="Value / Points to" value={r.value} />
        </div>
      ))}
    </div>
  );
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
  const [domainInput, setDomainInput] = useState(initialState.domain ?? "portal.");
  const [busy, setBusy] = useState(false);
  const [showApex, setShowApex] = useState(false);

  useEffect(() => {
    setState(initialState);
    if (initialState.domain) setDomainInput(initialState.domain);
  }, [initialState]);

  const refresh = useCallback(async () => {
    const res = await fetch(apiBase, { credentials: "include" });
    const data = await res.json();
    if (res.ok && data.state) setState(data.state);
  }, [apiBase]);

  async function run(action: "claim" | "check" | "remove", domain?: string) {
    setBusy(true);
    try {
      const res = await fetch(apiBase, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, domain }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Request failed");
      setState(data.state);
      if (action === "claim") toast.success("Domain saved — add the DNS record next");
      if (action === "check") toast.message("Status updated");
      if (action === "remove") {
        toast.success("Custom domain removed");
        setDomainInput("portal.");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  const status = statusLabel(state);

  if (!entitled) {
    return (
      <Card className="shadow-sm">
        <CardContent className="space-y-3 pt-6">
          <h3 className="font-semibold text-heading">Custom domain</h3>
          <p className="text-sm text-muted">
            Connect <span className="font-medium text-heading">portal.yourstudio.com</span> so clients
            open your portal on your brand. This requires a plan that includes the Custom domain
            entitlement — upgrade to unlock setup here.
          </p>
          <p className="text-sm text-muted">
            Meanwhile your portal stays at{" "}
            <span className="font-medium text-heading">{state.fallbackSubdomain}</span>.
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
            <h3 className="font-semibold text-heading">Custom domain</h3>
            <p className={`mt-1 text-sm font-medium ${status.tone}`}>{status.title}</p>
            <p className="mt-1 text-sm text-muted">{status.detail}</p>
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
              Automatic registration with our host is not configured in this environment. You can still
              prepare DNS below, then contact support to finish — or ask a platform admin to complete
              the connection.
            </div>
          ) : null}

          {!state.domain ? (
            <div className="space-y-3">
              <p className="text-sm text-muted">
                <strong className="font-medium text-heading">Recommend a subdomain</strong> like{" "}
                <code className="text-xs">portal.yourstudio.com</code> — it only needs a CNAME and
                avoids apex-domain DNS quirks.
              </p>
              <div className="space-y-2">
                <Label htmlFor="custom-domain-input">Your portal domain</Label>
                <Input
                  id="custom-domain-input"
                  value={domainInput}
                  onChange={(e) => setDomainInput(e.target.value)}
                  placeholder="portal.yourstudio.com"
                  disabled={busy}
                />
              </div>
              <button
                type="button"
                className="text-xs text-accent underline"
                onClick={() => setShowApex((v) => !v)}
              >
                {showApex ? "Hide apex notes" : "Using an apex domain (example.com)?"}
              </button>
              {showApex ? (
                <p className="text-xs text-muted">
                  Apex domains are supported: you will add an A record to{" "}
                  <code>76.76.21.21</code> instead of a CNAME. Prefer a subdomain when you can.
                </p>
              ) : null}
              <Button
                type="button"
                disabled={busy || !domainInput.trim()}
                onClick={() => run("claim", domainInput.trim())}
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

              <div className="space-y-2">
                <p className="text-sm font-medium text-heading">Add this DNS record</p>
                <p className="text-sm text-muted">
                  In your <strong>domain registrar&apos;s DNS settings</strong> (where you renew the
                  domain), create the record below. Then come back and check status.
                </p>
                <DnsTable records={state.dnsRecords} />
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
                    Portal links in email and payments now use this domain. Ask ShootPortal support to
                    confirm the Auth redirect allow-list includes{" "}
                    <code className="text-xs">https://{state.domain}/auth/confirm</code> — without it,
                    password reset and invites can break on the new host.
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
