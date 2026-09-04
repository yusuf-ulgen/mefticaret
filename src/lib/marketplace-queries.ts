import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export type SellerStatus = "pending" | "approved" | "rejected" | "suspended";
export type PayoutRequestStatus = "pending" | "processing" | "paid" | "failed";

export const SELLER_STATUS_LABELS: Record<SellerStatus, string> = {
  pending: "Başvuru bekliyor",
  approved: "Onaylı",
  rejected: "Reddedildi",
  suspended: "Askıda",
};

export const PAYOUT_REQUEST_LABELS: Record<PayoutRequestStatus, string> = {
  pending: "Talep alındı",
  processing: "İşleniyor",
  paid: "Ödendi",
  failed: "Başarısız",
};

/**
 * Satıcı finansal alanları (IBAN, vergi no) tarayıcıya hiç gönderilmez:
 * bu kolonların okuma yetkisi `authenticated` rolünden kaldırıldı.
 */
export const SELLER_SAFE_COLUMNS =
  "id, store_id, user_id, display_name, legal_name, email, phone, about, commission_rate, status, rejection_reason, approved_at, suspended_at, created_at";

export type SellerRow = {
  id: string;
  store_id: string;
  user_id: string;
  display_name: string;
  legal_name: string | null;
  email: string | null;
  phone: string | null;
  about: string | null;
  commission_rate: number;
  status: SellerStatus;
  rejection_reason: string | null;
  approved_at: string | null;
  suspended_at: string | null;
  created_at: string;
};

export type PayoutRequestRow = {
  id: string;
  store_id: string;
  seller_id: string;
  amount: number;
  currency: string;
  iban: string | null;
  note: string | null;
  admin_note: string | null;
  status: PayoutRequestStatus;
  processed_at: string | null;
  created_at: string;
};

/** Mağazanın pazaryeri satıcıları — RLS: yönetici tümünü, satıcı kendisini görür. */
export const sellersQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["marketplace-sellers", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("marketplace_sellers")
        .select(SELLER_SAFE_COLUMNS)
        .eq("store_id", storeId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as SellerRow[];
    },
  });

/** Kullanıcının kendi satıcı hesapları (tüm mağazalarda). */
export const mySellerAccountsQuery = (userId: string | null) =>
  queryOptions({
    queryKey: ["my-seller-accounts", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("marketplace_sellers")
        .select(`${SELLER_SAFE_COLUMNS}, stores(id, name, slug)`)
        .eq("user_id", userId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as (SellerRow & {
        stores: { id: string; name: string; slug: string } | null;
      })[];
    },
  });

export const sellerQuery = (sellerId: string) =>
  queryOptions({
    queryKey: ["marketplace-seller", sellerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("marketplace_sellers")
        .select(`${SELLER_SAFE_COLUMNS}, stores(id, name, slug)`)
        .eq("id", sellerId)
        .single();
      if (error) throw error;
      return data as unknown as SellerRow & {
        stores: { id: string; name: string; slug: string } | null;
      };
    },
  });

export type SellerProductRow = {
  id: string;
  title: string;
  slug: string;
  status: string;
  base_price: number;
  currency: string;
  seller_id: string | null;
  product_variants: {
    id: string;
    title: string;
    sku: string | null;
    price: number;
    stock: number;
  }[];
};

/** Satıcının ürünleri ve varyant stokları. */
export const sellerProductsQuery = (sellerId: string) =>
  queryOptions({
    queryKey: ["seller-products", sellerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select(
          "id, title, slug, status, base_price, currency, seller_id, product_variants(id, title, sku, price, stock)",
        )
        .eq("seller_id", sellerId)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as unknown as SellerProductRow[];
    },
  });

/** Mağazanın satıcıya atanabilir ürünleri (yönetici görünümü). */
export const storeProductsForAssignmentQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["store-products-assignment", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, title, seller_id, status")
        .eq("store_id", storeId)
        .order("title", { ascending: true })
        .limit(1000);
      if (error) throw error;
      return (data ?? []) as unknown as {
        id: string;
        title: string;
        seller_id: string | null;
        status: string;
      }[];
    },
  });

export type SellerOrderLine = {
  order_id: string;
  order_number: string;
  status: string;
  placed_at: string;
  currency: string;
  title: string;
  variant_title: string | null;
  quantity: number;
  line_total: number;
};

/** Satıcının sipariş kalemleri — RLS ile yalnızca kendi ürünlerini içeren siparişler. */
export const sellerOrderLinesQuery = (sellerId: string, storeId: string) =>
  queryOptions({
    queryKey: ["seller-order-lines", sellerId],
    queryFn: async (): Promise<SellerOrderLine[]> => {
      const { data, error } = await supabase
        .from("order_items")
        .select(
          "order_id, title, variant_title, quantity, line_total, products!inner(seller_id), orders(order_number, status, placed_at, currency)",
        )
        .eq("store_id", storeId)
        .eq("products.seller_id", sellerId)
        .order("created_at", { ascending: false })
        .limit(2000);
      if (error) throw error;

      return (data ?? []).map((row) => {
        const item = row as unknown as {
          order_id: string;
          title: string;
          variant_title: string | null;
          quantity: number;
          line_total: number;
          orders: {
            order_number: string;
            status: string;
            placed_at: string;
            currency: string;
          } | null;
        };
        return {
          order_id: item.order_id,
          order_number: item.orders?.order_number ?? "—",
          status: item.orders?.status ?? "pending",
          placed_at: item.orders?.placed_at ?? "",
          currency: item.orders?.currency ?? "TRY",
          title: item.title,
          variant_title: item.variant_title,
          quantity: Number(item.quantity ?? 0),
          line_total: Number(item.line_total ?? 0),
        };
      });
    },
  });

export const sellerPayoutRequestsQuery = (sellerId: string) =>
  queryOptions({
    queryKey: ["seller-payout-requests", sellerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("seller_payout_requests")
        .select("*")
        .eq("seller_id", sellerId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as PayoutRequestRow[];
    },
  });

export const storePayoutRequestsQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["store-payout-requests", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("seller_payout_requests")
        .select("*, marketplace_sellers(id, display_name)")
        .eq("store_id", storeId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as (PayoutRequestRow & {
        marketplace_sellers: { id: string; display_name: string } | null;
      })[];
    },
  });

export type SellerEarnings = {
  revenue: number;
  units: number;
  orders: number;
  commissionRate: number;
  commission: number;
  net: number;
  paid: number;
  pending: number;
  available: number;
};

/** Satış, komisyon, kazanç ve çekilebilir bakiye hesabı. */
export function computeSellerEarnings(
  lines: SellerOrderLine[],
  commissionRate: number,
  requests: PayoutRequestRow[],
): SellerEarnings {
  const revenue = lines.reduce((sum, line) => sum + line.line_total, 0);
  const units = lines.reduce((sum, line) => sum + line.quantity, 0);
  const orders = new Set(lines.map((line) => line.order_id)).size;
  const commission = revenue * commissionRate;
  const net = revenue - commission;
  const paid = requests
    .filter((request) => request.status === "paid")
    .reduce((sum, request) => sum + Number(request.amount), 0);
  const pending = requests
    .filter((request) => request.status === "pending" || request.status === "processing")
    .reduce((sum, request) => sum + Number(request.amount), 0);

  return {
    revenue,
    units,
    orders,
    commissionRate,
    commission,
    net,
    paid,
    pending,
    available: Math.max(0, net - paid - pending),
  };
}
