"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

/** PATCH one section of /api/staff/account with a saving flag and toasts. */
export function useSectionSave(section: string) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  async function save(body: Record<string, unknown>, success = "Saved"): Promise<Record<string, unknown> | null> {
    setSaving(true);
    try {
      const res = await fetch("/api/staff/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ section, ...body }),
      });
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) {
        toast.error(typeof data.error === "string" ? data.error : "Couldn't save. Please try again.");
        return null;
      }
      toast.success(success);
      router.refresh();
      return data;
    } catch {
      toast.error("Couldn't save. Check your connection and try again.");
      return null;
    } finally {
      setSaving(false);
    }
  }

  return { saving, save };
}
