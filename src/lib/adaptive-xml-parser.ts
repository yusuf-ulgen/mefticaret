import { XMLParser, XMLValidator } from "fast-xml-parser";

export type XmlRootCandidate = {
  path: string;
  label: string;
  count: number;
  score: number;
};

export type AdaptiveXmlResult = {
  rows: Array<Record<string, unknown>>;
  selectedRoot: string | null;
  rootCandidates: XmlRootCandidate[];
};

const PRODUCT_KEYS = [
  "sku", "stok", "code", "kod", "barcode", "barkod", "title", "name", "ad", "urun",
  "price", "fiyat", "cost", "alis", "stock", "quantity", "adet", "image", "resim",
];

function keyScore(value: unknown): number {
  if (!value || typeof value !== "object" || Array.isArray(value)) return 0;
  const keys = Object.keys(value as Record<string, unknown>).map((key) => key.toLocaleLowerCase("tr-TR"));
  return PRODUCT_KEYS.filter((hint) => keys.some((key) => key.includes(hint))).length;
}

function collectCandidates(
  value: unknown,
  path: string,
  output: XmlRootCandidate[],
  values: Map<string, Array<Record<string, unknown>>>,
  depth = 0,
) {
  if (!value || typeof value !== "object" || depth > 10) return;
  if (Array.isArray(value)) {
    const records = value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item));
    if (records.length) {
      const density = records.slice(0, 5).reduce((sum, row) => sum + keyScore(row), 0);
      const label = path.split(".").pop() ?? path;
      const nameBonus = /^(product|urun|ürün|item|record|row|article)$/i.test(label) ? 20 : 0;
      output.push({ path, label, count: records.length, score: records.length * 4 + density * 8 + nameBonus });
      values.set(path, records);
    }
    value.slice(0, 3).forEach((item) => collectCandidates(item, path, output, values, depth + 1));
    return;
  }
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const nextPath = path ? `${path}.${key}` : key;
    if (child && typeof child === "object" && !Array.isArray(child) && keyScore(child) >= 2) {
      output.push({ path: nextPath, label: key, count: 1, score: keyScore(child) * 8 });
      values.set(nextPath, [child as Record<string, unknown>]);
    }
    collectCandidates(child, nextPath, output, values, depth + 1);
  }
}

function findExplicitRows(payload: unknown, itemPath: string): Array<Record<string, unknown>> {
  const wanted = itemPath.trim().toLocaleLowerCase("tr-TR");
  if (!wanted) return [];
  const found: Array<Record<string, unknown>> = [];
  const visit = (value: unknown, path: string, depth: number) => {
    if (!value || typeof value !== "object" || depth > 10) return;
    if (Array.isArray(value)) {
      if (path.toLocaleLowerCase("tr-TR") === wanted || path.toLocaleLowerCase("tr-TR").endsWith(`.${wanted}`)) {
        found.push(...value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item)));
      }
      value.slice(0, 3).forEach((item) => visit(item, path, depth + 1));
      return;
    }
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      const next = path ? `${path}.${key}` : key;
      if ((next.toLocaleLowerCase("tr-TR") === wanted || key.toLocaleLowerCase("tr-TR") === wanted) && child && typeof child === "object" && !Array.isArray(child)) {
        found.push(child as Record<string, unknown>);
      }
      visit(child, next, depth + 1);
    }
  };
  visit(payload, "", 0);
  return found;
}

export function parseAdaptiveXml(xml: string, itemPath?: string | null): AdaptiveXmlResult {
  const text = xml.replace(/^\uFEFF/, "").trim();
  if (!text) throw new Error("XML kaynağı boş yanıt döndürdü");
  if (/<!DOCTYPE|<!ENTITY/i.test(text)) throw new Error("Güvenlik nedeniyle DTD veya ENTITY içeren XML desteklenmiyor");
  const validation = XMLValidator.validate(text);
  if (validation !== true) throw new Error(`XML çözümlenemedi: ${validation.err.msg} (${validation.err.line}:${validation.err.col})`);

  let payload: unknown;
  try {
    payload = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@",
      removeNSPrefix: true,
      trimValues: true,
      parseTagValue: false,
      parseAttributeValue: false,
      processEntities: false,
    }).parse(text) as unknown;
  } catch (error) {
    throw new Error(`XML çözümlenemedi: ${error instanceof Error ? error.message : "geçersiz yapı"}`);
  }

  const candidates: XmlRootCandidate[] = [];
  const values = new Map<string, Array<Record<string, unknown>>>();
  collectCandidates(payload, "", candidates, values);
  const ranked = candidates.sort((a, b) => b.score - a.score || b.count - a.count).slice(0, 20);

  if (itemPath?.trim()) {
    const explicitRows = findExplicitRows(payload, itemPath);
    return { rows: explicitRows, selectedRoot: explicitRows.length ? itemPath.trim() : null, rootCandidates: ranked };
  }

  const selected = ranked[0];
  return {
    rows: selected ? values.get(selected.path) ?? [] : [],
    selectedRoot: selected?.path ?? null,
    rootCandidates: ranked,
  };
}