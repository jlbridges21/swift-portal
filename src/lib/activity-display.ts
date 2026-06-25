export interface ActivityConfig {
  icon: string;
  label: string;
}

export const ACTIVITY_CONFIG: Record<string, ActivityConfig> = {
  proposal_submitted: { icon: "✅", label: "Proposal submitted" },
  lead_created: { icon: "✅", label: "Proposal submitted" },
  account_created: { icon: "👤", label: "Client account created" },
  project_created: { icon: "📁", label: "Project created" },
  shoot_proposed: { icon: "📅", label: "Shoot proposed" },
  shoot_confirmed: { icon: "✅", label: "Shoot confirmed" },
  shoot_rescheduled: { icon: "📍", label: "Shoot rescheduled" },
  shoot_declined: { icon: "✖️", label: "Shoot time declined" },
  shoot_withdrawn: { icon: "↩️", label: "Shoot proposal withdrawn" },
  status_updated: { icon: "🔄", label: "Status updated" },
  shoot_completed: { icon: "🚁", label: "Shoot completed" },
  photos_uploaded: { icon: "📸", label: "Photos uploaded" },
  videos_uploaded: { icon: "🎥", label: "Videos uploaded" },
  tour_added: { icon: "🌐", label: "360° tour added" },
  documents_uploaded: { icon: "📄", label: "Documents uploaded" },
  media_uploaded: { icon: "📎", label: "Media uploaded" },
  invoice_sent: { icon: "💳", label: "Invoice sent" },
  payment_requested: { icon: "💳", label: "Invoice sent" },
  payment_received: { icon: "💰", label: "Payment received" },
  payment_completed: { icon: "💰", label: "Payment received" },
  revision_requested: { icon: "✏️", label: "Revision requested" },
  revision_completed: { icon: "🔄", label: "Revision completed" },
  deliverables_approved: { icon: "✅", label: "Deliverables approved" },
  quote_sent: { icon: "💼", label: "Quote sent" },
  quote_approved: { icon: "✅", label: "Proposal approved" },
  quote_changes_requested: { icon: "✏️", label: "Proposal changes requested" },
  asset_reviewed: { icon: "📋", label: "Asset reviewed" },
  sent_for_review: { icon: "👀", label: "Sent for review" },
};

export function getActivityDisplay(type: string, description: string) {
  const config = ACTIVITY_CONFIG[type];
  return {
    icon: config?.icon ?? "•",
    description: description || config?.label || type,
  };
}
