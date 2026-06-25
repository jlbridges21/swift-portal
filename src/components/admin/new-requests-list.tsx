"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDate } from "@/lib/utils";
import { ExternalLink, Inbox, ArrowRight } from "lucide-react";

interface NewRequestProject {
  id: string;
  project_name: string;
  property_address: string;
  service_type: string;
  created_at: string;
  clients: { name: string; company: string | null; email: string } | null;
}

interface NewRequestsListProps {
  projects: NewRequestProject[];
}

export function NewRequestsList({ projects }: NewRequestsListProps) {
  if (!projects.length) {
    return (
      <EmptyState
        icon={Inbox}
        title="No new requests"
        description="Incoming project requests will appear here. Clients can submit via the public request form or their portal."
      >
        <Link href="/admin/projects">
          <Button variant="outline">View All Projects</Button>
        </Link>
      </EmptyState>
    );
  }

  return (
    <div className="space-y-3">
      {projects.map((project) => (
        <Card key={`new-request-${project.id}`} className="shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-semibold text-primary">{project.project_name}</h3>
                <StatusBadge status="new_request" />
              </div>
              <p className="mt-1 text-sm text-muted line-clamp-1">{project.property_address}</p>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                {project.clients && (
                  <span>
                    {project.clients.name}
                    {project.clients.company ? ` · ${project.clients.company}` : ""}
                  </span>
                )}
                <span>{project.service_type}</span>
                <span>Submitted {formatDate(project.created_at)}</span>
              </div>
            </div>
            <div className="flex shrink-0 gap-2">
              <Link href={`/admin/projects/${project.id}`}>
                <Button variant="accent" size="sm">
                  Review <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href={`/admin/projects/${project.id}`} target="_blank">
                <Button variant="outline" size="sm">
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
