/** AI Anahtar Kelime Üreticisi — istemci ve sunucuda paylaşılan tipler. */

export const KEYWORD_MARKETS = {
  google: "Google SEO",
  trendyol: "Trendyol",
  hepsiburada: "Hepsiburada",
  amazon: "Amazon",
} as const;

export type KeywordMarket = keyof typeof KEYWORD_MARKETS;

export type KeywordIntent = "informational" | "commercial" | "transactional";

export const INTENT_LABELS: Record<KeywordIntent, string> = {
  informational: "Bilgi",
  commercial: "Ticari araştırma",
  transactional: "Satın alma",
};

export type KeywordResult = {
  primary: string[];
  longTail: string[];
  lsi: string[];
  intents: { keyword: string; intent: KeywordIntent }[];
  negative: string[];
  visualAttributes: { color: string[]; fabric: string[]; style: string[] };
  metaTitle: string;
  metaDescription: string;
};
