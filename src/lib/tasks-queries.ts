import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export type OperationTask = {
  key: string;
  label: string;
  description: string;
  count: number;
  to: string;
  tone: "danger" | "warn" | "info";
};

/** Günlük operasyon merkezi: bekleyen iş kalemlerinin sayımlarını toplar. */
export const operationTasksQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["operation-tasks", storeId],
    queryFn: async (): Promise<OperationTask[]> => {
      const head = { count: "exact" as const, head: true };

      const [
        pendingOrders,
        unfulfilled,
        unpaid,
        pendingReviews,
        openQuestions,
        openReturns,
        abandoned,
        draftProducts,
        openPurchaseOrders,
        unreadNotifications,
      ] = await Promise.all([
        supabase.from("orders").select("id", head).eq("store_id", storeId).eq("status", "pending"),
        supabase
          .from("orders")
          .select("id", head)
          .eq("store_id", storeId)
          .eq("fulfillment_status", "unfulfilled")
          .neq("status", "cancelled"),
        supabase.from("orders").select("id", head).eq("store_id", storeId).eq("payment_status", "pending"),
        supabase.from("product_reviews").select("id", head).eq("store_id", storeId).eq("status", "pending"),
        supabase.from("product_questions").select("id", head).eq("store_id", storeId).is("answer", null),
        supabase
          .from("return_requests")
          .select("id", head)
          .eq("store_id", storeId)
          .in("status", ["requested", "approved", "received"]),
        supabase
          .from("abandoned_carts")
          .select("id", head)
          .eq("store_id", storeId)
          .is("recovered_order_id", null)
          .gte("last_seen_at", new Date(Date.now() - 7 * 86_400_000).toISOString()),
        supabase.from("products").select("id", head).eq("store_id", storeId).eq("status", "draft"),
        supabase.from("purchase_orders").select("id", head).eq("store_id", storeId).neq("status", "received"),
        supabase.from("notifications").select("id", head).eq("store_id", storeId).eq("is_read", false),
      ]);

      const lowStock = await supabase
        .from("product_variants")
        .select("id, stock, low_stock_threshold")
        .eq("store_id", storeId)
        .limit(5000);
      if (lowStock.error) throw lowStock.error;
      const lowStockCount = (lowStock.data ?? []).filter(
        (row) => Number(row.stock ?? 0) <= Number(row.low_stock_threshold ?? 0),
      ).length;

      const num = (result: { count: number | null }) => Number(result.count ?? 0);

      return [
        {
          key: "pending-orders",
          label: "Onay bekleyen sipariş",
          description: "Durumu hâlâ beklemede olan siparişleri işleyin.",
          count: num(pendingOrders),
          to: `/store/${storeId}/orders`,
          tone: "danger",
        },
        {
          key: "unfulfilled",
          label: "Kargolanmamış sipariş",
          description: "Sevkiyat oluşturulmayı bekleyen siparişler.",
          count: num(unfulfilled),
          to: `/store/${storeId}/shipments`,
          tone: "danger",
        },
        {
          key: "unpaid",
          label: "Ödemesi bekleyen sipariş",
          description: "Tahsilatı tamamlanmamış siparişleri kontrol edin.",
          count: num(unpaid),
          to: `/store/${storeId}/orders`,
          tone: "warn",
        },
        {
          key: "returns",
          label: "Açık iade talebi",
          description: "Sonuçlandırılmayı bekleyen iade süreçleri.",
          count: num(openReturns),
          to: `/store/${storeId}/returns`,
          tone: "warn",
        },
        {
          key: "low-stock",
          label: "Kritik stok varyantı",
          description: "Eşiğin altına düşen varyantlar için sipariş planlayın.",
          count: lowStockCount,
          to: `/store/${storeId}/reorder`,
          tone: "danger",
        },
        {
          key: "purchase-orders",
          label: "Açık satın alma siparişi",
          description: "Mal kabulü tamamlanmamış tedarik siparişleri.",
          count: num(openPurchaseOrders),
          to: `/store/${storeId}/purchasing`,
          tone: "info",
        },
        {
          key: "reviews",
          label: "Onay bekleyen değerlendirme",
          description: "Moderasyon bekleyen ürün yorumları.",
          count: num(pendingReviews),
          to: `/store/${storeId}/reviews`,
          tone: "warn",
        },
        {
          key: "questions",
          label: "Cevaplanmayan soru",
          description: "Müşteri sorularını yanıtlayarak dönüşümü artırın.",
          count: num(openQuestions),
          to: `/store/${storeId}/questions`,
          tone: "warn",
        },
        {
          key: "abandoned",
          label: "Son 7 günün terk sepetleri",
          description: "Kurtarma iletişimi yapılabilecek sepetler.",
          count: num(abandoned),
          to: `/store/${storeId}/carts`,
          tone: "info",
        },
        {
          key: "draft-products",
          label: "Taslak ürün",
          description: "Yayına alınmayı bekleyen ürün kayıtları.",
          count: num(draftProducts),
          to: `/store/${storeId}/products`,
          tone: "info",
        },
        {
          key: "notifications",
          label: "Okunmamış bildirim",
          description: "Mağaza bildirim akışını gözden geçirin.",
          count: num(unreadNotifications),
          to: `/store/${storeId}/notifications`,
          tone: "info",
        },
      ];
    },
  });
