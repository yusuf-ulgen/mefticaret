import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

/** Growth & Logistics Expansion Pack okuma sorguları (RLS ile mağazaya kapalı). */

export type AffiliatePartnerRow = {
  id: string;
  name: string;
  email: string | null;
  country_code: string;
  code: string;
  commission_percent: number;
  payout_currency: string;
  promo_code: string | null;
  is_active: boolean;
  notes: string | null;
};

export type AffiliateConversionRow = {
  id: string;
  partner_id: string;
  order_id: string | null;
  order_total: number;
  order_currency: string;
  commission_amount: number;
  commission_currency: string;
  status: "pending" | "approved" | "paid" | "rejected";
  created_at: string;
  affiliate_partners: { name: string } | null;
};

export type HolidayCampaignRow = {
  id: string;
  holiday_key: string;
  name: string;
  countries: string[];
  starts_at: string;
  ends_at: string;
  discount_percent: number;
  banner_text: string | null;
  banner_locale: string;
  is_auto: boolean;
  is_active: boolean;
};

export type ReturnHubRow = {
  id: string;
  country_code: string;
  hub_name: string;
  address: string | null;
  city: string | null;
  postal_code: string | null;
  carrier_code: string | null;
  instructions: string | null;
  is_active: boolean;
};

export type ReturnLabelRow = {
  id: string;
  reference: string;
  order_id: string | null;
  destination_country: string;
  origin_country: string;
  carrier_code: string | null;
  tracking_number: string | null;
  status: "draft" | "issued" | "in_transit" | "received" | "cancelled";
  created_at: string;
  return_hubs: { hub_name: string; country_code: string } | null;
};

export type CarrierQuoteRow = {
  id: string;
  destination_country: string;
  weight_grams: number;
  carrier_code: string;
  service: string | null;
  cost: number;
  currency: string;
  transit_days: number | null;
  source: "manual" | "api";
  fetched_at: string;
};

export type WholesaleTierRow = {
  id: string;
  product_id: string | null;
  min_quantity: number;
  discount_percent: number;
  is_active: boolean;
  products: { title: string } | null;
};

export type RfqRow = {
  id: string;
  reference: string;
  company_name: string;
  contact_name: string | null;
  email: string | null;
  country_code: string;
  currency: string;
  requested_total: number;
  quoted_total: number | null;
  status: "new" | "quoted" | "won" | "lost";
  valid_until: string | null;
  created_at: string;
};

export type MarketplaceChannelRow = {
  id: string;
  channel: string;
  is_active: boolean;
  credentials_ready: boolean;
  target_currency: string;
  last_sync_at: string | null;
  last_status: string | null;
  synced_products: number;
  notes: string | null;
};

export const affiliatePartnersQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["affiliate-partners", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("affiliate_partners")
        .select(
          "id, name, email, country_code, code, commission_percent, payout_currency, promo_code, is_active, notes",
        )
        .eq("store_id", storeId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as AffiliatePartnerRow[];
    },
  });

export const affiliateConversionsQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["affiliate-conversions", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("affiliate_conversions")
        .select(
          "id, partner_id, order_id, order_total, order_currency, commission_amount, commission_currency, status, created_at, affiliate_partners(name)",
        )
        .eq("store_id", storeId)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as unknown as AffiliateConversionRow[];
    },
  });

export const holidayCampaignsQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["holiday-campaigns", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("holiday_campaigns")
        .select(
          "id, holiday_key, name, countries, starts_at, ends_at, discount_percent, banner_text, banner_locale, is_auto, is_active",
        )
        .eq("store_id", storeId)
        .order("starts_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as HolidayCampaignRow[];
    },
  });

export const returnHubsQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["return-hubs", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("return_hubs")
        .select("id, country_code, hub_name, address, city, postal_code, carrier_code, instructions, is_active")
        .eq("store_id", storeId)
        .order("country_code", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as ReturnHubRow[];
    },
  });

export const returnLabelsQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["return-labels", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("international_return_labels")
        .select(
          "id, reference, order_id, destination_country, origin_country, carrier_code, tracking_number, status, created_at, return_hubs(hub_name, country_code)",
        )
        .eq("store_id", storeId)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as unknown as ReturnLabelRow[];
    },
  });

export const carrierQuotesQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["carrier-quotes", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("carrier_rate_quotes")
        .select(
          "id, destination_country, weight_grams, carrier_code, service, cost, currency, transit_days, source, fetched_at",
        )
        .eq("store_id", storeId)
        .order("destination_country", { ascending: true })
        .limit(300);
      if (error) throw error;
      return (data ?? []) as unknown as CarrierQuoteRow[];
    },
  });

export const wholesaleTiersQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["wholesale-tiers", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wholesale_tiers")
        .select("id, product_id, min_quantity, discount_percent, is_active, products(title)")
        .eq("store_id", storeId)
        .order("min_quantity", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as WholesaleTierRow[];
    },
  });

export const rfqRequestsQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["rfq-requests", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rfq_requests")
        .select(
          "id, reference, company_name, contact_name, email, country_code, currency, requested_total, quoted_total, status, valid_until, created_at",
        )
        .eq("store_id", storeId)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as unknown as RfqRow[];
    },
  });

export const marketplaceChannelsQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["global-marketplace-channels", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("global_marketplace_channels")
        .select(
          "id, channel, is_active, credentials_ready, target_currency, last_sync_at, last_status, synced_products, notes",
        )
        .eq("store_id", storeId)
        .order("channel", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as MarketplaceChannelRow[];
    },
  });
