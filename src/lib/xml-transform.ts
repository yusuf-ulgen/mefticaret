/**
 * XML Entegratör v2 — dönüştürme motoru (16 kural tipi).
 *
 * Saf fonksiyonlardır: veri erişimi, ağ çağrısı veya `eval` kullanılmaz.
 * `custom_js` kuralı, kendi güvenli ifade yorumlayıcımızda çalışır; JavaScript
 * runtime'ına erişim verilmez (global, window, fetch, import erişimi yok).
 */

export type TransformType =
  | "trim"
  | "uppercase"
  | "lowercase"
  | "replace"
  | "truncate"
  | "multiply"
  | "round"
  | "add_vat"
  | "remove_vat"
  | "currency"
  | "join"
  | "split"
  | "first"
  | "last"
  | "template"
  | "conditional"
  | "date_format"
  | "custom_js";

export type TransformRule = {
  type: TransformType;
  /** replace: aranan (regex destekli), conditional: karşılaştırılan değer */
  search?: string;
  /** replace: yerine yazılan */
  replace?: string;
  /** truncate: karakter sayısı */
  length?: number;
  /** multiply / currency: çarpan veya kur */
  factor?: number;
  /** round: ondalık hane */
  decimals?: number;
  /** add_vat / remove_vat: KDV oranı (%) */
  rate?: number;
  /** join / split: ayırıcı */
  delimiter?: string;
  /** template: "{{value}} - Marka" */
  template?: string;
  /** conditional: operatör */
  operator?: "eq" | "neq" | "contains" | "gt" | "lt" | "empty" | "not_empty";
  /** conditional: koşul doğruysa / yanlışsa */
  then?: string;
  else?: string;
  /** date_format: kaynak ve hedef biçim */
  from?: string;
  to?: string;
  /** custom_js: güvenli ifade (value değişkeni kullanılabilir) */
  expression?: string;
  /** replace: regex bayrakları */
  flags?: string;
};

export type TransformValue = string | string[];

export type TransformRules = Record<string, TransformRule[]>;

export const TRANSFORM_TYPES: Array<{
  type: TransformType;
  label: string;
  group: "text" | "number" | "list" | "logic";
  hint: string;
}> = [
  { type: "trim", label: "Boşlukları temizle", group: "text", hint: "Baş ve sondaki boşlukları siler" },
  { type: "uppercase", label: "BÜYÜK HARF", group: "text", hint: "Tümünü büyük harfe çevirir" },
  { type: "lowercase", label: "küçük harf", group: "text", hint: "Tümünü küçük harfe çevirir" },
  { type: "replace", label: "Değiştir (regex)", group: "text", hint: "Aranan metni/deseni yenisiyle değiştirir" },
  { type: "truncate", label: "Karaktere kes", group: "text", hint: "Belirtilen uzunlukta keser" },
  { type: "multiply", label: "Çarp", group: "number", hint: "Sayıyı verilen katsayıyla çarpar" },
  { type: "round", label: "Yuvarla", group: "number", hint: "Belirtilen ondalık haneye yuvarlar" },
  { type: "add_vat", label: "KDV ekle", group: "number", hint: "Tutara KDV oranını ekler" },
  { type: "remove_vat", label: "KDV çıkar", group: "number", hint: "KDV dahil tutardan KDV'yi düşer" },
  { type: "currency", label: "Döviz çevir", group: "number", hint: "Tutarı verilen kurla çarpar" },
  { type: "join", label: "Diziyi birleştir", group: "list", hint: "Listeyi ayırıcıyla metne çevirir" },
  { type: "split", label: "Metni böl", group: "list", hint: "Metni ayırıcıdan listeye böler" },
  { type: "first", label: "İlk eleman", group: "list", hint: "Listenin ilk değerini alır" },
  { type: "last", label: "Son eleman", group: "list", hint: "Listenin son değerini alır" },
  { type: "template", label: "Şablon", group: "logic", hint: '"{{value}} - Marka" biçiminde birleştirir' },
  { type: "conditional", label: "Koşullu değer", group: "logic", hint: "Koşul doğruysa/yanlışsa farklı değer yazar" },
  { type: "date_format", label: "Tarih biçimi", group: "logic", hint: "Kaynak tarih biçimini hedefe çevirir" },
  { type: "custom_js", label: "Özel ifade", group: "logic", hint: "Korumalı ifade: value * 1.2, upper(value) …" },
];

