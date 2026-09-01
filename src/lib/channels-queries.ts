import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { MARKETPLACE_CONNECTORS } from "@/lib/marketplace";

/** Sağlayıcı listesi connector kayıt defterinden türetilir. */
export const MARKETPLACE_PROVIDERS = MARKETPLACE_CONNECTORS.map((connector) => ({
  code: connector.code,
  name: connector.name,
  kind: connector.kind,
  region: connector.region,
  capabilities: connector.capabilities,
  commissionRate: connector.defaultCommissionRate,
  sellerIdLabel: connector.sellerIdLabel,
  docsUrl: connector.docsUrl,
  notes: connector.notes ?? null,
}));

export const CHANNEL_STATUS_LABELS: Record<string, string> = {
  disconnected: "Bağlı değil",
  connected: "Bağlı",
  error: "Hata",
  paused: "Duraklatıldı",
};

export const LISTING_STATUS_LABELS: Record<string, string> = {
  draft: "Taslak",
  queued: "Kuyrukta",
  listed: "Yayında",
  error: "Hata",
  removed: "Kaldırıldı",
};

export const channelsQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["marketplace-channels", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("marketplace_channels")
        .select("*")
        .eq("store_id", storeId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

export const channelListingsQuery = (storeId: string, channelId: string | null) =>
  queryOptions({
    queryKey: ["channel-listings", storeId, channelId],
    queryFn: async () => {
      if (!channelId) return [];
      const { data, error } = await supabase
        .from("channel_listings")
        .select("*, products(id, title, slug, base_price, currency, status)")
        .eq("store_id", storeId)
        .eq("channel_id", channelId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: Boolean(channelId),
  });
