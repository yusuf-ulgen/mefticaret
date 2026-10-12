/**
 * AI motor ayarları ve kredi cüzdanı — yalnızca sunucu tarafında çalışır.
 *
 * Kredi kontrolü OpenAI çağrısından ÖNCE, düşüm ise başarılı yanıttan SONRA yapılır.
 * Bakiye ve hareketler yalnızca güvenlik tanımlı veritabanı fonksiyonları ile değişir.
 */

import {
  DEFAULT_CREDIT_COSTS,
  INSUFFICIENT_CREDITS_CODE,
  PURPOSE_MODEL_CLASS,
  insufficientCreditsMessage,
  type AiCreditPurpose,
  type AiModelClass,
} from "@/lib/ai-credits";

export type AiEngineSettings = {
  isEnabled: boolean;
  modelFast: string;
  modelSmart: string;
  modelImage: string;
  fastInputUsd: number;
  fastOutputUsd: number;
  smartInputUsd: number;
  smartOutputUsd: number;
  imageUnitUsd: number;
  creditCosts: Record<AiCreditPurpose, number>;
  freeMonthlyCredits: number;
};

export const FALLBACK_ENGINE: AiEngineSettings = {
  isEnabled: true,
  modelFast: "gpt-4o-mini",
  modelSmart: "gpt-4o",
  modelImage: "dall-e-3",
  fastInputUsd: 0.15,
  fastOutputUsd: 0.6,
  smartInputUsd: 2.5,
  smartOutputUsd: 10,
  imageUnitUsd: 0.04,
  creditCosts: { ...DEFAULT_CREDIT_COSTS },
  freeMonthlyCredits: 0,
};

let cache: { value: AiEngineSettings; at: number } | null = null;
const CACHE_MS = 30_000;

async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** Motor ayarlarını okur (kısa süreli önbellekli). */
export async function loadAiEngineSettings(force = false): Promise<AiEngineSettings> {
  if (!force && cache && Date.now() - cache.at < CACHE_MS) return cache.value;

  const client = await db();
  const { data } = await client.from("ai_engine_settings").select("*").eq("id", true).maybeSingle();
  const value: AiEngineSettings = data
    ? {
        isEnabled: data.is_enabled,
        modelFast: data.model_fast,
        modelSmart: data.model_smart,
        modelImage: data.model_image,
        fastInputUsd: Number(data.fast_input_usd_per_mtok),
        fastOutputUsd: Number(data.fast_output_usd_per_mtok),
        smartInputUsd: Number(data.smart_input_usd_per_mtok),
        smartOutputUsd: Number(data.smart_output_usd_per_mtok),
        imageUnitUsd: Number(data.image_unit_usd),
        creditCosts: {
          text: data.credit_cost_text,
          image: data.credit_cost_image,
          campaign: data.credit_cost_campaign,
          copilot: data.credit_cost_copilot,
        },
        freeMonthlyCredits: data.free_monthly_credits,
      }
    : FALLBACK_ENGINE;

  cache = { value, at: Date.now() };
  return value;
}

export function clearAiEngineCache() {
  cache = null;
}

/** İş türü için kullanılacak OpenAI modeli. */
export function modelForPurpose(engine: AiEngineSettings, purpose: AiCreditPurpose): string {
  const modelClass = PURPOSE_MODEL_CLASS[purpose];
  if (modelClass === "image") return engine.modelImage;
  if (modelClass === "smart") return engine.modelSmart;
  return engine.modelFast;
}

export function creditCostFor(engine: AiEngineSettings, purpose: AiCreditPurpose): number {
  return engine.creditCosts[purpose] ?? DEFAULT_CREDIT_COSTS[purpose];
}

/** Token kullanımının gerçek OpenAI maliyeti (USD). */
export function usdCost(
  engine: AiEngineSettings,
  modelClass: AiModelClass,
  inputTokens: number,
  outputTokens: number,
): number {
  if (modelClass === "image") return engine.imageUnitUsd;
  const input = modelClass === "smart" ? engine.smartInputUsd : engine.fastInputUsd;
  const output = modelClass === "smart" ? engine.smartOutputUsd : engine.fastOutputUsd;
  return (inputTokens / 1_000_000) * input + (outputTokens / 1_000_000) * output;
}

export async function aiCreditBalance(storeId: string): Promise<number> {
  const client = await db();
  const { data } = await client
    .from("store_ai_credits")
    .select("balance")
    .eq("store_id", storeId)
    .maybeSingle();
  return data?.balance ?? 0;
}

export class AiCreditError extends Error {
  readonly code = INSUFFICIENT_CREDITS_CODE;
  constructor(
    readonly needed: number,
    readonly balance: number,
  ) {
    super(insufficientCreditsMessage(needed, balance));
  }
}

/** OpenAI çağrısından önce bakiye kontrolü. Yetersizse istek hiç gönderilmez. */
export async function assertAiCredits(
  storeId: string,
  purpose: AiCreditPurpose,
): Promise<{ credits: number; balance: number; engine: AiEngineSettings }> {
  const engine = await loadAiEngineSettings();
  if (!engine.isEnabled) throw new Error("Yapay zekâ motoru şu anda kapalı.");
  const credits = creditCostFor(engine, purpose);
  const balance = await aiCreditBalance(storeId);
  if (credits > 0 && balance < credits) throw new AiCreditError(credits, balance);
  return { credits, balance, engine };
}

/** Başarılı yanıttan sonra atomik kredi düşümü; kalan bakiyeyi döner. */
export async function consumeAiCredits(options: {
  storeId: string;
  credits: number;
  purpose: AiCreditPurpose;
  task?: string | null;
  userId?: string | null;
}): Promise<number> {
  if (options.credits <= 0) return aiCreditBalance(options.storeId);
  const client = await db();
  const { data, error } = await client.rpc("consume_ai_credits", {
    _store_id: options.storeId,
    _credits: options.credits,
    _reason: `ai_${options.purpose}`,
    _task: options.task ?? null,
    _user_id: options.userId ?? null,
  } as never);
  if (error) {
    if (error.message.includes(INSUFFICIENT_CREDITS_CODE)) {
      throw new AiCreditError(options.credits, await aiCreditBalance(options.storeId));
    }
    throw new Error(error.message);
  }
  return Number(data ?? 0);
}

/** Kredi yükleme (ödeme onayı veya yönetici hediyesi). */
export async function grantAiCredits(options: {
  storeId: string;
  credits: number;
  reason: string;
  userId?: string | null;
  meta?: Record<string, unknown>;
}): Promise<number> {
  const client = await db();
  const { data, error } = await client.rpc("grant_ai_credits", {
    _store_id: options.storeId,
    _credits: options.credits,
    _reason: options.reason,
    _user_id: options.userId ?? null,
    _meta: options.meta ?? {},
  } as never);
  if (error) throw new Error(error.message);
  return Number(data ?? 0);
}
