export type UserRole = "admin" | "client";

export type NotificationType =
  | "proposal_submitted"
  | "proposal_approved"
  | "proposal_changes"
  | "schedule_change_requested"
  | "payment_received"
  | "revision_requested"
  | "shoot_proposed"
  | "quote_sent"
  | "status_changed"
  | "deliverables_uploaded"
  | "invoice_available"
  | "payment_confirmed";

export type ProjectStatus =
  | "new_request"
  | "quote_sent"
  | "proposal_approved"
  | "scheduled"
  | "shoot_complete_editing"
  | "ready_for_review"
  | "awaiting_payment"
  | "delivered";

export type PaymentStatus =
  | "draft"
  | "sent"
  | "pending"
  | "paid"
  | "failed"
  | "expired"
  | "cancelled";
export type MediaType = "photo" | "video" | "document";
export type MediaSource = "upload" | "youtube" | "kuula" | "external";
export type MediaVisibility = "client" | "admin" | "both";
export type ActivityVisibility = "admin" | "client" | "both";

export type PropertyType =
  | "Residential"
  | "Waterfront"
  | "Land"
  | "Commercial"
  | "Construction Site"
  | "Golf Course"
  | "Resort"
  | "Marina"
  | "HOA / Community"
  | "Roof / Inspection"
  | "Other";
export type RevisionStatus = "pending" | "in_progress" | "completed";

export type ActivityType =
  | "lead_created"
  | "proposal_submitted"
  | "account_created"
  | "project_created"
  | "status_updated"
  | "shoot_proposed"
  | "shoot_confirmed"
  | "shoot_rescheduled"
  | "shoot_completed"
  | "media_uploaded"
  | "photos_uploaded"
  | "videos_uploaded"
  | "tour_added"
  | "documents_uploaded"
  | "payment_requested"
  | "invoice_sent"
  | "payment_completed"
  | "payment_received"
  | "revision_requested"
  | "revision_completed"
  | "deliverables_approved"
  | "quote_sent"
  | "quote_approved"
  | "quote_changes_requested"
  | "asset_reviewed"
  | "sent_for_review"
  | "email_sent"
  | "email_delivered"
  | "email_opened"
  | "email_clicked"
  | "email_bounced"
  | "email_complained"
  | "preliminary_estimate_created"
  | "official_proposal_sent";

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: UserRole;
  client_id: string | null;
  push_notifications_enabled?: boolean;
  onesignal_subscription_id?: string | null;
  email_notifications_enabled?: boolean;
  in_app_notifications_enabled?: boolean;
  created_at: string;
  updated_at: string;
}

