import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

/** Markets & Pricing okuma sorguları — tenant izolasyonu RLS ile korunur. */

export type PlatformCurrency = {
  code: string;
  name: string;
  symbol: string;
  decimals: number;
  symbol_position: string;
  is_active: boolean;
};

export type PricingSettings = {
  store_id: string;
  base_currency: string;
  update_frequency: string;
  default_markup_type: string;
  default_markup_value: number;
  default_rounding: string;
  min_margin_percent: number | null;
  max_change_percent: number | null;
  require_approval: boolean;
  stale_after_hours: number;
  geolocation_enabled: boolean;
  provider_code: string | null;
  last_rate_sync_at: string | null;
};

export type StoreCurrency = {
  id: string;
  currency: string;
  is_active: boolean;
  is_base: boolean;
  markup_type: string;
  markup_value: number;
  rounding: string;
  manual_rate: number | null;
  use_manual_rate: boolean;
};

export type Market = {
  id: string;
  name: string;
  code: string;
  country_code: string | null;
  currency: string;
  locale: string | null;
  domain: string | null;
  url_prefix: string | null;
  tax_included: boolean;
  price_list_id: string | null;
  markup_type: string;
  markup_value: number;
  rounding: string;
  is_default: boolean;
  is_active: boolean;
  sort_order: number;
};

export type PriceList = {
  id: string;
  name: string;
  code: string;
  currency: string;
  kind: string;
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
};

export type PricingRule = {
  id: string;
  name: string;
  description: string | null;
  priority: number;
  is_active: boolean;
  conditions: Record<string, unknown>;
  actions: Record<string, unknown>;
  starts_at: string | null;
  ends_at: string | null;
};

export type PricingCampaign = {
  id: string;
  name: string;
  currency: string;
  rate: number | null;
  markup_type: string;
  markup_value: number;
  rounding: string;
  market_id: string | null;
  price_list_id: string | null;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
};

export type RateHistoryRow = {
  id: string;
  base_currency: string;
  quote_currency: string;
  old_rate: number | null;
  new_rate: number;
  source: string;
  provider_code: string | null;
  created_at: string;
};

export type LiveRate = {
  base_currency: string;
  quote_currency: string;
  rate: number;
  source: string;
  fetched_at: string;
};

export const platformCurrenciesQuery = () =>
  queryOptions({
    queryKey: ["platform-currencies"],
    queryFn: async (): Promise<PlatformCurrency[]> => {
      const { data, error } = await supabase
        .from("platform_currencies")
        .select("code, name, symbol, decimals, symbol_position, is_active")
        .order("code");
      if (error) throw error;
      return (data ?? []) as PlatformCurrency[];
    },
  });

export const pricingSettingsQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["pricing-settings", storeId],
    queryFn: async (): Promise<PricingSettings | null> => {
      const { data, error } = await supabase
        .from("store_pricing_settings")
        .select("*")
        .eq("store_id", storeId)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as PricingSettings | null;
    },
  });

export const storeCurrenciesQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["store-currencies", storeId],
    queryFn: async (): Promise<StoreCurrency[]> => {
      const { data, error } = await supabase
        .from("store_currencies")
        .select("id, currency, is_active, is_base, markup_type, markup_value, rounding, manual_rate, use_manual_rate")
        .eq("store_id", storeId)
        .order("is_base", { ascending: false })
        .order("currency");
      if (error) throw error;
      return (data ?? []) as StoreCurrency[];
    },
  });

export const marketsQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["markets", storeId],
    queryFn: async (): Promise<Market[]> => {
      const { data, error } = await supabase
        .from("markets")
        .select(
          "id, name, code, country_code, currency, locale, domain, url_prefix, tax_included, price_list_id, markup_type, markup_value, rounding, is_default, is_active, sort_order",
        )
        .eq("store_id", storeId)
        .order("sort_order")
        .order("name");
      if (error) throw error;
      return (data ?? []) as Market[];
    },
  });

export const priceListsQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["price-lists", storeId],
    queryFn: async (): Promise<PriceList[]> => {
      const { data, error } = await supabase
        .from("price_lists")
        .select("id, name, code, currency, kind, is_active, starts_at, ends_at")
        .eq("store_id", storeId)
        .order("name");
      if (error) throw error;
      return (data ?? []) as PriceList[];
    },
  });

export const pricingRulesQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["pricing-rules", storeId],
    queryFn: async (): Promise<PricingRule[]> => {
      const { data, error } = await supabase
        .from("pricing_rules")
        .select("id, name, description, priority, is_active, conditions, actions, starts_at, ends_at")
        .eq("store_id", storeId)
        .order("priority", { ascending: false });
      if (error) throw error;
      return (data ?? []) as PricingRule[];
    },
  });

export const pricingCampaignsQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["pricing-campaigns", storeId],
    queryFn: async (): Promise<PricingCampaign[]> => {
      const { data, error } = await supabase
        .from("pricing_campaigns")
        .select(
          "id, name, currency, rate, markup_type, markup_value, rounding, market_id, price_list_id, starts_at, ends_at, is_active",
        )
        .eq("store_id", storeId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as PricingCampaign[];
    },
  });

export const liveRatesQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["live-rates", storeId],
    queryFn: async (): Promise<LiveRate[]> => {
      const { data, error } = await supabase
        .from("currency_rates")
        .select("base_currency, quote_currency, rate, source, fetched_at")
        .eq("store_id", storeId)
        .order("quote_currency");
      if (error) throw error;
      return (data ?? []) as LiveRate[];
    },
  });

export const rateHistoryQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["rate-history", storeId],
    queryFn: async (): Promise<RateHistoryRow[]> => {
      const { data, error } = await supabase
        .from("exchange_rate_history")
        .select("id, base_currency, quote_currency, old_rate, new_rate, source, provider_code, created_at")
        .eq("store_id", storeId)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as RateHistoryRow[];
    },
  });

export const pricingAuditQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["pricing-audit", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pricing_audit_logs")
        .select("id, product_id, market_id, currency, old_price, new_price, reason, source, created_at")
        .eq("store_id", storeId)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });
