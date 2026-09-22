/**
 * XmlIntegrator — Dönüştürme Motoru (Transform Engine).
 *
 * Eşleştirilen her hedef alan için sıralı bir kural zinciri tanımlanabilir.
 * Kurallar tarayıcıda (canlı önizleme) ve sunucuda (içe aktarım) aynı kodla
 * çalışır; bu yüzden bu dosya tamamen saf ve bağımsızdır.
 *
 * custom_js kuralı gerçek JavaScript çalıştırmaz: sunucu ortamı (Worker)
 * dinamik kod derlemesine izin vermediği için ifade, izinli fonksiyonlarla
 * sınırlı kendi güvenli yorumlayıcımızda değerlendirilir.
 */

export type TransformKind =
  | "trim"
  | "uppercase"
  | "replace"
  | "truncate"
  | "multiply"
  | "round"
  | "add_vat"
  | "remove_vat"
  | "currency"
  | "join"
  | "split"
  | "pick"
  | "template"
  | "conditional"
  | "date_format"
  | "custom_js";

export type TransformStep = {
  kind: TransformKind;
  /** Kuralın kendi ayarları (ör. replace için search/replacement). */
  options?: Record<string, string | number | boolean> | undefined;
};

/** Hedef alan anahtarı → kural zinciri. */
export type TransformRules = Record<string, TransformStep[]>;

export type TransformGroup = "text" | "numeric" | "array" | "logic";

export const TRANSFORM_GROUP_LABELS: Record<TransformGroup, string> = {
  text: "Metin işlemleri",
  numeric: "Sayısal işlemler",
  array: "Dizi ve şablon",
  logic: "Mantıksal",
};

export type TransformOptionField = {
  key: string;
  label: string;
  type: "text" | "number" | "select";
  placeholder?: string;
  choices?: Array<{ value: string; label: string }>;
  defaultValue?: string | number;
};

export type TransformDefinition = {
  kind: TransformKind;
  label: string;
  group: TransformGroup;
  hint: string;
  fields: TransformOptionField[];
};

/** Panelde gösterilen 16 dönüştürme kuralı. */
export const TRANSFORM_DEFINITIONS: TransformDefinition[] = [
  { kind: "trim", label: "Boşlukları kırp", group: "text", hint: "Baştaki ve sondaki boşlukları siler.", fields: [] },
  {
    kind: "uppercase",
    label: "Harf düzeni",
    group: "text",
    hint: "Metni büyük/küçük harfe veya baş harfleri büyüğe çevirir.",
    fields: [
      {
        key: "mode",
        label: "Biçim",
        type: "select",
        defaultValue: "upper",
        choices: [
          { value: "upper", label: "TÜMÜ BÜYÜK" },
          { value: "lower", label: "tümü küçük" },
          { value: "title", label: "Baş Harfler Büyük" },
        ],
      },
    ],
  },
  {
    kind: "replace",
    label: "Değiştir",
    group: "text",
    hint: "Belirtilen metni başka bir metinle değiştirir.",
    fields: [
      { key: "search", label: "Aranan", type: "text", placeholder: "örn. ADET" },
      { key: "replacement", label: "Yerine", type: "text", placeholder: "boş bırakılabilir" },
      {
        key: "mode",
        label: "Eşleşme",
        type: "select",
        defaultValue: "all",
        choices: [
          { value: "all", label: "Tüm eşleşmeler" },
          { value: "first", label: "İlk eşleşme" },
          { value: "regex", label: "Düzenli ifade" },
        ],
      },
    ],
  },
  {
    kind: "truncate",
    label: "Kısalt",
    group: "text",
    hint: "Metni belirtilen uzunlukta keser.",
    fields: [
      { key: "length", label: "Uzunluk", type: "number", defaultValue: 120 },
      { key: "suffix", label: "Sonuna eklenecek", type: "text", placeholder: "…" },
    ],
  },
  {
    kind: "multiply",
    label: "Çarp",
    group: "numeric",
    hint: "Sayısal değeri katsayı ile çarpar (ör. 1.2).",
    fields: [{ key: "factor", label: "Katsayı", type: "number", defaultValue: 1 }],
  },
  {
    kind: "round",
    label: "Yuvarla",
    group: "numeric",
    hint: "Ondalık basamak sayısına göre yuvarlar.",
    fields: [
      { key: "decimals", label: "Ondalık", type: "number", defaultValue: 2 },
      {
        key: "mode",
        label: "Yön",
        type: "select",
        defaultValue: "half",
        choices: [
          { value: "half", label: "En yakına" },
          { value: "up", label: "Yukarı" },
          { value: "down", label: "Aşağı" },
        ],
      },
    ],
  },
  {
    kind: "add_vat",
    label: "KDV ekle",
    group: "numeric",
    hint: "KDV hariç tutara KDV ekler.",
    fields: [{ key: "rate", label: "KDV %", type: "number", defaultValue: 20 }],
  },
  {
    kind: "remove_vat",
    label: "KDV çıkar",
    group: "numeric",
    hint: "KDV dahil tutardan KDV'yi düşer.",
    fields: [{ key: "rate", label: "KDV %", type: "number", defaultValue: 20 }],
  },
  {
    kind: "currency",
    label: "Para birimi çevir",
    group: "numeric",
    hint: "Sabit kur ile çevirir (ör. USD → TRY kuru 34.5).",
    fields: [
      { key: "rate", label: "Kur", type: "number", defaultValue: 1 },
      { key: "decimals", label: "Ondalık", type: "number", defaultValue: 2 },
    ],
  },
  {
    kind: "join",
    label: "Birleştir",
    group: "array",
    hint: "Çok değerli alanı tek ayırıcıyla birleştirir.",
    fields: [
      { key: "from", label: "Kaynak ayırıcı", type: "text", defaultValue: "," },
      { key: "separator", label: "Yeni ayırıcı", type: "text", defaultValue: " | " },
    ],
  },
  {
    kind: "split",
    label: "Böl ve seç",
    group: "array",
    hint: "Değeri ayırıcıya göre böler, istenen parçayı alır (0 = ilk).",
    fields: [
      { key: "separator", label: "Ayırıcı", type: "text", defaultValue: ">" },
      { key: "index", label: "Parça sırası", type: "number", defaultValue: 0 },
    ],
  },
  {
    kind: "pick",
    label: "İlk / son öğe",
    group: "array",
    hint: "Çok değerli alanın ilk ya da son öğesini alır.",
    fields: [
      { key: "separator", label: "Ayırıcı", type: "text", defaultValue: "," },
      {
        key: "position",
        label: "Öğe",
        type: "select",
        defaultValue: "first",
        choices: [
          { value: "first", label: "İlk" },
          { value: "last", label: "Son" },
        ],
      },
    ],
  },
  {
    kind: "template",
    label: "Şablon",
    group: "array",
    hint: "{{value}} ve kaynak alan adlarıyla yeni metin kurar.",
    fields: [{ key: "pattern", label: "Şablon", type: "text", placeholder: "{{brand}} {{value}}" }],
  },
  {
    kind: "conditional",
    label: "Koşullu değer",
    group: "logic",
    hint: "Koşul sağlanırsa bir değer, sağlanmazsa diğerini yazar.",
    fields: [
      {
        key: "operator",
        label: "Koşul",
        type: "select",
        defaultValue: "equals",
        choices: [
          { value: "equals", label: "eşitse" },
          { value: "contains", label: "içeriyorsa" },
          { value: "empty", label: "boşsa" },
          { value: "gt", label: "büyükse" },
          { value: "lt", label: "küçükse" },
        ],
      },
      { key: "compare", label: "Karşılaştırılan", type: "text" },
      { key: "then", label: "Evetse", type: "text", placeholder: "{{value}}" },
      { key: "else", label: "Hayırsa", type: "text", placeholder: "{{value}}" },
    ],
  },
  {
    kind: "date_format",
    label: "Tarih biçimi",
    group: "logic",
    hint: "Tarihi seçilen biçime çevirir.",
    fields: [
      {
        key: "to",
        label: "Biçim",
        type: "select",
        defaultValue: "iso",
        choices: [
          { value: "iso", label: "ISO (2026-01-31)" },
          { value: "tr", label: "31.01.2026" },
          { value: "datetime", label: "31.01.2026 14:05" },
        ],
      },
    ],
  },
  {
    kind: "custom_js",
    label: "Özel ifade",
    group: "logic",
    hint: 'Güvenli ifade: value, num, round(num*1.2, 2), upper(trim(value)) gibi.',
    fields: [{ key: "expression", label: "İfade", type: "text", placeholder: "round(num * 1.2, 2)" }],
  },
];

