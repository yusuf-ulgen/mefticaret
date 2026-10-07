import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

/** Next-Gen Innovation & FinTech Pack okuma sorguları (RLS ile mağazaya kapalı). */

export type ShoppableVideoRow = {
  id: string;
  product_id: string | null;
  title: string;
  video_url: string;
  thumbnail_url: string | null;
  source: "upload" | "tiktok" | "instagram" | "youtube";
  placement: "home" | "pdp" | "both";
  is_active: boolean;
  sort_order: number;
  views: number;
  product_clicks: number;
};

export type UgcPostRow = {
  id: string;
  product_id: string | null;
  source: "instagram" | "tiktok" | "manual";
  author_handle: string | null;
  media_url: string;
  permalink: string | null;
  caption: string | null;
  likes: number;
  status: "pending" | "approved" | "rejected";
  created_at: string;
};

export type PaymentRouteRow = {
  id: string;
  provider: string;
  label: string;
  bin_prefixes: string[];
  card_networks: string[];
  fee_percent: number;
  fee_fixed: number;
  approval_rate: number;
  priority: number;
  is_active: boolean;
};

export type RouteDecisionRow = {
  id: string;
  order_id: string | null;
  route_id: string | null;
  bin_prefix: string | null;
  amount: number;
  currency: string;
  chosen_fee: number;
  baseline_fee: number;
  saved_amount: number;
  created_at: string;
};

export type CheckoutAddonRow = {
  id: string;
  kind: "warranty" | "insurance" | "carbon";
  name: string;
  description: string | null;
  months: number | null;
  price_type: "percent" | "fixed";
  price_value: number;
  min_order_total: number;
  currency: string;
  is_active: boolean;
};

export type FraudAssessmentRow = {
  id: string;
  order_id: string;
  score: number;
  level: "low" | "medium" | "high";
  signals: { code: string; label: string; weight: number }[];
  status: "pending" | "cleared" | "blocked";
  created_at: string;
  orders: { order_number: string; grand_total: number; currency: string; payment_status: string } | null;
};

export type ArAssetRow = {
  id: string;
  product_id: string;
  model_url: string | null;
  usdz_url: string | null;
  poster_url: string | null;
  scale_hint: string | null;
  is_active: boolean;
};

export const shoppableVideosQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["shoppable-videos", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shoppable_videos")
        .select(
          "id, product_id, title, video_url, thumbnail_url, source, placement, is_active, sort_order, views, product_clicks",
        )
        .eq("store_id", storeId)
        .order("sort_order", { ascending: true })
        .limit(120);
      if (error) throw error;
      return (data ?? []) as ShoppableVideoRow[];
    },
  });

export const ugcPostsQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["ugc-posts", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ugc_posts")
        .select(
          "id, product_id, source, author_handle, media_url, permalink, caption, likes, status, created_at",
        )
        .eq("store_id", storeId)
        .order("created_at", { ascending: false })
        .limit(150);
      if (error) throw error;
      return (data ?? []) as UgcPostRow[];
    },
  });

export const paymentRoutesQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["payment-routes", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payment_routes")
        .select(
          "id, provider, label, bin_prefixes, card_networks, fee_percent, fee_fixed, approval_rate, priority, is_active",
        )
        .eq("store_id", storeId)
        .order("priority", { ascending: false });
      if (error) throw error;
      return (data ?? []) as PaymentRouteRow[];
    },
  });

export const routeDecisionsQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["payment-route-decisions", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payment_route_decisions")
        .select("id, order_id, route_id, bin_prefix, amount, currency, chosen_fee, baseline_fee, saved_amount, created_at")
        .eq("store_id", storeId)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as RouteDecisionRow[];
    },
  });

export const checkoutAddonsQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["checkout-addons", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("checkout_addons")
        .select(
          "id, kind, name, description, months, price_type, price_value, min_order_total, currency, is_active",
        )
        .eq("store_id", storeId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as CheckoutAddonRow[];
    },
  });

export const fraudAssessmentsQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["fraud-assessments", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fraud_assessments")
        .select(
          "id, order_id, score, level, signals, status, created_at, orders(order_number, grand_total, currency, payment_status)",
        )
        .eq("store_id", storeId)
        .order("score", { ascending: false })
        .limit(150);
      if (error) throw error;
      return (data ?? []) as unknown as FraudAssessmentRow[];
    },
  });

export const arAssetsQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["product-ar-assets", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_ar_assets")
        .select("id, product_id, model_url, usdz_url, poster_url, scale_hint, is_active")
        .eq("store_id", storeId)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as ArAssetRow[];
    },
  });
