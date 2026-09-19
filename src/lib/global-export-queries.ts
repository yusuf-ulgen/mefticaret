import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

/** Global & e-ihracat modülü okuma sorguları — tenant izolasyonu RLS ile korunur. */

export type GlobalSettings = {
  store_id: string;
  geo_detect_enabled: boolean;
  fx_buffer_percent: number;
  default_incoterm: "DDP" | "DDU";
  ioss_enabled: boolean;
  ioss_number: string | null;
  oss_enabled: boolean;
  us_nexus_states: string[];
  rtl_auto: boolean;
  exporter_name: string | null;
  exporter_tax_id: string | null;
  exporter_address: string | null;
  exporter_city: string | null;
  exporter_country: string | null;
  exporter_phone: string | null;
  exporter_email: string | null;
  default_hs_code: string | null;
  auto_translate_locales: string[];
};

export type CountryPrice = {
  id: string;
  product_id: string;
  country_code: string;
  currency: string;
  price: number;
  compare_at_price: number | null;
  is_active: boolean;
  products: { title: string; slug: string } | null;
};

export type GlobalPaymentMethodRow = {
  id: string;
  provider: string;
  label: string;
  countries: string[];
  currencies: string[];
  mode: "test" | "live";
  is_active: boolean;
  credentials_ready: boolean;
  sort_order: number;
  last_status: string | null;
  last_error: string | null;
};

export type GlobalCarrierRow = {
  id: string;
  carrier_code: string;
  label: string;
  account_number: string | null;
  mode: "test" | "live";
  is_active: boolean;
  credentials_ready: boolean;
  supports_micro_export: boolean;
  last_status: string | null;
  last_error: string | null;
};

export type CustomsProfileRow = {
  id: string;
  product_id: string;
  hs_code: string | null;
  origin_country: string;
  weight_grams: number | null;
  description_en: string | null;
  material: string | null;
  products: { title: string; slug: string } | null;
};

export type ExportDocumentRow = {
  id: string;
  order_id: string;
  kind: string;
  document_number: string;
  incoterm: "DDP" | "DDU";
  currency: string;
  total_value: number;
  payload: Record<string, unknown>;
  created_at: string;
};

export type GlobalShipmentRow = {
  id: string;
  order_id: string;
  carrier_code: string;
  service: string | null;
  tracking_number: string | null;
  incoterm: "DDP" | "DDU";
  destination_country: string | null;
  weight_grams: number | null;
  cost: number | null;
  currency: string | null;
  status: string;
  last_event: string | null;
  created_at: string;
};

export const globalSettingsQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["global-settings", storeId],
    queryFn: async (): Promise<GlobalSettings | null> => {
      const { data, error } = await supabase
        .from("store_global_settings")
        .select("*")
        .eq("store_id", storeId)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as GlobalSettings | null;
    },
  });

export const countryPricesQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["country-prices", storeId],
    queryFn: async (): Promise<CountryPrice[]> => {
      const { data, error } = await supabase
        .from("country_prices")
        .select(
          "id, product_id, country_code, currency, price, compare_at_price, is_active, products(title, slug)",
        )
        .eq("store_id", storeId)
        .order("country_code")
        .limit(500);
      if (error) throw error;
      return (data ?? []) as unknown as CountryPrice[];
    },
  });

export const globalPaymentMethodsQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["global-payment-methods", storeId],
    queryFn: async (): Promise<GlobalPaymentMethodRow[]> => {
      const { data, error } = await supabase
        .from("global_payment_methods")
        .select(
          "id, provider, label, countries, currencies, mode, is_active, credentials_ready, sort_order, last_status, last_error",
        )
        .eq("store_id", storeId)
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as unknown as GlobalPaymentMethodRow[];
    },
  });

export const globalCarriersQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["global-carriers", storeId],
    queryFn: async (): Promise<GlobalCarrierRow[]> => {
      const { data, error } = await supabase
        .from("global_carriers")
        .select(
          "id, carrier_code, label, account_number, mode, is_active, credentials_ready, supports_micro_export, last_status, last_error",
        )
        .eq("store_id", storeId)
        .order("carrier_code");
      if (error) throw error;
      return (data ?? []) as unknown as GlobalCarrierRow[];
    },
  });

export const customsProfilesQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["customs-profiles", storeId],
    queryFn: async (): Promise<CustomsProfileRow[]> => {
      const { data, error } = await supabase
        .from("customs_profiles")
        .select(
          "id, product_id, hs_code, origin_country, weight_grams, description_en, material, products(title, slug)",
        )
        .eq("store_id", storeId)
        .limit(500);
      if (error) throw error;
      return (data ?? []) as unknown as CustomsProfileRow[];
    },
  });

export const exportDocumentsQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["export-documents", storeId],
    queryFn: async (): Promise<ExportDocumentRow[]> => {
      const { data, error } = await supabase
        .from("export_documents")
        .select("id, order_id, kind, document_number, incoterm, currency, total_value, payload, created_at")
        .eq("store_id", storeId)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as unknown as ExportDocumentRow[];
    },
  });

export const globalShipmentsQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["global-shipments", storeId],
    queryFn: async (): Promise<GlobalShipmentRow[]> => {
      const { data, error } = await supabase
        .from("global_shipments")
        .select(
          "id, order_id, carrier_code, service, tracking_number, incoterm, destination_country, weight_grams, cost, currency, status, last_event, created_at",
        )
        .eq("store_id", storeId)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as unknown as GlobalShipmentRow[];
    },
  });

export const euVatRatesQuery = () =>
  queryOptions({
    queryKey: ["eu-vat-rates"],
    staleTime: 60 * 60 * 1000,
    queryFn: async (): Promise<{ country_code: string; name: string; standard_rate: number }[]> => {
      const { data, error } = await supabase
        .from("eu_vat_rates")
        .select("country_code, name, standard_rate")
        .order("name");
      if (error) throw error;
      return (data ?? []) as { country_code: string; name: string; standard_rate: number }[];
    },
  });

export const usSalesTaxRatesQuery = () =>
  queryOptions({
    queryKey: ["us-sales-tax-rates"],
    staleTime: 60 * 60 * 1000,
    queryFn: async (): Promise<{ state_code: string; name: string; rate: number }[]> => {
      const { data, error } = await supabase
        .from("us_sales_tax_rates")
        .select("state_code, name, rate")
        .order("name");
      if (error) throw error;
      return (data ?? []) as { state_code: string; name: string; rate: number }[];
    },
  });
