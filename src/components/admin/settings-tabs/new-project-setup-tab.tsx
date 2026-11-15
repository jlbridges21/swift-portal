"use client";

import { Box, Clapperboard, CreditCard, FileText, Images, ReceiptText, Rotate3d, type LucideIcon } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import type { AppSettings } from "@/lib/app-settings";
import { DefaultDocumentsSettingsCard } from "@/components/admin/default-documents-settings-card";
import { SectionHeading, useSettingsTab } from "@/components/admin/settings-tabs/shared";

type MediaKey = keyof AppSettings["mediaSectionDefaults"];

const MEDIA_SECTIONS: { key: MediaKey; id: string; label: string; icon: LucideIcon }[] = [
  { key: "photos", id: "mediaDefaultPhotos", label: "Photo gallery", icon: Images },
  { key: "videos", id: "mediaDefaultVideos", label: "Video", icon: Clapperboard },
  { key: "tours", id: "mediaDefaultTours", label: "360° tours", icon: Rotate3d },
  { key: "models", id: "mediaDefaultModels", label: "3D models", icon: Box },
  { key: "documents", id: "mediaDefaultDocuments", label: "Documents", icon: FileText },
  { key: "estimates", id: "mediaDefaultEstimates", label: "Estimates & proposals", icon: ReceiptText },
  { key: "payments", id: "mediaDefaultPayments", label: "Payments", icon: CreditCard },
];

export function NewProjectSetupTab() {
  const { settings, patchMediaSectionDefaults } = useSettingsTab();
  return (
    <div id="settings-new-project-setup" tabIndex={-1} className="scroll-mt-24 space-y-4">
      <SectionHeading id="new_project_setup">New project setup</SectionHeading>
      <p className="mt-1 mb-4 text-sm text-muted">Defaults for new projects. Existing projects keep their own settings.</p>

      <section
        id="settings-media-section-defaults"
        className="scroll-mt-24 rounded-2xl border border-border bg-card p-5 sm:p-6"
        aria-labelledby="settings-media-section-defaults-title"
      >
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
          <h3 id="settings-media-section-defaults-title" className="text-base font-semibold text-heading">
            What clients see on a new project
          </h3>
          <p className="text-[13px] text-muted">You can change it per project anytime</p>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {MEDIA_SECTIONS.map(({ key, id, label, icon: Icon }) => {
            const on = settings.mediaSectionDefaults[key];
            return (
              <label
                key={key}
                htmlFor={id}
                className={cn(
                  "flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border border-border px-3.5 py-3 transition-colors",
                  on ? "bg-card hover:bg-subtle" : "bg-subtle/60 hover:bg-subtle"
                )}
              >
                <span
                  className={cn(
                    "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                    on ? "bg-accent-subtle text-accent" : "bg-subtle text-muted"
                  )}
                >
                  <Icon className="h-[18px] w-[18px]" aria-hidden />
                </span>
                <span className={cn("min-w-0 flex-1 truncate text-sm font-semibold", on ? "text-heading" : "text-muted")}>
                  {label}
                </span>
                <Switch
                  id={id}
                  checked={on}
                  onCheckedChange={(v) => patchMediaSectionDefaults({ [key]: v })}
                  aria-label={`${label} visible to clients by default`}
                />
              </label>
            );
          })}
        </div>
      </section>

      <DefaultDocumentsSettingsCard />
    </div>
  );
}
