/**
 * Gelişmiş alan kuralları (xml_feeds.field_rules): yedek alan, koşul,
 * formül, varsayılan değer ve zorunluluk. Tarayıcı ve sunucuda aynı kod çalışır.
 * Mevcut dönüşüm zinciri (transform_rules) bu kurallardan sonra uygulanır.
 */

import { evaluateExpression } from "@/lib/xml-transforms";

export const CONDITION_OPERATORS = [
  "equals",
  "not_equals",
  "contains",
  "greater",
  "less",
  "empty",
  "not_empty",
] as const;
export type ConditionOperator = (typeof CONDITION_OPERATORS)[number];

export const CONDITION_LABELS: Record<ConditionOperator, string> = {
  equals: "eşittir",
  not_equals: "eşit değildir",
  contains: "içerir",
  greater: "büyüktür",
  less: "küçüktür",
  empty: "boş",
  not_empty: "dolu",
};

export type FieldRule = {
  fallback?: string;
  formula?: string;
  condition?: { field: string; operator: ConditionOperator; value?: string };
  defaultValue?: string;
  required?: boolean;
  notes?: string;
};

export type FieldRules = Record<string, FieldRule>;

const RULE_PREFIX = "__rule__";

export function parseFieldRules(raw: unknown): FieldRules {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: FieldRules = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!value || typeof value !== "object") continue;
    const v = value as Record<string, unknown>;
    const rule: FieldRule = {};
    if (typeof v["fallback"] === "string" && v["fallback"]) rule.fallback = v["fallback"].slice(0, 200);
    if (typeof v["formula"] === "string" && v["formula"].trim()) rule.formula = v["formula"].slice(0, 300);
    if (typeof v["defaultValue"] === "string" && v["defaultValue"] !== "") rule.defaultValue = v["defaultValue"].slice(0, 500);
    if (v["required"] === true) rule.required = true;
    if (typeof v["notes"] === "string" && v["notes"]) rule.notes = v["notes"].slice(0, 500);
    const c = v["condition"] as Record<string, unknown> | undefined;
    if (c && typeof c["field"] === "string" && c["field"] && CONDITION_OPERATORS.includes(c["operator"] as ConditionOperator)) {
      rule.condition = {
        field: c["field"].slice(0, 200),
        operator: c["operator"] as ConditionOperator,
        ...(typeof c["value"] === "string" ? { value: c["value"].slice(0, 255) } : {}),
      };
    }
    if (Object.keys(rule).length) out[key.slice(0, 100)] = rule;
  }
  return out;
}

const num = (value: string) => {
  const n = Number(String(value).replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

export function checkCondition(row: Record<string, string>, condition: FieldRule["condition"]): boolean {
  if (!condition) return true;
  const left = readPath(row, condition.field);
  const right = String(condition.value ?? "").trim();
  switch (condition.operator) {
    case "equals":
      return left.toLocaleLowerCase("tr") === right.toLocaleLowerCase("tr");
    case "not_equals":
      return left.toLocaleLowerCase("tr") !== right.toLocaleLowerCase("tr");
    case "contains":
      return left.toLocaleLowerCase("tr").includes(right.toLocaleLowerCase("tr"));
    case "greater": {
      const a = num(left), b = num(right);
      return a !== null && b !== null && a > b;
    }
    case "less": {
      const a = num(left), b = num(right);
      return a !== null && b !== null && a < b;
    }
    case "empty":
      return left === "";
    case "not_empty":
      return left !== "";
  }
}

/** Formülü `value` değişkeniyle hesaplar (ör. `value * 1.20 + 5`). */
export function testFormula(formula: string, value: string, row: Record<string, string> = {}): { ok: boolean; result: string } {
  try {
    const n = num(value);
    const out = evaluateExpression(formula, { ...row, value: n ?? value } as never);
    if (typeof out === "number") {
      if (!Number.isFinite(out)) return { ok: false, result: "Geçersiz sonuç" };
      return { ok: true, result: String(Math.round(out * 100) / 100) };
    }
    return { ok: true, result: String(out ?? "") };
  } catch (error) {
    return { ok: false, result: error instanceof Error ? error.message : "Formül hatalı" };
  }
}

/** Yolu okur; dizi/indeksiz yollarda ilk dolu değeri döndürür. */
function readPath(row: Record<string, string>, path: string | undefined, collectAll = false): string {
  if (!path) return "";
  if (!collectAll && row[path] !== undefined) return String(row[path]).trim();
  const generic = path.replace(/\[\d*\]/g, "");
  const values: string[] = [];
  for (const [k, v] of Object.entries(row)) {
    if (k.replace(/\[\d+\]/g, "") !== generic || !String(v).trim()) continue;
    if (!collectAll) return String(v).trim();
    values.push(String(v).trim());
  }
  return collectAll ? values.join(",") : "";
}

/** Tek hedef alanın kurallı değerini hesaplar. */
export function resolveRuleValue(
  row: Record<string, string>,
  sourcePath: string | undefined,
  rule: FieldRule,
  collectAll = false,
): string {
  let value = readPath(row, sourcePath, collectAll);
  if (!value && rule.fallback) value = readPath(row, rule.fallback, collectAll);
  if (checkCondition(row, rule.condition)) {
    if (rule.formula && value) {
      const out = testFormula(rule.formula, value, row);
      if (out.ok) value = out.result;
    }
  } else if (rule.condition) {
    value = rule.defaultValue ?? "";
  }
  if (!value && rule.defaultValue) value = rule.defaultValue;
  return value;
}

/**
 * Kuralları satırlara uygular: hesaplanan değer sentetik bir sütuna yazılır ve
 * eşleme o sütuna yönlendirilir; kaynak veri değişmez.
 */
export function applyFieldRules(
  rows: Array<Record<string, string>>,
  mapping: Record<string, string>,
  rules: FieldRules,
): {
  rows: Array<Record<string, string>>;
  mapping: Record<string, string>;
  missing: Array<{ row: number; field: string }>;
} {
  const keys = Object.keys(rules);
  if (!keys.length) return { rows, mapping, missing: [] };
  const nextMapping = { ...mapping };
  for (const key of keys) nextMapping[key] = `${RULE_PREFIX}${key}`;
  const missing: Array<{ row: number; field: string }> = [];
  const nextRows = rows.map((row, index) => {
    const copy = { ...row };
    for (const key of keys) {
      const rule = rules[key]!;
      const value = resolveRuleValue(row, mapping[key], rule, key === "images" || key === "videos");
      copy[`${RULE_PREFIX}${key}`] = value;
      if (rule.required && !value) missing.push({ row: index, field: key });
    }
    return copy;
  });
  return { rows: nextRows, mapping: nextMapping, missing };
}

/** Hata metninden hata türü tahmini (Hatalı Ürünler filtresi için). */
export function classifyFailure(reason: string): string {
  const r = reason.toLocaleLowerCase("tr");
  if (r.includes("kategori")) return "category";
  if (r.includes("görsel") || r.includes("resim") || r.includes("image")) return "image";
  if (r.includes("zorunlu") || r.includes("boş") || r.includes("eksik")) return "required";
  if (r.includes("fiyat")) return "price";
  return "other";
}

export const FAILURE_TYPE_LABELS: Record<string, string> = {
  category: "Kategori eşleşmedi",
  image: "Görsel sorunu",
  required: "Zorunlu alan eksik",
  price: "Fiyat okunamadı",
  other: "Diğer",
};
