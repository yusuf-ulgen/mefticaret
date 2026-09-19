import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

/**
 * Vitrin kampanyaları: yayına açılmış e-posta kampanyalarının vitrin alanları.
 * Anonim okuma RLS ile yalnızca aktif mağaza + `storefront_enabled` satırlara açıktır.
 */

export type StorefrontCampaign = {
  id: string;
  storeId: string;
  name: string;
  slug: string;
  bannerHeadline: string;
  bannerBody: string;
  bannerCtaLabel: string;
  landingHeadline: string;
  landingBody: string;
  discountCode: string;
  endsAt: string | null;
};

const SELECT =
  "id, store_id, name, slug, banner_headline, banner_body, banner_cta_label, landing_headline, landing_body, discount_code, ends_at";

type Row = {
  id: string;
  store_id: string;
  name: string;
  slug: string | null;
  banner_headline: string | null;
  banner_body: string | null;
  banner_cta_label: string | null;
  landing_headline: string | null;
  landing_body: string | null;
  discount_code: string | null;
  ends_at: string | null;
};

function mapRow(row: Row): StorefrontCampaign {
  return {
    id: String(row.id),
    storeId: String(row.store_id),
    name: String(row.name ?? ""),
    slug: String(row.slug ?? ""),
    bannerHeadline: String(row.banner_headline ?? ""),
    bannerBody: String(row.banner_body ?? ""),
    bannerCtaLabel: String(row.banner_cta_label ?? ""),
    landingHeadline: String(row.landing_headline ?? ""),
    landingBody: String(row.landing_body ?? ""),
    discountCode: String(row.discount_code ?? ""),
    endsAt: row.ends_at ? String(row.ends_at) : null,
  };
}

async function storeIdBySlug(slug: string) {
  const { data, error } = await supabase.from("stores").select("id").eq("slug", slug).maybeSingle();
  if (error) throw error;
  return data ? String(data.id) : null;
}

/** Vitrinde gösterilecek aktif kampanyalar (en yenisi başta). */
export const storefrontCampaignsQuery = (slug: string) =>
  queryOptions({
    queryKey: ["storefront-campaigns", slug],
    queryFn: async () => {
      const storeId = await storeIdBySlug(slug);
      if (!storeId) return [] as StorefrontCampaign[];
      const { data, error } = await supabase
        .from("email_campaigns")
        .select(SELECT)
        .eq("store_id", storeId)
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return ((data ?? []) as unknown as Row[]).map(mapRow);
    },
    staleTime: 60_000,
  });

/** Tek kampanya sayfası verisi. */
export const storefrontCampaignQuery = (slug: string, campaignSlug: string) =>
  queryOptions({
    queryKey: ["storefront-campaign", slug, campaignSlug],
    queryFn: async () => {
      const storeId = await storeIdBySlug(slug);
      if (!storeId) return null;
      const { data, error } = await supabase
        .from("email_campaigns")
        .select(SELECT)
        .eq("store_id", storeId)
        .eq("slug", campaignSlug)
        .maybeSingle();
      if (error) throw error;
      return data ? mapRow(data as unknown as Row) : null;
    },
    staleTime: 60_000,
  });

function sessionId() {
  if (typeof window === "undefined") return "";
  const key = "mefti-campaign-session";
  let value = window.localStorage.getItem(key);
  if (!value) {
    value = crypto.randomUUID();
    window.localStorage.setItem(key, value);
  }
  return value;
}

/** Banner görüntülenme/tıklama kaydı — gerçek olay, uydurma sayaç yok. */
export async function trackCampaignEvent(
  campaign: Pick<StorefrontCampaign, "id" | "storeId">,
  kind: "view" | "click",
) {
  try {
    await supabase.from("campaign_storefront_events").insert({
      store_id: campaign.storeId,
      campaign_id: campaign.id,
      kind,
      session_id: sessionId(),
    } as never);
  } catch {
    // Ölçüm hatası vitrini etkilemez.
  }
}
