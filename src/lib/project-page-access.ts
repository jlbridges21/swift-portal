import type { Project } from "@/lib/types";
import type { ProjectAccessKind } from "@/lib/project-access";

/** Payments, quotes, estimates, proposals — assigned client + business admin only. */
export function canViewProjectFinancials(accessKind: ProjectAccessKind): boolean {
  return accessKind === "admin" || accessKind === "assigned_client";
}

/** Fields safe for shared-by-email and anonymous link viewers in HTML/RSC payload. */
export function sanitizeProjectForMediaViewer(project: Project): Project {
  return {
    id: project.id,
    business_id: project.business_id,
    client_id: project.client_id,
    property_id: project.property_id,
    property_address: project.property_address,
    project_name: project.project_name,
    service_type: project.service_type,
    shoot_date: project.shoot_date,
    delivery_date: project.delivery_date,
    status: project.status,
    cover_image_url: project.cover_image_url,
    cover_image_id: project.cover_image_id,
    created_at: project.created_at,
    updated_at: project.updated_at,
    notes: null,
    deliverables_approved_at: null,
    deliverables_approved_by: null,
    ghl_sync_status: null,
    ghl_last_sync_attempt_at: null,
    ghl_webhook_status_code: null,
    ghl_webhook_response_body: null,
    deleted_at: null,
    deleted_by: null,
    link_access_mode: project.link_access_mode,
    link_access_token: null,
    link_access_enabled_at: null,
    link_access_enabled_by: null,
    link_access_view_count: project.link_access_view_count,
  };
}
