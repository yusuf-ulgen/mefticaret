/**
 * Ürün & Müşteri Yönetimi v2 — saf (istemci/sunucu ortak) iş kuralları.
 * Akıllı koleksiyon kuralları, segment kuralları ve seçenek → varyant üretimi.
 */

// ---------- Seçenekler & varyantlar ----------

export type ProductOptionInput = { name: string; values: string[] };

export type VariantDraft = {
  id?: string;
  title: string;
  option1: string | null;
  option2: string | null;
  option3: string | null;
  sku: string;
  barcode: string;
  price: number;
  compare_at_price: number | null;
  cost_price: number | null;
  stock: number;
  inventory_policy: "deny" | "continue";
  weight: number | null;
  weight_unit: "kg" | "g" | "lb";
};

export function cleanOptions(options: ProductOptionInput[]): ProductOptionInput[] {
  return options
    .slice(0, 3)
    .map((o) => ({
      name: o.name.trim(),
      values: [...new Set(o.values.map((v) => v.trim()).filter(Boolean))].slice(0, 100),
    }))
    .filter((o) => o.name && o.values.length > 0);
}

/** Seçeneklerin kartezyen çarpımı; mevcut varyantlar seçenek değerlerine göre korunur. */
export function buildVariants(
  options: ProductOptionInput[],
  existing: VariantDraft[],
  defaults: { price: number; compare_at_price: number | null; cost_price: number | null },
): VariantDraft[] {
  const clean = cleanOptions(options);
  const combos: string[][] = clean.reduce<string[][]>(
    (acc, opt) => acc.flatMap((prefix) => opt.values.map((v) => [...prefix, v])),
    [[]],
  );
  const key = (v: Pick<VariantDraft, "option1" | "option2" | "option3">) =>
    [v.option1, v.option2, v.option3].map((x) => (x ?? "").toLocaleLowerCase("tr").replace(/ı/g, "i")).join("|");
  const byKey = new Map(existing.map((v) => [key(v), v]));

  return combos.slice(0, 250).map((combo) => {
    const o = { option1: combo[0] ?? null, option2: combo[1] ?? null, option3: combo[2] ?? null };
    const prev = byKey.get(key(o));
    const title = combo.length ? combo.join(" / ") : "Varsayılan";
    return (
      prev ? { ...prev, ...o, title } : {
        ...o,
        title,
        sku: "",
        barcode: "",
        price: defaults.price,
        compare_at_price: defaults.compare_at_price,
        cost_price: defaults.cost_price,
        stock: 0,
        inventory_policy: "deny",
        weight: null,
        weight_unit: "g",
      }
    );
  });
}

export function toGrams(weight: number | null, unit: "kg" | "g" | "lb"): number | null {
  if (weight == null || !Number.isFinite(weight)) return null;
  const g = unit === "kg" ? weight * 1000 : unit === "lb" ? weight * 453.59237 : weight;
  return Math.round(g);
}

export function margin(price: number, cost: number | null): number | null {
  if (!cost || price <= 0) return null;
  return Math.round(((price - cost) / price) * 1000) / 10;
}

// ---------- Akıllı koleksiyon kuralları ----------

export const COLLECTION_FIELDS = ["tag", "price", "stock", "product_type", "vendor", "title"] as const;
export type CollectionField = (typeof COLLECTION_FIELDS)[number];
export const COLLECTION_OPS = ["eq", "neq", "gt", "lt", "contains", "not_contains"] as const;
export type CollectionOp = (typeof COLLECTION_OPS)[number];

export type CollectionRule = { field: CollectionField; op: CollectionOp; value: string };
export type CollectionRules = { match: "all" | "any"; conditions: CollectionRule[] };

export const COLLECTION_FIELD_LABELS: Record<CollectionField, string> = {
  tag: "Etiket",
  price: "Fiyat",
  stock: "Stok",
  product_type: "Ürün tipi",
  vendor: "Marka / Satıcı",
  title: "Başlık",
};