export const TRANSFORM_BY_KIND: Record<TransformKind, TransformDefinition> = Object.fromEntries(
  TRANSFORM_DEFINITIONS.map((definition) => [definition.kind, definition]),
) as Record<TransformKind, TransformDefinition>;

/** Kural için varsayılan ayarları üretir. */
export function defaultTransformStep(kind: TransformKind): TransformStep {
  const definition = TRANSFORM_BY_KIND[kind];
  const options: Record<string, string | number | boolean> = {};
  for (const field of definition.fields) {
    if (field.defaultValue !== undefined) options[field.key] = field.defaultValue;
  }
  return { kind, options };
}

/* ------------------------------ yardımcılar ------------------------------- */

const toText = (value: unknown) => (value === null || value === undefined ? "" : String(value));

function readNumber(text: string): number | null {
  const cleaned = text.replace(/[^\d.,-]/g, "").trim();
  if (!cleaned) return null;
  let normalized = cleaned;
  if (cleaned.includes(",") && cleaned.includes(".")) {
    normalized = cleaned.lastIndexOf(",") > cleaned.lastIndexOf(".")
      ? cleaned.replace(/\./g, "").replace(",", ".")
      : cleaned.replace(/,/g, "");
  } else if (cleaned.includes(",")) {
    normalized = cleaned.replace(/\./g, "").replace(",", ".");
  }
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

function formatNumber(value: number, decimals: number): string {
  const digits = Math.max(0, Math.min(6, Math.round(decimals)));
  return value.toFixed(digits);
}

function optionText(step: TransformStep, key: string, fallback = ""): string {
  const raw = step.options?.[key];
  return raw === undefined || raw === null ? fallback : String(raw);
}

function optionNumber(step: TransformStep, key: string, fallback: number): number {
  const value = readNumber(optionText(step, key));
  return value === null ? fallback : value;
}

function fillTemplate(pattern: string, value: string, row: Record<string, string>): string {
  return pattern.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_match, token: string) => {
    if (token === "value") return value;
    return toText(row[token]);
  });
}

function titleCase(text: string): string {
  return text
    .toLocaleLowerCase("tr")
    .replace(/(^|[\s\-/(])(\p{L})/gu, (_m, prefix: string, letter: string) => prefix + letter.toLocaleUpperCase("tr"));
}

function parseDate(text: string): Date | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const tr = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})(?:[ T](\d{1,2}):(\d{2}))?$/.exec(trimmed);
  if (tr) {
    const [, day, month, year, hour, minute] = tr;
    const date = new Date(
      Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour ?? 0), Number(minute ?? 0)),
    );
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/* --------------------------- güvenli ifade motoru -------------------------- */

type ExprValue = string | number | boolean;

