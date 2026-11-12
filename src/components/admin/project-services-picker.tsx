"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ServiceMultiSelect, type ServiceOption } from "@/components/forms/service-multi-select";

const SAVE_DELAY_MS = 900;

/**
 * A project's services, editable in place (Classic and New interface).
 * Saves through PUT /api/projects/[id]/services a moment after the last change.
 * Only the project's service links change: the name and any estimate or
 * proposal stay exactly as they are.
 */
export function ProjectServicesPicker({
  projectId,
  catalog,
  initialIds,
  disabled,
  onSaved,
  id = "project-services",
  className,
  compact,
}: {
  projectId: string;
  /** Every business service; inactive ones show only while still linked. */
  catalog: ServiceOption[];
  initialIds: string[];
  disabled?: boolean;
  onSaved?: (result: { serviceType: string; names: string[] }) => void;
  id?: string;
  className?: string;
  /** One fixed-height line instead of a chip per service (New interface). */
  compact?: boolean;
}) {
  const [ids, setIds] = useState(initialIds);
  const saved = useRef(initialIds);
  const timer = useRef<number | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current);
  }, []);

  async function save(next: string[]) {
    if (next.join("|") === saved.current.join("|")) return;
    if (!next.length) {
      toast.error("A project needs at least one service.");
      setIds(saved.current);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/services`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ service_ids: next }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        project?: { service_type?: string };
        service_names?: string[];
      };
      if (!res.ok) {
        toast.error(data.error || "Couldn't update the services.");
        setIds(saved.current);
        return;
      }
      saved.current = next;
      toast.success("Services updated. The estimate was not changed.");
      onSaved?.({ serviceType: data.project?.service_type ?? "", names: data.service_names ?? [] });
    } finally {
      setSaving(false);
    }
  }

  return (
    <ServiceMultiSelect
      id={id}
      name="project_services_display"
      options={catalog}
      value={ids}
      disabled={disabled}
      className={className}
      display={compact ? "compact" : "chips"}
      placeholder="Choose services…"
      onChange={(next) => {
        setIds(next);
        if (timer.current) window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => void save(next), SAVE_DELAY_MS);
      }}
    />
  );
}
