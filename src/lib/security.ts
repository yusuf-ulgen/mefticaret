/** Güvenlik ve KVKK/GDPR ortak sabitleri (istemci ve sunucu tarafından kullanılır). */

export const CONSENT_TYPES = [
  "cookies_necessary",
  "cookies_analytics",
  "cookies_marketing",
  "marketing_email",
  "marketing_sms",
  "privacy_policy",
  "terms",
] as const;
export type ConsentType = (typeof CONSENT_TYPES)[number];

export const CONSENT_TYPE_LABELS: Record<ConsentType, string> = {
  cookies_necessary: "Zorunlu çerezler",
  cookies_analytics: "Analitik çerezler",
  cookies_marketing: "Pazarlama çerezleri",
  marketing_email: "E-posta pazarlama izni",
  marketing_sms: "SMS pazarlama izni",
  privacy_policy: "Gizlilik politikası onayı",
  terms: "Kullanım şartları onayı",
};

export const DSR_KINDS = ["export", "delete", "access", "rectify"] as const;
export type DsrKind = (typeof DSR_KINDS)[number];

export const DSR_KIND_LABELS: Record<DsrKind, string> = {
  export: "Veri dışa aktarma",
  delete: "Hesap / veri silme",
  access: "Veriye erişim",
  rectify: "Veri düzeltme",
};

export const DSR_STATUSES = ["pending", "in_progress", "completed", "rejected"] as const;
export type DsrStatus = (typeof DSR_STATUSES)[number];

export const DSR_STATUS_LABELS: Record<DsrStatus, string> = {
  pending: "Beklemede",
  in_progress: "İşleniyor",
  completed: "Tamamlandı",
  rejected: "Reddedildi",
};

export const LEGAL_BASES = [
  "consent",
  "contract",
  "legal_obligation",
  "legitimate_interest",
  "vital_interest",
  "public_task",
] as const;
export type LegalBasis = (typeof LEGAL_BASES)[number];

export const LEGAL_BASIS_LABELS: Record<LegalBasis, string> = {
  consent: "Açık rıza",
  contract: "Sözleşmenin ifası",
  legal_obligation: "Hukuki yükümlülük",
  legitimate_interest: "Meşru menfaat",
  vital_interest: "Hayati menfaat",
  public_task: "Kamu görevi",
};

/** Tarayıcıda saklanan çerez onayı (banner tekrar gösterilmesin diye). */
export const CONSENT_STORAGE_PREFIX = "mefti:consent:";
export const CONSENT_POLICY_VERSION = "v1";

export type CookiePreferences = {
  analytics: boolean;
  marketing: boolean;
  decidedAt: string;
  version: string;
};

export function readCookiePreferences(slug: string): CookiePreferences | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(`${CONSENT_STORAGE_PREFIX}${slug}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CookiePreferences;
    if (parsed.version !== CONSENT_POLICY_VERSION) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeCookiePreferences(slug: string, prefs: Omit<CookiePreferences, "version">) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      `${CONSENT_STORAGE_PREFIX}${slug}`,
      JSON.stringify({ ...prefs, version: CONSENT_POLICY_VERSION }),
    );
  } catch {
    /* depolama kapalıysa sessizce yoksay */
  }
}
