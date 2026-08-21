"use client";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  MESSAGE_TEMPLATE_DEFINITIONS,
  buildDefaultWorkflowSettings,
  type MessageTemplateKey,
  type WorkflowSettings,
} from "@/lib/workflow-settings";
import { renderWorkflowTemplate, WORKFLOW_VARIABLE_FALLBACKS } from "@/lib/workflow-template-render";

const SAMPLE_VARS = {
  ...WORKFLOW_VARIABLE_FALLBACKS,
  client_name: "Alex Rivera",
  project_name: "123 Main St — Drone Photos",
  property_address: "123 Main St, Orange Beach, AL",
  portal_link: "https://portal.example.com/dashboard/projects/sample",
  portal_name: "Acme Portal",
  payment_amount: "$450.00",
  shoot_date: "March 15, 2026 at 10:00 AM",
  business_name: "Acme Media",
};

interface EmailTemplatesSettingsCardProps {
  workflow: WorkflowSettings;
  onChange: (workflow: WorkflowSettings) => void;
  portalName?: string;
  businessName?: string;
}

export function EmailTemplatesSettingsCard({
  workflow,
  onChange,
  portalName,
  businessName,
}: EmailTemplatesSettingsCardProps) {
  const defaults = buildDefaultWorkflowSettings().messages;
  const previewVars = {
    ...SAMPLE_VARS,
    portal_name: portalName?.trim() || SAMPLE_VARS.portal_name,
    business_name: businessName?.trim() || SAMPLE_VARS.business_name,
  };

  function patchMessage(key: MessageTemplateKey, patch: { subject?: string; body?: string }) {
    const current = workflow.messages[key];
    onChange({
      ...workflow,
      messages: {
        ...workflow.messages,
        [key]: { ...current, ...patch },
      },
    });
  }

  function resetMessage(key: MessageTemplateKey) {
    onChange({
      ...workflow,
      messages: {
        ...workflow.messages,
        [key]: { ...defaults[key] },
      },
    });
  }

  const clientTemplates = MESSAGE_TEMPLATE_DEFINITIONS.filter((t) => t.audience === "client");
  const adminTemplates = MESSAGE_TEMPLATE_DEFINITIONS.filter((t) => t.audience === "admin");

  function renderGroup(
    title: string,
    description: string,
    templates: typeof MESSAGE_TEMPLATE_DEFINITIONS
  ) {
    if (templates.length === 0) return null;
    return (
      <div className="space-y-4">
        <div>
          <h3 className="text-base font-semibold text-primary">{title}</h3>
          <p className="mt-1 text-sm text-muted">{description}</p>
        </div>
        {templates.map((tpl) => {
          const current = workflow.messages[tpl.key];
          const isCustom =
            current.subject !== defaults[tpl.key].subject ||
            current.body !== defaults[tpl.key].body;
          const previewSubject = renderWorkflowTemplate(current.subject, previewVars, {
            workflowKey: tpl.key,
          });
          const previewBody = renderWorkflowTemplate(current.body, previewVars, {
            workflowKey: tpl.key,
          });
          return (
            <Card key={tpl.key} className="shadow-sm">
              <CardHeader className="pb-2">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base">{tpl.label}</CardTitle>
                    <p className="mt-1 text-sm text-muted">{tpl.description}</p>
                  </div>
                  {isCustom && (
                    <button
                      type="button"
                      className="shrink-0 text-xs font-medium text-accent hover:underline"
                      onClick={() => resetMessage(tpl.key)}
                    >
                      Reset to default
                    </button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor={`email-subject-${tpl.key}`}>Subject</Label>
                  <Input
                    id={`email-subject-${tpl.key}`}
                    value={current.subject}
                    onChange={(e) => patchMessage(tpl.key, { subject: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`email-body-${tpl.key}`}>Body</Label>
                  <Textarea
                    id={`email-body-${tpl.key}`}
                    rows={4}
                    value={current.body}
                    onChange={(e) => patchMessage(tpl.key, { body: e.target.value })}
                  />
                </div>
                <div className="rounded-lg border border-border bg-slate-50 px-3 py-2">
                  <p className="text-xs font-medium text-primary">Merge variables</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-muted">{tpl.placeholders}</p>
                </div>
                <div className="rounded-lg border border-dashed border-border px-3 py-3">
                  <p className="text-xs font-medium text-primary">Preview</p>
                  <p className="mt-2 text-sm font-medium text-foreground">{previewSubject}</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-muted">{previewBody}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {renderGroup(
        "Client-facing emails",
        "These go to your customers from your business brand.",
        clientTemplates
      )}
      {renderGroup(
        "Admin-facing emails",
        "These go to your team. Most admin alerts use a short in-app style notice.",
        adminTemplates
      )}
    </div>
  );
}