export const OP_LABELS: Record<CollectionOp, string> = {
  eq: "eşittir",
  neq: "eşit değil",
  gt: "büyüktür",
  lt: "küçüktür",
  contains: "içerir",
  not_contains: "içermez",
};

export type RuleProduct = {
  title: string;
  tags: string[] | null;
  base_price: number;
  product_type: string | null;
  vendor: string | null;
  stock: number;
};

function compareText(actual: string, op: CollectionOp, expected: string) {
  const a = actual.toLocaleLowerCase("tr").replace(/ı/g, "i");
  const e = expected.toLocaleLowerCase("tr").replace(/ı/g, "i");
  switch (op) {
    case "eq": return a === e;
    case "neq": return a !== e;
    case "contains": return a.includes(e);
    case "not_contains": return !a.includes(e);
    default: return false;
  }
}

function compareNum(actual: number, op: CollectionOp, expected: string) {
  const e = Number(expected);
  if (!Number.isFinite(e)) return false;
  switch (op) {
    case "eq": return actual === e;
    case "neq": return actual !== e;
    case "gt": return actual > e;
    case "lt": return actual < e;
    default: return false;
  }
}

export function matchesCollectionRule(p: RuleProduct, r: CollectionRule): boolean {
  switch (r.field) {
    case "tag": {
      const tags = (p.tags ?? []).map((t) => t.toLocaleLowerCase("tr").replace(/ı/g, "i"));
      const has = tags.includes(r.value.trim().toLocaleLowerCase("tr").replace(/ı/g, "i"));
      if (r.op === "eq" || r.op === "contains") return has;
      if (r.op === "neq" || r.op === "not_contains") return !has;
      return false;
    }
    case "price": return compareNum(Number(p.base_price), r.op, r.value);
    case "stock": return compareNum(Number(p.stock), r.op, r.value);
    case "product_type": return compareText(p.product_type ?? "", r.op, r.value);
    case "vendor": return compareText(p.vendor ?? "", r.op, r.value);
    case "title": return compareText(p.title, r.op, r.value);
  }
}

export function matchesCollection(p: RuleProduct, rules: CollectionRules): boolean {
  if (!rules.conditions.length) return false;
  return rules.match === "any"
    ? rules.conditions.some((r) => matchesCollectionRule(p, r))
    : rules.conditions.every((r) => matchesCollectionRule(p, r));
}

export function parseCollectionRules(raw: unknown): CollectionRules {
  const r = (raw ?? {}) as Partial<CollectionRules>;
  const conditions = Array.isArray(r.conditions)
    ? r.conditions.filter(
        (c): c is CollectionRule =>
          !!c && COLLECTION_FIELDS.includes(c.field) && COLLECTION_OPS.includes(c.op) && typeof c.value === "string",
      )
    : [];
  return { match: r.match === "any" ? "any" : "all", conditions: conditions.slice(0, 20) };
}

// ---------- Segment kuralları ----------

export const SEGMENT_FIELDS = [
  "total_spent",
  "orders_count",
  "city",
  "tag",
  "last_order_days",
  "accepts_marketing",
] as const;
export type SegmentField = (typeof SEGMENT_FIELDS)[number];
export type SegmentOp = "gt" | "gte" | "lt" | "lte" | "eq" | "neq" | "contains";
export type SegmentRule = { field: SegmentField; op: SegmentOp; value: string };
export type SegmentQuery = { match: "all" | "any"; rules: SegmentRule[] };

export const SEGMENT_FIELD_META: Record<SegmentField, { label: string; ops: SegmentOp[]; kind: "number" | "text" | "bool" }> = {
  total_spent: { label: "Toplam harcama (₺)", ops: ["gt", "gte", "lt", "lte", "eq"], kind: "number" },
  orders_count: { label: "Sipariş sayısı", ops: ["gt", "gte", "lt", "lte", "eq"], kind: "number" },
  city: { label: "Şehir", ops: ["eq", "neq", "contains"], kind: "text" },
  tag: { label: "Etiket", ops: ["contains", "neq"], kind: "text" },
  last_order_days: { label: "Son sipariş (gün önce)", ops: ["lt", "lte", "gt", "gte"], kind: "number" },
  accepts_marketing: { label: "Pazarlama onayı", ops: ["eq"], kind: "bool" },
};

