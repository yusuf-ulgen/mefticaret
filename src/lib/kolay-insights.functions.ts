import { requireHomeMaker } from "@/lib/home-maker-guard";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";


/**
 * Kolay Panel analitik ucu.
 *
 * Tüm sayılar veritabanındaki gerçek siparişlerden sunucuda hesaplanır.
 * İptal/iade/geri ödeme siparişleri ciroya dâhil edilmez.
 */

export type KolayInsights = {
  currency: string;
  range: { days: number };
  totals: {
    orders: number;
    paidRevenue: number;
    unpaidCount: number;
    averageBasket: number;
    newCustomers: number;
    repeatCustomers: number;
  };
  daily: { date: string; orders: number; revenue: number }[];
  topProducts: { title: string; quantity: number }[];
  topCustomers: { name: string; orders: number; spent: number }[];
  busiestHours: { hour: number; orders: number }[];
  statuses: { status: string; count: number }[];
};

const DEAD = ["cancelled", "refunded", "returned"];

export const getKolayInsights = createServerFn({ method: "GET" })
  .middleware([requireHomeMaker])
  .inputValidator((input: unknown) =>
    z
      .object({ storeId: z.string().uuid(), days: z.number().int().min(7).max(90).default(30) })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<KolayInsights> => {
    const { supabase } = context;

    const { data: store, error: storeError } = await supabase
      .from("stores")
      .select("id, currency")
      .eq("id", data.storeId)
      .maybeSingle();
    if (storeError) throw new Error(storeError.message);
    if (!store) throw new Error("Mağaza bulunamadı veya yetkiniz yok");
    const currency = (store as { currency?: string | null }).currency ?? "TRY";

    const since = new Date();
    since.setHours(0, 0, 0, 0);
    since.setDate(since.getDate() - (data.days - 1));

    const { data: orders, error } = await supabase
      .from("orders")
      .select(
        "id, grand_total, payment_status, status, placed_at, customer_name, customer_phone, customer_email, order_items(title, quantity)",
      )
      .eq("store_id", data.storeId)
      .gte("placed_at", since.toISOString())
      .limit(2000);
    if (error) throw new Error(error.message);

    const dayKeys: string[] = [];
    for (let i = 0; i < data.days; i += 1) {
      const day = new Date(since);
      day.setDate(since.getDate() + i);
      dayKeys.push(day.toISOString().slice(0, 10));
    }
    const dailyMap = new Map(dayKeys.map((key) => [key, { orders: 0, revenue: 0 }]));

    const products = new Map<string, number>();
    const customers = new Map<string, { name: string; orders: number; spent: number }>();
    const hours = new Array(24).fill(0) as number[];
    const statuses = new Map<string, number>();

    let orderCount = 0;
    let paidRevenue = 0;
    let unpaidCount = 0;

    for (const order of orders ?? []) {
      const dead = DEAD.includes(String(order.status));
      statuses.set(String(order.status), (statuses.get(String(order.status)) ?? 0) + 1);
      if (dead) continue;
      orderCount += 1;
      const paid = String(order.payment_status) === "paid";
      const total = Number(order.grand_total ?? 0);
      if (paid) paidRevenue += total;
      else unpaidCount += 1;

      if (order.placed_at) {
        const placed = new Date(order.placed_at);
        const key = order.placed_at.slice(0, 10);
        const bucket = dailyMap.get(key);
        if (bucket) {
          bucket.orders += 1;
          if (paid) bucket.revenue += total;
        }
        hours[placed.getHours()] = (hours[placed.getHours()] ?? 0) + 1;
      }

      for (const item of order.order_items ?? []) {
        products.set(item.title, (products.get(item.title) ?? 0) + Number(item.quantity ?? 0));
      }

      const key =
        (order.customer_phone ?? "").replace(/\D/g, "").slice(-10) ||
        (order.customer_email ?? "").toLowerCase() ||
        order.id;
      const current = customers.get(key) ?? {
        name: order.customer_name ?? "Müşteri",
        orders: 0,
        spent: 0,
      };
      current.orders += 1;
      if (paid) current.spent += total;
      if (order.customer_name) current.name = order.customer_name;
      customers.set(key, current);
    }

    const customerList = [...customers.values()];
    const repeatCustomers = customerList.filter((customer) => customer.orders > 1).length;

    return {
      currency,
      range: { days: data.days },
      totals: {
        orders: orderCount,
        paidRevenue,
        unpaidCount,
        averageBasket: orderCount > 0 ? paidRevenue / orderCount : 0,
        newCustomers: customerList.length - repeatCustomers,
        repeatCustomers,
      },
      daily: dayKeys.map((date) => ({
        date,
        orders: dailyMap.get(date)?.orders ?? 0,
        revenue: dailyMap.get(date)?.revenue ?? 0,
      })),
      topProducts: [...products.entries()]
        .map(([title, quantity]) => ({ title, quantity }))
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 6),
      topCustomers: customerList.sort((a, b) => b.spent - a.spent).slice(0, 6),
      busiestHours: hours
        .map((count, hour) => ({ hour, orders: count }))
        .filter((row) => row.orders > 0)
        .sort((a, b) => b.orders - a.orders)
        .slice(0, 4),
      statuses: [...statuses.entries()]
        .map(([status, count]) => ({ status, count }))
        .sort((a, b) => b.count - a.count),
    };
  });
