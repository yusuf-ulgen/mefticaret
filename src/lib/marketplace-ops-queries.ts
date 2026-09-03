import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { MarketplaceReturnStatus, SettlementStatus } from "@/lib/marketplace-ops";
import {
  orderAnalysisFn,
  productAnalysisFn,
  settlementSummaryFn,
  stockDepletionAnalysisFn,
} from "@/lib/marketplace-ops.functions";

/** Mağazaya ait pazaryeri kanallarını (marketplace_channels) döndürür — filtre seçicileri için. */
export const marketplaceChannelsQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["marketplace-ops-channels", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("marketplace_channels")
        .select("id, name, provider, status")
        .eq("store_id", storeId)
        .order("name", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

/** Pazaryeri iade/değişim listesi — durum ve kanal filtreleriyle. */
export const marketplaceReturnsQuery = (
  storeId: string,
  filters: { status?: MarketplaceReturnStatus | "all"; channelId?: string | "all" } = {},
) =>
  queryOptions({
    queryKey: ["marketplace-returns", storeId, filters.status ?? "all", filters.channelId ?? "all"],
    queryFn: async () => {
      let query = supabase
        .from("marketplace_returns")
        .select(
          "*, marketplace_channels(id, name, provider), orders(id, order_number, customer_name, currency)",
        )
        .eq("store_id", storeId)
        .order("requested_at", { ascending: false })
        .limit(500);
      if (filters.status && filters.status !== "all") query = query.eq("status", filters.status);
      if (filters.channelId && filters.channelId !== "all")
        query = query.eq("channel_id", filters.channelId);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });

/** Mutabakat/hakediş kayıtları + toplamlar (kanal ve dönem filtreli). */
export const marketplaceSettlementsQuery = (
  storeId: string,
  filters: { marketplace?: string | "all"; status?: SettlementStatus | "all"; from?: string; to?: string } = {},
) =>
  queryOptions({
    queryKey: [
      "marketplace-settlements",
      storeId,
      filters.marketplace ?? "all",
      filters.status ?? "all",
      filters.from ?? "",
      filters.to ?? "",
    ],
    queryFn: async () => {
      let query = supabase
        .from("marketplace_settlements")
        .select("*, marketplace_channels(id, name, provider)")
        .eq("store_id", storeId)
        .order("period_start", { ascending: false })
        .limit(500);
      if (filters.marketplace && filters.marketplace !== "all")
        query = query.eq("marketplace", filters.marketplace);
      if (filters.status && filters.status !== "all") query = query.eq("status", filters.status);
      if (filters.from) query = query.gte("period_start", filters.from);
      if (filters.to) query = query.lte("period_end", filters.to);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });

/** Ürün / kanal başına ilan bağlantıları (marketplace_listing_links). */
export const listingLinksQuery = (
  storeId: string,
  filters: { productId?: string | "all"; channelId?: string | "all" } = {},
) =>
  queryOptions({
    queryKey: ["listing-links", storeId, filters.productId ?? "all", filters.channelId ?? "all"],
    queryFn: async () => {
      let query = supabase
        .from("marketplace_listing_links")
        .select(
          "*, products(id, title, sku), product_variants(id, title, sku), marketplace_channels(id, name, provider)",
        )
        .eq("store_id", storeId)
        .order("created_at", { ascending: false })
        .limit(1000);
      if (filters.productId && filters.productId !== "all")
        query = query.eq("product_id", filters.productId);
      if (filters.channelId && filters.channelId !== "all")
        query = query.eq("channel_id", filters.channelId);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });

/** Ürün seçici için hafif ürün listesi. */
export const productPickerQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["listing-links-product-picker", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, title, sku, status")
        .eq("store_id", storeId)
        .neq("status", "archived")
        .order("title", { ascending: true })
        .limit(2000);
      if (error) throw error;
      return data ?? [];
    },
  });

/** Ürüne ait varyant seçici. */
export const variantPickerQuery = (storeId: string, productId: string | null) =>
  queryOptions({
    queryKey: ["listing-links-variant-picker", storeId, productId],
    queryFn: async () => {
      if (!productId) return [];
      const { data, error } = await supabase
        .from("product_variants")
        .select("id, title, sku")
        .eq("store_id", storeId)
        .eq("product_id", productId)
        .order("position", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: Boolean(productId),
  });

/** Stok tükenme analizi (server hesaplama, salt server fn üzerinden okunur). */
export const stockDepletionAnalysisQuery = (storeId: string, days: number) =>
  queryOptions({
    queryKey: ["marketplace-ops-stock-depletion", storeId, days],
    queryFn: async () => {
      return stockDepletionAnalysisFn({ data: { storeId, days } });
    },
  });

/** Sipariş analizi (şehir / saat / kanal). */
export const orderAnalysisQuery = (storeId: string, from: string, to: string) =>
  queryOptions({
    queryKey: ["marketplace-ops-order-analysis", storeId, from, to],
    queryFn: async () => {
      return orderAnalysisFn({ data: { storeId, from, to } });
    },
  });

/** Ürün analizi (satış adedi, ciro, komisyon, kâr). */
export const productAnalysisQuery = (storeId: string, from: string, to: string) =>
  queryOptions({
    queryKey: ["marketplace-ops-product-analysis", storeId, from, to],
    queryFn: async () => {
      return productAnalysisFn({ data: { storeId, from, to } });
    },
  });

/** Mutabakat özeti — pazaryeri/dönem bazında brüt/komisyon/kargo/kesinti/net. */
export const settlementSummaryQuery = (storeId: string, from: string, to: string) =>
  queryOptions({
    queryKey: ["marketplace-ops-settlement-summary", storeId, from, to],
    queryFn: async () => {
      return settlementSummaryFn({ data: { storeId, from, to } });
    },
  });
