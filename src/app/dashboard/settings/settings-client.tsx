"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar } from "@/components/ui/avatar";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Camera, Lock } from "lucide-react";
import type { Client, Profile } from "@/lib/types";

interface SettingsClientProps {
  profile: Profile;
  client: Client | null;
}

export function SettingsClient({ profile: initialProfile, client: initialClient }: SettingsClientProps) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [profile, setProfile] = useState(initialProfile);
  const [client, setClient] = useState(initialClient);
  const [fullName, setFullName] = useState(initialProfile.full_name || "");
  const [phone, setPhone] = useState(initialClient?.phone || "");
  const [company, setCompany] = useState(initialClient?.company || "");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ password: "", confirm: "" });

  async function saveProfile() {
    setSaving(true);
    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ full_name: fullName, phone, company }),
    });
    setSaving(false);
    if (res.ok) {
      setProfile((p) => ({ ...p, full_name: fullName }));
      if (client) setClient({ ...client, phone: phone || null, company: company || null });
      toast.success("Profile updated");
      router.refresh();
    } else {
      toast.error("Failed to save");
    }
  }

  async function uploadAvatar(file: File) {
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/profile/avatar", { method: "POST", credentials: "include", body: fd });
    setUploading(false);
    if (res.ok) {
      const { avatar_url } = await res.json();
      setProfile((p) => ({ ...p, avatar_url }));
      toast.success("Photo updated");
      router.refresh();
    } else {
      const data = await res.json();
      toast.error(data.error || "Upload failed");
    }
  }

  async function resetPassword() {
    if (passwordForm.password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (passwordForm.password !== passwordForm.confirm) {
      toast.error("Passwords do not match");
      return;
    }
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: passwordForm.password });
    if (error) {
      toast.error(error.message);
      return;
    }
    setPasswordForm({ password: "", confirm: "" });
    toast.success("Password updated");
  }

  return (
    <div className="min-h-screen bg-background">
      <Header
        variant="dashboard"
        userRole="client"
        userName={profile.full_name}
        userAvatar={profile.avatar_url}
      />
      <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6 lg:px-8">
        <h1 className="text-2xl font-bold text-primary mb-8">Account Settings</h1>

        <Card className="mb-6 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Profile Picture</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-6">
            <Avatar name={fullName || profile.email} src={profile.avatar_url} size="lg" />
            <div>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadAvatar(f);
                }}
              />
              <Button variant="outline" size="sm" disabled={uploading} onClick={() => fileRef.current?.click()}>
                <Camera className="h-4 w-4" />
                {uploading ? "Uploading..." : "Change Photo"}
              </Button>
              <p className="text-xs text-muted mt-2">JPG, PNG or WebP. Max 5MB.</p>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Profile Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Display Name</Label>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={profile.email} disabled className="bg-slate-50" />
              <p className="text-xs text-muted">Contact support to change your email address.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Company</Label>
                <Input value={company} onChange={(e) => setCompany(e.target.value)} />
              </div>
            </div>
            <Button variant="accent" onClick={saveProfile} disabled={saving}>
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Lock className="h-4 w-4" /> Reset Password
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>New Password</Label>
              <Input
                type="password"
                value={passwordForm.password}
                onChange={(e) => setPasswordForm({ ...passwordForm, password: e.target.value })}
                minLength={8}
              />
            </div>
            <div className="space-y-2">
              <Label>Confirm Password</Label>
              <Input
                type="password"
                value={passwordForm.confirm}
                onChange={(e) => setPasswordForm({ ...passwordForm, confirm: e.target.value })}
              />
            </div>
            <Button variant="outline" onClick={resetPassword}>Update Password</Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
