"use client";

import { useState, type ReactNode } from "react";
import { Activity, AlertTriangle, AtSign, ChevronDown, CircleCheck, Loader2, Mail, Reply, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  domainStatusLabel,
  senderModeLabel,
  useEmailDiagnostics,
  type LastSend,
} from "@/components/admin/email-diagnostics-card";
import type { AppSettings } from "@/lib/app-settings";
import { DEFAULT_PLATFORM_FROM_ADDRESS } from "@/lib/site-metadata";
import { cn } from "@/lib/utils";
import { DomainRecordsList, SectionHeading, useSettingsTab, parseApiResponse } from "@/components/admin/settings-tabs/shared";

const CARD = "rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6";

function mailboxOf(header: string | undefined | null): string | null {
  if (!header) return null;
  return header.match(/<([^>]+)>/)?.[1] ?? (header.includes("@") ? header.trim() : null);
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function lastTestLine(lastSend: LastSend | null, loading: boolean): string {
  if (loading && !lastSend) return "Last test: checking…";
  if (!lastSend) return "Last test: not sent yet.";
  const when = formatWhen(lastSend.at);
  if (lastSend.sent) return `Last test: sent${lastSend.to ? ` to ${lastSend.to}` : ""} · ${when}`;
  if (lastSend.skipped) return `Last test: skipped${lastSend.skipReason ? ` (${lastSend.skipReason})` : ""} · ${when}`;
  return `Last test: failed${lastSend.error ? ` (${lastSend.error})` : ""} · ${when}`;
}

function StatusItem({
  icon,
  tone = "neutral",
  title,
  detail,
}: {
  icon: ReactNode;
  tone?: "ok" | "warn" | "neutral";
  title: string;
  detail: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span
        className={cn(
          "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
          tone === "ok" && "bg-emerald-50 text-emerald-700 surface-dark:bg-emerald-500/15 surface-dark:text-emerald-300",
          tone === "warn" && "bg-amber-50 text-amber-700 surface-dark:bg-amber-500/15 surface-dark:text-amber-300",
          tone === "neutral" && "bg-subtle text-muted"
        )}
      >
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-heading">{title}</p>
        <p className="truncate text-[13px] text-muted" title={detail}>
          {detail}
        </p>
      </div>
    </div>
  );
}

function ChoiceCard({
  selected,
  onSelect,
  title,
  badge,
  description,
  fromLine,
}: {
  selected: boolean;
  onSelect: () => void;
  title: string;
  badge?: ReactNode;
  description: string;
  fromLine: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        "flex min-w-0 gap-3 rounded-xl border p-4 text-left transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
        selected ? "border-accent bg-accent-subtle ring-3 ring-accent/20" : "border-border bg-card hover:border-accent/50"
      )}
    >
      <span
        className={cn(
          "mt-0.5 h-[18px] w-[18px] shrink-0 rounded-full border-2",
          selected ? "border-[5px] border-accent" : "border-border"
        )}
        aria-hidden
      />
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2 text-sm font-semibold text-heading">
          {title}
          {badge}
        </span>
        <span className="mt-1 block text-[13px] leading-snug text-muted">{description}</span>
        <span className="mt-2.5 block truncate rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs text-foreground" title={fromLine}>
          {fromLine}
        </span>
      </span>
    </button>
  );
}