export interface Client {
  id: string;
  name: string;
  full_name?: string | null;
  email: string;
  phone: string | null;
  company: string | null;
  notes: string | null;
  user_id: string | null;
  referral_source?: string | null;
  last_login_at?: string | null;
  last_activity_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Property {
  id: string;
  client_id: string | null;
  address: string;
  normalized_address: string;
  city: string | null;
  state: string | null;
  zip: string | null;
  property_type: PropertyType;
  nickname: string | null;
  notes: string | null;
  latitude: number | null;
  longitude: number | null;
  created_at: string;
  updated_at: string;
}

export interface Lead {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
  property_address: string;
  service_requested: string;
  preferred_date: string | null;
  notes: string | null;
  is_read: boolean;
  project_id: string | null;
  created_at: string;
}

export interface Project {
  id: string;
  client_id: string;
  property_id?: string | null;
  property_address: string;
  project_name: string;
  service_type: string;
  shoot_date: string | null;
  delivery_date: string | null;
  status: ProjectStatus;
  notes: string | null;
  cover_image_url: string | null;
  cover_image_id: string | null;
  deliverables_approved_at: string | null;
  deliverables_approved_by: string | null;
  created_at: string;
  updated_at: string;
  clients?: Client;
  properties?: Property;
}

export interface MediaAsset {
  id: string;
  project_id: string;
  property_id?: string | null;
  client_id?: string | null;
  file_name: string;
  file_path: string;
  file_url?: string | null;
  storage_path?: string | null;
  file_size: number | null;
  mime_type: string;
  media_type: MediaType;
  display_order: number;
  media_source: MediaSource;
  title?: string | null;
  thumbnail_url?: string | null;
  downloadable?: boolean;
  visibility?: MediaVisibility;
  youtube_url: string | null;
  embed_url: string | null;
  created_at: string;
  updated_at?: string;
}

export interface Tour {
  id: string;
  project_id: string;
  tour_name: string;
  thumbnail_url: string | null;
  kuula_url: string;
  embed_code: string | null;
  display_order: number;
  notes: string | null;
  created_at: string;
}

export interface Payment {
  id: string;
  project_id: string;
  client_id: string;
  quote_id?: string | null;
  amount: number;
  description: string;
  due_date: string | null;
  status: PaymentStatus;
  stripe_payment_link_id: string | null;
  stripe_payment_link_url: string | null;
  payment_link_url?: string | null;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id?: string | null;
  stripe_invoice_id?: string | null;
  stripe_receipt_url: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
  projects?: Pick<Project, "project_name">;
}

export interface ProjectClient {
  id: string;
  project_id: string;
  client_id: string;
  is_primary: boolean;
  created_at: string;
  clients?: Client;
}

export type ShootProposalStatus = "pending" | "accepted" | "countered" | "confirmed" | "declined" | "superseded";

export interface ShootProposal {
  id: string;
  project_id: string;
  proposed_by: "admin" | "client";
  proposed_at: string;
  message: string | null;
  status: ShootProposalStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Revision {
  id: string;
  project_id: string;
  client_id: string;
  description: string;
  status: RevisionStatus;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface QuoteLineItem {
  description: string;
  amount_cents: number;
}

export type QuoteStatus = "draft" | "sent" | "approved" | "changes_requested";
export type QuoteKind = "preliminary" | "official";

export interface ProjectQuote {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  line_items: QuoteLineItem[];
  total_cents: number;
  notes: string | null;
  expires_at: string | null;
  status: QuoteStatus;
  quote_kind?: QuoteKind;
  sent_at: string | null;
  approved_at: string | null;
  changes_feedback: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type AssetReviewStatus = "pending" | "approved" | "rejected";

export interface AssetReview {
  id: string;
  project_id: string;
  asset_type: "photo" | "video" | "tour" | "document";
  asset_id: string;
  status: AssetReviewStatus;
  feedback: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  project_id: string | null;
  read_at: string | null;
  created_at: string;
}

export interface ActivityLog {
  id: string;
  activity_type: ActivityType;
  description: string;
  title?: string | null;
  user_id: string | null;
  project_id: string | null;
  client_id?: string | null;
  property_id?: string | null;
  lead_id: string | null;
  visibility?: ActivityVisibility;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface Communication {
  id: string;
  project_id: string | null;
  client_id: string | null;
  user_id: string | null;
  comm_type: string;
  direction: string;
  title: string | null;
  message: string | null;
  status: string;
  provider: string;
  provider_event_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

type TableDef<T> = {
  Row: T;
  Insert: Partial<T>;
  Update: Partial<T>;
  Relationships: [];
};

export interface Database {
  public: {
    Tables: {
      profiles: TableDef<Profile>;
      clients: TableDef<Client>;
      leads: TableDef<Lead>;
      projects: TableDef<Project>;
      media_assets: TableDef<MediaAsset>;
      tours: TableDef<Tour>;
      payments: TableDef<Payment>;
      revisions: TableDef<Revision>;
      activity_logs: TableDef<ActivityLog>;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      user_role: UserRole;
      project_status: ProjectStatus;
      payment_status: PaymentStatus;
      media_type: MediaType;
      activity_type: ActivityType;
      revision_status: RevisionStatus;
    };
    CompositeTypes: Record<string, never>;
  };
}
