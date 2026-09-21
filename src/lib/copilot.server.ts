/** Mefticaret Copilot — mağaza verisiyle temellendirilmiş sohbet motoru (yalnızca sunucu). */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import { collectStoreMetrics, buildInsightPrompt } from "@/lib/analytics.server";
import { callProvider, loadStoreAiSettings, monthlyTokenUsage, type ChatMessage } from "@/lib/ai.server";

type Client = SupabaseClient<Database>;

const HISTORY_LIMIT = 12;

const SYSTEM_PROMPT = [
  "Sen Mefticaret Copilot'sun: çok kiracılı bir e-ticaret SaaS panelinde mağaza sahibine yardım eden operasyon asistanı.",
  "Yalnızca sana verilen MAĞAZA BAĞLAMI verilerine dayanarak konuş. Veri yoksa 'bu veri panelde henüz yok' de.",
  "Uydurma sayı, sahte istatistik veya gerçek dışı iddia üretme.",
  "Kısa, uygulanabilir ve Türkçe yanıt ver. Gerekiyorsa tire ile maddele; markdown başlığı kullanma.",
  "Önerilerini mümkün olduğunda panel sayfalarına yönlendirerek ver (örn. Stok, Siparişler, Terk Edilen Sepetler, SEO Denetimi).",
].join(" ");

export type CopilotSummary = {
  donem_gun: number;
  magaza: string;
  para_birimi: string;
  ciro: number;
  siparis: number;
  ortalama_sepet: number;
  odenme_orani: number;
  iptal_iade: number;
  yeni_musteri: number;
  aktif_urun: number;
  bekleyen_siparis: number;
  hazirlanmayan_siparis: number;
  terk_edilen_sepet: number;
  acik_iade_talebi: number;
  kritik_stok: { title: string; stock: number }[];
  en_iyi_urunler: { title: string; quantity: number; revenue: number }[];
  aktif_kuponlar: string[];
};

export type CopilotContext = {
  summary: CopilotSummary;
  promptBlock: string;
};

/** Mağazanın gerçek operasyon verisini toplar ve modele verilecek bağlam bloğunu üretir. */
export async function collectCopilotContext(
  client: Client,
  storeId: string,
  days = 30,
): Promise<CopilotContext> {
  const metrics = await collectStoreMetrics(client as never, storeId, days);

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const anyClient = client as unknown as { from: (table: string) => any };

  const [pending, unfulfilled, abandoned, openReturns, activeDiscounts] = await Promise.all([
    anyClient
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("store_id", storeId)
      .in("status", ["pending", "awaiting_payment"]),
    anyClient
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("store_id", storeId)
      .eq("fulfillment_status", "unfulfilled"),
    anyClient
      .from("abandoned_carts")
      .select("id", { count: "exact", head: true })
      .eq("store_id", storeId)
      .gte("created_at", since),
    anyClient
      .from("returns")
      .select("id", { count: "exact", head: true })
      .eq("store_id", storeId)
      .in("status", ["requested", "approved"]),
    anyClient
      .from("discounts")
      .select("code")
      .eq("store_id", storeId)
      .eq("is_active", true)
      .limit(10),
  ]);

  const summary: CopilotSummary = {
    donem_gun: days,
    magaza: metrics.storeName,
    para_birimi: metrics.currency,
    ciro: Math.round(metrics.revenue),
    siparis: metrics.orders,
    ortalama_sepet: Math.round(metrics.aov),
    odenme_orani: Math.round(metrics.paidRatio),
    iptal_iade: metrics.cancelled,
    yeni_musteri: metrics.newCustomers,
    aktif_urun: metrics.activeProducts,
    bekleyen_siparis: Number(pending?.count ?? 0),
    hazirlanmayan_siparis: Number(unfulfilled?.count ?? 0),
    terk_edilen_sepet: Number(abandoned?.count ?? 0),
    acik_iade_talebi: Number(openReturns?.count ?? 0),
    kritik_stok: metrics.lowStock,
    en_iyi_urunler: metrics.topProducts,
    aktif_kuponlar: ((activeDiscounts?.data ?? []) as { code: string }[]).map((row) => row.code),
  };

  const promptBlock = [
    "MAĞAZA BAĞLAMI",
    buildInsightPrompt(metrics, days),
    `Bekleyen sipariş: ${summary.bekleyen_siparis}`,
    `Hazırlanmayan sipariş: ${summary.hazirlanmayan_siparis}`,
    `Son ${days} günde terk edilen sepet: ${summary.terk_edilen_sepet}`,
    `Açık iade talebi: ${summary.acik_iade_talebi}`,
    summary.aktif_kuponlar.length > 0
      ? `Aktif kuponlar: ${summary.aktif_kuponlar.join(", ")}`
      : "Aktif kupon yok.",
  ].join("\n");

  return { summary, promptBlock };
}

