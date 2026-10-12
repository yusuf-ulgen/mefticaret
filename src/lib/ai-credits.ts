/** Mefticaret AI kredi sistemi — istemci ve sunucu tarafında paylaşılan sabitler. */

/** Kredi düşümünü ve model sınıfını belirleyen iş türü. */
export type AiCreditPurpose = "text" | "image" | "campaign" | "copilot";

export type AiModelClass = "fast" | "smart" | "image";

/** Hangi iş türü hangi OpenAI model sınıfına gider. */
export const PURPOSE_MODEL_CLASS: Record<AiCreditPurpose, AiModelClass> = {
  text: "fast",
  image: "image",
  campaign: "smart",
  copilot: "smart",
};

export const AI_PURPOSE_LABELS: Record<AiCreditPurpose, string> = {
  text: "Ürün açıklaması / SEO metni",
  image: "AI Stüdyo görseli",
  campaign: "E-posta / SMS kampanya taslağı",
  copilot: "Store CoPilot işlemi",
};

/** Varsayılan kredi bedelleri (süper admin panelinden değiştirilebilir). */
export const DEFAULT_CREDIT_COSTS: Record<AiCreditPurpose, number> = {
  text: 1,
  image: 2,
  campaign: 2,
  copilot: 2,
};

/** Görev anahtarına göre iş türü — stratejik görevler GPT-4o'ya yönlenir. */
const CAMPAIGN_TASKS = new Set(["campaign", "email", "sms", "instagram", "sales_analysis"]);

export function purposeForTask(taskKey: string): AiCreditPurpose {
  if (taskKey.startsWith("copilot")) return "copilot";
  if (taskKey.startsWith("image") || taskKey.startsWith("photo")) return "image";
  if (CAMPAIGN_TASKS.has(taskKey)) return "campaign";
  return "text";
}

export const INSUFFICIENT_CREDITS_CODE = "INSUFFICIENT_AI_CREDITS";

export function insufficientCreditsMessage(needed: number, balance: number): string {
  return `Yapay zekâ krediniz yetersiz. Bu işlem ${needed} kredi gerektiriyor, bakiyeniz ${balance} kredi. Kredi yükleyerek devam edebilirsiniz.`;
}
