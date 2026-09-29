/** Politika Sistemi v2 — ortak (tarayıcı + sunucu) yardımcılar. */

import { htmlToText } from "@/lib/blog-content";

export type PolicyScope = "platform" | "store";

export const STORE_POLICY_KEYS = ["refund", "privacy", "shipping", "cookie", "distance_selling"] as const;
export const PLATFORM_POLICY_KEYS = ["privacy", "terms", "cookie", "refund", "seller_agreement", "distance_selling"] as const;

const STORE_SLUGS: Record<string, string> = {
  refund: "iade-degisim",
  privacy: "gizlilik",
  shipping: "kargo-teslimat",
  cookie: "cerez",
  distance_selling: "mesafeli-satis-sozlesmesi",
};
const PLATFORM_SLUGS: Record<string, string> = {
  privacy: "gizlilik",
  terms: "kullanim-kosullari",
  cookie: "cerez",
  refund: "iade",
  seller_agreement: "satici-sozlesmesi",
  distance_selling: "mesafeli-satis-sozlesmesi",
};

export const POLICY_LABELS: Record<string, string> = {
  refund: "İade & Değişim",
  privacy: "Gizlilik",
  shipping: "Kargo & Teslimat",
  cookie: "Çerez",
  distance_selling: "Mesafeli Satış Sözleşmesi",
  terms: "Kullanım Koşulları",
  seller_agreement: "Satıcı Sözleşmesi",
};

export const policySlug = (scope: PolicyScope, key: string) =>
  (scope === "store" ? STORE_SLUGS : PLATFORM_SLUGS)[key] ?? key;

export const policyKeyFromSlug = (scope: PolicyScope, slug: string) =>
  Object.entries(scope === "store" ? STORE_SLUGS : PLATFORM_SLUGS).find(([, s]) => s === slug)?.[0] ?? null;

/** Sipariş anında doldurulan, satıcının girmediği yer tutucular. */
export const ORDER_PLACEHOLDERS: Record<string, string> = {
  ALICI_ADI: "Alıcı adı",
  TESLIMAT_ADRESI: "Teslimat adresi",
  URUN_LISTESI: "Ürün listesi",
  TOPLAM_TUTAR: "Toplam tutar",
  SATICI_ADI: "Satıcı adı",
};

export type PlaceholderDef = {
  placeholder_key: string;
  label: string;
  default_value: string | null;
  input_type: string;
  min_value: number | null;
  is_required: boolean;
};

const esc = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c);

/** {{ANAHTAR}} yer tutucularını değerlerle değiştirir. Çok satırlı değerler <br> olur. */
export function renderPolicy(content: string, values: Record<string, string>, opts?: { keepUnknown?: boolean }) {
  return content.replace(/\{\{\s*([A-Z_İ]+)\s*\}\}/g, (all, rawKey: string) => {
    const key = rawKey.replace("İ", "I");
    const value = values[key];
    if (value !== undefined && value !== "") return esc(value).replace(/\n/g, "<br>");
    if (ORDER_PLACEHOLDERS[key]) return `<span data-order-field="${key}">[${ORDER_PLACEHOLDERS[key]}]</span>`;
    return opts?.keepUnknown ? all : "";
  });
}

/** Zorunlu ve en küçük değer kurallarını kontrol eder; hata listesi döner. */
export function validatePlaceholders(defs: PlaceholderDef[], values: Record<string, string>) {
  const errors: string[] = [];
  for (const d of defs) {
    const v = (values[d.placeholder_key] ?? "").trim();
    if (d.is_required && !v) errors.push(`${d.label} boş bırakılamaz`);
    if (v && d.input_type === "number") {
      const n = Number(v);
      if (!Number.isFinite(n)) errors.push(`${d.label} sayı olmalı`);
      else if (d.min_value !== null && n < d.min_value) errors.push(`${d.label} en az ${d.min_value} olmalı`);
    }
    if (v && d.input_type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) errors.push(`${d.label} geçerli bir e-posta olmalı`);
  }
  return errors;
}

export function nextVersion(current: string | null, kind: "minor" | "major") {
  if (!current) return "1.0";
  const [maj = 1, min = 0] = current.split(".").map((n) => Number(n) || 0);
  return kind === "major" ? `${maj + 1}.0` : `${maj}.${min + 1}`;
}

export type DiffPart = { type: "same" | "add" | "del"; text: string };

/** Kelime düzeyinde fark (LCS). Çok uzun metinlerde paragraf düzeyine düşer. */
export function diffPolicies(oldHtml: string, newHtml: string): DiffPart[] {
  const tokenize = (html: string) => {
    const text = htmlToText(html.replace(/<\/(p|h[1-6]|li)>/gi, "\n"));
    return text.split(/(\s+)/).filter(Boolean);
  };
  let a = tokenize(oldHtml);
  let b = tokenize(newHtml);
  if (a.length * b.length > 4_000_000) {
    a = htmlToText(oldHtml).split(/(?<=\.)\s+/);
    b = htmlToText(newHtml).split(/(?<=\.)\s+/);
  }
  const n = a.length;
  const m = b.length;
  const dp: Uint32Array[] = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--) dp[i]![j] = a[i] === b[j] ? dp[i + 1]![j + 1]! + 1 : Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!);
  const out: DiffPart[] = [];
  const push = (type: DiffPart["type"], text: string) => {
    const last = out[out.length - 1];
    if (last && last.type === type) last.text += text;
    else out.push({ type, text });
  };
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      push("same", a[i]!);
      i++;
      j++;
    } else if (dp[i + 1]![j]! >= dp[i]![j + 1]!) push("del", a[i++]!);
    else push("add", b[j++]!);
  }
  while (i < n) push("del", a[i++]!);
  while (j < m) push("add", b[j++]!);
  return out;
}
