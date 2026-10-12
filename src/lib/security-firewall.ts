/** Güvenlik duvarı ortak sabitleri ve etiketleri (izomorfik, veritabanı bağımsız). */

export const ATTACK_TYPES = [
  "sql_injection",
  "xss",
  "csrf",
  "brute_force",
  "ddos",
  "path_traversal",
  "rfi",
  "lfi",
  "rate_limit",
  "bot",
  "fraud",
  "country_block",
  "ip_block",
  "header_anomaly",
  "payload_size",
] as const;
export type AttackType = (typeof ATTACK_TYPES)[number];

export const ATTACK_TYPE_LABELS: Record<AttackType, string> = {
  sql_injection: "SQL enjeksiyonu",
  xss: "XSS (betik enjeksiyonu)",
  csrf: "CSRF",
  brute_force: "Kaba kuvvet (şifre denemesi)",
  ddos: "DDoS",
  path_traversal: "Dizin gezinme",
  rfi: "Uzak dosya çağırma",
  lfi: "Yerel dosya çağırma",
  rate_limit: "Hız limiti aşımı",
  bot: "Bot / tarayıcı aracı",
  fraud: "Dolandırıcılık şüphesi",
  country_block: "Engelli ülke",
  ip_block: "Engelli IP",
  header_anomaly: "Başlık anomalisi",
  payload_size: "Aşırı büyük istek",
};

export const SEVERITIES = ["low", "medium", "high", "critical"] as const;
export type Severity = (typeof SEVERITIES)[number];
export const SEVERITY_LABELS: Record<Severity, string> = {
  low: "Düşük",
  medium: "Orta",
  high: "Yüksek",
  critical: "Kritik",
};

export const SEC_ACTIONS = ["log", "block", "captcha", "alert", "throttle"] as const;
export type SecAction = (typeof SEC_ACTIONS)[number];
export const SEC_ACTION_LABELS: Record<SecAction, string> = {
  log: "Kaydedildi",
  block: "Engellendi",
  captcha: "Doğrulama istendi",
  alert: "Uyarı gönderildi",
  throttle: "Yavaşlatıldı",
};

export const IP_RULE_TYPES = ["whitelist", "blacklist", "rate_limit"] as const;
export type IpRuleType = (typeof IP_RULE_TYPES)[number];
export const IP_RULE_LABELS: Record<IpRuleType, string> = {
  whitelist: "İzin listesi",
  blacklist: "Kara liste",
  rate_limit: "Hız limiti",
};

export const FRAUD_ACTIONS = [
  "auto_approve",
  "manual_review",
  "sms_verify",
  "auto_reject",
  "notify_seller",
] as const;
export type FraudAction = (typeof FRAUD_ACTIONS)[number];
export const FRAUD_ACTION_LABELS: Record<FraudAction, string> = {
  auto_approve: "Otomatik onay",
  manual_review: "Manuel inceleme",
  sms_verify: "SMS doğrulama",
  auto_reject: "Otomatik ret",
  notify_seller: "Satıcıya bildir",
};

/** Risk skorundan otomatik aksiyon. 0-30 onay, 31-60 inceleme, 61-80 SMS, 81+ ret. */
export function fraudActionForScore(score: number): FraudAction {
  if (score > 80) return "auto_reject";
  if (score > 60) return "sms_verify";
  if (score > 30) return "manual_review";
  return "auto_approve";
}

export const WAF_MODES = ["passive", "active", "aggressive"] as const;
export type WafMode = (typeof WAF_MODES)[number];
export const WAF_MODE_LABELS: Record<WafMode, string> = {
  passive: "Pasif (yalnız kaydet)",
  active: "Aktif (engelle)",
  aggressive: "Agresif (düşük eşik)",
};

/** Parola politikası kontrolü; sonuç kullanıcıya gösterilecek Türkçe hatalardır. */
export function validatePassword(
  password: string,
  policy: {
    minLength?: number;
    requireUpper?: boolean;
    requireDigit?: boolean;
    requireSymbol?: boolean;
  } = {},
): string[] {
  const min = policy.minLength ?? 8;
  const errors: string[] = [];
  if (password.length < min) errors.push(`Şifre en az ${min} karakter olmalı.`);
  if ((policy.requireUpper ?? true) && !/[A-ZÇĞİÖŞÜ]/.test(password))
    errors.push("En az bir büyük harf gerekli.");
  if (!/[a-zçğıöşü]/.test(password)) errors.push("En az bir küçük harf gerekli.");
  if ((policy.requireDigit ?? true) && !/\d/.test(password)) errors.push("En az bir rakam gerekli.");
  if (policy.requireSymbol && !/[^\w\s]/.test(password))
    errors.push("En az bir özel karakter gerekli.");
  if (COMMON_PASSWORDS.has(password.toLowerCase()))
    errors.push("Bu şifre çok yaygın, daha özgün bir şifre seçin.");
  return errors;
}

/** Sık kullanılan şifrelerin kısa listesi (tam liste sunucuda genişletilir). */
export const COMMON_PASSWORDS = new Set([
  "123456",
  "12345678",
  "123456789",
  "1234567890",
  "password",
  "password1",
  "qwerty",
  "qwerty123",
  "111111",
  "123123",
  "abc123",
  "iloveyou",
  "admin",
  "admin123",
  "letmein",
  "welcome",
  "monkey",
  "dragon",
  "sunshine",
  "princess",
  "football",
  "master",
  "trustno1",
  "şifre123",
  "sifre123",
  "parola",
  "parola123",
  "galatasaray",
  "fenerbahce",
  "besiktas",
  "trabzonspor",
  "turkiye",
  "istanbul",
  "ankara",
  "deneme123",
  "mefticaret",
]);

/** Geçici (atılabilir) e-posta alan adları. */
export const DISPOSABLE_EMAIL_DOMAINS = new Set([
  "mailinator.com",
  "guerrillamail.com",
  "10minutemail.com",
  "tempmail.com",
  "temp-mail.org",
  "yopmail.com",
  "trashmail.com",
  "sharklasers.com",
  "getnada.com",
  "dispostable.com",
  "maildrop.cc",
  "throwawaymail.com",
  "fakeinbox.com",
  "mailnesia.com",
  "mohmal.com",
]);

export function isDisposableEmail(email: string) {
  const domain = email.split("@")[1]?.toLowerCase().trim();
  return !!domain && DISPOSABLE_EMAIL_DOMAINS.has(domain);
}

/** Türkiye cep telefonu biçimi kontrolü (5xx xxx xx xx). */
export function isValidTrPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  const local = digits.startsWith("90") ? digits.slice(2) : digits.replace(/^0/, "");
  return /^5\d{9}$/.test(local);
}

/** Güvenlik skoru: 100'den eksiltmeli basit ve açıklanabilir hesap. */
export function securityScore(input: {
  firewallEnabled: boolean;
  wafMode: WafMode;
  adminTwoFactor: boolean;
  criticalAttacksToday: number;
  pendingFraudReviews: number;
  expiringCertificates: number;
  blacklistRules: number;
}): number {
  let score = 100;
  if (!input.firewallEnabled) score -= 30;
  if (input.wafMode === "passive") score -= 10;
  if (!input.adminTwoFactor) score -= 15;
  if (input.criticalAttacksToday > 0) score -= Math.min(15, input.criticalAttacksToday);
  if (input.pendingFraudReviews > 5) score -= 5;
  if (input.expiringCertificates > 0) score -= 10;
  if (input.blacklistRules === 0) score -= 3;
  return Math.max(0, Math.min(100, score));
}
