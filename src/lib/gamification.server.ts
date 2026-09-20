/**
 * Oyunlaştırma — sunucu katmanı.
 * Ödül çekilişi, e-posta başına oynama limiti ve indirim kodu üretimi sunucuda yapılır.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import {
  buildDiscountCode,
  normalizePrizes,
  drawPrize,
  type GamificationKind,
  type GamificationPrize,
} from "@/lib/gamification";

type Client = SupabaseClient<Database>;
type Any = any;

export type GamificationCampaignRow = {
  id: string;
  kind: GamificationKind;
  name: string;
  isActive: boolean;
  headline: string;
  ctaLabel: string;
  prizes: GamificationPrize[];
  discountType: "percent" | "amount";
  codePrefix: string;
  codeValidDays: number;
  maxPlaysPerEmail: number;
  showDelaySeconds: number;
  playCount: number;
  updatedAt: string;
};

function mapCampaign(row: Any, playCount = 0): GamificationCampaignRow {
  return {
    id: String(row.id),
    kind: String(row.kind ?? "spin_wheel") as GamificationKind,
    name: String(row.name ?? ""),
    isActive: Boolean(row.is_active),
    headline: String(row.headline ?? "Şansını dene!"),
    ctaLabel: String(row.cta_label ?? "Çevir"),
    prizes: normalizePrizes(row.prizes),
    discountType: String(row.discount_type ?? "percent") as "percent" | "amount",
    codePrefix: String(row.code_prefix ?? "SANS"),
    codeValidDays: Number(row.code_valid_days ?? 7),
    maxPlaysPerEmail: Number(row.max_plays_per_email ?? 1),
    showDelaySeconds: Number(row.show_delay_seconds ?? 6),
    playCount,
    updatedAt: String(row.updated_at ?? row.created_at),
  };
}

export async function listGamificationCampaigns(client: Client, storeId: string) {
  const db = client as unknown as Any;
  const [campaigns, plays] = await Promise.all([
    db
      .from("gamification_campaigns")
      .select("*")
      .eq("store_id", storeId)
      .order("created_at", { ascending: false })
      .limit(100),
    db
      .from("gamification_plays")
      .select("id, campaign_id, email, prize_label, prize_value, discount_code, created_at")
      .eq("store_id", storeId)
      .order("created_at", { ascending: false })
      .limit(200),
  ]);
  if (campaigns.error) throw new Error(campaigns.error.message);
  if (plays.error) throw new Error(plays.error.message);

  const playRows = (plays.data ?? []) as Any[];
  const counts = new Map<string, number>();
  for (const play of playRows) {
    const key = String(play.campaign_id);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return {
    campaigns: ((campaigns.data ?? []) as Any[]).map((row) => mapCampaign(row, counts.get(String(row.id)) ?? 0)),
    plays: playRows.map((row) => ({
      id: String(row.id),
      campaignId: String(row.campaign_id),
      email: String(row.email ?? ""),
      prizeLabel: String(row.prize_label ?? ""),
      prizeValue: Number(row.prize_value ?? 0),
      discountCode: String(row.discount_code ?? ""),
      createdAt: String(row.created_at),
    })),
  };
}

export type SaveGamificationInput = {
  id?: string | null | undefined;
  kind: GamificationKind;
  name: string;
  isActive: boolean;
  headline: string;
  ctaLabel: string;
  prizes: GamificationPrize[];
  discountType: "percent" | "amount";
  codePrefix: string;
  codeValidDays: number;
  maxPlaysPerEmail: number;
  showDelaySeconds: number;
};

export async function saveGamificationCampaign(options: {
  client: Client;
  storeId: string;
  userId: string;
  input: SaveGamificationInput;
}) {
  const { assertStoreManager } = await import("@/lib/store-access.server");
  await assertStoreManager(options.client, options.storeId, options.userId);

  const { input } = options;
  const row: Record<string, unknown> = {
    store_id: options.storeId,
    kind: input.kind,
    name: input.name,
    is_active: input.isActive,
    headline: input.headline,
    cta_label: input.ctaLabel,
    prizes: normalizePrizes(input.prizes),
    discount_type: input.discountType,
    code_prefix: input.codePrefix.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8) || "SANS",
    code_valid_days: input.codeValidDays,
    max_plays_per_email: input.maxPlaysPerEmail,
    show_delay_seconds: input.showDelaySeconds,
    updated_at: new Date().toISOString(),
  };
  if (input.id) row["id"] = input.id;

  const { data, error } = await (options.client as unknown as Any)
    .from("gamification_campaigns")
    .upsert(row, { onConflict: "id" })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return { id: String(data.id) };
}

export async function deleteGamificationCampaign(options: {
  client: Client;
  storeId: string;
  userId: string;
  id: string;
}) {
  const { assertStoreManager } = await import("@/lib/store-access.server");
  await assertStoreManager(options.client, options.storeId, options.userId);
  const { error } = await (options.client as unknown as Any)
    .from("gamification_campaigns")
    .delete()
    .eq("id", options.id)
    .eq("store_id", options.storeId);
  if (error) throw new Error(error.message);
  return { ok: true as const };
}

/** Vitrinde gösterilecek aktif kampanyayı döndürür (ödül ağırlıkları gizlenir). */
export async function getActiveGamificationCampaign(client: Client, storeSlug: string) {
  const db = client as unknown as Any;
  const { data: store, error: storeError } = await db
    .from("stores")
    .select("id")
    .eq("slug", storeSlug)
    .maybeSingle();
  if (storeError) throw new Error(storeError.message);
  if (!store) return null;

  const { data, error } = await db
    .from("gamification_campaigns")
    .select("id, kind, headline, cta_label, prizes, show_delay_seconds")
    .eq("store_id", store.id)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;

  return {
    id: String(data.id),
    kind: String(data.kind) as GamificationKind,
    headline: String(data.headline ?? "Şansını dene!"),
    ctaLabel: String(data.cta_label ?? "Çevir"),
    showDelaySeconds: Number(data.show_delay_seconds ?? 6),
    prizeLabels: normalizePrizes(data.prizes).map((prize) => prize.label),
  };
}

