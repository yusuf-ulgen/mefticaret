/**
 * AI kategori eşleme servisi.
 *
 * Kaynak (tedarikçi/pazaryeri) kategori adlarını mağazanın kategori ağacıyla
 * eşleştirmek için merkezî AI çalıştırıcısını kullanır. Yalnızca sunucu tarafı.
 */

import { callProvider } from "@/lib/ai.server";

export type AiCategorySuggestion = {
  source: string;
  targetId: string | null;
  targetName: string | null;
  confidence: number;
  reason: string | null;
};

const SYSTEM_PROMPT =
  "Sen bir e-ticaret kategori eşleme uzmanısın. Yanıtın SADECE geçerli bir JSON dizisi olmalı; " +
  "açıklama, markdown veya kod bloğu ekleme.";

function extractJsonArray(text: string): unknown {
  const cleaned = text
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();
  const start = cleaned.indexOf("[");
  const end = cleaned.lastIndexOf("]");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }
}

function clampConfidence(value: unknown): number {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.min(Math.max(num, 0), 1);
}

/**
 * Kaynak kategorileri hedef kategorilerle eşleştirir.
 * Hata durumunda boş dizi döner — içe aktarım akışı bozulmaz.
 */
export async function suggestCategoryMappings(input: {
  sourceCategories: string[];
  targetCategories: { id: string; name: string }[];
  charge?: { storeId: string; userId?: string | null };
}): Promise<{ suggestions: AiCategorySuggestion[]; creditsUsed: number; model: string | null }> {
  if (!input.sourceCategories.length || !input.targetCategories.length)
    return { suggestions: [], creditsUsed: 0, model: null };

  const allowedIds = new Set(input.targetCategories.map((row) => row.id));

  const prompt = [
    "Aşağıdaki 'Kaynak Kategoriler' listesini 'Hedef Kategoriler' listesiyle en mantıklı şekilde eşleştir.",
    "Emin olmadığın kaynak kategorilerde target_id değerini null bırak.",
    "",
    `Kaynak Kategoriler:\n${JSON.stringify(input.sourceCategories)}`,
    "",
    `Hedef Kategoriler:\n${JSON.stringify(input.targetCategories)}`,
    "",
    "Yanıtı SADECE şu JSON biçiminde döndür:",
    '[{"source":"Kaynak Kategori","target_id":"uuid|null","target_name":"Hedef Kategori","confidence":0.95,"reason":"Kısa Türkçe gerekçe"}]',
  ].join("\n");

  const result = await callProvider({
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: prompt },
    ],
    temperature: 0.2,
    maxTokens: 2500,
    purpose: "text",
    ...(input.charge
      ? { charge: { ...input.charge, task: "xml_category_mapping" } }
      : {}),
  });

  const parsed = extractJsonArray(result.text);
  if (!Array.isArray(parsed)) return { suggestions: [], creditsUsed: result.creditsUsed, model: result.model };

  const known = new Set(input.sourceCategories);
  const seen = new Set<string>();
  const suggestions: AiCategorySuggestion[] = [];

  for (const raw of parsed) {
    if (!raw || typeof raw !== "object") continue;
    const row = raw as Record<string, unknown>;
    const source = typeof row["source"] === "string" ? row["source"].trim() : "";
    if (!source || !known.has(source) || seen.has(source)) continue;

    const targetIdRaw = row["target_id"];
    const targetId = typeof targetIdRaw === "string" && allowedIds.has(targetIdRaw) ? targetIdRaw : null;
    const targetName =
      targetId ? (input.targetCategories.find((c) => c.id === targetId)?.name ?? null) : null;
    const reason = typeof row["reason"] === "string" ? row["reason"].trim().slice(0, 500) : null;

    seen.add(source);
    suggestions.push({
      source,
      targetId,
      targetName,
      confidence: targetId ? clampConfidence(row["confidence"]) : 0,
      reason: reason || null,
    });
  }

  return { suggestions, creditsUsed: result.creditsUsed, model: result.model };
}

export type AiFieldSuggestion = {
  targetKey: string;
  sourcePath: string;
  confidence: number;
  reason: string | null;
};

/**
 * Kaynak XML/CSV alan yollarını Mefticaret ürün alanlarıyla eşleştirir.
 * Hedef anahtarların dışındaki öneriler ve bilinmeyen kaynak yolları atılır.
 */
export async function suggestFieldMapping(input: {
  sourceFields: { path: string; sample?: string | null }[];
  targetFields: { key: string; label: string; hint?: string | null }[];
  charge?: { storeId: string; userId?: string | null };
}): Promise<{ suggestions: AiFieldSuggestion[]; creditsUsed: number }> {
  if (!input.sourceFields.length) return { suggestions: [], creditsUsed: 0 };

  const allowedPaths = new Set(input.sourceFields.map((row) => row.path));
  const allowedKeys = new Set(input.targetFields.map((row) => row.key));

  const prompt = [
    "Bir tedarikçi ürün dosyasındaki alanları e-ticaret sistemimizin ürün alanlarıyla eşleştir.",
    "Emin olmadığın hedef alanı hiç yazma; her hedef alan en fazla bir kez kullanılabilir.",
    "",
    `Kaynak Alanlar (yol ve örnek değer):\n${JSON.stringify(input.sourceFields)}`,
    "",
    `Hedef Alanlar:\n${JSON.stringify(input.targetFields)}`,
    "",
    "Yanıtı SADECE şu JSON biçiminde döndür:",
    '[{"target_key":"sku","source_path":"Barkod","confidence":0.98,"reason":"Kısa Türkçe gerekçe"}]',
  ].join("\n");

  const result = await callProvider({
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: prompt },
    ],
    temperature: 0.1,
    maxTokens: 2500,
    purpose: "text",
    ...(input.charge ? { charge: { ...input.charge, task: "xml_field_mapping" } } : {}),
  });

  const parsed = extractJsonArray(result.text);
  if (!Array.isArray(parsed)) return { suggestions: [], creditsUsed: result.creditsUsed };

  const usedKeys = new Set<string>();
  const suggestions: AiFieldSuggestion[] = [];
  for (const raw of parsed) {
    if (!raw || typeof raw !== "object") continue;
    const row = raw as Record<string, unknown>;
    const targetKey = typeof row["target_key"] === "string" ? row["target_key"].trim() : "";
    const sourcePath = typeof row["source_path"] === "string" ? row["source_path"].trim() : "";
    if (!allowedKeys.has(targetKey) || !allowedPaths.has(sourcePath) || usedKeys.has(targetKey)) continue;
    const reason = typeof row["reason"] === "string" ? row["reason"].trim().slice(0, 300) : null;
    usedKeys.add(targetKey);
    suggestions.push({
      targetKey,
      sourcePath,
      confidence: clampConfidence(row["confidence"]),
      reason: reason || null,
    });
  }

  return { suggestions, creditsUsed: result.creditsUsed };
}
