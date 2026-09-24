"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import type { Profile } from "@/lib/types";

/**
 * Staff personal notification channel prefs (email + in-app).
 * Business event routing stays in admin Settings → Notifications.
 */
export function StaffNotificationPrefs({ profile }: { profile: Profile }) {
  const router = useRouter();
  const [emailOn, setEmailOn] = useState(profile.email_notifications_enabled !== false);
  const [inAppOn, setInAppOn] = useState(profile.in_app_notifications_enabled !== false);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email_notifications_enabled: emailOn,
          in_app_notifications_enabled: inAppOn,
        }),
      });
      if (!res.ok) {
        toast.error("Could not save notification preferences");
        return;
      }
      toast.success("Notification preferences saved");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Bell className="h-4 w-4" />
          Notification preferences
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-slate-600">
          Control how you hear about projects you&apos;re assigned to. Billing and subscription
          alerts stay with the studio owner.
        </p>
        <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2">
          <div>
            <Label className="text-sm font-medium text-slate-900">Email notifications</Label>
            <p className="text-xs text-slate-500">Project updates sent to {profile.email}</p>
          </div>
          <input
            type="checkbox"
            className="h-4 w-4"
            checked={emailOn}
            onChange={(e) => setEmailOn(e.target.checked)}
          />
        </label>
        <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2">
          <div>
            <Label className="text-sm font-medium text-slate-900">In-app notifications</Label>
            <p className="text-xs text-slate-500">Bell alerts while you&apos;re signed in</p>
          </div>
          <input
            type="checkbox"
            className="h-4 w-4"
            checked={inAppOn}
            onChange={(e) => setInAppOn(e.target.checked)}
          />
        </label>
        <Button type="button" disabled={saving} onClick={() => void save()}>
          {saving ? "Saving…" : "Save preferences"}
        </Button>
      </CardContent>
    </Card>
  );
}