/**
 * Ödülü sunucuda çeker, indirim kuponunu oluşturur ve abone kaydını açar.
 * Aynı e-posta limiti aşarsa daha önce kazandığı kod tekrar verilir.
 */
export async function playGamification(options: {
  client: Client;
  storeSlug: string;
  campaignId: string;
  email: string;
}) {
  const db = options.client as unknown as Any;
  const email = options.email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("Geçerli bir e-posta girin");

  const { data: store, error: storeError } = await db
    .from("stores")
    .select("id")
    .eq("slug", options.storeSlug)
    .maybeSingle();
  if (storeError) throw new Error(storeError.message);
  if (!store) throw new Error("Mağaza bulunamadı");

  const { data: campaign, error: campaignError } = await db
    .from("gamification_campaigns")
    .select("*")
    .eq("id", options.campaignId)
    .eq("store_id", store.id)
    .eq("is_active", true)
    .maybeSingle();
  if (campaignError) throw new Error(campaignError.message);
  if (!campaign) throw new Error("Kampanya aktif değil");

  const { data: previous, error: previousError } = await db
    .from("gamification_plays")
    .select("id, prize_label, prize_value, discount_code")
    .eq("campaign_id", campaign.id)
    .eq("email", email)
    .order("created_at", { ascending: false })
    .limit(50);
  if (previousError) throw new Error(previousError.message);

  const plays = (previous ?? []) as Any[];
  const limit = Math.max(1, Number(campaign.max_plays_per_email ?? 1));
  if (plays.length >= limit) {
    const last = plays[0]!;
    return {
      repeat: true as const,
      prizeLabel: String(last.prize_label ?? ""),
      prizeValue: Number(last.prize_value ?? 0),
      discountCode: String(last.discount_code ?? ""),
    };
  }

  const prize = drawPrize(normalizePrizes(campaign.prizes), Math.random());
  const validDays = Math.max(1, Number(campaign.code_valid_days ?? 7));
  const expiresAt = new Date(Date.now() + validDays * 86_400_000).toISOString();
  let code = "";

  if (prize.value > 0) {
    for (let attempt = 0; attempt < 5 && !code; attempt += 1) {
      const candidate = buildDiscountCode(String(campaign.code_prefix ?? "SANS"));
      const { error: couponError } = await db.from("discounts").insert({
        store_id: store.id,
        code: candidate,
        kind: campaign.discount_type === "amount" ? "fixed" : "percentage",
        value: prize.value,
        is_active: true,
        usage_limit: 1,
        ends_at: expiresAt,
      });
      if (!couponError) code = candidate;
      else if (!/duplicate|unique/i.test(couponError.message)) throw new Error(couponError.message);
    }
    if (!code) throw new Error("İndirim kodu oluşturulamadı, tekrar deneyin");
  }

  const { error: playError } = await db.from("gamification_plays").insert({
    store_id: store.id,
    campaign_id: campaign.id,
    email,
    prize_label: prize.label,
    prize_value: prize.value,
    discount_code: code,
  });
  if (playError) throw new Error(playError.message);

  await db
    .from("email_subscribers")
    .upsert(
      { store_id: store.id, email, status: "subscribed", source: "gamification" },
      { onConflict: "store_id,email", ignoreDuplicates: true },
    );

  return {
    repeat: false as const,
    prizeLabel: prize.label,
    prizeValue: prize.value,
    discountCode: code,
  };
}
