"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { SERVICE_TYPES } from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";
import { CheckCircle, Lock, LogIn } from "lucide-react";

export default function RequestPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [accountExists, setAccountExists] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setAccountExists(false);

    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries());

    if (data.password !== data.confirm_password) {
      setError("Passwords do not match.");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const body = await res.json();

      if (res.status === 409) {
        setAccountExists(true);
        setError(body.message);
        setLoading(false);
        return;
      }

      if (!res.ok) {
        throw new Error(body.error || "Failed to submit request");
      }

      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: data.email as string,
        password: data.password as string,
      });

      if (signInError) {
        router.push("/login?message=Account created. Please sign in.");
        return;
      }

      router.push(`/dashboard/projects/${body.projectId}?welcome=1`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1 px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl">
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold tracking-tight text-primary">Request a Shoot</h1>
            <p className="mt-2 text-muted">
              Submit your project details and create your client portal account in one step.
            </p>
          </div>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Project Request</CardTitle>
              <CardDescription>
                Your project will appear in your portal immediately after submission.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <section className="space-y-4">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">Contact</h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="name">Full Name *</Label>
                      <Input id="name" name="name" required placeholder="John Smith" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email *</Label>
                      <Input id="email" name="email" type="email" required placeholder="john@example.com" />
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone</Label>
                      <Input id="phone" name="phone" type="tel" placeholder="(555) 123-4567" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="company">Company</Label>
                      <Input id="company" name="company" placeholder="Brokerage or company" />
                    </div>
                  </div>
                </section>

                <section className="space-y-4">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">Project</h3>
                  <div className="space-y-2">
                    <Label htmlFor="property_address">Property Address *</Label>
                    <Input id="property_address" name="property_address" required placeholder="123 Main St, City, State" />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="service_requested">Service Requested *</Label>
                      <Select
                        id="service_requested"
                        name="service_requested"
                        required
                        placeholder="Select a service"
                        options={SERVICE_TYPES.map((s) => ({ value: s, label: s }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="preferred_date">Preferred Date</Label>
                      <Input id="preferred_date" name="preferred_date" type="date" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="notes">Project Notes</Label>
                    <Textarea id="notes" name="notes" placeholder="Tell us about the property, deliverables, or special requirements..." rows={4} />
                  </div>
                </section>

                <section className="space-y-4 rounded-lg border border-border bg-slate-50 p-4">
                  <div className="flex items-center gap-2">
                    <Lock className="h-4 w-4 text-accent" />
                    <h3 className="text-sm font-semibold text-primary">Portal Account</h3>
                  </div>
                  <p className="text-xs text-muted">
                    Create a password to access your project status, media, and invoices.
                  </p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="password">Password *</Label>
                      <Input id="password" name="password" type="password" required minLength={8} placeholder="Min. 8 characters" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirm_password">Confirm Password *</Label>
                      <Input id="confirm_password" name="confirm_password" type="password" required minLength={8} />
                    </div>
                  </div>
                </section>

                {error && (
                  <div className={`rounded-lg p-4 text-sm ${accountExists ? "bg-amber-50 text-amber-800" : "bg-red-50 text-red-700"}`}>
                    {error}
                    {accountExists && (
                      <Link href="/login" className="mt-3 inline-flex">
                        <Button variant="accent" size="sm">
                          <LogIn className="h-4 w-4" />
                          Log In to Your Portal
                        </Button>
                      </Link>
                    )}
                  </div>
                )}

                <Button type="submit" variant="accent" size="lg" className="w-full" disabled={loading}>
                  {loading ? "Creating your portal..." : "Submit Request & Create Account"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
}
