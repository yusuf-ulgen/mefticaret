/** Destek talebi (ticket) sabitleri: durum, öncelik, departman, kanal ve yazar rolleri. */

export const SUPPORT_STATUSES = ["open", "pending", "answered", "resolved", "closed"] as const;
export type SupportStatus = (typeof SUPPORT_STATUSES)[number];

export const SUPPORT_STATUS_LABELS: Record<SupportStatus, string> = {
  open: "Açık",
  pending: "Beklemede",
  answered: "Yanıtlandı",
  resolved: "Çözüldü",
  closed: "Kapatıldı",
};

/** Mağaza tarafının atayabileceği durumlar; diğerleri platform yöneticisine aittir. */
export const STORE_ASSIGNABLE_STATUSES = ["open", "pending", "closed"] as const;

export const SUPPORT_PRIORITIES = ["low", "normal", "high", "urgent"] as const;
export type SupportPriority = (typeof SUPPORT_PRIORITIES)[number];

export const SUPPORT_PRIORITY_LABELS: Record<SupportPriority, string> = {
  low: "Düşük",
  normal: "Normal",
  high: "Yüksek",
  urgent: "Acil",
};

export const SUPPORT_CATEGORIES = [
  "billing",
  "technical",
  "account",
  "store",
  "marketplace",
  "api",
  "other",
] as const;
export type SupportCategory = (typeof SUPPORT_CATEGORIES)[number];

export const SUPPORT_CATEGORY_LABELS: Record<SupportCategory, string> = {
  billing: "Faturalama",
  technical: "Teknik",
  account: "Hesap",
  store: "Mağaza",
  marketplace: "Pazaryeri",
  api: "API",
  other: "Diğer",
};

/** Kanal: `ticket` bugün aktif, `chat` canlı destek için ayrılmıştır. */
export const SUPPORT_CHANNELS = ["ticket", "chat", "email"] as const;
export type SupportChannel = (typeof SUPPORT_CHANNELS)[number];

export const SUPPORT_CHANNEL_LABELS: Record<SupportChannel, string> = {
  ticket: "Ticket",
  chat: "Canlı Destek",
  email: "E-posta",
};

export const SUPPORT_AUTHOR_ROLES = ["customer", "store", "platform", "system"] as const;
export type SupportAuthorRole = (typeof SUPPORT_AUTHOR_ROLES)[number];

export const SUPPORT_AUTHOR_ROLE_LABELS: Record<SupportAuthorRole, string> = {
  customer: "Müşteri",
  store: "Mağaza",
  platform: "Destek Ekibi",
  system: "Sistem",
};

export const SUPPORT_ATTACHMENT_BUCKET = "support-attachments";
export const SUPPORT_MAX_FILE_BYTES = 20 * 1024 * 1024;

export const SUPPORT_ALLOWED_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
  "text/plain",
  "text/csv",
  "application/zip",
  "video/mp4",
];

export type SupportAttachment = {
  path: string;
  name: string;
  size: number;
  mimeType: string;
};

export type SupportTicketRow = {
  id: string;
  store_id: string | null;
  subject: string;
  department: string;
  category: SupportCategory;
  priority: SupportPriority;
  status: SupportStatus;
  channel: SupportChannel;
  requester_id: string | null;
  requester_email: string | null;
  assigned_to: string | null;
  attachments: SupportAttachment[];
  first_response_at: string | null;
  last_reply_at: string | null;
  resolved_at: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type SupportMessageRow = {
  id: string;
  ticket_id: string;
  author_id: string | null;
  author_name: string | null;
  author_role: SupportAuthorRole;
  body: string;
  is_internal: boolean;
  attachments: SupportAttachment[];
  read_at: string | null;
  created_at: string;
};