export const SEGMENT_OP_LABELS: Record<SegmentOp, string> = {
  gt: ">", gte: "≥", lt: "<", lte: "≤", eq: "=", neq: "≠", contains: "içerir",
};

export type SegmentSubject = {
  total_spent: number;
  orders_count: number;
  cities: string[];
  tags: string[] | null;
  last_order_at: string | null;
  accepts_marketing: boolean;
};

function numOp(a: number, op: SegmentOp, e: number) {
  switch (op) {
    case "gt": return a > e;
    case "gte": return a >= e;
    case "lt": return a < e;
    case "lte": return a <= e;
    case "eq": return a === e;
    case "neq": return a !== e;
    default: return false;
  }
}

export function matchesSegmentRule(c: SegmentSubject, r: SegmentRule, now = Date.now()): boolean {
  const lc = (s: string) => s.trim().toLocaleLowerCase("tr").replace(/ı/g, "i");
  switch (r.field) {
    case "total_spent":
    case "orders_count": {
      const e = Number(r.value);
      return Number.isFinite(e) && numOp(Number(c[r.field]), r.op, e);
    }
    case "last_order_days": {
      const e = Number(r.value);
      if (!Number.isFinite(e) || !c.last_order_at) return false;
      const days = Math.floor((now - new Date(c.last_order_at).getTime()) / 86_400_000);
      return numOp(days, r.op, e);
    }
    case "city": {
      const cities = c.cities.map(lc);
      const v = lc(r.value);
      if (r.op === "eq") return cities.includes(v);
      if (r.op === "neq") return !cities.includes(v);
      if (r.op === "contains") return cities.some((x) => x.includes(v));
      return false;
    }
    case "tag": {
      const has = (c.tags ?? []).map(lc).includes(lc(r.value));
      return r.op === "neq" ? !has : has;
    }
    case "accepts_marketing":
      return c.accepts_marketing === (r.value === "true");
  }
}

export function matchesSegmentQuery(c: SegmentSubject, q: SegmentQuery, now = Date.now()): boolean {
  if (!q.rules.length) return true;
  return q.match === "any"
    ? q.rules.some((r) => matchesSegmentRule(c, r, now))
    : q.rules.every((r) => matchesSegmentRule(c, r, now));
}

export function parseSegmentQuery(raw: unknown): SegmentQuery {
  const q = (raw ?? {}) as Partial<SegmentQuery>;
  const rules = Array.isArray(q.rules)
    ? q.rules.filter(
        (r): r is SegmentRule =>
          !!r && SEGMENT_FIELDS.includes(r.field) &&
          SEGMENT_FIELD_META[r.field].ops.includes(r.op) && typeof r.value === "string",
      )
    : [];
  return { match: q.match === "any" ? "any" : "all", rules: rules.slice(0, 20) };
}

// ---------- i18n (Türkçe varsayılan, İngilizce hazır) ----------

export const V2_TEXT = {
  tr: {
    products: "Ürünler", collections: "Koleksiyonlar", customers: "Müşteriler", segments: "Segmentler",
    save: "Kaydet", preview: "Önizle", draft: "Taslak", active: "Aktif", archived: "Arşivlendi",
    featureOff: "Bu özellik paketinizde henüz açık değil. Süper yönetici paket ayarlarından açabilir.",
  },
  en: {
    products: "Products", collections: "Collections", customers: "Customers", segments: "Segments",
    save: "Save", preview: "Preview", draft: "Draft", active: "Active", archived: "Archived",
    featureOff: "This feature is not enabled for your plan yet.",
  },
} as const;

export const t = (key: keyof (typeof V2_TEXT)["tr"], locale: "tr" | "en" = "tr") => V2_TEXT[locale][key];

export const PRODUCT_STATUS_LABELS: Record<string, string> = {
  draft: "Taslak",
  active: "Aktif",
  archived: "Arşivlendi",
};
