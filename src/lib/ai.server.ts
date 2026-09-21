/**
 * Mefticaret AI motoru — tüm çağrılar yalnızca OpenAI'ye gider.
 *
 * Model seçimi süper admin panelindeki motor ayarlarından okunur; mağaza
 * bağlamı verildiğinde çağrıdan önce kredi kontrolü, başarılı yanıttan sonra
 * kredi düşümü yapılır. Yalnızca sunucu tarafında çalışır.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import { AI_TASK_MAP, type AiTask } from "@/lib/ai-tasks";
import { PURPOSE_MODEL_CLASS, purposeForTask, type AiCreditPurpose } from "@/lib/ai-credits";
import {
  assertAiCredits,
  consumeAiCredits,
  loadAiEngineSettings,
  modelForPurpose,
  usdCost,
} from "@/lib/ai-credits.server";

type Client = SupabaseClient<Database>;

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export type ProviderResult = {
  text: string;
  inputTokens: number;
  outputTokens: number;
  model: string;
  creditsUsed: number;
  costUsd: number;
};

export type StoreAiSettings = {
  providerCode: string;
  model: string;
  creativity: number;
  brandTone: string;
  language: string;
  monthlyTokenLimit: number;
  isEnabled: boolean;
};

export const DEFAULT_AI_SETTINGS: StoreAiSettings = {
  providerCode: "openai",
  model: "gpt-4o-mini",
  creativity: 0.7,
  brandTone: "premium",
  language: "tr",
  monthlyTokenLimit: 500_000,
  isEnabled: true,
};

class AiError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
  }
}

function gatewayError(status: number, detail: string): AiError {
  if (status === 401) return new AiError("OpenAI anahtarı geçersiz veya tanımlı değil.", false);
  if (status === 402) return new AiError("OpenAI hesabında bakiye kalmadı.", false);
  if (status === 403) return new AiError("OpenAI bu isteği reddetti.", false);
  if (status === 429)
    return new AiError("OpenAI istek limiti aşıldı, kısa süre sonra tekrar deneyin.", true);
  if (status >= 500) return new AiError("OpenAI geçici olarak yanıt vermiyor.", true);
  return new AiError(`AI isteği başarısız (${status}): ${detail.slice(0, 200)}`, false);
}

async function callOpenAi(
  model: string,
  messages: ChatMessage[],
  temperature: number,
  maxTokens: number,
): Promise<{ text: string; inputTokens: number; outputTokens: number }> {
  const apiKey = process.env["OPENAI_API_KEY"];
  if (!apiKey)
    throw new AiError("OpenAI anahtarı tanımlı değil. Süper admin panelinden ekleyin.", false);

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages, temperature, max_tokens: maxTokens }),
  });
  if (!response.ok) throw gatewayError(response.status, await response.text());

  const payload = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  const text = payload.choices?.[0]?.message?.content?.trim();
  if (!text) throw new AiError("AI boş yanıt döndü", true);
  return {
    text,
    inputTokens: payload.usage?.prompt_tokens ?? 0,
    outputTokens: payload.usage?.completion_tokens ?? 0,
  };
}

/**
 * Merkezî AI çalıştırıcı: model yönlendirmesi + kredi kapısı + OpenAI çağrısı.
 * `charge` verildiğinde kredi yetersizse OpenAI'ye istek gönderilmez.
 */
export async function callProvider(options: {
  providerCode?: string;
  model?: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  purpose?: AiCreditPurpose;
  charge?: { storeId: string; userId?: string | null; task?: string | null };
}): Promise<ProviderResult> {
  const temperature = Math.min(Math.max(options.temperature ?? 0.7, 0), 1);
  const maxTokens = Math.max(options.maxTokens ?? 900, 1500);
  const purpose: AiCreditPurpose = options.purpose ?? "text";

  const engine = await loadAiEngineSettings();
  if (!engine.isEnabled) throw new AiError("Yapay zekâ motoru şu anda kapalı.", false);
  const model = modelForPurpose(engine, purpose);

  let credits = 0;
  if (options.charge) {
    const gate = await assertAiCredits(options.charge.storeId, purpose);
    credits = gate.credits;
  }

  const result = await callOpenAi(model, options.messages, temperature, maxTokens);
  const costUsd = usdCost(
    engine,
    PURPOSE_MODEL_CLASS[purpose],
    result.inputTokens,
    result.outputTokens,
  );

  if (options.charge && credits > 0) {
    await consumeAiCredits({
      storeId: options.charge.storeId,
      credits,
      purpose,
      task: options.charge.task ?? null,
      userId: options.charge.userId ?? null,
    });
  }

  return { ...result, model, creditsUsed: credits, costUsd };
}

export async function loadStoreAiSettings(
  client: Client,
  storeId: string,
): Promise<StoreAiSettings> {
  const engine = await loadAiEngineSettings();
  const { data, error } = await client
    .from("store_ai_settings")
    .select(
      "provider_code, model, creativity, brand_tone, language, monthly_token_limit, is_enabled",
    )
    .eq("store_id", storeId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  // Sağlayıcı ve model artık yalnızca platform motor ayarlarından gelir.
  if (!data) return { ...DEFAULT_AI_SETTINGS, model: engine.modelFast };
  return {
    providerCode: "openai",
    model: engine.modelFast,
    creativity: Number(data.creativity),
    brandTone: data.brand_tone,
    language: data.language,
    monthlyTokenLimit: data.monthly_token_limit,
    isEnabled: data.is_enabled,
  };
}

function monthStart(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

export async function monthlyTokenUsage(client: Client, storeId: string): Promise<number> {
  const { data, error } = await client
    .from("ai_generations")
    .select("total_tokens")
    .eq("store_id", storeId)
    .gte("created_at", monthStart());
  if (error) throw new Error(error.message);
  return (data ?? []).reduce((sum, row) => sum + (row.total_tokens ?? 0), 0);
}

async function logGeneration(entry: {
  storeId: string;
  userId: string | null;
  task: string;
  providerCode: string;
  model: string;
  prompt: string;
  output: string | null;
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
  status: "success" | "error";
  error?: string | null;
  creditsUsed?: number;
  costUsd?: number;
}) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin.from("ai_generations").insert({
    store_id: entry.storeId,
    user_id: entry.userId,
    task: entry.task,
    provider_code: entry.providerCode,
    model: entry.model,
    prompt: entry.prompt.slice(0, 8000),
    output: entry.output ? entry.output.slice(0, 20000) : null,
    input_tokens: entry.inputTokens,
    output_tokens: entry.outputTokens,
    total_tokens: entry.inputTokens + entry.outputTokens,
    duration_ms: entry.durationMs,
    status: entry.status,
    error: entry.error ?? null,
    credits_used: entry.creditsUsed ?? 0,
    cost_usd: entry.costUsd ?? 0,
  });
}

/** Mağaza bağlamında istemi kurar, sağlayıcıyı çağırır ve kullanımı kaydeder. */
export async function runAiTask(options: {
  client: Client;
  storeId: string;
  userId: string;
  taskKey: string;
  values: Record<string, string>;
}): Promise<{
  text: string;
  task: AiTask;
  totalTokens: number;
  model: string;
  providerCode: string;
  creditsUsed: number;
}> {
  const task = AI_TASK_MAP.get(options.taskKey);
  if (!task) throw new Error("Bilinmeyen AI görevi");

  const { data: store, error: storeError } = await options.client
    .from("stores")
    .select("id, name, industry")
    .eq("id", options.storeId)
    .maybeSingle();
  if (storeError) throw new Error(storeError.message);
  if (!store) throw new Error("Mağaza bulunamadı veya yetkiniz yok");

  const settings = await loadStoreAiSettings(options.client, options.storeId);
  if (!settings.isEnabled) throw new Error("Bu mağaza için AI kullanımı kapalı");

  const used = await monthlyTokenUsage(options.client, options.storeId);
  if (settings.monthlyTokenLimit > 0 && used >= settings.monthlyTokenLimit) {
    throw new Error(
      "Bu ay için AI token limitiniz doldu. Limiti AI ayarlarından yükseltebilirsiniz.",
    );
  }

  const lines = [
    `Mağaza: ${store.name}${store.industry ? ` (${store.industry})` : ""}`,
    `Marka tonu: ${options.values["tone"] ?? settings.brandTone}`,
    `Çıktı dili: ${settings.language === "tr" ? "Türkçe" : settings.language}`,
  ];

  for (const field of task.fields) {
    const value = (options.values[field.name] ?? "").trim();
    if (field.required && !value) throw new Error(`${field.label} alanı zorunlu`);
    if (value && field.name !== "tone") lines.push(`${field.label}: ${value}`);
  }

  if (task.key === "sales_analysis") {
    const { buildInsightPrompt, collectStoreMetrics } = await import("@/lib/analytics.server");
    const days = Number(options.values["days"] ?? 30) || 30;
    const metrics = await collectStoreMetrics(options.client, options.storeId, days);
    lines.push(buildInsightPrompt(metrics, days));
  }

  const prompt = lines.join("\n");
  const started = Date.now();

  const purpose = purposeForTask(task.key);

  try {
    const result = await callProvider({
      messages: [
        { role: "system", content: task.system },
        { role: "user", content: prompt },
      ],
      temperature: settings.creativity,
      maxTokens: task.maxTokens,
      purpose,
      charge: { storeId: options.storeId, userId: options.userId, task: task.key },
    });

    await logGeneration({
      storeId: options.storeId,
      userId: options.userId,
      task: task.key,
      providerCode: "openai",
      model: result.model,
      prompt,
      output: result.text,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      durationMs: Date.now() - started,
      status: "success",
      creditsUsed: result.creditsUsed,
      costUsd: result.costUsd,
    });

    return {
      text: result.text,
      task,
      totalTokens: result.inputTokens + result.outputTokens,
      model: result.model,
      providerCode: "openai",
      creditsUsed: result.creditsUsed,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI isteği başarısız";
    await logGeneration({
      storeId: options.storeId,
      userId: options.userId,
      task: task.key,
      providerCode: "openai",
      model: settings.model,
      prompt,
      output: null,
      inputTokens: 0,
      outputTokens: 0,
      durationMs: Date.now() - started,
      status: "error",
      error: message,
    });
    throw new Error(message);
  }
}

export const COPY_SYSTEM_PROMPT = AI_TASK_MAP.get("product_description")!.system;
export const INSIGHT_SYSTEM_PROMPT = AI_TASK_MAP.get("sales_analysis")!.system;

/** Kredi kapısı olmayan platform içi çağrı (süper admin işleri). */
export async function chatComplete(messages: ChatMessage[], maxTokens = 900): Promise<string> {
  const result = await callProvider({ messages, maxTokens, purpose: "text" });
  return result.text;
}
