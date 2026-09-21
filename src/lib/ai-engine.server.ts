/**
 * Süper admin AI Motor Masası sunucu mantığı.
 * OpenAI anahtarı yalnızca sunucu ortam değişkeninde tutulur; panele hiçbir
 * zaman gönderilmez — yalnızca "bağlı / bağlı değil" durumu döner.
 */

import { clearAiEngineCache, loadAiEngineSettings } from "@/lib/ai-credits.server";

async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export type AiEngineDesk = {
  keyConfigured: boolean;
  engine: Awaited<ReturnType<typeof loadAiEngineSettings>>;
  packages: { id: string; code: string; name: string; credits: number; price: number; currency: string }[];
  finance: {
    monthCostUsd: number;
    monthRequests: number;
    monthCreditsUsed: number;
    monthRevenueTry: number;
    totalCostUsd: number;
    totalRevenueTry: number;
    byModel: { model: string; requests: number; costUsd: number }[];
    daily: { day: string; costUsd: number; credits: number }[];
  };
};

function monthStartIso(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

export async function aiEngineDesk(): Promise<AiEngineDesk> {
  const client = await db();
  const engine = await loadAiEngineSettings(true);
  const start = monthStartIso();

  const [{ data: packages }, { data: generations }, { data: orders }] = await Promise.all([
    client
      .from("ai_credit_packages")
      .select("id, code, name, credits, price, currency")
      .order("sort_order", { ascending: true }),
    client
      .from("ai_generations")
      .select("model, cost_usd, credits_used, created_at")
      .order("created_at", { ascending: false })
      .limit(5000),
    client.from("ai_credit_orders").select("amount, currency, status, created_at").eq("status", "paid"),
  ]);

  const modelMap = new Map<string, { requests: number; costUsd: number }>();
  const dayMap = new Map<string, { costUsd: number; credits: number }>();
  let monthCostUsd = 0;
  let monthRequests = 0;
  let monthCreditsUsed = 0;
  let totalCostUsd = 0;

  for (const row of generations ?? []) {
    const cost = Number(row.cost_usd ?? 0);
    totalCostUsd += cost;
    const model = modelMap.get(row.model) ?? { requests: 0, costUsd: 0 };
    modelMap.set(row.model, { requests: model.requests + 1, costUsd: model.costUsd + cost });
    if (row.created_at >= start) {
      monthCostUsd += cost;
      monthRequests += 1;
      monthCreditsUsed += row.credits_used ?? 0;
      const day = row.created_at.slice(0, 10);
      const bucket = dayMap.get(day) ?? { costUsd: 0, credits: 0 };
      dayMap.set(day, { costUsd: bucket.costUsd + cost, credits: bucket.credits + (row.credits_used ?? 0) });
    }
  }

  let monthRevenueTry = 0;
  let totalRevenueTry = 0;
  for (const row of orders ?? []) {
    const amount = Number(row.amount ?? 0);
    totalRevenueTry += amount;
    if (row.created_at >= start) monthRevenueTry += amount;
  }

  return {
    keyConfigured: Boolean(process.env["OPENAI_API_KEY"]),
    engine,
    packages: (packages ?? []).map((row) => ({ ...row, price: Number(row.price) })),
    finance: {
      monthCostUsd,
      monthRequests,
      monthCreditsUsed,
      monthRevenueTry,
      totalCostUsd,
      totalRevenueTry,
      byModel: [...modelMap.entries()]
        .map(([model, value]) => ({ model, ...value }))
        .sort((a, b) => b.costUsd - a.costUsd),
      daily: [...dayMap.entries()]
        .map(([day, value]) => ({ day, ...value }))
        .sort((a, b) => a.day.localeCompare(b.day)),
    },
  };
}

export async function saveAiEngineConfig(
  input: Record<string, unknown>,
  userId: string,
): Promise<{ ok: true }> {
  const client = await db();
  const map: Record<string, string> = {
    isEnabled: "is_enabled",
    modelFast: "model_fast",
    modelSmart: "model_smart",
    modelImage: "model_image",
    creditCostText: "credit_cost_text",
    creditCostImage: "credit_cost_image",
    creditCostCampaign: "credit_cost_campaign",
    creditCostCopilot: "credit_cost_copilot",
    fastInputUsd: "fast_input_usd_per_mtok",
    fastOutputUsd: "fast_output_usd_per_mtok",
    smartInputUsd: "smart_input_usd_per_mtok",
    smartOutputUsd: "smart_output_usd_per_mtok",
    imageUnitUsd: "image_unit_usd",
  };

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString(), updated_by: userId };
  for (const [key, column] of Object.entries(map)) {
    if (input[key] !== undefined) patch[column] = input[key];
  }

  const { error } = await client
    .from("ai_engine_settings")
    .upsert({ id: true, ...patch } as never, { onConflict: "id" });
  if (error) throw new Error(error.message);
  clearAiEngineCache();
  return { ok: true };
}

/** Anahtarı gerçekten OpenAI'ye sorarak doğrular; anahtar değeri asla dönmez. */
export async function testOpenAiKey(): Promise<{ ok: boolean; message: string; models?: number }> {
  const apiKey = process.env["OPENAI_API_KEY"];
  if (!apiKey) return { ok: false, message: "OpenAI anahtarı tanımlı değil." };
  try {
    const response = await fetch("https://api.openai.com/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (response.status === 401) return { ok: false, message: "Anahtar geçersiz (401)." };
    if (!response.ok) return { ok: false, message: `OpenAI yanıtı: ${response.status}` };
    const payload = (await response.json()) as { data?: unknown[] };
    return { ok: true, message: "Bağlantı başarılı.", models: payload.data?.length ?? 0 };
  } catch {
    return { ok: false, message: "OpenAI'ye ulaşılamadı." };
  }
}