export function EmailSenderTab() {
  const { settings, setSettings, patchEmail } = useSettingsTab();
  const email = settings.email;
  const { loading, config, lastSend, sending, sendTest } = useEmailDiagnostics();
  const [testTo, setTestTo] = useState("");
  const verified = email.domainVerificationStatus === "verified";
  const usingCustom = email.senderMode === "custom_domain";
  const [domainSetupOpen, setDomainSetupOpen] = useState(
    usingCustom || email.domainVerificationStatus === "pending"
  );
  const ownDomainChosen = usingCustom || domainSetupOpen;

  const businessName = settings.business.businessName.trim() || email.fromName.trim() || "ShootPortal";
  const platformMailbox =
    (config && config.senderMode !== "custom_domain" ? mailboxOf(config.resolvedFrom) : null) ??
    DEFAULT_PLATFORM_FROM_ADDRESS;
  const platformFrom = `${businessName} <${platformMailbox}>`;
  const domain = email.customDomain.trim() || "yourdomain.com";
  const customFrom = `${email.fromName.trim() || businessName} <${email.senderEmail.trim() || `hello@${domain}`}>`;
  const replyAddress = email.replyTo.trim() || settings.business.primaryContactEmail.trim();

  async function startVerification() {
    try {
      const res = await fetch("/api/admin/email/domain", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: email.customDomain }),
      });
      const data = await parseApiResponse(res);
      if (data.settings) setSettings(data.settings as AppSettings);
      toast.success("Add the DNS records below, then re-check verification");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Domain setup failed");
    }
  }

  async function recheckDns() {
    try {
      const res = await fetch("/api/admin/email/domain/verify", {
        method: "POST",
        credentials: "include",
      });
      const data = await parseApiResponse(res);
      if (data.settings) setSettings(data.settings as AppSettings);
      toast.success(`Domain status: ${data.domainVerificationStatus}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Re-check failed");
    }
  }

  return (
    <div id="settings-email" tabIndex={-1} className="scroll-mt-24">
      <SectionHeading id="email">Email</SectionHeading>
      <p className="mt-1 mb-4 text-sm text-muted">Who your client emails come from and where replies go.</p>

      <div className="space-y-5">
        {/* Status strip */}
        <div className="grid gap-4 rounded-2xl border border-border bg-card px-5 py-4 shadow-sm sm:grid-cols-3">
          {loading && !config ? (
            <StatusItem icon={<Loader2 className="h-4 w-4 animate-spin" />} title="Checking…" detail="Sending status" />
          ) : config?.sendingConfigured ? (
            <StatusItem icon={<CircleCheck className="h-4 w-4" />} tone="ok" title="Ready to send" detail="Emails are going out" />
          ) : (
            <StatusItem
              icon={<AlertTriangle className="h-4 w-4" />}
              tone="warn"
              title="Not ready yet"
              detail="Email sending isn't set up"
            />
          )}
          <StatusItem
            icon={<Reply className="h-4 w-4" />}
            title="Replies go to"
            detail={replyAddress || "No address set yet"}
          />
          <StatusItem
            icon={<Activity className="h-4 w-4" />}
            title="Delivery tracking"
            detail={loading && !config ? "Checking…" : config?.webhookConfigured ? "On" : "Off"}
          />
        </div>

        {/* How emails are sent */}
        <section className={CARD} aria-labelledby="email-how-sent">
          <h3 id="email-how-sent" className="mb-4 text-base font-semibold text-heading">
            How emails are sent
          </h3>
          <div role="radiogroup" aria-labelledby="email-how-sent" className="grid gap-3 md:grid-cols-2">
            <ChoiceCard
              selected={!ownDomainChosen}
              onSelect={() => {
                setDomainSetupOpen(false);
                if (usingCustom || email.senderEmail) patchEmail({ senderMode: "platform", senderEmail: "" });
              }}
              title="ShootPortal sending"
              badge={
                <span className="rounded-full bg-accent-subtle px-2 py-0.5 text-[11px] font-semibold text-accent">
                  Recommended
                </span>
              }
              description="Works right away, no setup. Clients see your business name."
              fromLine={platformFrom}
            />
            <ChoiceCard
              selected={ownDomainChosen}
              onSelect={() => {
                setDomainSetupOpen(true);
                if (verified && !usingCustom) patchEmail({ senderMode: "custom_domain" });
              }}
              title="Your own domain"
              description="Send from your own address. Needs a one-time DNS check."
              fromLine={customFrom}
            />
          </div>

          {ownDomainChosen ? (
            <div className="mt-5 space-y-4 border-t border-border pt-5">
              <div className="flex flex-wrap items-center gap-2 text-[13px]">
                <span className="font-semibold text-heading">Domain status</span>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-xs font-semibold",
                    verified
                      ? "bg-emerald-50 text-emerald-700 surface-dark:bg-emerald-500/15 surface-dark:text-emerald-300"
                      : "bg-amber-50 text-amber-700 surface-dark:bg-amber-500/15 surface-dark:text-amber-300"
                  )}
                >
                  {domainStatusLabel(email.domainVerificationStatus)}
                </span>
                {!usingCustom ? (
                  <span className="text-muted">Emails keep sending from ShootPortal until you switch.</span>
                ) : null}
                {verified && !usingCustom ? (
                  <Button type="button" size="sm" className="h-9" onClick={() => patchEmail({ senderMode: "custom_domain" })}>
                    Use this domain
                  </Button>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="customDomain">Custom sending domain</Label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    id="customDomain"
                    value={email.customDomain}
                    onChange={(e) => patchEmail({ customDomain: e.target.value })}
                    placeholder="mail.yourdomain.com"
                  />
                  <Button type="button" variant="outline" className="h-11 shrink-0 sm:h-10" onClick={() => void startVerification()}>
                    Start verification
                  </Button>
                  <Button type="button" variant="outline" className="h-11 shrink-0 sm:h-10" onClick={() => void recheckDns()}>
                    Re-check DNS
                  </Button>
                </div>
                <DomainRecordsList refreshKey={`${email.resendDomainId}:${email.domainVerificationStatus}`} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="senderEmail">Notification sender email</Label>
                <Input
                  id="senderEmail"
                  type="email"
                  value={email.senderEmail}
                  placeholder={`hello@${domain}`}
                  disabled={!usingCustom}
                  onChange={(e) => patchEmail({ senderEmail: e.target.value })}
                />
                <p className="text-xs text-muted">
                  {usingCustom
                    ? "Must be an address on your verified domain."
                    : "Available once your domain is verified and switched on."}
                </p>
              </div>
            </div>
          ) : null}
        </section>

        {/* Sender details */}
        <section className={CARD} aria-labelledby="email-sender-details">
          <h3 id="email-sender-details" className="mb-4 text-base font-semibold text-heading">
            Sender details
          </h3>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 scroll-mt-24" id="settings-from-name" tabIndex={-1}>
              <Label htmlFor="fromName">From name</Label>
              <Input id="fromName" value={email.fromName} onChange={(e) => patchEmail({ fromName: e.target.value })} />
              <p className="text-xs text-muted">Used with your own domain. ShootPortal sending shows your business name.</p>
            </div>
            <div className="space-y-2 scroll-mt-24" id="settings-reply-to" tabIndex={-1}>
              <Label htmlFor="replyTo">Replies go to</Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
                <Input
                  id="replyTo"
                  type="email"
                  className="pl-9"
                  placeholder={settings.business.primaryContactEmail || "you@example.com"}
                  value={email.replyTo}
                  onChange={(e) => patchEmail({ replyTo: e.target.value })}
                />
              </div>
              <p className="text-xs text-muted">Leave empty to use your main contact email.</p>
            </div>
          </div>
          <div className="mt-4 space-y-2">
            <Label htmlFor="footerText">Footer line</Label>
            <Textarea id="footerText" rows={2} value={email.footerText} onChange={(e) => patchEmail({ footerText: e.target.value })} />
          </div>
        </section>

        {/* Send a test email */}
        <section className={CARD} aria-labelledby="email-test-title">
          <div className="mb-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h3 id="email-test-title" className="text-base font-semibold text-heading">
              Send a test email
            </h3>
            <p className="text-[13px] text-muted">See exactly what clients get</p>
          </div>
          <form
            className="flex flex-col gap-2 sm:flex-row"
            onSubmit={(e) => {
              e.preventDefault();
              void sendTest(testTo);
            }}
          >
            <div className="relative flex-1">
              <AtSign className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
              <Input
                id="testEmail"
                type="email"
                aria-label="Send a test email to"
                className="h-11 pl-9"
                placeholder="you@example.com"
                value={testTo}
                onChange={(e) => setTestTo(e.target.value)}
              />
            </div>
            <Button type="submit" className="h-11 shrink-0" disabled={sending}>
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Send test
            </Button>
          </form>
          <p className="mt-2 text-xs text-muted">{lastTestLine(lastSend, loading)}</p>

          <details className="group mt-4 border-t border-border pt-3">
            <summary className="flex min-h-9 cursor-pointer list-none items-center gap-1.5 text-[13px] font-medium text-muted hover:text-heading [&::-webkit-details-marker]:hidden">
              <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" aria-hidden />
              Delivery details
            </summary>
            {config ? (
              <dl className="mt-2 grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-muted">Sending as</dt>
                  <dd className="mt-0.5 text-foreground">{senderModeLabel(config.senderMode)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">Custom domain</dt>
                  <dd className="mt-0.5 text-foreground">
                    {config.customDomain
                      ? `${config.customDomain} · ${domainStatusLabel(config.domainVerificationStatus)}`
                      : domainStatusLabel(config.domainVerificationStatus)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">From address (saved)</dt>
                  <dd className="mt-0.5 break-all text-foreground">{config.resolvedFrom}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">Replies go to (saved)</dt>
                  <dd className="mt-0.5 break-all text-foreground">{config.resolvedReplyTo || "—"}</dd>
                </div>
              </dl>
            ) : (
              <p className="mt-2 text-xs text-muted">{loading ? "Loading…" : "Couldn't load delivery details."}</p>
            )}
          </details>
        </section>
      </div>
    </div>
  );
}
