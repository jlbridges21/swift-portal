"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { StickySaveBar } from "@/components/ui/sticky-save-bar";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PROJECT_STATUSES, SERVICE_TYPES } from "@/lib/constants";

interface Client {
  id: string;
  name: string;
  company: string | null;
}

export default function NewProjectPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [clients, setClients] = useState<Client[]>([]);

  useEffect(() => {
    fetch("/api/clients")
      .then((res) => res.json())
      .then(setClients);
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries());

    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Failed to create project");
      }

      const project = await res.json();
      router.push(`/admin/projects/${project.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Header variant="dashboard" userRole="admin" />
      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8 pb-6 md:pb-24">
        <Card>
          <CardHeader>
            <CardTitle>Create Project</CardTitle>
            <p className="text-sm text-muted">
              Project name is generated automatically from the client, address, and service.
            </p>
          </CardHeader>
          <CardContent>
            <form id="new-project-form" onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="client_id">Client *</Label>
                <Select
                  id="client_id"
                  name="client_id"
                  required
                  placeholder="Select a client"
                  options={clients.map((c) => ({
                    value: c.id,
                    label: c.company ? `${c.name} (${c.company})` : c.name,
                  }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="street_address">Street Address *</Label>
                <Input id="street_address" name="street_address" required placeholder="123 Main St" />
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="city">City *</Label>
                  <Input id="city" name="city" required placeholder="Annapolis" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="zip">ZIP *</Label>
                  <Input id="zip" name="zip" required placeholder="21401" inputMode="numeric" />
                </div>
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="service_type">Service Type *</Label>
                  <Select
                    id="service_type"
                    name="service_type"
                    required
                    placeholder="Select service"
                    options={SERVICE_TYPES.map((s) => ({ value: s, label: s }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select
                    id="status"
                    name="status"
                    options={PROJECT_STATUSES.map((s) => ({ value: s.value, label: s.label }))}
                  />
                </div>
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="shoot_date">Shoot Date</Label>
                  <Input id="shoot_date" name="shoot_date" type="date" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="delivery_date">Delivery Date</Label>
                  <Input id="delivery_date" name="delivery_date" type="date" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea id="notes" name="notes" rows={3} />
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}
            </form>
          </CardContent>
        </Card>
      </main>
      <StickySaveBar
        onSave={() => (document.getElementById("new-project-form") as HTMLFormElement)?.requestSubmit()}
        saving={loading}
        label="Create Project"
      />
    </div>
  );
}
