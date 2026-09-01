/** Modüler AI sağlayıcı katmanı ve kullanım takibi — yalnızca sunucu tarafında çalışır. */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import { AI_TASK_MAP, type AiTask } from "@/lib/ai-tasks";

type Client = SupabaseClient<Database>;

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export type ProviderResult = {
  text: string;
  inputTokens: number;
  outputTokens: number;
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
  providerCode: "lovable",
  model: "google/gemini-3.7-flash",
  creativity: 0.7,
  brandTone: "premium",
  language: "tr",
  monthlyTokenLimit: 500_000,
  isEnabled: true,
};

const LOVABLE_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

class AiError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
  }
}

function gatewayError(status: number, detail: string): AiError {
  if (status === 401) return new AiError("AI servisi yapılandırılmamış (geçersiz anahtar)", false);
  if (status === 402) return new AiError("AI kredisi tükendi. Çalışma alanına kredi ekleyin.", false);
  if (status === 403) return new AiError("AI kullanımı kapalı veya limit dolu. Yönetici onayı gerekiyor.", false);
  if (status === 429) return new AiError("AI istek limiti aşıldı, kısa süre sonra tekrar deneyin.", true);
  if (status >= 500) return new AiError("AI sağlayıcısı geçici olarak yanıt vermiyor.", true);
  return new AiError(`AI isteği başarısız (${status}): ${detail.slice(0, 200)}`, false);
}

async function callLovable(
  model: string,
  messages: ChatMessage[],
  temperature: number,
  maxTokens: number,
): Promise<ProviderResult> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new AiError("AI servisi yapılandırılmamış", false);

  const response = await fetch(LOVABLE_URL, {
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

async function callOpenAi(
  model: string,
  messages: ChatMessage[],
  temperature: number,
  maxTokens: number,
): Promise<ProviderResult> {
  const apiKey = process.env["OPENAI_API_KEY"];
  if (!apiKey) throw new AiError("OpenAI anahtarı (OPENAI_API_KEY) tanımlı değil", false);

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages, temperature, max_completion_tokens: maxTokens }),
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

async function callAnthropic(
  model: string,
  messages: ChatMessage[],
  temperature: number,
  maxTokens: number,
): Promise<ProviderResult> {
  const apiKey = process.env["ANTHROPIC_API_KEY"];
  if (!apiKey) throw new AiError("Anthropic anahtarı (ANTHROPIC_API_KEY) tanımlı değil", false);

  const system = messages.filter((item) => item.role === "system").map((item) => item.content).join("\n");
  const rest = messages.filter((item) => item.role !== "system");

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model, system, messages: rest, temperature, max_tokens: maxTokens }),
  });
  if (!response.ok) throw gatewayError(response.status, await response.text());

  const payload = (await response.json()) as {
    content?: { text?: string }[];
    usage?: { input_tokens?: number; output_tokens?: number };
  };
  const text = payload.content?.map((part) => part.text ?? "").join("").trim();
  if (!text) throw new AiError("AI boş yanıt döndü", true);
  return {
    text,
    inputTokens: payload.usage?.input_tokens ?? 0,
    outputTokens: payload.usage?.output_tokens ?? 0,
  };
}

async function callGemini(
  model: string,
  messages: ChatMessage[],
  temperature: number,
  maxTokens: number,
): Promise<ProviderResult> {
  const apiKey = process.env["GEMINI_API_KEY"];
  if (!apiKey) throw new AiError("Gemini anahtarı (GEMINI_API_KEY) tanımlı değil", false);

  const system = messages.filter((item) => item.role === "system").map((item) => item.content).join("\n");
  const contents = messages
    .filter((item) => item.role !== "system")
    .map((item) => ({ role: item.role === "assistant" ? "model" : "user", parts: [{ text: item.content }] }));

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents,
        systemInstruction: system ? { parts: [{ text: system }] } : undefined,
        generationConfig: { temperature, maxOutputTokens: maxTokens },
      }),
    },
  );
  if (!response.ok) throw gatewayError(response.status, await response.text());

  const payload = (await response.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
  };
  const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("").trim();
  if (!text) throw new AiError("AI boş yanıt döndü", true);
  return {
    text,
    inputTokens: payload.usageMetadata?.promptTokenCount ?? 0,
    outputTokens: payload.usageMetadata?.candidatesTokenCount ?? 0,
  };
}

/** Sağlayıcı bağımsız çağrı — yeni sağlayıcılar buraya eklenir. */
export async function callProvider(options: {
  providerCode: string;
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
}): Promise<ProviderResult> {
  const temperature = Math.min(Math.max(options.temperature ?? 0.7, 0), 1);
  const maxTokens = options.maxTokens ?? 900;
  switch (options.providerCode) {
    case "openai":
      return callOpenAi(options.model, options.messages, temperature, maxTokens);
    case "anthropic":
      return callAnthropic(options.model, options.messages, temperature, maxTokens);
    case "gemini":
      return callGemini(options.model, options.messages, temperature, maxTokens);
    case "lovable":
    default:
      return callLovable(options.model, options.messages, temperature, maxTokens);
  }
}

export async function loadStoreAiSettings(client: Client, storeId: string): Promise<StoreAiSettings> {
  const { data, error } = await client
    .from("store_ai_settings")
    .select("provider_code, model, creativity, brand_tone, language, monthly_token_limit, is_enabled")
    .eq("store_id", storeId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return DEFAULT_AI_SETTINGS;
  return {
    providerCode: data.provider_code,
    model: data.model,
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
  });
}

/** Mağaza bağlamında istemi kurar, sağlayıcıyı çağırır ve kullanımı kaydeder. */
export async function runAiTask(options: {
  client: Client;
  storeId: string;
  userId: string;
  taskKey: string;
  values: Record<string, string>;
}): Promise<{ text: string; task: AiTask; totalTokens: number; model: string; providerCode: string }> {
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
    throw new Error("Bu ay için AI token limitiniz doldu. Limiti AI ayarlarından yükseltebilirsiniz.");
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

  try {
    const result = await callProvider({
      providerCode: settings.providerCode,
      model: settings.model,
      messages: [
        { role: "system", content: task.system },
        { role: "user", content: prompt },
      ],
      temperature: settings.creativity,
      maxTokens: task.maxTokens,
    });

    await logGeneration({
      storeId: options.storeId,
      userId: options.userId,
      task: task.key,
      providerCode: settings.providerCode,
      model: settings.model,
      prompt,
      output: result.text,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      durationMs: Date.now() - started,
      status: "success",
    });

    return {
      text: result.text,
      task,
      totalTokens: result.inputTokens + result.outputTokens,
      model: settings.model,
      providerCode: settings.providerCode,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI isteği başarısız";
    await logGeneration({
      storeId: options.storeId,
      userId: options.userId,
      task: task.key,
      providerCode: settings.providerCode,
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

/** Geriye dönük uyumluluk: doğrudan Lovable AI çağrısı. */
export async function chatComplete(messages: ChatMessage[], maxTokens = 900): Promise<string> {
  const result = await callLovable(DEFAULT_AI_SETTINGS.model, messages, 0.7, maxTokens);
  return result.text;
}
