"use client";

import { useMemo, useRef, useState } from "react";
import { Check, Loader2, RotateCcw, Send } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { isSafeCssColor } from "@/lib/brand-color";
import {
  buildDefaultWorkflowSettings,
  type MessageTemplateKey,
  type WorkflowSettings,
} from "@/lib/workflow-settings";
import { renderWorkflowTemplate, type WorkflowMessageVariables } from "@/lib/workflow-template-render";
import {
  AUTOMATED_EMAIL_SAMPLE_VARS,
  automatedEmailCtaLabel,
  automatedEmailVariables,
  automatedEmailWhenSent,
  groupAutomatedEmails,
  type AutomatedEmailDefinition,
} from "@/components/admin/settings-tabs/automated-emails-meta";
import { parseApiResponse } from "@/components/admin/settings-tabs/shared";

interface EmailTemplatesSettingsCardProps {
  workflow: WorkflowSettings;
  onChange: (workflow: WorkflowSettings) => void;
  portalName?: string;
  businessName?: string;
  /** Branding for the live preview (falls back to neutral defaults). */
  logoUrl?: string;
  primaryColor?: string;
  accentColor?: string;
  footerText?: string;
}

type Field = "subject" | "body";

const GROUPS = groupAutomatedEmails();
const ALL_TEMPLATES = GROUPS.flatMap((g) => g.templates);

