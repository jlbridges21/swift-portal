/** Shared messaging types safe for client components (no server imports). */

export interface ConversationListItem {
  client_id: string;
  client_name: string;
  client_email: string;
  company: string | null;
  last_message: string;
  last_message_at: string;
  last_sender_role: "admin" | "client";
  unread_count: number;
}

export interface CrmTimelineItem {
  id: string;
  kind: "message" | "activity";
  created_at: string;
  title: string;
  body: string | null;
  /** Small icon/emoji for compact activity rows */
  icon?: string | null;
  meta?: string | null;
  sender_role?: "admin" | "client";
  is_unread?: boolean;
  project_id?: string | null;
  project_name?: string | null;
}