const EXPR_FUNCTIONS: Record<string, (args: ExprValue[]) => ExprValue> = {
  upper: (args) => toText(args[0]).toLocaleUpperCase("tr"),
  lower: (args) => toText(args[0]).toLocaleLowerCase("tr"),
  trim: (args) => toText(args[0]).trim(),
  len: (args) => toText(args[0]).length,
  num: (args) => readNumber(toText(args[0])) ?? 0,
  str: (args) => toText(args[0]),
  abs: (args) => Math.abs(Number(args[0]) || 0),
  floor: (args) => Math.floor(Number(args[0]) || 0),
  ceil: (args) => Math.ceil(Number(args[0]) || 0),
  round: (args) => {
    const digits = Math.max(0, Math.min(6, Math.round(Number(args[1] ?? 0) || 0)));
    const factor = 10 ** digits;
    return Math.round((Number(args[0]) || 0) * factor) / factor;
  },
  min: (args) => Math.min(...args.map((item) => Number(item) || 0)),
  max: (args) => Math.max(...args.map((item) => Number(item) || 0)),
  slice: (args) => toText(args[0]).slice(Number(args[1] ?? 0) || 0, args[2] === undefined ? undefined : Number(args[2])),
  replace: (args) => toText(args[0]).split(toText(args[1])).join(toText(args[2])),
  concat: (args) => args.map((item) => toText(item)).join(""),
  contains: (args) => toText(args[0]).includes(toText(args[1])),
};

/** Yalnızca izinli işleç ve fonksiyonları tanıyan küçük ifade yorumlayıcısı. */
export function evaluateExpression(expression: string, scope: Record<string, ExprValue>): ExprValue {
  const source = expression.slice(0, 400);
  let index = 0;

  const skip = () => {
    while (index < source.length && /\s/.test(source[index] as string)) index += 1;
  };
  const eat = (token: string) => {
    skip();
    if (source.startsWith(token, index)) {
      index += token.length;
      return true;
    }
    return false;
  };
  const expect = (token: string) => {
    if (!eat(token)) throw new Error(`İfadede '${token}' bekleniyordu`);
  };

  const parseTernary = (): ExprValue => {
    const condition = parseComparison();
    if (!eat("?")) return condition;
    const whenTrue = parseTernary();
    expect(":");
    const whenFalse = parseTernary();
    return truthy(condition) ? whenTrue : whenFalse;
  };

  function truthy(value: ExprValue): boolean {
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value !== 0;
    return value.trim().length > 0;
  }

  function parseComparison(): ExprValue {
    let left = parseAdditive();
    for (;;) {
      skip();
      const operator = ["==", "!=", ">=", "<=", ">", "<"].find((candidate) => source.startsWith(candidate, index));
      if (!operator) return left;
      index += operator.length;
      const right = parseAdditive();
      const bothNumeric = typeof left !== "string" || typeof right !== "string";
      const a = bothNumeric ? Number(left) : String(left);
      const b = bothNumeric ? Number(right) : String(right);
      left =
        operator === "=="
          ? a === b
          : operator === "!="
            ? a !== b
            : operator === ">="
              ? a >= b
              : operator === "<="
                ? a <= b
                : operator === ">"
                  ? a > b
                  : a < b;
    }
  }

  function parseAdditive(): ExprValue {
    let left = parseMultiplicative();
    for (;;) {
      skip();
      const char = source[index];
      if (char !== "+" && char !== "-") return left;
      index += 1;
      const right = parseMultiplicative();
      if (char === "+" && (typeof left === "string" || typeof right === "string")) {
        const leftNumber = typeof left === "number" ? left : readNumber(toText(left));
        const rightNumber = typeof right === "number" ? right : readNumber(toText(right));
        left = leftNumber !== null && rightNumber !== null ? leftNumber + rightNumber : toText(left) + toText(right);
      } else {
        left = char === "+" ? Number(left) + Number(right) : Number(left) - Number(right);
      }
    }
  }

  function parseMultiplicative(): ExprValue {
    let left = parseUnary();
    for (;;) {
      skip();
      const char = source[index];
      if (char !== "*" && char !== "/" && char !== "%") return left;
      index += 1;
      const right = Number(parseUnary());
      const leftNumber = typeof left === "number" ? left : (readNumber(toText(left)) ?? 0);
      if (char === "*") left = leftNumber * right;
      else if (char === "/") left = right === 0 ? 0 : leftNumber / right;
      else left = right === 0 ? 0 : leftNumber % right;
    }
  }

  function parseUnary(): ExprValue {
    skip();
    if (eat("-")) return -Number(parseUnary());
    if (eat("!")) return !truthy(parseUnary());
    return parsePrimary();
  }

  function parsePrimary(): ExprValue {
    skip();
    if (eat("(")) {
      const value = parseTernary();
      expect(")");
      return value;
    }
    const char = source[index];
    if (char === '"' || char === "'") {
      index += 1;
      let text = "";
      while (index < source.length && source[index] !== char) {
        text += source[index];
        index += 1;
      }
      index += 1;
      return text;
    }
    const numberMatch = /^\d+(?:\.\d+)?/.exec(source.slice(index));
    if (numberMatch) {
      index += numberMatch[0].length;
      return Number(numberMatch[0]);
    }
    const nameMatch = /^[A-Za-z_][A-Za-z0-9_]*/.exec(source.slice(index));
    if (!nameMatch) throw new Error("İfade okunamadı");
    const name = nameMatch[0];
    index += name.length;
    if (eat("(")) {
      const args: ExprValue[] = [];
      skip();
      if (!eat(")")) {
        for (;;) {
          args.push(parseTernary());
          if (eat(",")) continue;
          expect(")");
          break;
        }
      }
      const fn = EXPR_FUNCTIONS[name];
      if (!fn) throw new Error(`Bilinmeyen fonksiyon: ${name}`);
      return fn(args);
    }
    if (name === "true") return true;
    if (name === "false") return false;
    if (name in scope) return scope[name] as ExprValue;
    throw new Error(`Bilinmeyen değer: ${name}`);
  }

  const result = parseTernary();
  skip();
  if (index < source.length) throw new Error("İfade sonunda beklenmeyen karakter");
  return result;
}

/* ------------------------------ kural uygulama ---------------------------- */

/** Tek bir kuralı uygular. */
export function applyTransformStep(
  value: string,
  step: TransformStep,
  row: Record<string, string> = {},
): string {
  switch (step.kind) {
    case "trim":
      return value.trim();
    case "uppercase": {
      const mode = optionText(step, "mode", "upper");
      if (mode === "lower") return value.toLocaleLowerCase("tr");
      if (mode === "title") return titleCase(value);
      return value.toLocaleUpperCase("tr");
    }
    case "replace": {
      const search = optionText(step, "search");
      if (!search) return value;
      const replacement = optionText(step, "replacement");
      const mode = optionText(step, "mode", "all");
      if (mode === "regex") {
        try {
          return value.replace(new RegExp(search, "g"), replacement);
        } catch {
          return value;
        }
      }
      if (mode === "first") return value.replace(search, replacement);
      return value.split(search).join(replacement);
    }
    case "truncate": {
      const length = Math.max(1, Math.min(20_000, Math.round(optionNumber(step, "length", 120))));
      if (value.length <= length) return value;
      return value.slice(0, length).trimEnd() + optionText(step, "suffix");
    }
    case "multiply": {
      const number = readNumber(value);
      if (number === null) return value;
      return formatNumber(number * optionNumber(step, "factor", 1), 2);
    }
    case "round": {
      const number = readNumber(value);
      if (number === null) return value;
      const decimals = Math.max(0, Math.min(6, Math.round(optionNumber(step, "decimals", 2))));
      const factor = 10 ** decimals;
      const mode = optionText(step, "mode", "half");
      const rounded =
        mode === "up"
          ? Math.ceil(number * factor) / factor
          : mode === "down"
            ? Math.floor(number * factor) / factor
            : Math.round(number * factor) / factor;
      return formatNumber(rounded, decimals);
    }
    case "add_vat": {
      const number = readNumber(value);
      if (number === null) return value;
      return formatNumber(number * (1 + optionNumber(step, "rate", 20) / 100), 2);
    }
    case "remove_vat": {
      const number = readNumber(value);
      if (number === null) return value;
      const rate = optionNumber(step, "rate", 20);
      return formatNumber(number / (1 + rate / 100), 2);
    }
    case "currency": {
      const number = readNumber(value);
      if (number === null) return value;
      return formatNumber(number * optionNumber(step, "rate", 1), optionNumber(step, "decimals", 2));
    }
    case "join": {
      const from = optionText(step, "from", ",") || ",";
      const separator = optionText(step, "separator", " | ");
      return value
        .split(from)
        .map((part) => part.trim())
        .filter(Boolean)
        .join(separator);
    }
    case "split": {
      const separator = optionText(step, "separator", ">") || ">";
      const parts = value.split(separator).map((part) => part.trim());
      const wanted = Math.round(optionNumber(step, "index", 0));
      const picked = wanted < 0 ? parts[parts.length + wanted] : parts[wanted];
      return picked ?? "";
    }
    case "pick": {
      const separator = optionText(step, "separator", ",") || ",";
      const parts = value
        .split(separator)
        .map((part) => part.trim())
        .filter(Boolean);
      if (!parts.length) return "";
      return (optionText(step, "position", "first") === "last" ? parts[parts.length - 1] : parts[0]) ?? "";
    }
    case "template": {
      const pattern = optionText(step, "pattern");
      return pattern ? fillTemplate(pattern, value, row) : value;
    }
    case "conditional": {
      const operator = optionText(step, "operator", "equals");
      const compare = optionText(step, "compare");
      const number = readNumber(value);
      const compareNumber = readNumber(compare);
      const matched =
        operator === "empty"
          ? value.trim() === ""
          : operator === "contains"
            ? value.includes(compare)
            : operator === "gt"
              ? number !== null && compareNumber !== null && number > compareNumber
              : operator === "lt"
                ? number !== null && compareNumber !== null && number < compareNumber
                : value.trim() === compare.trim();
      const branch = optionText(step, matched ? "then" : "else", "{{value}}");
      return fillTemplate(branch || "{{value}}", value, row);
    }
    case "date_format": {
      const date = parseDate(value);
      if (!date) return value;
      const target = optionText(step, "to", "iso");
      const day = pad(date.getUTCDate());
      const month = pad(date.getUTCMonth() + 1);
      const year = date.getUTCFullYear();
      if (target === "tr") return `${day}.${month}.${year}`;
      if (target === "datetime") {
        return `${day}.${month}.${year} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;
      }
      return date.toISOString().slice(0, 10);
    }
    case "custom_js": {
      const expression = optionText(step, "expression").trim();
      if (!expression) return value;
      const result = evaluateExpression(expression, {
        value,
        num: readNumber(value) ?? 0,
        length: value.length,
      });
      return typeof result === "number" ? String(result) : toText(result);
    }
    default:
      return value;
  }
}

/** Bir alanın kural zincirini sırayla uygular; hatalı kural değeri bozmaz. */
export function applyTransforms(
  value: string,
  steps: TransformStep[] | undefined,
  row: Record<string, string> = {},
): string {
  if (!steps?.length) return value;
  let current = value;
  for (const step of steps.slice(0, 20)) {
    try {
      current = applyTransformStep(current, step, row);
    } catch {
      // Hatalı kural (ör. geçersiz ifade) satırı düşürmemeli.
      return current;
    }
  }
  return current;
}

/** Kaydedilmiş ham kuralları güvenli biçime çevirir. */
export function parseTransformRules(raw: unknown): TransformRules {
  if (!raw || typeof raw !== "object") return {};
  const rules: TransformRules = {};
  for (const [field, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!Array.isArray(value)) continue;
    const steps: TransformStep[] = [];
    for (const item of value.slice(0, 20)) {
      if (!item || typeof item !== "object") continue;
      const kind = (item as { kind?: unknown }).kind;
      if (typeof kind !== "string" || !(kind in TRANSFORM_BY_KIND)) continue;
      const options = (item as { options?: unknown }).options;
      steps.push({
        kind: kind as TransformKind,
        options: options && typeof options === "object" ? (options as Record<string, string | number>) : {},
      });
    }
    if (steps.length) rules[field] = steps;
  }
  return rules;
}

/** Kural zincirinin kısa özeti (kart üzerinde gösterilir). */
export function describeTransforms(steps: TransformStep[] | undefined): string {
  if (!steps?.length) return "";
  return steps.map((step) => TRANSFORM_BY_KIND[step.kind]?.label ?? step.kind).join(" → ");
}