export function EmailTemplatesSettingsCard({
  workflow,
  onChange,
  portalName,
  businessName,
  logoUrl,
  primaryColor,
  accentColor,
  footerText,
}: EmailTemplatesSettingsCardProps) {
  const defaults = useMemo(() => buildDefaultWorkflowSettings().messages, []);
  const [selectedKey, setSelectedKey] = useState<MessageTemplateKey>(
    ALL_TEMPLATES[0]?.key ?? "new_request_confirmation"
  );
  const [sending, setSending] = useState(false);
  const subjectRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const lastField = useRef<Field>("body");

  const previewVars: WorkflowMessageVariables = {
    ...AUTOMATED_EMAIL_SAMPLE_VARS,
    portal_name: portalName?.trim() || AUTOMATED_EMAIL_SAMPLE_VARS.portal_name,
    business_name: businessName?.trim() || AUTOMATED_EMAIL_SAMPLE_VARS.business_name,
  };

  function patchMessage(key: MessageTemplateKey, patch: { subject?: string; body?: string; enabled?: boolean }) {
    const current = workflow.messages[key];
    onChange({
      ...workflow,
      messages: { ...workflow.messages, [key]: { ...current, ...patch } },
    });
  }

  function resetMessage(key: MessageTemplateKey) {
    onChange({
      ...workflow,
      messages: {
        ...workflow.messages,
        // Reset restores the wording only; on/off stays as the business set it.
        [key]: { ...defaults[key], enabled: workflow.messages[key].enabled },
      },
    });
  }

  function isEdited(key: MessageTemplateKey) {
    const current = workflow.messages[key];
    return current.subject !== defaults[key].subject || current.body !== defaults[key].body;
  }

  function selectTemplate(key: MessageTemplateKey) {
    setSelectedKey(key);
    // On narrow screens the editor sits below the list; bring it into view.
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 1023px)").matches) {
      requestAnimationFrame(() => editorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    }
  }

  const tpl: AutomatedEmailDefinition =
    ALL_TEMPLATES.find((t) => t.key === selectedKey) ?? ALL_TEMPLATES[0];
  const current = workflow.messages[tpl.key];
  const enabled = current.enabled !== false;
  const variables = automatedEmailVariables(tpl);

  function insertVariable(name: string) {
    const token = `{{${name}}}`;
    const field = lastField.current;
    const el = field === "subject" ? subjectRef.current : bodyRef.current;
    const value = field === "subject" ? current.subject : current.body;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    const next = value.slice(0, start) + token + value.slice(end);
    patchMessage(tpl.key, field === "subject" ? { subject: next } : { body: next });
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      const pos = start + token.length;
      el.setSelectionRange(pos, pos);
    });
  }

  async function sendTest() {
    if (sending) return;
    setSending(true);
    try {
      const res = await fetch("/api/admin/email-templates/test", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: tpl.key, subject: current.subject, body: current.body }),
      });
      const data = await parseApiResponse(res);
      toast.success(`Test sent to ${typeof data.to === "string" ? data.to : "your email"}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not send the test email");
    } finally {
      setSending(false);
    }
  }

  const previewSubject = renderWorkflowTemplate(current.subject, previewVars, { workflowKey: tpl.key });
  const previewBody = renderWorkflowTemplate(current.body, previewVars, { workflowKey: tpl.key });

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-start">
      {/* Left: emails grouped by stage */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        {GROUPS.map((group) => (
          <div key={group.id}>
            <p className="px-4 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-wider text-muted sm:px-5">
              {group.title}
            </p>
            <ul>
              {group.templates.map((t) => {
                const msg = workflow.messages[t.key];
                const on = msg.enabled !== false;
                const selected = t.key === tpl.key;
                const subjectPreview = renderWorkflowTemplate(msg.subject, previewVars, { workflowKey: t.key });
                return (
                  <li
                    key={t.key}
                    className={cn(
                      "relative flex items-center gap-3 border-l-[3px] transition-colors",
                      selected ? "border-accent bg-accent-subtle" : "border-transparent hover:bg-subtle"
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => selectTemplate(t.key)}
                      aria-current={selected ? "true" : undefined}
                      className="min-h-[56px] min-w-0 flex-1 py-3 pl-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent sm:pl-5"
                    >
                      <span className="flex items-center gap-2">
                        <span className={cn("truncate text-sm font-semibold", on ? "text-heading" : "text-muted")}>
                          {t.label}
                        </span>
                        {isEdited(t.key) ? (
                          <span className="shrink-0 rounded-md bg-accent-subtle px-1.5 py-0.5 text-[11px] font-semibold text-accent">
                            Edited
                          </span>
                        ) : null}
                      </span>
                      <span className="mt-0.5 block truncate text-[13px] text-muted">{subjectPreview}</span>
                    </button>
                    <div className="flex h-11 shrink-0 items-center pr-4 sm:pr-5">
                      <Switch
                        checked={on}
                        onCheckedChange={(next) => patchMessage(t.key, { enabled: next })}
                        aria-label={`Send the ${t.label} email`}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
        <div className="h-2" />
      </div>

      {/* Right: editor + live preview */}
      <div ref={editorRef} className="scroll-mt-24 rounded-2xl border border-border bg-card p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-heading">{tpl.label}</h3>
            {enabled ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 surface-dark:bg-emerald-500/15 surface-dark:text-emerald-300">
                <Check className="h-3 w-3" aria-hidden /> On
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full bg-subtle px-2 py-0.5 text-xs font-semibold text-muted">
                Off
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {isEdited(tpl.key) ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-9 text-accent"
                onClick={() => resetMessage(tpl.key)}
              >
                <RotateCcw className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                Reset to default
              </Button>
            ) : null}
            <Button type="button" variant="outline" size="sm" className="h-9" onClick={sendTest} disabled={sending}>
              {sending ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden />
              ) : (
                <Send className="mr-1.5 h-3.5 w-3.5" aria-hidden />
              )}
              Send me a test
            </Button>
          </div>
        </div>
        <p className="mt-1 text-[13px] text-muted">{automatedEmailWhenSent(tpl)}</p>
        {!enabled ? (
          <p className="mt-2 text-xs text-muted">
            This email is off and won&apos;t be sent. Your wording is kept for when you turn it back on.
          </p>
        ) : null}

        <div className="mt-5 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor={`email-subject-${tpl.key}`}>Subject</Label>
            <Input
              ref={subjectRef}
              id={`email-subject-${tpl.key}`}
              value={current.subject}
              onFocus={() => (lastField.current = "subject")}
              onChange={(e) => patchMessage(tpl.key, { subject: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`email-body-${tpl.key}`}>Message</Label>
            <Textarea
              ref={bodyRef}
              id={`email-body-${tpl.key}`}
              rows={5}
              value={current.body}
              onFocus={() => (lastField.current = "body")}
              onChange={(e) => patchMessage(tpl.key, { body: e.target.value })}
            />
          </div>
          {variables.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted">Insert:</span>
              {variables.map((name) => (
                <button
                  key={name}
                  type="button"
                  // Keep focus (and the cursor) in the field being edited.
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => insertVariable(name)}
                  className="inline-flex min-h-8 items-center rounded-md bg-accent-subtle px-2 font-mono text-xs font-medium text-accent hover:opacity-80"
                >
                  + {name}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <EmailPreview
          subject={previewSubject}
          body={previewBody}
          ctaLabel={automatedEmailCtaLabel(tpl.key)}
          businessName={previewVars.business_name}
          logoUrl={logoUrl}
          primaryColor={primaryColor}
          accentColor={accentColor}
          footerText={footerText}
        />
      </div>
    </div>
  );
}

/**
 * Mirrors the layout of the branded email (header, body, button, footer).
 * Emails always render light, so the colors here match the real email, not the portal theme.
 */
function EmailPreview({
  subject,
  body,
  ctaLabel,
  businessName,
  logoUrl,
  primaryColor,
  accentColor,
  footerText,
}: {
  subject: string;
  body: string;
  ctaLabel: string;
  businessName: string;
  logoUrl?: string;
  primaryColor?: string;
  accentColor?: string;
  footerText?: string;
}) {
  const header = primaryColor && isSafeCssColor(primaryColor) ? primaryColor : "#0F172A";
  const button = accentColor && isSafeCssColor(accentColor) ? accentColor : "#3B82F6";
  const logo = (logoUrl ?? "").trim();
  return (
    <div className="mt-6">
      <p className="mb-2 text-xs font-medium text-muted">Preview</p>
      <div className="overflow-hidden rounded-xl border border-border" style={{ background: "#FFFFFF" }}>
        <div className="flex items-center gap-3 px-5 py-4" style={{ background: header }}>
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt="" className="h-7 w-auto max-w-[96px] object-contain" />
          ) : null}
          <span className="truncate text-sm font-semibold" style={{ color: "#FFFFFF" }}>
            {businessName}
          </span>
        </div>
        <div className="px-5 py-5">
          <p className="text-[15px] font-semibold leading-snug" style={{ color: "#0F172A" }}>
            {subject}
          </p>
          <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed" style={{ color: "#475569" }}>
            {body}
          </p>
          <span
            className="mt-4 inline-block rounded-lg px-4 py-2.5 text-sm font-semibold"
            style={{ background: button, color: "#FFFFFF" }}
          >
            {ctaLabel}
          </span>
        </div>
        <div className="border-t px-5 py-3" style={{ background: "#F8FAFC", borderColor: "#E2E8F0" }}>
          <p className="text-xs" style={{ color: "#94A3B8" }}>
            {footerText?.trim() || `You received this email because you have a project with ${businessName}.`}
          </p>
        </div>
      </div>
    </div>
  );
}