const asText = (value: TransformValue): string => (Array.isArray(value) ? value.join(",") : value ?? "");

const asList = (value: TransformValue): string[] =>
  Array.isArray(value) ? value : String(value ?? "").split(/[,;|]/).map((part) => part.trim()).filter(Boolean);

/** Türkçe/İngiliz ondalık ayırıcılarını tolere eden sayı okuma. */
export function toNumber(value: TransformValue): number {
  const text = asText(value).replace(/[^\d,.\-]/g, "").trim();
  if (!text) return 0;
  const lastComma = text.lastIndexOf(",");
  const lastDot = text.lastIndexOf(".");
  const normalized = lastComma > lastDot ? text.replace(/\./g, "").replace(",", ".") : text.replace(/,/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

const formatNumber = (value: number, decimals = 2): string =>
  Number.isInteger(value) && decimals === 0 ? String(value) : value.toFixed(decimals);

/* ------------------------------------------------------------------ */
/* Güvenli ifade yorumlayıcısı (custom_js)                            */
/* ------------------------------------------------------------------ */

type Token = { kind: "num" | "str" | "id" | "op"; text: string };

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let index = 0;
  while (index < input.length) {
    const char = input[index]!;
    if (/\s/.test(char)) {
      index += 1;
      continue;
    }
    if (/[0-9]/.test(char) || (char === "." && /[0-9]/.test(input[index + 1] ?? ""))) {
      let text = "";
      while (index < input.length && /[0-9.]/.test(input[index]!)) text += input[index++]!;
      tokens.push({ kind: "num", text });
      continue;
    }
    if (char === '"' || char === "'") {
      let text = "";
      index += 1;
      while (index < input.length && input[index] !== char) text += input[index++]!;
      index += 1;
      tokens.push({ kind: "str", text });
      continue;
    }
    if (/[A-Za-z_]/.test(char)) {
      let text = "";
      while (index < input.length && /[A-Za-z0-9_]/.test(input[index]!)) text += input[index++]!;
      tokens.push({ kind: "id", text });
      continue;
    }
    const two = input.slice(index, index + 2);
    if (["==", "!=", ">=", "<=", "&&", "||"].includes(two)) {
      tokens.push({ kind: "op", text: two });
      index += 2;
      continue;
    }
    if ("+-*/%()<>?:,".includes(char)) {
      tokens.push({ kind: "op", text: char });
      index += 1;
      continue;
    }
    throw new Error(`İfadede desteklenmeyen karakter: ${char}`);
  }
  return tokens;
}

type Scalar = string | number | boolean;

const FUNCTIONS: Record<string, (args: Scalar[]) => Scalar> = {
  upper: (args) => String(args[0] ?? "").toUpperCase(),
  lower: (args) => String(args[0] ?? "").toLowerCase(),
  trim: (args) => String(args[0] ?? "").trim(),
  len: (args) => String(args[0] ?? "").length,
  number: (args) => toNumber(String(args[0] ?? "")),
  round: (args) => {
    const digits = Math.min(6, Math.max(0, Number(args[1] ?? 0)));
    const factor = 10 ** digits;
    return Math.round(Number(args[0] ?? 0) * factor) / factor;
  },
  abs: (args) => Math.abs(Number(args[0] ?? 0)),
  min: (args) => Math.min(...args.map((arg) => Number(arg))),
  max: (args) => Math.max(...args.map((arg) => Number(arg))),
  slice: (args) => String(args[0] ?? "").slice(Number(args[1] ?? 0), args[2] === undefined ? undefined : Number(args[2])),
  replace: (args) => String(args[0] ?? "").split(String(args[1] ?? "")).join(String(args[2] ?? "")),
  contains: (args) => String(args[0] ?? "").includes(String(args[1] ?? "")),
};

/**
 * Yalnızca aritmetik, karşılaştırma, koşul ve beyaz listedeki fonksiyonları
 * destekleyen özyinelemeli inişli yorumlayıcı. JavaScript kodu çalıştırmaz.
 */
export function evaluateExpression(expression: string, value: TransformValue): string {
  if (expression.length > 500) throw new Error("İfade çok uzun");
  const tokens = tokenize(expression);
  let position = 0;

  const peek = () => tokens[position];
  const eat = (text: string) => {
    if (peek()?.text === text) {
      position += 1;
      return true;
    }
    return false;
  };

  const parseTernary = (): Scalar => {
    const condition = parseOr();
    if (eat("?")) {
      const truthy = parseTernary();
      if (!eat(":")) throw new Error("Koşullu ifadede ':' eksik");
      const falsy = parseTernary();
      return condition ? truthy : falsy;
    }
    return condition;
  };

  function parseOr(): Scalar {
    let left = parseAnd();
    while (peek()?.text === "||") {
      position += 1;
      const right = parseAnd();
      left = Boolean(left) || Boolean(right);
    }
    return left;
  }

  function parseAnd(): Scalar {
    let left = parseComparison();
    while (peek()?.text === "&&") {
      position += 1;
      const right = parseComparison();
      left = Boolean(left) && Boolean(right);
    }
    return left;
  }

  function parseComparison(): Scalar {
    let left = parseSum();
    for (;;) {
      const op = peek()?.text;
      if (op && ["==", "!=", ">", "<", ">=", "<="].includes(op)) {
        position += 1;
        const right = parseSum();
        const bothNumeric = typeof left === "number" && typeof right === "number";
        const a = bothNumeric ? (left as number) : String(left);
        const b = bothNumeric ? (right as number) : String(right);
        if (op === "==") left = a === b;
        else if (op === "!=") left = a !== b;
        else if (op === ">") left = a > b;
        else if (op === "<") left = a < b;
        else if (op === ">=") left = a >= b;
        else left = a <= b;
        continue;
      }
      return left;
    }
  }

  function parseSum(): Scalar {
    let left = parseProduct();
    for (;;) {
      if (eat("+")) {
        const right = parseProduct();
        left =
          typeof left === "number" && typeof right === "number"
            ? left + right
            : `${String(left)}${String(right)}`;
        continue;
      }
      if (eat("-")) {
        const right = parseProduct();
        left = Number(left) - Number(right);
        continue;
      }
      return left;
    }
  }

  function parseProduct(): Scalar {
    let left = parseUnary();
    for (;;) {
      if (eat("*")) {
        left = Number(left) * Number(parseUnary());
        continue;
      }
      if (eat("/")) {
        const divisor = Number(parseUnary());
        left = divisor === 0 ? 0 : Number(left) / divisor;
        continue;
      }
      if (eat("%")) {
        const divisor = Number(parseUnary());
        left = divisor === 0 ? 0 : Number(left) % divisor;
        continue;
      }
      return left;
    }
  }

  function parseUnary(): Scalar {
    if (eat("-")) return -Number(parseUnary());
    if (eat("+")) return Number(parseUnary());
    return parsePrimary();
  }

  function parsePrimary(): Scalar {
    const token = peek();
    if (!token) throw new Error("İfade beklenmedik şekilde bitti");
    if (token.kind === "num") {
      position += 1;
      return Number(token.text);
    }
    if (token.kind === "str") {
      position += 1;
      return token.text;
    }
    if (token.kind === "id") {
      position += 1;
      if (token.text === "value") {
        const text = asText(value);
        const numeric = Number(text.replace(",", "."));
        return text !== "" && Number.isFinite(numeric) ? numeric : text;
      }
      if (token.text === "text") return asText(value);
      if (token.text === "true") return true;
      if (token.text === "false") return false;
      const fn = FUNCTIONS[token.text];
      if (!fn) throw new Error(`Bilinmeyen ifade adı: ${token.text}`);
      if (!eat("(")) throw new Error(`${token.text} için parantez gerekli`);
      const args: Scalar[] = [];
      if (!eat(")")) {
        do {
          args.push(parseTernary());
        } while (eat(","));
        if (!eat(")")) throw new Error("Parantez kapatılmadı");
      }
      return fn(args);
    }
    if (eat("(")) {
      const inner = parseTernary();
      if (!eat(")")) throw new Error("Parantez kapatılmadı");
      return inner;
    }
    throw new Error(`Beklenmeyen ifade: ${token.text}`);
  }

  const result = parseTernary();
  if (position !== tokens.length) throw new Error("İfade tamamen çözümlenemedi");
  if (typeof result === "number") return Number.isInteger(result) ? String(result) : String(Number(result.toFixed(4)));
  return String(result);
}

/* ------------------------------------------------------------------ */
/* Tarih biçimlendirme                                                */
/* ------------------------------------------------------------------ */

function parseDateWithFormat(text: string, from?: string): Date | null {
  const value = text.trim();
  if (!value) return null;
  if (!from || from === "auto" || from.toLowerCase() === "iso") {
    const iso = new Date(value);
    return Number.isNaN(iso.getTime()) ? null : iso;
  }
  const order: string[] = [];
  const pattern = from
    .replace(/yyyy/g, () => {
      order.push("y");
      return "(\\d{4})";
    })
    .replace(/MM/g, () => {
      order.push("M");
      return "(\\d{2})";
    })
    .replace(/dd/g, () => {
      order.push("d");
      return "(\\d{2})";
    })
    .replace(/HH/g, () => {
      order.push("H");
      return "(\\d{2})";
    })
    .replace(/mm/g, () => {
      order.push("m");
      return "(\\d{2})";
    })
    .replace(/ss/g, () => {
      order.push("s");
      return "(\\d{2})";
    })
    .replace(/[.]/g, "\\.");
  const match = new RegExp(`^${pattern}$`).exec(value);
  if (!match) return null;
  const parts: Record<string, number> = { y: 1970, M: 1, d: 1, H: 0, m: 0, s: 0 };
  order.forEach((key, index) => {
    parts[key] = Number(match[index + 1]);
  });
  const date = new Date(Date.UTC(parts["y"]!, parts["M"]! - 1, parts["d"]!, parts["H"], parts["m"], parts["s"]));
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(date: Date, to?: string): string {
  if (!to || to.toLowerCase() === "iso") return date.toISOString();
  const pad = (input: number) => String(input).padStart(2, "0");
  return to
    .replace(/yyyy/g, String(date.getUTCFullYear()))
    .replace(/MM/g, pad(date.getUTCMonth() + 1))
    .replace(/dd/g, pad(date.getUTCDate()))
    .replace(/HH/g, pad(date.getUTCHours()))
    .replace(/mm/g, pad(date.getUTCMinutes()))
    .replace(/ss/g, pad(date.getUTCSeconds()));
}

/* ------------------------------------------------------------------ */
/* Kural uygulama                                                     */
/* ------------------------------------------------------------------ */

/** Tek bir dönüşüm kuralını uygular. Hata fırlatmaz; hatalıysa değeri korur. */
export function applyTransform(value: TransformValue, rule: TransformRule): TransformValue {
  switch (rule.type) {
    case "trim":
      return Array.isArray(value) ? value.map((item) => item.trim()) : asText(value).trim();
    case "uppercase":
      return asText(value).toLocaleUpperCase("tr");
    case "lowercase":
      return asText(value).toLocaleLowerCase("tr");
    case "replace": {
      const search = rule.search ?? "";
      if (!search) return value;
      try {
        const flags = (rule.flags ?? "g").replace(/[^gimsu]/g, "") || "g";
        return asText(value).replace(new RegExp(search, flags), rule.replace ?? "");
      } catch {
        return asText(value).split(search).join(rule.replace ?? "");
      }
    }
    case "truncate": {
      const limit = Math.max(1, Math.min(20000, Math.round(rule.length ?? 100)));
      const text = asText(value);
      return text.length > limit ? text.slice(0, limit).trimEnd() : text;
    }
    case "multiply":
      return formatNumber(toNumber(value) * (rule.factor ?? 1), rule.decimals ?? 2);
    case "round": {
      const digits = Math.max(0, Math.min(6, Math.round(rule.decimals ?? 0)));
      const factor = 10 ** digits;
      return formatNumber(Math.round(toNumber(value) * factor) / factor, digits);
    }
    case "add_vat":
      return formatNumber(toNumber(value) * (1 + (rule.rate ?? 20) / 100), rule.decimals ?? 2);
    case "remove_vat": {
      const divisor = 1 + (rule.rate ?? 20) / 100;
      return formatNumber(divisor === 0 ? 0 : toNumber(value) / divisor, rule.decimals ?? 2);
    }
    case "currency":
      return formatNumber(toNumber(value) * (rule.factor ?? 1), rule.decimals ?? 2);
    case "join":
      return asList(value).join(rule.delimiter ?? ",");
    case "split":
      return asText(value)
        .split(rule.delimiter ?? ",")
        .map((part) => part.trim())
        .filter(Boolean);
    case "first":
      return asList(value)[0] ?? "";
    case "last": {
      const list = asList(value);
      return list[list.length - 1] ?? "";
    }
    case "template":
      return (rule.template ?? "{{value}}").replace(/\{\{\s*value\s*\}\}/g, asText(value));
    case "conditional": {
      const text = asText(value);
      const operator = rule.operator ?? "eq";
      const target = rule.search ?? "";
      let matched = false;
      if (operator === "eq") matched = text === target;
      else if (operator === "neq") matched = text !== target;
      else if (operator === "contains") matched = text.includes(target);
      else if (operator === "gt") matched = toNumber(text) > toNumber(target);
      else if (operator === "lt") matched = toNumber(text) < toNumber(target);
      else if (operator === "empty") matched = text.trim() === "";
      else matched = text.trim() !== "";
      const output = matched ? rule.then : rule.else;
      return output === undefined || output === null ? text : output.replace(/\{\{\s*value\s*\}\}/g, text);
    }
    case "date_format": {
      const date = parseDateWithFormat(asText(value), rule.from);
      return date ? formatDate(date, rule.to) : asText(value);
    }
    case "custom_js": {
      if (!rule.expression) return value;
      try {
        return evaluateExpression(rule.expression, value);
      } catch {
        return asText(value);
      }
    }
    default:
      return value;
  }
}

/** Kural zincirini sırayla uygular ve metin döner. */
export function applyTransformChain(value: TransformValue, rules: TransformRule[] | undefined): string {
  if (!rules?.length) return asText(value);
  let current: TransformValue = value;
  for (const rule of rules.slice(0, 12)) current = applyTransform(current, rule);
  return asText(current);
}

/** Alan bazlı kural setini eşleştirilmiş satıra uygular. */
export function applyFieldTransforms<T extends Record<string, unknown>>(row: T, rules: TransformRules): T {
  if (!rules || !Object.keys(rules).length) return row;
  const output: Record<string, unknown> = { ...row };
  for (const [field, chain] of Object.entries(rules)) {
    if (!chain?.length) continue;
    const raw = output[field];
    if (raw === undefined || raw === null) continue;
    const input: TransformValue = Array.isArray(raw) ? raw.map((item) => String(item)) : String(raw);
    const result = applyTransformChain(input, chain);
    output[field] = typeof raw === "number" ? toNumber(result) : result;
  }
  return output as T;
}

/** Kural özetini insan diliyle anlatır (arayüzde etiket olarak kullanılır). */
export function describeTransform(rule: TransformRule): string {
  const meta = TRANSFORM_TYPES.find((item) => item.type === rule.type);
  const label = meta?.label ?? rule.type;
  switch (rule.type) {
    case "replace":
      return `${label}: "${rule.search ?? ""}" → "${rule.replace ?? ""}"`;
    case "truncate":
      return `${label}: ${rule.length ?? 100} karakter`;
    case "multiply":
    case "currency":
      return `${label}: ×${rule.factor ?? 1}`;
    case "round":
      return `${label}: ${rule.decimals ?? 0} hane`;
    case "add_vat":
    case "remove_vat":
      return `${label}: %${rule.rate ?? 20}`;
    case "join":
    case "split":
      return `${label}: "${rule.delimiter ?? ","}"`;
    case "template":
      return `${label}: ${rule.template ?? "{{value}}"}`;
    case "conditional":
      return `${label}: ${rule.operator ?? "eq"} "${rule.search ?? ""}"`;
    case "date_format":
      return `${label}: ${rule.from ?? "auto"} → ${rule.to ?? "ISO"}`;
    case "custom_js":
      return `${label}: ${rule.expression ?? ""}`;
    default:
      return label;
  }
}
