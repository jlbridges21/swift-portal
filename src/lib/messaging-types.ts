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

/** Read state for admin-sent messages only (did the client open it). */
export interface MessageReadReceipt {
  /** Portal users who can read this client thread (excludes the admin sender). */
  recipient_count: number;
  /** How many of those recipients have a read row. */
  read_count: number;
  /** Earliest recipient read_at, if any. */
  first_read_at: string | null;
  /** Latest recipient read_at, if any. */
  last_read_at: string | null;
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
  /** Present on admin-sent messages when loaded for an admin viewer. */
  read_receipt?: MessageReadReceipt | null;
  message_id?: string;
}
