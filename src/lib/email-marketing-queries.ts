import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { campaignMetrics, type SendRow } from "@/lib/email-marketing";

export type EmailDesignRow = Database["public"]["Tables"]["email_designs"]["Row"];
export type EmailCampaignRow = Database["public"]["Tables"]["email_campaigns"]["Row"];
export type EmailVariantRow = Database["public"]["Tables"]["email_campaign_variants"]["Row"];
export type EmailSendRow = Database["public"]["Tables"]["email_sends"]["Row"];
export type EmailSubscriberRow = Database["public"]["Tables"]["email_subscribers"]["Row"];

export const emailDesignsQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["email-designs", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_designs")
        .select("*")
        .eq("store_id", storeId)
        .order("updated_at", { ascending: false });
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

export const emailCampaignsQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["email-campaigns", storeId],
    queryFn: async () => {
      const [campaigns, variants] = await Promise.all([
        supabase
          .from("email_campaigns")
          .select("*")
          .eq("store_id", storeId)
          .order("created_at", { ascending: false }),
        supabase
          .from("email_campaign_variants")
          .select("*")
          .eq("store_id", storeId)
          .order("label", { ascending: true }),
      ]);
      if (campaigns.error) throw new Error(campaigns.error.message);
      if (variants.error) throw new Error(variants.error.message);
      return { campaigns: campaigns.data ?? [], variants: variants.data ?? [] };
    },
  });

export const emailSendsQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["email-sends", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_sends")
        .select("campaign_id, variant_id, status, opened_at, clicked_at, unsubscribed_at, revenue, recipient, created_at")
        .eq("store_id", storeId)
        .order("created_at", { ascending: false })
        .limit(5000);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

export const emailSubscribersQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["email-subscribers", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_subscribers")
        .select("*")
        .eq("store_id", storeId)
        .order("created_at", { ascending: false })
        .limit(2000);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

/** Kampanya bazlı gönderim metriklerini hesaplar. */
export function metricsByCampaign(
  sends: { campaign_id: string | null; status: string; opened_at: string | null; clicked_at: string | null; unsubscribed_at: string | null; revenue: number | string }[],
) {
  const grouped = new Map<string, SendRow[]>();
  for (const send of sends) {
    if (!send.campaign_id) continue;
    const rows = grouped.get(send.campaign_id) ?? [];
    rows.push({
      status: send.status,
      openedAt: send.opened_at,
      clickedAt: send.clicked_at,
      unsubscribedAt: send.unsubscribed_at,
      revenue: Number(send.revenue) || 0,
    });
    grouped.set(send.campaign_id, rows);
  }
  const result = new Map<string, ReturnType<typeof campaignMetrics>>();
  for (const [campaignId, rows] of grouped) {
    result.set(campaignId, campaignMetrics(rows));
  }
  return result;
}
