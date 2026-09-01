import type { Database } from "@/integrations/supabase/types";

export type JobKind = Database["public"]["Enums"]["job_kind"];
export type JobStatus = Database["public"]["Enums"]["job_status"];

export const JOB_KIND_LABELS: Record<JobKind, string> = {
  email: "E-posta",
  sms: "SMS",
  whatsapp: "WhatsApp",
  image: "Görsel işleme",
  feed_sync: "XML/CSV senkronizasyonu",
  marketplace_sync: "Pazaryeri senkronizasyonu",
  webhook: "Webhook",
  analytics: "Analitik",
  ai: "AI",
  sitemap: "Sitemap",
  invoice: "Fatura",
};

export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  queued: "Kuyrukta",
  running: "Çalışıyor",
  succeeded: "Tamamlandı",
  failed: "Başarısız",
  cancelled: "İptal edildi",
};

export const JOB_KINDS = Object.keys(JOB_KIND_LABELS) as [JobKind, ...JobKind[]];
export const JOB_STATUSES = Object.keys(JOB_STATUS_LABELS) as [JobStatus, ...JobStatus[]];

export type QueueJob = Database["public"]["Tables"]["job_queue"]["Row"];