function titleFrom(message: string): string {
  const clean = message.replace(/\s+/g, " ").trim();
  return clean.length > 60 ? `${clean.slice(0, 57)}...` : clean || "Yeni sohbet";
}

/** Kullanıcı mesajını alır, bağlamı toplar, yanıtı üretir ve konuşmayı kalıcı hale getirir. */
export async function sendCopilotTurn(options: {
  client: Client;
  storeId: string;
  userId: string;
  message: string;
  conversationId?: string | null;
}): Promise<{ conversationId: string; answer: string; totalTokens: number; model: string }> {
  const { client, storeId, userId, message } = options;

  const settings = await loadStoreAiSettings(client, storeId);
  if (!settings.isEnabled) throw new Error("Bu mağaza için AI kullanımı kapalı");

  const used = await monthlyTokenUsage(client, storeId);
  if (settings.monthlyTokenLimit > 0 && used >= settings.monthlyTokenLimit) {
    throw new Error("Bu ay için AI token limitiniz doldu. Limiti AI ayarlarından yükseltebilirsiniz.");
  }

  let conversationId = options.conversationId ?? null;
  if (conversationId) {
    const { data, error } = await client
      .from("copilot_conversations")
      .select("id")
      .eq("id", conversationId)
      .eq("store_id", storeId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error("Sohbet bulunamadı veya yetkiniz yok");
  } else {
    const { data, error } = await client
      .from("copilot_conversations")
      .insert({ store_id: storeId, user_id: userId, title: titleFrom(message) })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    conversationId = data.id;
  }

  const { data: history, error: historyError } = await client
    .from("copilot_messages")
    .select("role, content")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(HISTORY_LIMIT);
  if (historyError) throw new Error(historyError.message);

  const context = await collectCopilotContext(client, storeId);

  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "system", content: context.promptBlock },
    ...[...(history ?? [])].reverse().map((row) => ({
      role: row.role === "assistant" ? ("assistant" as const) : ("user" as const),
      content: row.content,
    })),
    { role: "user", content: message },
  ];

  const result = await callProvider({
    purpose: "copilot",
    charge: { storeId: options.storeId, userId: userId, task: "copilot" },
    messages,
    temperature: settings.creativity,
    maxTokens: 1400,
  });

  const totalTokens = result.inputTokens + result.outputTokens;

  const { error: insertError } = await client.from("copilot_messages").insert([
    {
      conversation_id: conversationId,
      store_id: storeId,
      role: "user",
      content: message,
      total_tokens: 0,
    },
    {
      conversation_id: conversationId,
      store_id: storeId,
      role: "assistant",
      content: result.text,
      model: settings.model,
      total_tokens: totalTokens,
      context_summary: context.summary as never,
    },
  ]);
  if (insertError) throw new Error(insertError.message);

  await client
    .from("copilot_conversations")
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", conversationId);

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin.from("ai_generations").insert({
    store_id: storeId,
    user_id: userId,
    task: "copilot",
    provider_code: settings.providerCode,
    model: settings.model,
    prompt: message.slice(0, 8000),
    output: result.text.slice(0, 20000),
    input_tokens: result.inputTokens,
    output_tokens: result.outputTokens,
    total_tokens: totalTokens,
    duration_ms: 0,
    status: "success",
  });

  return { conversationId, answer: result.text, totalTokens, model: settings.model };
}
