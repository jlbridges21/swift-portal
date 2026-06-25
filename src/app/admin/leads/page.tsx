import Link from "next/link";
import { Header } from "@/components/layout/header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { formatDate } from "@/lib/utils";
import { Mail, Phone, Building, MapPin } from "lucide-react";
import { MarkLeadReadButton } from "@/components/admin/mark-lead-read";

export default async function AdminLeadsPage() {
  const profile = await getProfile();
  if (!profile || profile.role !== "admin") redirect("/dashboard");

  const supabase = await createClient();
  const { data: leads } = await supabase
    .from("leads")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div className="min-h-screen bg-background">
      <Header variant="dashboard" userRole="admin" />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-primary">Leads</h1>
            <p className="text-muted">{leads?.length ?? 0} total leads</p>
          </div>
        </div>

        <div className="space-y-4">
          {leads?.map((lead) => (
            <Card key={lead.id} className={!lead.is_read ? "border-accent/30 bg-accent/5" : ""}>
              <CardContent className="p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <h3 className="font-semibold text-primary">{lead.name}</h3>
                      {!lead.is_read && <Badge variant="warning">New</Badge>}
                      <Badge>{lead.service_requested}</Badge>
                    </div>
                    <div className="grid gap-2 text-sm text-muted sm:grid-cols-2">
                      <span className="flex items-center gap-2">
                        <Mail className="h-4 w-4" /> {lead.email}
                      </span>
                      {lead.phone && (
                        <span className="flex items-center gap-2">
                          <Phone className="h-4 w-4" /> {lead.phone}
                        </span>
                      )}
                      {lead.company && (
                        <span className="flex items-center gap-2">
                          <Building className="h-4 w-4" /> {lead.company}
                        </span>
                      )}
                      <span className="flex items-center gap-2">
                        <MapPin className="h-4 w-4" /> {lead.property_address}
                      </span>
                    </div>
                    {lead.notes && (
                      <p className="text-sm text-muted border-l-2 border-border pl-3">{lead.notes}</p>
                    )}
                    <p className="text-xs text-muted">
                      Submitted {formatDate(lead.created_at)}
                      {lead.preferred_date && ` · Preferred: ${formatDate(lead.preferred_date)}`}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {!lead.is_read && <MarkLeadReadButton leadId={lead.id} />}
                    <Link href={`/admin/clients/new?lead=${lead.id}`}>
                      <Button variant="accent" size="sm">Create Client</Button>
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {(!leads || leads.length === 0) && (
            <Card>
              <CardContent className="py-12 text-center text-muted">
                No leads yet. They&apos;ll appear here when someone submits a request.
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
